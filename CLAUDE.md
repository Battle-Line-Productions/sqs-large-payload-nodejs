# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`@battleline/sqs-large-payload-nodejs` — a TypeScript library that transparently offloads large SQS messages to S3 when they exceed the SQS size limit (1 MiB). Built for AWS SDK v3, published as dual ESM/CJS.

## Commands

```bash
npm run build          # tsup → ESM + CJS + .d.ts into dist/
npm run lint           # biome check .
npm run lint:fix       # biome check --write .
npm test               # vitest run (single run)
npm run test:watch     # vitest (watch mode)
npm run test:coverage  # vitest run --coverage → .coverage/
```

Run a single test file:
```bash
npx vitest run tests/unit/sqs-large-payload.service.test.ts
```

Run tests matching a name pattern:
```bash
npx vitest run -t "should upload"
```

## Architecture

The library is a single service class with typed errors and options:

- **`src/sqs-large-payload.service.ts`** — `SqsLargePayloadService` class. Core logic: `sendMessage()` serializes and checks byte size against `maxMessageSize`; if over, uploads to S3 as `{uuid}.json` and sends an `{ S3Payload: { Key } }` reference instead. `processReceivedMessage()` detects S3 references and fetches transparently. `sendMessageBatch()` handles up to 10 messages with per-entry S3 offloading.
- **`src/types.ts`** — `SqsServiceOptions` (constructor config), return types (`SendMessageOutput`, `SendMessageBatchOutput`), and `DEFAULT_MAX_MESSAGE_SIZE` constant.
- **`src/errors.ts`** — Error hierarchy rooted at `SqsLargePayloadError`: `MissingQueueError`, `QueueUrlResolutionError`, `BatchValidationError`, `S3PayloadError`.
- **`src/index.ts`** — Public API barrel export.

The service accepts optional pre-configured `SQSClient`/`S3Client` via constructor options (no DI framework). Queue resolution supports both URLs (passthrough) and names (calls `GetQueueUrl`).

## Tooling

- **TypeScript 5.8** targeting ES2022, strict mode, `nodenext` module resolution
- **tsup** bundles ESM + CJS with declarations; uses `tsconfig.build.json`
- **Biome** for linting and formatting: 2-space indent, 120-char line width, recommended rules, auto-organized imports
- **Vitest** with `globals: true`; tests live in `tests/`; coverage via v8 with 60% thresholds on branches/functions/lines/statements
- **Node >=18** required

## Peer Dependencies

Consumers must install `@aws-sdk/client-sqs` and `@aws-sdk/client-s3` (^3.700.0).

## CI

GitHub Actions runs lint, build, and test on Node 18/20/22 for PRs to `main`. Releases trigger npm publish.
