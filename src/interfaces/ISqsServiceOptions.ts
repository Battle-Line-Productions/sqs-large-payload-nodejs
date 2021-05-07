import { S3, SQS } from "aws-sdk";

export interface ISqsServiceOptions {
    s3BucketName: string,
    maxMessageSize?: number,
    queueName?: string,
    region: string,
    s3Client?: S3,
    sqsClient?: SQS,
    s3DeleteAfterLoad: boolean
}
