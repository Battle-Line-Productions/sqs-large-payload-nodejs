# sqs-large-payload-nodejs v2 Modernization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the library from AWS SDK v2 to v3, drop legacy dependencies, update defaults to 1 MiB, add batch operations, ship as dual ESM/CJS with TypeScript 5+, and replace Jest with Vitest.

**Architecture:** Plain class (no DI framework) accepting SDK v3 client instances or creating them internally. Dual-format package using TypeScript `module: "nodenext"` with explicit `.js` extensions in imports. Vitest for testing, Biome for linting.

**Tech Stack:** TypeScript 5.8+, `@aws-sdk/client-sqs`, `@aws-sdk/client-s3`, Node 18+, Vitest, Biome, `crypto.randomUUID()`

---

## File Structure

```
sqs-large-payload-nodejs/
├── src/
│   ├── index.ts                          # Public re-exports
│   ├── sqs-large-payload.service.ts      # Main service (renamed, flat)
│   ├── types.ts                          # All interfaces, enums, error classes
│   └── errors.ts                         # Typed error classes
├── tests/
│   └── unit/
│       └── sqs-large-payload.service.test.ts
├── biome.json                            # Biome config (replaces ESLint+Prettier)
├── vitest.config.ts                      # Vitest config (replaces jest.config.js)
├── tsconfig.json                         # Updated for ES2022 + NodeNext
├── tsconfig.build.json                   # Build-only config (excludes tests)
├── package.json                          # Updated deps, dual exports, engines
├── CHANGELOG.md                          # v1 -> v2 migration notes
├── README.md                             # Rewritten with SDK v3 examples
├── .github/workflows/ci.yml             # Updated CI
└── .github/workflows/release_npm.yml    # Updated release
```

**Files to delete:**
- `src/interfaces/ISqsLargePayloadService.ts`
- `src/interfaces/ISqsServiceOptions.ts`
- `src/interfaces/SqsServiceMessageSize.ts`
- `src/interfaces/index.ts`
- `src/services/sqs.service.ts`
- `src/services/index.ts`
- `tests/unit/sqs.service.test.ts`
- `jest.config.js`
- `.prettierrc.json`
- `yarn.lock`
- `index.ts` (root — no longer needed with package.json exports map)
- `examples/` (entire directory)

---

## Task 1: Scaffold — Update package.json and tsconfig

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `biome.json`
- Create: `vitest.config.ts`
- Create: `tsup.config.ts`

- [ ] **Step 1: Update package.json**

Replace the full contents of `package.json`:

```json
{
  "name": "@battleline/sqs-large-payload-nodejs",
  "version": "2.0.0",
  "description": "Transparently offload large SQS messages to S3 when they exceed the size limit",
  "type": "module",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "homepage": "https://github.com/Battle-Line-Productions/sqs-large-payload-nodejs/blob/main/README.md",
  "publishConfig": {
    "access": "public"
  },
  "engines": {
    "node": ">=18"
  },
  "bugs": {
    "url": "https://github.com/Battle-Line-Productions/sqs-large-payload-nodejs/issues"
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "prepare": "npm run build"
  },
  "keywords": [
    "sqs",
    "large",
    "messages",
    "payload",
    "s3",
    "aws",
    "lambda",
    "aws-sdk-v3"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/Battle-Line-Productions/sqs-large-payload-nodejs.git"
  },
  "files": [
    "dist/**/*",
    "package.json",
    "README.md",
    "CHANGELOG.md"
  ],
  "author": "Cavanaugh, Michael",
  "license": "ISC",
  "dependencies": {},
  "peerDependencies": {
    "@aws-sdk/client-s3": "^3.700.0",
    "@aws-sdk/client-sqs": "^3.700.0"
  },
  "devDependencies": {
    "@aws-sdk/client-s3": "^3.700.0",
    "@aws-sdk/client-sqs": "^3.700.0",
    "@biomejs/biome": "^1.9.0",
    "@vitest/coverage-v8": "^3.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Replace tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "outDir": "./dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src/**/*", "tests/**/*", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["tests/**/*", "vitest.config.ts"]
}
```

