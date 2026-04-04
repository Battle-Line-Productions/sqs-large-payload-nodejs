# sqs-large-payload-nodejs

[![CI](https://github.com/Battle-Line-Productions/sqs-large-payload-nodejs/actions/workflows/ci.yml/badge.svg)](https://github.com/Battle-Line-Productions/sqs-large-payload-nodejs/actions/workflows/ci.yml)

Transparently offload large SQS messages to S3 when they exceed the size limit. Built for AWS SDK v3.

SQS has a maximum message size of **1 MiB**. This library automatically uploads messages larger than that threshold to S3, and sends a lightweight reference through SQS instead. On the receiving side, it detects the reference and fetches the original payload from S3.

## Installation

```bash
npm install @battleline/sqs-large-payload-nodejs @aws-sdk/client-sqs @aws-sdk/client-s3
```

> **Note:** `@aws-sdk/client-sqs` and `@aws-sdk/client-s3` are **peer dependencies** — you bring your own SDK v3 clients.

## Quick Start

```typescript
import { SqsLargePayloadService } from "@battleline/sqs-large-payload-nodejs";

const sqs = new SqsLargePayloadService({
  region: "us-east-2",
  s3BucketName: "my-payload-bucket",
  queueUrl: "https://sqs.us-east-2.amazonaws.com/123456789/my-queue",
});

// Send a message (automatically offloads to S3 if > 1 MiB)
const result = await sqs.sendMessage({ key: "value" });
console.log(result.messageId);

// Process a received message (transparently fetches from S3 if needed)
const body = await sqs.processReceivedMessage(event.Records[0].body);
```

## API

### `new SqsLargePayloadService(options)`

| Option              | Type       | Required | Default | Description |
|---------------------|------------|----------|---------|-------------|
| `region`            | `string`   | Yes      |         | AWS region |
| `s3BucketName`      | `string`   | Yes      |         | S3 bucket for large payloads |
| `queueUrl`          | `string`   | No       |         | SQS queue URL (preferred over `queueName`) |
| `queueName`         | `string`   | No       |         | SQS queue name (resolved via `GetQueueUrl`) |
| `maxMessageSize`    | `number`   | No       | 1 MiB   | Byte threshold for S3 offload |
| `s3DeleteAfterLoad` | `boolean`  | No       | `false` | Delete S3 object after retrieval |
| `sqsClient`         | `SQSClient`| No       |         | Bring your own SQS client |
| `s3Client`          | `S3Client` | No       |         | Bring your own S3 client |

### `sendMessage<T>(body: T, queueNameOrUrl?: string): Promise<SendMessageOutput>`

Serializes `body` to JSON and sends it to SQS. If the serialized size exceeds `maxMessageSize`, the payload is uploaded to S3 first and a reference is sent through SQS.

### `sendMessageBatch<T>(entries: SendMessageBatchEntry<T>[], queueNameOrUrl?: string): Promise<SendMessageBatchResultEntry[]>`

Send up to 10 messages in a single batch. Each entry that exceeds the threshold is individually offloaded to S3.

### `processReceivedMessage(messageBody: string): Promise<string>`

Pass in the raw SQS message body. If it contains an `S3Payload` reference, the original payload is fetched from S3 (and optionally deleted). Otherwise the message is returned as-is.

### `getQueueUrl(queueNameOrUrl?: string): Promise<string>`

Resolve a queue name to a URL, or pass through a URL directly.

## IAM Permissions

**S3:** `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` (only if `s3DeleteAfterLoad: true`)

**SQS:** `sqs:GetQueueUrl`, `sqs:SendMessage`, `sqs:SendMessageBatch`

## Error Handling

The library throws typed errors:

- `MissingQueueError` — no queue name or URL was provided
- `QueueUrlResolutionError` — `GetQueueUrl` returned no result
- `S3PayloadError` — S3 upload or download failed
- `SqsLargePayloadError` — base class for all errors above

```typescript
import { S3PayloadError } from "@battleline/sqs-large-payload-nodejs";

try {
  await sqs.sendMessage(hugePayload);
} catch (err) {
  if (err instanceof S3PayloadError) {
    console.error("S3 issue:", err.cause);
  }
}
```

## Migrating from v1

See [CHANGELOG.md](./CHANGELOG.md) for the full migration guide.
