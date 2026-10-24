# Contributing

This covers the workflow for changing the Friendship Yachts API: getting set up, making a
change, and getting it merged. Two other files cover the rest:

- [`AGENTS.md`](AGENTS.md) has the engineering rules for layering, errors, validation and
  logging. Read it before your first change.
- [`README.md`](README.md) lists the scripts and documents the error response body.

## Prerequisites

- Node.js 24. `.nvmrc` pins it, so `nvm use` picks it up.
- pnpm 11. `package.json` pins `pnpm@11.25.0` in `packageManager`.
- Docker, for the local MySQL database.

## First-time setup

```bash
git clone https://github.com/frienship-yacht-rental/friendship-yacht-api.git
cd friendship-yacht-api
nvm use
pnpm install           # also installs the git hooks
cp .env.example .env
docker compose up -d   # MySQL 8 on localhost:3306
```

Two values in `.env` need changing before the server will work.

`DATABASE_URL` in `.env.example` does not match the container. `docker-compose.yml`
creates a database named `friendship-yatchs`, spelled that way, with user `admin` and
password `admin`:

```bash
DATABASE_URL=mysql://admin:admin@127.0.0.1:3306/friendship-yatchs
```

`BETTER_AUTH_SECRET` needs at least 32 characters. Generate one with
`openssl rand -base64 32`.

`src/config/env.ts` checks every variable at startup. If one is missing or malformed, the
process exits and prints which one.

Then create the tables and start the server:

```bash
pnpm db:push   # creates the tables in src/db/schema.ts
pnpm dev       # restarts on save
curl http://localhost:8000/api/v1/health
```

The tests don't need the database. `vitest.config.ts` supplies placeholder env values, and
the auth specs run better-auth against an in-memory store.

To call endpoints by hand, open `FriendShip Yatchs Backend APIs/` in
[Bruno](https://www.usebruno.com/). It has a request for each route.

## Branches

Branch off `main` and name the branch `<your-name>/<type>/<topic>`, for example
`parth/feat/auth`. `<type>` is one of the commit types below. Open the pull request
against `main`.

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), and
commitlint rejects a message that doesn't. Write `type(scope): subject`:

```text
feat(auth): add password reset endpoint
fix(validate): coerce numeric query params
```

- `type` is one of `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`,
  `revert`, `style`, `test`.
- `scope` names the feature or concern. commitlint doesn't require it, but add one anyway.
  It's what makes `git log` skimmable.
- The subject can't be upper case, PascalCase or Start Case. Write it in lower case.
- The header line can be at most 100 characters.

Make one logical change per commit.

## Git hooks

`pnpm install` sets up husky, which runs these hooks:

| Hook         | Runs                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | `lint-staged`: ESLint `--fix` and Prettier on staged `.ts` and `.js` files, Prettier on `.json`, `.md`, `.yml` |
| `commit-msg` | commitlint                                                                                                     |
| `pre-push`   | `pnpm type-check`, `pnpm lint`, `pnpm test`                                                                    |

Don't skip them with `--no-verify` or `HUSKY=0`. The project has no hosted CI, so the
pre-push hook is the last automated check before code reaches GitHub. A comment in
`.husky/pre-push` suggests `--no-verify` for work-in-progress branches. Don't follow it. If
a hook fails, fix what it found.

Prettier formats staged files at commit time, so you don't need to format by hand.

The pre-push hook doesn't run `format:check` or coverage. Run the full set yourself before
opening a pull request:

```bash
pnpm type-check && pnpm lint && pnpm format:check && pnpm test
pnpm test:coverage   # fails below the 60% floor set in vitest.config.ts
```

## Project layout

Code is grouped by layer, with one file per feature in each layer folder, named
`<feature>.<layer>.ts`:

```text
src/
├── server.ts       # binds the port, graceful shutdown
├── app.ts          # middleware pipeline, mounts routers under /api/v1
├── routes/         # user.routes.ts: one Express Router per feature
├── controllers/    # user.controller.ts: a class; the file exports an instance
├── services/       # user.service.ts: business logic, no Express
├── schemas/        # user.schema.ts: Zod schemas and inferred types
├── db/             # drizzle client and table definitions
├── lib/            # better-auth instance, AppError classes
├── middleware/     # request id, validation, session check, error handler
├── config/         # validated env, logger
└── __tests__/      # Vitest and supertest specs
```