- [ ] **Step 4: Create biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 120
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "files": {
    "ignore": ["dist/**", "node_modules/**", ".coverage/**"]
  }
}
```

- [ ] **Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      thresholds: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60,
      },
      reporter: ["text", "lcov", "html"],
      reportsDirectory: ".coverage",
    },
  },
});
```

- [ ] **Step 6: Create tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node18",
  outDir: "dist",
});
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: clean install with SDK v3 packages resolved

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json tsconfig.build.json biome.json vitest.config.ts tsup.config.ts
git commit -m "chore: scaffold v2 — SDK v3 deps, TS5, Vitest, Biome, ESM"
```

---

## Task 2: Define types, errors, and constants

**Files:**
- Create: `src/types.ts`
- Create: `src/errors.ts`

- [ ] **Step 1: Write src/errors.ts**

```typescript
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

export class S3PayloadError extends SqsLargePayloadError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "S3PayloadError";
  }
}
```

- [ ] **Step 2: Write src/types.ts**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/errors.ts
git commit -m "feat: add v2 types, errors, and constants"
```

---

## Task 3: Implement the core service with SDK v3

**Files:**
- Create: `src/sqs-large-payload.service.ts`
- Create: `src/index.ts` (overwrite)

- [ ] **Step 1: Write src/sqs-large-payload.service.ts**

