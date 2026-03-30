import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetQueueUrlCommand, SQSClient, SendMessageBatchCommand, SendMessageCommand } from "@aws-sdk/client-sqs";
import { MissingQueueError, QueueUrlResolutionError, S3PayloadError } from "./errors.js";
import type {
  SendMessageBatchEntry,
  SendMessageBatchResultEntry,
  SendMessageOutput,
  SqsServiceOptions,
} from "./types.js";
import { DEFAULT_MAX_MESSAGE_SIZE } from "./types.js";

export class SqsLargePayloadService {
  private readonly region: string;
  private readonly s3Bucket: string;
  private readonly queueName?: string;
  private readonly queueUrl?: string;
  private readonly maxMessageSize: number;
  private readonly s3DeleteAfterLoad: boolean;
  private readonly sqsClient: SQSClient;
  private readonly s3Client: S3Client;

  constructor(options: SqsServiceOptions) {
    this.region = options.region;
    this.s3Bucket = options.s3BucketName;
    this.queueName = options.queueName;
    this.queueUrl = options.queueUrl;
    this.maxMessageSize = options.maxMessageSize ?? DEFAULT_MAX_MESSAGE_SIZE;
    this.s3DeleteAfterLoad = options.s3DeleteAfterLoad ?? false;
    this.sqsClient = options.sqsClient ?? new SQSClient({ region: this.region });
    this.s3Client = options.s3Client ?? new S3Client({ region: this.region, forcePathStyle: true });
  }

  /**
   * Resolve a queue URL. Accepts a URL directly (starts with "http") or a queue name.
   * Falls back to constructor-level queueUrl, then queueName.
   */
  async getQueueUrl(queueNameOrUrl?: string): Promise<string> {
    const input = queueNameOrUrl ?? this.queueUrl ?? this.queueName;

    if (!input) {
      throw new MissingQueueError();
    }

    // If it looks like a URL, return it directly
    if (input.startsWith("http")) {
      return input;
    }

    const result = await this.sqsClient.send(new GetQueueUrlCommand({ QueueName: input }));

    if (!result.QueueUrl) {
      throw new QueueUrlResolutionError(input);
    }

    return result.QueueUrl;
  }

  /**
   * Send a single message. Offloads to S3 if the serialized size exceeds maxMessageSize.
   */
  async sendMessage<T>(body: T, queueNameOrUrl?: string): Promise<SendMessageOutput> {
    const messageString = JSON.stringify({ message: body });
    const msgSize = Buffer.byteLength(messageString, "utf-8");
    const queueUrl = await this.getQueueUrl(queueNameOrUrl);

    if (msgSize < this.maxMessageSize) {
      const result = await this.sqsClient.send(
        new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: messageString }),
      );
      return { messageId: result.MessageId };
    }

    const s3Key = `${randomUUID()}.json`;
    await this.uploadToS3(s3Key, messageString);

    const result = await this.sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({ S3Payload: { Key: s3Key } }),
      }),
    );

    return { messageId: result.MessageId, s3Key };
  }

  /**
   * Send up to 10 messages in a batch. Each entry that exceeds the size limit is
   * individually offloaded to S3.
   */
  async sendMessageBatch<T>(
    entries: SendMessageBatchEntry<T>[],
    queueNameOrUrl?: string,
  ): Promise<SendMessageBatchResultEntry[]> {
    const queueUrl = await this.getQueueUrl(queueNameOrUrl);
    const s3Keys = new Map<string, string>();

    const sqsEntries = await Promise.all(
      entries.map(async (entry) => {
        const messageString = JSON.stringify({ message: entry.body });
        const msgSize = Buffer.byteLength(messageString, "utf-8");

        if (msgSize < this.maxMessageSize) {
          return { Id: entry.id, MessageBody: messageString };
        }

        const s3Key = `${randomUUID()}.json`;
        await this.uploadToS3(s3Key, messageString);
        s3Keys.set(entry.id, s3Key);

        return {
          Id: entry.id,
          MessageBody: JSON.stringify({ S3Payload: { Key: s3Key } }),
        };
      }),
    );

    const result = await this.sqsClient.send(new SendMessageBatchCommand({ QueueUrl: queueUrl, Entries: sqsEntries }));

    return (result.Successful ?? []).map((s) => ({
      id: s.Id ?? "",
      messageId: s.MessageId,
      s3Key: s3Keys.get(s.Id ?? ""),
    }));
  }

  /**
   * Process a received SQS message body. If it contains an S3 reference, fetches
   * the payload from S3 (and optionally deletes it).
   */
  async processReceivedMessage(messageBody: string): Promise<string> {
    const parsed = JSON.parse(messageBody);

    if (!parsed.S3Payload) {
      return messageBody;
    }

    const key: string = parsed.S3Payload.Key;

    const s3Object = await this.s3Client.send(new GetObjectCommand({ Bucket: this.s3Bucket, Key: key }));

    if (!s3Object.Body) {
      throw new S3PayloadError("Message has an S3Payload reference but no object was found in the bucket");
    }

    const bodyString = await s3Object.Body.transformToString();

    if (this.s3DeleteAfterLoad) {
      await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.s3Bucket, Key: key }));
    }

    return bodyString;
  }

  private async uploadToS3(key: string, body: string): Promise<void> {
    try {
      await this.s3Client.send(new PutObjectCommand({ Bucket: this.s3Bucket, Body: body, Key: key }));
    } catch (err) {
      throw new S3PayloadError(`Failed to upload payload to S3: ${err}`, { cause: err });
    }
  }
}