Auth is [better-auth](https://www.better-auth.com/) on drizzle over MySQL, configured in
`src/lib/auth.ts`. The sign-up, sign-in and sign-out routes call its server API.

## Adding an endpoint

Say you're adding `GET /api/v1/bookings`.

1. Schema. Put the request and response Zod schemas in `src/schemas/booking.schema.ts`
   and export their inferred types. Type the success body with `ApiResponse<T>` from
   `src/schemas/apiResponse.schema.ts`.
2. Service. Write a `BookingService` class in `src/services/booking.service.ts`. It takes
   typed input, returns typed output and throws `AppError` subclasses from
   `src/lib/errors.ts`. It never imports Express.
3. Controller. In `src/controllers/booking.controller.ts`, write a `BookingController`
   class that takes the service in its constructor. Define each handler as an arrow
   function property typed `RequestHandler`, so `this` still works after the router calls
   it. Read input with `validated(req, schemas)`, never from `req.body` or `req.query`.
   End the file with
   `export const bookingController = new BookingController(new BookingService());`.
4. Route. In `src/routes/booking.routes.ts`, create
   `export const bookingRouter: Router = Router();` and register the handlers on it. Put
   `validate({ body, query, params })` from `src/middleware/validate.ts` in front of every
   handler that takes input. Put `authMiddleware` in front of any route that needs a
   signed-in user. It sets `req.user` and `req.session`.
5. Mount. Import the router in `src/app.ts` and add
   ``app.use(`${API_PREFIX}/bookings`, bookingRouter);`` next to the auth router, above
   `notFoundHandler`.
6. Test. Add supertest specs under `src/__tests__/booking/` that drive `app` directly.
   Cover the happy path and at least one failure, asserting on `code` and `details`. A
   spec that goes through auth mocks `src/lib/auth.js` with the in-memory instance from
   `src/__tests__/auth/auth.helpers.ts`. The comment at the top of that file shows how.
7. Add a request for the endpoint to the Bruno collection.

`src/controllers/user.controller.ts` still calls `safeParse` on `req.body` itself. That's
a known gap, so don't copy it.

Import TypeScript files with a `.js` extension, as in `../services/booking.service.js`.
The project compiles to Node ESM, and Node needs the extension at runtime.

## Changing the database schema

Tables live in `src/db/schema.ts`. `drizzle.config.ts` points drizzle-kit at that file and
reads `DATABASE_URL` from `.env`.

| Script             | Does                                                         |
| ------------------ | ------------------------------------------------------------ |
| `pnpm db:push`     | Applies `src/db/schema.ts` to the database directly          |
| `pnpm db:generate` | Writes a SQL migration for the schema change into `drizzle/` |
| `pnpm db:migrate`  | Applies pending migrations from `drizzle/`                   |
| `pnpm db:studio`   | Opens Drizzle Studio to browse the data                      |

No migrations are committed yet, so every database gets its tables from `db:push` today.
If you generate a migration, commit the `drizzle/` folder together with the schema change.

The `user`, `session`, `account` and `verification` tables belong to better-auth, and
their columns have to match what it expects. Check the better-auth docs before changing
one.

## Adding a dependency

- `pnpm add` is for packages the running server imports. Types, build tools and test
  tools go in with `pnpm add -D`.
- If the admin panel already uses a package for the same job, such as zod, vitest or
  prettier, use that one at the same major version.
- pnpm 11 skips a package's install script unless the package is listed under
  `allowBuilds` in `pnpm-workspace.yaml`. If a new dependency needs its script, add it
  there with a comment saying why, as the `esbuild` entry does.
- `drizzle-orm` and `drizzle-kit` are both pinned to `1.0.0-rc.4`. Upgrade them together.

## The admin panel

The admin panel calls this API. Its repository is `friendship-yacht-admin`, usually
checked out next to this one as `../admin-panel`, and its Zod schemas live under
`src/features/<feature>/`.

Response shapes and error `code` values are a contract with it. When you change either,
make the matching change in the admin panel as part of the same work, or say in the pull
request that the admin side still needs it. `BetterAuthError` passes better-auth's own
error codes through to clients, so a better-auth upgrade can change codes too.

## Pull requests

Before asking for review, check that:

- [ ] `pnpm type-check && pnpm lint && pnpm format:check && pnpm test` passes.
- [ ] `pnpm test:coverage` stays at or above the 60% floor. Don't lower the floor to get a
      change through.
- [ ] The change follows [`AGENTS.md`](AGENTS.md).
- [ ] A supertest spec covers the happy path and at least one failure, with `details` for
      validation errors.
- [ ] New env vars are in `src/config/env.ts` and `.env.example`. A required one also goes
      in the `env` block of `vitest.config.ts`, or every test run exits at startup.
- [ ] A changed response shape or error `code` has a matching admin panel change, or the
      description says it doesn't yet.
- [ ] A schema change says in the description whether reviewers need to run
      `pnpm db:push`.
- [ ] New endpoints have a request in the Bruno collection.
- [ ] If you touched `src/app.ts`, `src/server.ts` or `src/middleware/`, you started the
      server and called it. supertest never runs `server.ts`.

For that last check:

```bash
pnpm dev
curl -i -H "Origin: http://localhost:3000" http://localhost:8000/api/v1/health
```

The response should be a 200 with an `Access-Control-Allow-Origin` header.