```typescript
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  GetQueueUrlCommand,
  SQSClient,
  SendMessageBatchCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { randomUUID } from "node:crypto";
import { S3PayloadError, MissingQueueError, QueueUrlResolutionError } from "./errors.js";
import type { SendMessageBatchEntry, SendMessageBatchResultEntry, SendMessageOutput, SqsServiceOptions } from "./types.js";
import { DEFAULT_MAX_MESSAGE_SIZE } from "./types.js";

export class SqsLargePayloadService {
  private readonly region: string;
  private readonly s3Bucket: string;
  private readonly queueName?: string;
  private readonly queueUrl?: string;
  private readonly maxMessageSize: number;
  private readonly s3DeleteAfterLoad: boolean;
  private readonly sqsClient: SQSClient;
  private readonly s3Client: S3Client;

  constructor(options: SqsServiceOptions) {
    this.region = options.region;
    this.s3Bucket = options.s3BucketName;
    this.queueName = options.queueName;
    this.queueUrl = options.queueUrl;
    this.maxMessageSize = options.maxMessageSize ?? DEFAULT_MAX_MESSAGE_SIZE;
    this.s3DeleteAfterLoad = options.s3DeleteAfterLoad ?? false;
    this.sqsClient = options.sqsClient ?? new SQSClient({ region: this.region });
    this.s3Client = options.s3Client ?? new S3Client({ region: this.region, forcePathStyle: true });
  }

  /**
   * Resolve a queue URL. Accepts a URL directly (starts with "http") or a queue name.
   * Falls back to constructor-level queueUrl, then queueName.
   */
  async getQueueUrl(queueNameOrUrl?: string): Promise<string> {
    const input = queueNameOrUrl ?? this.queueUrl ?? this.queueName;

    if (!input) {
      throw new MissingQueueError();
    }

    // If it looks like a URL, return it directly
    if (input.startsWith("http")) {
      return input;
    }

    const result = await this.sqsClient.send(new GetQueueUrlCommand({ QueueName: input }));

    if (!result.QueueUrl) {
      throw new QueueUrlResolutionError(input);
    }

    return result.QueueUrl;
  }

  /**
   * Send a single message. Offloads to S3 if the serialized size exceeds maxMessageSize.
   */
  async sendMessage<T>(body: T, queueNameOrUrl?: string): Promise<SendMessageOutput> {
    const messageString = JSON.stringify({ message: body });
    const msgSize = Buffer.byteLength(messageString, "utf-8");
    const queueUrl = await this.getQueueUrl(queueNameOrUrl);

    if (msgSize < this.maxMessageSize) {
      const result = await this.sqsClient.send(
        new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: messageString }),
      );
      return { messageId: result.MessageId };
    }

    const s3Key = `${randomUUID()}.json`;
    await this.uploadToS3(s3Key, messageString);

    const result = await this.sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({ S3Payload: { Key: s3Key } }),
      }),
    );

    return { messageId: result.MessageId, s3Key };
  }

  /**
   * Send up to 10 messages in a batch. Each entry that exceeds the size limit is
   * individually offloaded to S3.
   */
  async sendMessageBatch<T>(
    entries: SendMessageBatchEntry<T>[],
    queueNameOrUrl?: string,
  ): Promise<SendMessageBatchResultEntry[]> {
    const queueUrl = await this.getQueueUrl(queueNameOrUrl);
    const s3Keys = new Map<string, string>();

    const sqsEntries = await Promise.all(
      entries.map(async (entry) => {
        const messageString = JSON.stringify({ message: entry.body });
        const msgSize = Buffer.byteLength(messageString, "utf-8");

        if (msgSize < this.maxMessageSize) {
          return { Id: entry.id, MessageBody: messageString };
        }

        const s3Key = `${randomUUID()}.json`;
        await this.uploadToS3(s3Key, messageString);
        s3Keys.set(entry.id, s3Key);

        return {
          Id: entry.id,
          MessageBody: JSON.stringify({ S3Payload: { Key: s3Key } }),
        };
      }),
    );

    const result = await this.sqsClient.send(
      new SendMessageBatchCommand({ QueueUrl: queueUrl, Entries: sqsEntries }),
    );

    return (result.Successful ?? []).map((s) => ({
      id: s.Id!,
      messageId: s.MessageId,
      s3Key: s3Keys.get(s.Id!),
    }));
  }

  /**
   * Process a received SQS message body. If it contains an S3 reference, fetches
   * the payload from S3 (and optionally deletes it).
   */
  async processReceivedMessage(messageBody: string): Promise<string> {
    const parsed = JSON.parse(messageBody);

    if (!parsed.S3Payload) {
      return messageBody;
    }

    const key: string = parsed.S3Payload.Key;

    const s3Object = await this.s3Client.send(
      new GetObjectCommand({ Bucket: this.s3Bucket, Key: key }),
    );

    if (!s3Object.Body) {
      throw new S3PayloadError("Message has an S3Payload reference but no object was found in the bucket");
    }

    const bodyString = await s3Object.Body.transformToString();

    if (this.s3DeleteAfterLoad) {
      await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.s3Bucket, Key: key }));
    }

    return bodyString;
  }

  private async uploadToS3(key: string, body: string): Promise<void> {
    try {
      await this.s3Client.send(
        new PutObjectCommand({ Bucket: this.s3Bucket, Body: body, Key: key }),
      );
    } catch (err) {
      throw new S3PayloadError(`Failed to upload payload to S3: ${err}`, { cause: err });
    }
  }
}
```

- [ ] **Step 2: Overwrite src/index.ts**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/sqs-large-payload.service.ts src/index.ts
git commit -m "feat: implement SqsLargePayloadService with SDK v3, batch support, typed errors"
```

---

## Task 4: Write unit tests with Vitest

**Files:**
- Create: `tests/unit/sqs-large-payload.service.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { GetQueueUrlCommand, SendMessageBatchCommand, SendMessageCommand } from "@aws-sdk/client-sqs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SqsLargePayloadService } from "../../src/sqs-large-payload.service.js";
import { MissingQueueError, QueueUrlResolutionError, S3PayloadError } from "../../src/errors.js";
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

  const sqsClient = { send: sqsSend } as any;
  const s3Client = { send: s3Send } as any;

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

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: "a", messageId: "msg-a", s3Key: undefined });
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
      expect(result[0].s3Key).toBeDefined();
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
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run tests with coverage**

