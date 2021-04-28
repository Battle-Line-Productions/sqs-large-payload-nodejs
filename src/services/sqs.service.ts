import 'reflect-metadata';
import { S3, SQS } from 'aws-sdk';
import { injectable } from 'inversify';
import { nanoid } from 'nanoid';
import { ISqsLargePayloadService, ISqsServiceOptions, SqsServiceMessageSize } from '../interfaces';

@injectable()
export class SqsLargePayloadService implements ISqsLargePayloadService {
  private region: string;
  private queueName?: string;
  private maxMessageSize?: number;
  private s3EndpointUrl: string;
  private s3Bucket: string;
  private sqsEndpoint?: string;
  private s3Client?: S3;
  private sqsClient?: SQS;

  constructor(options: ISqsServiceOptions) {
    this.region = options.region;
    this.queueName = options.queueName;
    this.maxMessageSize = options.maxMessageSize;
    this.s3EndpointUrl = options.s3EndpointUrl;
    this.s3Bucket = options.s3BucketName;
    this.sqsEndpoint = options.sqsEndpoint;
    this.s3Client = options.s3Client;
    this.sqsClient = options.sqsClient;
  }

  private getInstanceSqs(): SQS {
    if (this.sqsClient) {
      return this.sqsClient;
    }

    const sqsConfig = {
      region: this.region,
      endpoint: this.sqsEndpoint
    };

    if (!this.sqsEndpoint) {
      delete sqsConfig.endpoint;
    }

    return new SQS(sqsConfig);
  }

  private getInstanceS3(): S3 {
    if (this.s3Client) {
      return this.s3Client;
    }

    const s3Config = {
      s3ForcePathStyle: true,
      signatureVersion: 'v2',
      region: this.region,
      endpoint: this.s3EndpointUrl
    };

    return new S3(s3Config);
  }

  public async getQueueUrl(queueName?: string): Promise<string> {
    const name = queueName ? queueName : this.queueName ? this.queueName : '';

    const { QueueUrl } = await this.getInstanceSqs().getQueueUrl({ QueueName: name }).promise();

    if (!QueueUrl) {
      throw new Error(`Unable to determine Queue url from provided name of ${queueName}`);
    }

    return QueueUrl;
  }

  public async SendMessage<T>(body: T, queueName?: string): Promise<any> {
    const messageString = JSON.stringify({ message: body });
    const msgSize = Buffer.byteLength(messageString, 'utf-8');
    const queueUrl = await this.getQueueUrl(queueName);

    const messageSize = this.maxMessageSize || SqsServiceMessageSize.MAX_SQS_MESSAGE_SIZE;

    if (msgSize < messageSize) {
      const messageConfig = {
        QueueUrl: queueUrl,
        MessageBody: messageString
      };

      return this.getInstanceSqs().sendMessage(messageConfig).promise();
    }

    const keyId = nanoid();
    const payloadId = `${keyId}.json`;

    const responseBucket = await this.getInstanceS3()
      .upload({
        Bucket: this.s3Bucket,
        Body: messageString,
        Key: payloadId
      })
      .promise();

    const messageConfig = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({
        S3Payload: {
          Id: payloadId,
          Key: responseBucket.Key,
          Location: responseBucket.Location
        }
      })
    };

    return this.getInstanceSqs().sendMessage(messageConfig).promise();
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

      return s3Object.Body.toString();
    }

    return messageBody;
  }
}
