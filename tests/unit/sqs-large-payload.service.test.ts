import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { GetQueueUrlCommand, SendMessageBatchCommand, SendMessageCommand } from "@aws-sdk/client-sqs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BatchValidationError, MissingQueueError, QueueUrlResolutionError, S3PayloadError } from "../../src/errors.js";
import { SqsLargePayloadService } from "../../src/sqs-large-payload.service.js";
import { DEFAULT_MAX_MESSAGE_SIZE } from "../../src/types.js";
import type { SqsServiceOptions } from "../../src/types.js";

// Mock both AWS SDK clients
vi.mock("@aws-sdk/client-sqs", async () => {
  const actual = await vi.importActual<typeof import("@aws-sdk/client-sqs")>("@aws-sdk/client-sqs");
  return {
    ...actual,
    SQSClient: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
    })),
  };
});

vi.mock("@aws-sdk/client-s3", async () => {
  const actual = await vi.importActual<typeof import("@aws-sdk/client-s3")>("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
    })),
  };
});

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-1234"),
}));

function createService(overrides?: Partial<SqsServiceOptions>) {
  const sqsSend = vi.fn();
  const s3Send = vi.fn();

  const sqsClient = { send: sqsSend } as unknown as SqsServiceOptions["sqsClient"];
  const s3Client = { send: s3Send } as unknown as SqsServiceOptions["s3Client"];

  const options: SqsServiceOptions = {
    region: "us-east-2",
    s3BucketName: "test-bucket",
    s3DeleteAfterLoad: false,
    sqsClient,
    s3Client,
    ...overrides,
  };

  const service = new SqsLargePayloadService(options);
  return { service, sqsSend, s3Send };
}

