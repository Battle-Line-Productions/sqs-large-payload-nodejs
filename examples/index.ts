// build example
import { SqsLargePayloadService, ISqsServiceOptions, ISqsLargePayloadService } from '@battleline/sqs-large-payload-nodejs';

const sqsOptions: ISqsServiceOptions = {
    s3EndpointUrl: 'string',
    s3BucketName: 'string',
    region: 'us-east-2'
};

const sqs: ISqsLargePayloadService = new SqsLargePayloadService(sqsOptions);

sqs