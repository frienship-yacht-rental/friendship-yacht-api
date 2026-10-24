# Engineering standards for friendship-yacht-api

This file is the contract for anyone changing this repository, human or
agent. `README.md` explains how to run it. This file explains how to change it
without degrading it.

The codebase doubles as a boilerplate. Each feature's `<feature>.<layer>.ts`
files are domain, and everything else is reusable. See "Reusing as a
boilerplate" at the end.

## Architecture

Request lifecycle, in the order `src/app.ts` registers it:

```
requestId → helmet → cors → body parsing → access log
  → GET /api/v1/health             (liveness probe, not rate limited)
  → /api/v1 → rate limit → feature routers
  → notFoundHandler → errorHandler
```

Each layer has one flat folder, and a feature has one file in each, named
`<feature>.<layer>.ts`:

| File                                      | Owns                                         | May import                                              |
| ----------------------------------------- | -------------------------------------------- | ------------------------------------------------------- |
| `src/schemas/<feature>.schema.ts`         | Zod input and response schemas, their types  | zod, other schemas                                      |
| `src/services/<feature>.service.ts`       | Business rules and the interface they expose | `schemas/`, `lib/`, `db/`, `config/env`, other services |
| `src/controllers/<feature>.controller.ts` | HTTP ⇄ service translation                   | its service, `schemas/`, `middleware/validate`          |
| `src/routes/<feature>.routes.ts`          | Paths, methods, validation wiring            | its controller, `schemas/`, `middleware/`               |

- A controller is a class. Its file exports one instance, constructed with
  its service.
- A router is a plain `Router()` instance exported by name, built at import
  time rather than returned from a factory.
- `src/app.ts` imports each router directly and mounts it under `API_PREFIX`.
  There is no aggregating router and no per-feature `index.ts`.
- Dependencies point inward: route → controller → service. A lower layer
  never imports a higher one. A service that needs another feature's data
  calls that feature's service.

The rest of `src/` is shared. `lib/` is framework-agnostic code, `middleware/`
is Express-specific cross-cutting code. `middleware/auth.middleware.ts`
rejects a request with no session and sets `req.user` and `req.session`. Add
it per route in the router.

## Rules

1. **Throw, don't respond.** Failures are `AppError` subclasses from
   `src/lib/errors.ts`. Never call `res.status(4xx)` in a controller, because
   the error handler owns the response shape. Express 5 forwards rejected
   promises, so controllers need no `try/catch` or async wrapper.
2. **Validate at the edge, once.** Every route with input runs
   `validate({ body, query, params })` in the router, and the controller reads
   the result with `validated(req, schemas)`. Controllers never touch
   `req.body` or `req.query` directly. Zod strips unknown keys. Add `.strict()`
   only when the contract demands rejection.
3. **Services do not know HTTP.** No `req`, `res`, status codes or headers in
   a service. It takes typed input, returns typed output and throws `AppError`.
4. **Depend on interfaces.** A service class implements an interface, and its
   controller's constructor takes that interface rather than the class.
   Whatever storage a service reaches has an in-memory stand-in that tests
   use.
5. **Configuration through `env`.** Import from `src/config/env.ts`. Never
   read `process.env` elsewhere. A new variable goes in the schema _and_ in
   `.env.example`. A required one also goes in `test.env` in
   `vitest.config.ts`, because tests skip `.env` and a missing variable exits
   the process.
6. **Log through `logger`.** No `console.*` outside `src/config/env.ts`.
   Include `requestId: req.id` in any log line that has a request in scope.
7. **Every response shape is a Zod schema** in `src/schemas/`. The admin
   panel at `../admin-panel` validates against the same shape, so a change
   here is a change there.
8. **Public error codes are a contract.** Adding or renaming a `code` is an
   API change. Update the admin panel's handling in the same change.
9. **Versioning.** Every route mounts under `/api/v1`, the `/api/v1/health`
   liveness probe included. A breaking change to a response shape gets
   `/api/v2`, not a silent edit.

## Adding a feature

1. Write the contract first. Put the Zod input and response schemas in
   `src/schemas/<feature>.schema.ts` and export their inferred types.
2. Write the service with a unit test against an in-memory stand-in, before
   the controller exists.
3. Write the controller, then the router.
4. Import the router in `src/app.ts` and mount it under `API_PREFIX`, after
   the rate limiter and before `notFoundHandler`.
5. Add supertest specs under `src/__tests__/<feature>/` that assert the happy
   path, one validation failure with `details`, and one `AppError`.
6. If the admin panel consumes it, add the matching Zod schema under
   `../admin-panel/src/features/<feature>/` in the same change.

## Testing

| Layer | Tool               | What it proves                                |
| ----- | ------------------ | --------------------------------------------- |
| Unit  | Vitest             | Services against in-memory storage, pure code |
| HTTP  | Vitest + supertest | Routing, validation, error envelope, headers  |

Cross-cutting specs sit in `src/__tests__/` and feature specs in
`src/__tests__/<feature>/`. The auth specs `vi.mock` `src/lib/auth.ts` with
the instance from `auth.helpers.ts`, so they never load `src/db/` or reach
MySQL. Copy that wiring into any spec that drives an auth route.

`app.ts` is exported without listening so supertest can drive it. Only
`server.ts` binds a port, and coverage excludes it. Tests run with
`NODE_ENV=test`, which silences the console transport and skips `.env`.

Coverage floor is 60% across the board (`vitest.config.ts`). Raise it when the
real number has stayed well above it for a while. Never lower it to make a
change pass.

## Before you say you are done

```bash
pnpm type-check && pnpm lint && pnpm format:check && pnpm test
```

The pre-push hook runs the same checks except `format:check`. If a change
touches the request pipeline, also start the server with `pnpm dev` and
request `/api/v1/health` once, since supertest never runs `server.ts`.

## Commits

Conventional Commits, enforced by commitlint. Scope by feature or concern:
`feat(auth): add password reset`, `fix(validate): coerce numeric query
params`. One logical change per commit.

## Reusing as a boilerplate

To start a new service from this repository:

1. The auth feature is generic. To drop it, delete the `auth.*.ts` files and
   `src/__tests__/auth/`, and remove the `authRouter` mount from `src/app.ts`.
2. Rename `name` and `description` in `package.json`, and the logger's
   `defaultMeta.service` in `src/config/logger.ts`.
3. Rewrite the defaults in `.env.example`, including the database name in
   `DATABASE_URL`, and this file's title.
