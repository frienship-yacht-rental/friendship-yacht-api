# Friendship Yachts — API

HTTP API for the Friendship Yachts web app
([`friendship-yacht-web`](../friendship-yacht-web)).

## Stack

| Concern       | Choice                                             |
| ------------- | -------------------------------------------------- |
| Runtime       | Node.js 24, ESM                                    |
| Framework     | Express 5                                          |
| Language      | TypeScript (strict + `exactOptionalPropertyTypes`) |
| Validation    | Zod v4                                             |
| Logging       | winston (structured JSON) + morgan access logs     |
| Tests         | Vitest 5 + supertest                               |
| Lint / format | ESLint 10 (flat config) + Prettier 3               |

## Requirements

- Node.js `>=20.9` — the repo pins 24 in `.nvmrc`
- pnpm `>=11` (see `packageManager` in `package.json`)

## Getting started

```bash
pnpm install              # also activates the git hooks
cp .env.example .env      # then adjust
pnpm dev
```

The server listens on http://localhost:8000 by default and answers
`GET /health`.

Environment variables are validated by `src/config/env.ts` at startup. A
missing or malformed value stops the process with a readable message rather
than surfacing as `undefined` on the first request.

## Scripts

| Script               | Purpose                         |
| -------------------- | ------------------------------- |
| `pnpm dev`           | Watch mode via `tsx`            |
| `pnpm build`         | Clean `dist/` and compile       |
| `pnpm start`         | Run the compiled build          |
| `pnpm type-check`    | `tsc --noEmit`                  |
| `pnpm lint`          | ESLint, zero warnings tolerated |
| `pnpm format`        | Write Prettier formatting       |
| `pnpm test`          | Unit and HTTP tests, single run |
| `pnpm test:watch`    | Tests in watch mode             |
| `pnpm test:coverage` | Tests with coverage thresholds  |

## Project structure

```
src/
├── server.ts          # Process entry: listen, graceful shutdown
├── app.ts             # Express app: middleware order and routes
├── config/
│   ├── env.ts         # Validated environment variables
│   └── logger.ts      # winston setup, morgan stream
├── middleware/
│   └── error.ts       # 404 and error handlers, error codes
└── __tests__/         # Vitest specs
```

`app.ts` is exported without listening so tests can drive it through
supertest; only `server.ts` binds a port.

## Conventions

### Error responses

Every non-2xx response has the same body:

```json
{ "message": "Human-readable, may change", "code": "STABLE_MACHINE_CODE" }
```

`code` is what clients branch on — the web app's API client already reads it.
Throw an `Error` with a `status` (and optionally a `code`) from any handler and
`errorHandler` produces this shape. 5xx responses never include the original
message or stack.

### Environment

Read configuration through `env` from `src/config/env.ts`, never
`process.env` directly. New variables go in the schema there **and** in
`.env.example`.

### CORS

Only origins listed in `CORS_ORIGIN` (comma-separated) may call the API from a
browser. Server-to-server callers, such as the Next.js server, are not subject
to CORS. Add the deployed web origin in production.

### Logging

Logs are structured JSON. In development they also go to the console. Files
are written to `logs/` (gitignored) with rotation at 5 MB × 5 files per
stream; `error.log` receives only errors so a fault is never buried in the
combined log.

## Quality gates

Enforced locally by husky (see `.husky/README.md`):

- **pre-commit** — `lint-staged` formats and lints staged files
- **commit-msg** — Conventional Commits, via commitlint
- **pre-push** — `type-check`, `lint`, `test`

No hosted CI is configured, so the pre-push hook is the last automated gate.
