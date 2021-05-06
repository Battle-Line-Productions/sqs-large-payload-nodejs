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

### Setup

```javascript

```

### Send Message

```javascript

```

### ProcessReceivedMessage

```javascript

```