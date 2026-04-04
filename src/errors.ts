export class SqsLargePayloadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SqsLargePayloadError";
  }
}

export class MissingQueueError extends SqsLargePayloadError {
  constructor(message = "Queue name or URL is required") {
    super(message);
    this.name = "MissingQueueError";
  }
}

export class QueueUrlResolutionError extends SqsLargePayloadError {
  constructor(queueName: string) {
    super(`Unable to determine queue URL from provided name: ${queueName}`);
    this.name = "QueueUrlResolutionError";
  }
}

export class BatchValidationError extends SqsLargePayloadError {
  constructor(message: string) {
    super(message);
    this.name = "BatchValidationError";
  }
}

export class S3PayloadError extends SqsLargePayloadError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "S3PayloadError";
  }
}
