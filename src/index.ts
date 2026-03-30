export { SqsLargePayloadService } from "./sqs-large-payload.service.js";
export type {
  SqsServiceOptions,
  SendMessageOutput,
  SendMessageBatchEntry,
  SendMessageBatchResultEntry,
  SendMessageBatchFailedEntry,
  SendMessageBatchOutput,
} from "./types.js";
export { DEFAULT_MAX_MESSAGE_SIZE } from "./types.js";
export {
  SqsLargePayloadError,
  BatchValidationError,
  MissingQueueError,
  QueueUrlResolutionError,
  S3PayloadError,
} from "./errors.js";