Run: `npx vitest run --coverage`
Expected: Coverage meets 60% thresholds

- [ ] **Step 4: Commit**

```bash
git add tests/unit/sqs-large-payload.service.test.ts
git commit -m "test: add comprehensive Vitest unit tests for v2 service"
```

---

## Task 5: Delete old files

**Files:**
- Delete: `src/interfaces/ISqsLargePayloadService.ts`
- Delete: `src/interfaces/ISqsServiceOptions.ts`
- Delete: `src/interfaces/SqsServiceMessageSize.ts`
- Delete: `src/interfaces/index.ts`
- Delete: `src/services/sqs.service.ts`
- Delete: `src/services/index.ts`
- Delete: `tests/unit/sqs.service.test.ts`
- Delete: `jest.config.js`
- Delete: `.prettierrc.json`
- Delete: `index.ts` (root)
- Delete: `examples/javascript/index.js`
- Delete: `examples/javascript/package.json`

- [ ] **Step 1: Remove old source and config files**

```bash
rm -f src/interfaces/ISqsLargePayloadService.ts \
      src/interfaces/ISqsServiceOptions.ts \
      src/interfaces/SqsServiceMessageSize.ts \
      src/interfaces/index.ts \
      src/services/sqs.service.ts \
      src/services/index.ts \
      tests/unit/sqs.service.test.ts \
      jest.config.js \
      .prettierrc.json \
      yarn.lock \
      index.ts
rm -rf examples/
rmdir src/interfaces src/services 2>/dev/null || true
```

- [ ] **Step 2: Verify build still works**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: No errors

- [ ] **Step 3: Verify tests still pass**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove legacy v1 source files, Jest config, Inversify, aws-sdk v2"
```

---

## Task 6: Update CI workflows

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release_npm.yml`

- [ ] **Step 1: Replace .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    name: Build & Test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run test:coverage

      - name: Upload coverage
        if: matrix.node-version == 22
        uses: coverallsapp/github-action@v2
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          path-to-lcov: .coverage/lcov.info
```

- [ ] **Step 2: Replace .github/workflows/release_npm.yml**

```yaml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          registry-url: "https://registry.npmjs.org"
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test

      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_PUBLISH_TOKEN }}
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/release_npm.yml
git commit -m "ci: update workflows for Node 18+, Vitest, Biome"
```

---

## Task 7: Rewrite README and add CHANGELOG

**Files:**
- Modify: `README.md`
- Create: `CHANGELOG.md`

- [ ] **Step 1: Rewrite README.md**

```markdown
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
```

- [ ] **Step 2: Create CHANGELOG.md**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: rewrite README for v2 SDK v3, add CHANGELOG with migration guide"
```

---

## Task 8: Final verification

- [ ] **Step 1: Clean install**

```bash
rm -rf node_modules dist
npm install
```

- [ ] **Step 2: Lint**

Run: `npx biome check .`
Expected: No errors

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Compiles cleanly, `dist/` contains `.js`, `.cjs`, `.d.ts`, `.d.cts` files

- [ ] **Step 4: Verify CJS output works**

Run: `node -e "const m = require('./dist/index.cjs'); console.log(Object.keys(m))"`
Expected: Prints exported names including `SqsLargePayloadService`

- [ ] **Step 5: Verify ESM output works**

Run: `node --input-type=module -e "import { SqsLargePayloadService } from './dist/index.js'; console.log(typeof SqsLargePayloadService)"`
Expected: Prints `function`

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Run coverage**

Run: `npm run test:coverage`
Expected: Meets 60% threshold on all metrics

- [ ] **Step 8: Commit any lint fixes**

```bash
git add -A
git commit -m "chore: final lint fixes for v2"
```
