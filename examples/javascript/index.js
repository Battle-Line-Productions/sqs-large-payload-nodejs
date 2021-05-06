// build example
const SQS = require('@battleline/sqs-large-payload-nodejs');

const sqsOptions = {
    s3EndpointUrl: 'string',
    s3BucketName: 'string',
    region: 'us-east-2'
};

const sqs = new SQS(sqsOptions);
