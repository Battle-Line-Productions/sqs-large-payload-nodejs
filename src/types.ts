import type { S3Client } from "@aws-sdk/client-s3";
import type { SQSClient } from "@aws-sdk/client-sqs";

/** 1 MiB — the current AWS SQS maximum message size */
export const DEFAULT_MAX_MESSAGE_SIZE = 1024 * 1024;

export interface SqsServiceOptions {
  /** S3 bucket name for large payloads */
  s3BucketName: string;

  /** AWS region (used when creating default clients) */
  region: string;

  /** Delete the S3 object after it is retrieved */
  s3DeleteAfterLoad?: boolean;

  /** Max message size in bytes before offloading to S3 (default: 1 MiB) */
  maxMessageSize?: number;

  /** Default SQS queue name (resolved to URL via GetQueueUrl) */
  queueName?: string;

  /** Default SQS queue URL (takes precedence over queueName) */
  queueUrl?: string;

  /** Pre-configured S3 client */
  s3Client?: S3Client;

  /** Pre-configured SQS client */
  sqsClient?: SQSClient;
}

export interface SendMessageOutput {
  messageId: string | undefined;
  /** Set when the message was offloaded to S3 */
  s3Key?: string;
}

export interface SendMessageBatchEntry<T = unknown> {
  id: string;
  body: T;
}

export interface SendMessageBatchResultEntry {
  id: string;
  messageId: string | undefined;
  s3Key?: string;
}

export interface SendMessageBatchFailedEntry {
  id: string;
  code: string;
  message: string;
  senderFault: boolean;
}

export interface SendMessageBatchOutput {
  successful: SendMessageBatchResultEntry[];
  failed: SendMessageBatchFailedEntry[];
}
