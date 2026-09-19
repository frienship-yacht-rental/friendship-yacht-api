# Engineering standards — friendship-yacht-api

This file is the contract for anyone — human or agent — changing this
repository. `README.md` explains how to run it; this explains how to change it
without degrading it. Decisions with a "why" live in `docs/adr/`.

The codebase doubles as a boilerplate: everything under `src/modules/` is
domain; everything else is reusable. See "Reusing as a boilerplate" at the end.

## Architecture

Request lifecycle, in order (see `src/app.ts`):

```
requestId → helmet → cors → body parsing → access log
  → /health                       (unversioned liveness probe)
  → /api/v1 → rate limit → module routers
  → notFoundHandler → errorHandler
```

Each module under `src/modules/<name>/` is a vertical slice with fixed layers:

| File            | Owns                                   | May import                                                          |
| --------------- | -------------------------------------- | ------------------------------------------------------------------- |
| `schema.ts`     | Zod contracts and inferred types       | zod, other modules' schemas                                         |
| `repository.ts` | Storage interface + implementations    | its own schema                                                      |
| `service.ts`    | Business rules, no HTTP                | its repository interface, other modules' **services**, `lib/errors` |
| `controller.ts` | HTTP ⇄ service translation             | its service, `middleware/validate`                                  |
| `router.ts`     | Paths, methods, validation wiring      | its controller, `middleware/validate`                               |
| `index.ts`      | Composition root: constructs the above | everything in the module                                            |

Dependencies point inward: router → controller → service → repository. A
lower layer never imports a higher one. Cross-module access goes through the
other module's service, never its repository or controller (ADR-0001).

`src/lib/` is framework-agnostic code (errors). `src/middleware/` is
Express-specific cross-cutting code. `src/config/` is process configuration.

## Rules

1. **Throw, don't respond.** Failures are `AppError` subclasses from
   `src/lib/errors.ts`. Never call `res.status(4xx)` in a controller; the
   error handler owns the response shape (ADR-0002). Express 5 forwards
   rejected promises, so no `try/catch` or async wrapper is needed.
2. **Validate at the edge, once.** Every route with input uses
   `validate({ body, query, params })` and reads results via
   `validated(req, schemas)`. Controllers never touch `req.body`/`req.query`
   directly. Unknown keys are stripped by Zod — do not add `.strict()` unless
   the contract demands rejection.
3. **Services do not know HTTP.** No `req`, `res`, status codes or headers in
   a service. It takes typed input, returns typed output, throws `AppError`.
4. **Repositories are interfaces.** Services depend on the interface. Ship an
   in-memory implementation alongside any real one; tests use it (ADR-0004).
5. **Configuration through `env`.** Import from `src/config/env.ts`. Never
   read `process.env` elsewhere. A new variable goes in the schema _and_ in
   `.env.example`.
6. **Log through `logger`.** No `console.*` outside `src/config/env.ts`.
   Include `requestId: req.id` in any log line that has a request in scope.
7. **Every response shape is a Zod schema** in the module's `schema.ts`. The
   web app validates against the same shape; a change here is a change there.
8. **Public error codes are a contract.** Adding or renaming a `code` is an
   API change: update the web client's handling in the same change.
9. **Versioning.** Business routes mount under `/api/v1`. A breaking change
   to a response shape gets `/api/v2`, not a silent edit. `/health` stays
   unversioned.

## Adding a module

1. `mkdir src/modules/<name>` and create the six files above. Copy
   `src/modules/yachts/` for a read model, `src/modules/inquiries/` for a
   write model.
2. Define the contract in `schema.ts` first. Export inferred types.
3. Write the service with a fake repository in a unit test before the
   controller exists.
4. Mount the router in `src/routes.ts`.
5. Add a supertest spec under `src/__tests__/<name>.test.ts` that asserts
   the happy path, one validation failure with `details`, and one `AppError`.
6. If the web app consumes it, add the matching schema to
   `friendship-yacht-web/src/features/<name>/schema.ts`.

## Testing

| Layer | Tool               | What it proves                                  |
| ----- | ------------------ | ----------------------------------------------- |
| Unit  | Vitest             | Services with in-memory repositories, pure code |
| HTTP  | Vitest + supertest | Routing, validation, error envelope, headers    |

`app.ts` is exported without listening so supertest can drive it; only
`server.ts` binds a port and is excluded from coverage. Tests run with
`NODE_ENV=test`, which silences the console transport and skips `.env`.

Coverage floor is 60% across the board (`vitest.config.ts`). Raise it when the
real number has been comfortably above it for a while; never lower it to make
a change pass.

## Before you say you are done

```bash
pnpm type-check && pnpm lint && pnpm format:check && pnpm test
```

That is what the pre-push hook runs (ADR-0005). If a change touches the
request pipeline, also start the server and hit it once — supertest does not
exercise `server.ts`.

## Commits

Conventional Commits, enforced by commitlint. Scope by module or concern:
`feat(yachts): add availability endpoint`, `fix(validate): coerce numeric
query params`. One logical change per commit.

## Reusing as a boilerplate

To start a new service from this repository:

1. Delete `src/modules/yachts` and `src/modules/inquiries`; remove their
   mounts from `src/routes.ts`.
2. Rename in `package.json` (`name`, `description`) and the logger's
   `defaultMeta.service` in `src/config/logger.ts`.
3. Rewrite `.env.example` defaults (port, CORS origins) and this file's first
   paragraph.
4. Keep `docs/adr/0001`–`0005`; they describe the structure, not the domain.
   Add `0006+` for your own decisions.
