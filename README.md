# sqs-large-payload-nodejs

[![Coverage Status](https://coveralls.io/repos/github/Battle-Line-Productions/sqs-large-payload-nodejs/badge.svg?branch=main)](https://coveralls.io/github/Battle-Line-Productions/sqs-large-payload-nodejs?branch=main)

When sending messages to amazon SQS that are larger then 256KB it is rejected due to hard amazon limits on SQS. Amazon provided a solution for this in their JAVA SDK by uploading messages larger in size to an S3 bucket but provided no solution for their Javascript SDK.

While their are some npm packages out there already that help with this issue, none of them work with AWS Lambda or any event driven architecture that has already aquired the message from the queue.

This package works by exposing the processing logic for that message seperately and simply returns to you the message that was sent to either the SQS queue initially or to the S3 bucket based on its size.

## Installation
    - npm install @battleline/sqs-large-payload-nodejs
    or
    - yarn add @battleline/sqs-large-payload-nodejs

## Usage

This library is super simple and exports a sqs.service that has two primary functions exposed.

- SendMessage - Accepts a object of any type or string message and a optional queue name. 
- ProcessReceivedMessage - Takes in the SQS message body and will either return the message to you or get a message from S3 and return the S3 body to you.


### IAM Permissions

**S3 Permissions**

- s3:putObject
- s3:getObject
- s3:deleteObject - Required only if you choose true on s3DeleteAfterLoad option

**SQS Permissions**

- sqs:GetQueueUrl
- sqs:SendMessage

### Setup

```javascript
import AWS from 'aws-sdk';
const sqsHandler = require('@battleline/sqs-large-payload-nodejs');

const options = {
    s3BucketName: 'nameOfBucketHere',
    region: 'us-east-2', // or any other region here
    s3DeleteAfterLoad: false,  // If true, will delete the item from s3 after download. Does not return to s3 if message fails to process
    maxMessageSize: 262144,  // 256Kb by default. Can be set lower then this but now higher due to SQS hard limitation
    queueName: 'queueName', // Can optionally set it here or when calling send message
    sqsClient: new AWS.SQS(),  // optionally you can pass in your own SQS Client or we will create one when needed
    s3Client: new AWS.S3() // optionally you can apss in your own s3 client or we will create one when needed
};


const sqs = new sqsHandler.SqsLargePayloadService(options);

```

### Send Message

```javascript

const objectThingy = {
    someKey: 'someValue'
};

await sqs.SendMessage(objectThingy);

// or
await sqs.SendMessage("we can take strings also");

//or
await sqs.SendMessage("object or string here", "queueName will override from options");

```

### ProcessReceivedMessage

```javascript

// received stringified message from lambda event

const event = {
    Records: [
        {
            Body: "{ message: 'some message here' }"
        }
    ]
};

const expectedResultFromQeueu = await sqs.ProcessReceivedMessage(event.Records[0].Body).message;

```