describe("SqsLargePayloadService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getQueueUrl", () => {
    it("returns a URL directly when given an HTTP URL", async () => {
      const { service } = createService();
      const url = await service.getQueueUrl("https://sqs.us-east-2.amazonaws.com/123/my-queue");
      expect(url).toBe("https://sqs.us-east-2.amazonaws.com/123/my-queue");
    });

    it("resolves a queue name to a URL via GetQueueUrlCommand", async () => {
      const { service, sqsSend } = createService();
      sqsSend.mockResolvedValueOnce({ QueueUrl: "https://resolved.url" });

      const url = await service.getQueueUrl("my-queue");

      expect(url).toBe("https://resolved.url");
      expect(sqsSend).toHaveBeenCalledWith(expect.any(GetQueueUrlCommand));
    });

    it("uses constructor queueUrl as fallback", async () => {
      const { service } = createService({ queueUrl: "https://default.url" });
      const url = await service.getQueueUrl();
      expect(url).toBe("https://default.url");
    });

    it("uses constructor queueName as last fallback", async () => {
      const { service, sqsSend } = createService({ queueName: "default-queue" });
      sqsSend.mockResolvedValueOnce({ QueueUrl: "https://from-name.url" });

      const url = await service.getQueueUrl();

      expect(url).toBe("https://from-name.url");
    });

    it("throws MissingQueueError when no queue identifier is available", async () => {
      const { service } = createService();
      await expect(service.getQueueUrl()).rejects.toThrow(MissingQueueError);
    });

    it("throws QueueUrlResolutionError when SDK returns no URL", async () => {
      const { service, sqsSend } = createService();
      sqsSend.mockResolvedValueOnce({ QueueUrl: undefined });

      await expect(service.getQueueUrl("bad-queue")).rejects.toThrow(QueueUrlResolutionError);
    });
  });

  describe("sendMessage", () => {
    it("sends a small message directly to SQS", async () => {
      const { service, sqsSend } = createService({ queueUrl: "https://q.url" });
      sqsSend.mockResolvedValueOnce({ MessageId: "msg-1" });

      const result = await service.sendMessage("hello");

      expect(result).toEqual({ messageId: "msg-1" });
      expect(sqsSend).toHaveBeenCalledTimes(1);
      expect(sqsSend).toHaveBeenCalledWith(expect.any(SendMessageCommand));
    });

    it("offloads to S3 when message exceeds maxMessageSize", async () => {
      const { service, sqsSend, s3Send } = createService({
        queueUrl: "https://q.url",
        maxMessageSize: 1, // 1 byte threshold
      });

      s3Send.mockResolvedValueOnce({}); // PutObject
      sqsSend.mockResolvedValueOnce({ MessageId: "msg-2" }); // SendMessage

      const result = await service.sendMessage("large body");

      expect(result.messageId).toBe("msg-2");
      expect(result.s3Key).toBe("test-uuid-1234.json");
      expect(s3Send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(sqsSend).toHaveBeenCalledWith(expect.any(SendMessageCommand));
    });

    it("passes queue name or URL through to getQueueUrl", async () => {
      const { service, sqsSend } = createService();
      sqsSend
        .mockResolvedValueOnce({ QueueUrl: "https://resolved.url" }) // getQueueUrl
        .mockResolvedValueOnce({ MessageId: "msg-3" }); // sendMessage

      await service.sendMessage("body", "my-queue");

      expect(sqsSend).toHaveBeenCalledWith(expect.any(GetQueueUrlCommand));
    });

    it("wraps S3 upload errors in S3PayloadError", async () => {
      const { service, s3Send } = createService({
        queueUrl: "https://q.url",
        maxMessageSize: 1,
      });

      s3Send.mockRejectedValueOnce(new Error("S3 down"));

      await expect(service.sendMessage("big data")).rejects.toThrow(S3PayloadError);
    });
  });

  describe("sendMessageBatch", () => {
    it("sends a batch of small messages", async () => {
      const { service, sqsSend } = createService({ queueUrl: "https://q.url" });

      sqsSend.mockResolvedValueOnce({
        Successful: [
          { Id: "a", MessageId: "msg-a" },
          { Id: "b", MessageId: "msg-b" },
        ],
        Failed: [],
      });

      const result = await service.sendMessageBatch([
        { id: "a", body: "hello" },
        { id: "b", body: "world" },
      ]);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.successful[0]).toEqual({ id: "a", messageId: "msg-a", s3Key: undefined });
      expect(sqsSend).toHaveBeenCalledWith(expect.any(SendMessageBatchCommand));
    });

    it("offloads individual large entries to S3", async () => {
      const { service, sqsSend, s3Send } = createService({
        queueUrl: "https://q.url",
        maxMessageSize: 1,
      });

      s3Send.mockResolvedValue({}); // PutObject for each entry
      sqsSend.mockResolvedValueOnce({
        Successful: [{ Id: "a", MessageId: "msg-a" }],
        Failed: [],
      });

      const result = await service.sendMessageBatch([{ id: "a", body: "big" }]);

      expect(s3Send).toHaveBeenCalled();
      expect(result.successful[0].s3Key).toBeDefined();
    });

    it("throws BatchValidationError when more than 10 entries", async () => {
      const { service } = createService({ queueUrl: "https://q.url" });

      const entries = Array.from({ length: 11 }, (_, i) => ({ id: `${i}`, body: "x" }));

      await expect(service.sendMessageBatch(entries)).rejects.toThrow(BatchValidationError);
    });

    it("returns failed entries from the SQS response", async () => {
      const { service, sqsSend } = createService({ queueUrl: "https://q.url" });

      sqsSend.mockResolvedValueOnce({
        Successful: [{ Id: "a", MessageId: "msg-a" }],
        Failed: [{ Id: "b", Code: "InternalError", Message: "Something went wrong", SenderFault: false }],
      });

      const result = await service.sendMessageBatch([
        { id: "a", body: "hello" },
        { id: "b", body: "world" },
      ]);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toEqual({
        id: "b",
        code: "InternalError",
        message: "Something went wrong",
        senderFault: false,
      });
    });
  });

  describe("processReceivedMessage", () => {
    it("returns message as-is when no S3Payload", async () => {
      const { service } = createService();

      const body = JSON.stringify({ message: "hello" });
      const result = await service.processReceivedMessage(body);

      expect(result).toBe(body);
    });

    it("fetches from S3 when S3Payload is present", async () => {
      const { service, s3Send } = createService();

      const originalPayload = JSON.stringify({ message: "big data" });
      s3Send.mockResolvedValueOnce({
        Body: { transformToString: () => Promise.resolve(originalPayload) },
      });

      const body = JSON.stringify({ S3Payload: { Key: "some-key.json" } });
      const result = await service.processReceivedMessage(body);

      expect(result).toBe(originalPayload);
      expect(s3Send).toHaveBeenCalledWith(expect.any(GetObjectCommand));
    });

    it("deletes S3 object after load when s3DeleteAfterLoad is true", async () => {
      const { service, s3Send } = createService({ s3DeleteAfterLoad: true });

      s3Send
        .mockResolvedValueOnce({
          Body: { transformToString: () => Promise.resolve("data") },
        })
        .mockResolvedValueOnce({}); // DeleteObject

      const body = JSON.stringify({ S3Payload: { Key: "key.json" } });
      await service.processReceivedMessage(body);

      expect(s3Send).toHaveBeenCalledTimes(2);
      expect(s3Send).toHaveBeenLastCalledWith(expect.any(DeleteObjectCommand));
    });

    it("throws S3PayloadError when S3 object body is missing", async () => {
      const { service, s3Send } = createService();
      s3Send.mockResolvedValueOnce({ Body: undefined });

      const body = JSON.stringify({ S3Payload: { Key: "missing.json" } });
      await expect(service.processReceivedMessage(body)).rejects.toThrow(S3PayloadError);
    });
  });

  describe("DEFAULT_MAX_MESSAGE_SIZE", () => {
    it("equals 1 MiB", () => {
      expect(DEFAULT_MAX_MESSAGE_SIZE).toBe(1024 * 1024);
    });
  });
});
