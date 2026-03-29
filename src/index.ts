export { SqsLargePayloadService } from "./sqs-large-payload.service.js";
export type {
  SqsServiceOptions,
  SendMessageOutput,
  SendMessageBatchEntry,
  SendMessageBatchResultEntry,
} from "./types.js";
export { DEFAULT_MAX_MESSAGE_SIZE } from "./types.js";
export {
  SqsLargePayloadError,
  MissingQueueError,
  QueueUrlResolutionError,
  S3PayloadError,
} from "./errors.js";
