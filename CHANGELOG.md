# Changelog

## 2.0.0

### Breaking Changes

- **AWS SDK v3**: Migrated from `aws-sdk` (v2) to `@aws-sdk/client-sqs` and `@aws-sdk/client-s3`. You must install these as peer dependencies.
- **No more Inversify**: Removed `inversify` and `reflect-metadata` dependencies. The class is now a plain constructor — no decorators needed.
- **Default max message size changed from 256 KiB to 1 MiB**: AWS increased the SQS limit. The default threshold now matches the current limit.
- **Method names changed to camelCase**: `SendMessage` -> `sendMessage`, `ProcessReceivedMessage` -> `processReceivedMessage`, `GetQueueUrl` -> `getQueueUrl`.
- **Return types changed**: `sendMessage()` now returns `SendMessageOutput` (`{ messageId, s3Key? }`) instead of the raw SDK `SendMessageResult`.
- **Typed errors**: Throws `MissingQueueError`, `QueueUrlResolutionError`, `S3PayloadError` instead of generic `Error`.
- **Node 18+ required**: Dropped support for Node < 18.
- **ESM-first**: Package is now ESM with a CJS fallback.
- **Options changes**: `s3DeleteAfterLoad` now defaults to `false` (was required). Added `queueUrl` option.

### New Features

- **Queue URL passthrough**: You can now pass a queue URL directly (e.g., `https://sqs...`) to any method, skipping the `GetQueueUrl` API call.
- **Batch send**: New `sendMessageBatch()` method for sending up to 10 messages at once.
- **Typed errors**: Catch specific error types for better error handling.

### Migration Guide

1. Install SDK v3 clients:
   ```bash
   npm install @aws-sdk/client-sqs @aws-sdk/client-s3
   npm uninstall aws-sdk inversify reflect-metadata nanoid source-map-support tslib
   ```

2. Update client initialization:
   ```typescript
   // Before (v1)
   import AWS from "aws-sdk";
   const sqs = new SqsLargePayloadService({
     sqsClient: new AWS.SQS(),
     s3Client: new AWS.S3(),
     // ...
   });

   // After (v2)
   import { SQSClient } from "@aws-sdk/client-sqs";
   import { S3Client } from "@aws-sdk/client-s3";
   const sqs = new SqsLargePayloadService({
     sqsClient: new SQSClient({ region: "us-east-2" }),
     s3Client: new S3Client({ region: "us-east-2" }),
     // ...
   });
   ```

3. Update method calls (camelCase):
   ```typescript
   // Before
   await sqs.SendMessage(body, "queue");
   await sqs.ProcessReceivedMessage(body);
   await sqs.GetQueueUrl("queue");

   // After
   await sqs.sendMessage(body, "queue");
   await sqs.processReceivedMessage(body);
   await sqs.getQueueUrl("queue");
   ```

4. Update error handling:
   ```typescript
   import { S3PayloadError, MissingQueueError } from "@battleline/sqs-large-payload-nodejs";
   ```
