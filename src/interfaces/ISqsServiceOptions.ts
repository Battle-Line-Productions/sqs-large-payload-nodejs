import { S3, SQS } from "aws-sdk";

export interface ISqsServiceOptions {
    s3EndpointUrl: string,
    s3BucketName: string,
    maxMessageSize?: number,
    queueName?: string,
    region: string,
    sqsEndpoint?: string
    s3Client?: S3,
    sqsClient?: SQS
}
