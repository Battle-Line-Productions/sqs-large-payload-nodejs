import 'reflect-metadata';
import { S3, SQS } from 'aws-sdk';
import { injectable } from 'inversify';
import { nanoid } from 'nanoid';
import { ISqsLargePayloadService, ISqsServiceOptions, SqsServiceMessageSize } from '../interfaces';

@injectable()
export class SqsLargePayloadService implements ISqsLargePayloadService {
  private region: string;
  private s3Bucket: string;
  private queueName?: string;
  private maxMessageSize?: number;
  private s3Client?: S3;
  private sqsClient?: SQS;
  private s3DeleteAfterLoad: boolean;

  constructor(options: ISqsServiceOptions) {
    this.region = options.region;
    this.s3Bucket = options.s3BucketName;
    this.queueName = options.queueName;
    this.maxMessageSize = options.maxMessageSize;
    this.s3Client = options.s3Client;
    this.sqsClient = options.sqsClient;
    this.s3DeleteAfterLoad = options.s3DeleteAfterLoad;
  }

  private getInstanceSqs(): SQS {
    if (this.sqsClient) {
      return this.sqsClient;
    }

    const sqsConfig: SQS.ClientConfiguration = {
      region: this.region
    };

    return new SQS(sqsConfig);
  }

  private getInstanceS3(): S3 {
    if (this.s3Client) {
      return this.s3Client;
    }

    const s3Config: S3.ClientConfiguration = {
      s3ForcePathStyle: true,
      region: this.region
    };

    return new S3(s3Config);
  }

  public async GetQueueUrl(queueName?: string): Promise<string> {
    const name = queueName ? queueName : this.queueName ? this.queueName : '';

    console.log(`The queue name is ${name}`);

    if (name === '') {
      throw new Error(`Missing Queue Name`);
    }

    const { QueueUrl } = await this.getInstanceSqs().getQueueUrl({ QueueName: name }).promise();

    if (!QueueUrl) {
      throw new Error(`Unable to determine Queue url from provided name of ${queueName}`);
    }

    console.log(`The QueueUrl is ${QueueUrl}`);

    return QueueUrl;
  }

  public async SendMessage<T>(body: T, queueName?: string): Promise<SQS.SendMessageResult> {
    const messageString = JSON.stringify({ message: body });
    const msgSize = Buffer.byteLength(messageString, 'utf-8');
    const queueUrl = await this.GetQueueUrl(queueName);

    const messageSize = this.maxMessageSize || SqsServiceMessageSize.MAX_SQS_MESSAGE_SIZE;

    if (msgSize < messageSize) {
      const messageConfig = {
        QueueUrl: queueUrl,
        MessageBody: messageString
      };

      return await this.getInstanceSqs().sendMessage(messageConfig).promise();
    }

    const keyId = nanoid();
    const payloadId = `${keyId}.json`;

    console.log(`Writing message to bucket ${this.s3Bucket}`);
    await this.getInstanceS3()
      .putObject({
        Bucket: this.s3Bucket,
        Body: messageString,
        Key: payloadId
      })
      .promise()
      .catch((err) => {
        console.log(`S3 Threw the following error: ${err}`);
        throw new Error(err);
      });

    const messageConfig = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        S3Payload: {
          Key: payloadId,
        }
      })
    };

    return await this.getInstanceSqs().sendMessage(messageConfig).promise();
  }

  public async ProcessReceivedMessage(messageBody: string): Promise<string> {
    if (JSON.parse(messageBody).S3Payload) {
      const s3Object = await this.getInstanceS3()
        .getObject({
          Bucket: this.s3Bucket,
          Key: JSON.parse(messageBody).S3Payload.Key
        })
        .promise();

      if (!s3Object || !s3Object.Body) {
        throw new Error(`Message has a S3 Payload but no File found matching payload name in S3 Bucket`);
      }

      if (this.s3DeleteAfterLoad) {
        await this.getInstanceS3().deleteObject({ Bucket: this.s3Bucket, Key: JSON.parse(messageBody).S3Payload.Key });
      }

      return s3Object.Body.toString();
    }

    return messageBody;
  }
}
