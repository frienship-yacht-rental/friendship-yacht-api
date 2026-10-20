# Code review: `src/`

I reviewed every file under `src/` except `src/__tests__/`. There is no spec or issue in the repo, so I checked the code against `AGENTS.md` and for plain correctness. `pnpm type-check` and `pnpm lint` both pass. I didn't run the tests.

The base is solid. The env schema, error handler, request ids, logger and graceful shutdown are better than in most Express apps. The problems are in the auth layer on top of them.

## Wrong, fix these

1. `controllers/user.controller.ts:70` sends a JSON body with status 204. A 204 response has no body, so Express drops the JSON and the client never sees the message. Use `res.status(200).json(...)` or `res.status(204).end()`.

2. `app.ts:51` serves health at `/api/v1/health`. The comment above it, `AGENTS.md` and the boot check in `CLAUDE.md` all say `/health`, so that curl gets a 404 today. Move it to `/health`. If you keep it versioned, use `API_PREFIX` instead of the hardcoded string.

3. `app.ts:28` only calls `helmet.hidePoweredBy()`. The comment says this adds security headers, but it doesn't add any. Use `app.use(helmet())`.

4. `services/user.service.ts:14` and `:39` hardcode `callbackURL: "http://localhost:8000"`, which is wrong on any other host. better-auth uses it only for email verification redirects, and verification isn't turned on. Delete it now, and read it from `env` once verification exists.

5. The password rules are wrong in both directions. `schemas/user.schema.ts:9-10,19-20` and `lib/auth.ts:17-18` cap passwords at 10 characters, which rejects most password-manager output and every passphrase. `.trim()` silently changes what the user typed. I'd use min 8, max 128, and no trim. The sign-in schema should only check that the password isn't empty, or a stricter rule later locks out existing users. Also fix "atleast" in the messages.

6. `app.ts:36` mounts better-auth's own handler at `/api/auth/*` alongside your `/api/v1/auth/*` routes, so there are two sign-up endpoints. `/api/auth/sign-up/email` skips your Zod rules, your error format, the express rate limiter and the access log. Decide which one the web app calls. If it calls your routes, delete line 36. If it uses the better-auth client, keep the handler, move it below morgan, and set `trustedOrigins: env.CORS_ORIGIN` in `lib/auth.ts`. Without that setting, better-auth rejects cookie POSTs from `localhost:3000` with `INVALID_ORIGIN`.

## Breaks the repo's own rules

The rule numbers refer to `AGENTS.md`.

7. Rule 2 says to validate at the edge. `user.controller.ts:15` and `:40` call `safeParse(req.body)` by hand, and `middleware/validate.ts` is never used. This also produces two different `details` shapes. The controller sends a raw `ZodError`, while `validate()` sends `z.flattenError`. Add `validate({ body: SIGN_UP_VALIDATION })` in the router and read the result with `validated()`.

8. Rules 3 and 4 say services know nothing about HTTP and depend on interfaces. `AuthService` takes `Headers`, returns raw `Set-Cookie` strings and imports the `auth` singleton directly. The controller asks for `AuthService` instead of `IAuthService` at `user.controller.ts:9`. As a result, the service can't be tested without a real database. Pass `auth` in through the constructor and type it against the interface. With a cookie-based library you can't avoid passing some headers around, so write that exception into `AGENTS.md` before someone copies the pattern.

9. Rule 7 says every response shape is a Zod schema. `schemas/apiResponse.schema.ts` is a plain TS type, so the web repo can't validate against it. `IAuthService` sits in `schemas/user.schema.ts` but belongs in the service file. That leaves the schema file with only Zod in it.

10. Rule 8 says error codes are a contract. `lib/errors.ts:76` passes better-auth's codes straight through, such as `USER_ALREADY_EXISTS` and `INVALID_EMAIL_OR_PASSWORD`. A library upgrade can rename them and break the web client with no change in this repo. Map the ones you expect to codes you own.

## Code smells, judgement calls

11. Duplicated code. The three methods in `services/user.service.ts` repeat the same try/catch and return shape, and the three controller methods repeat the `Set-Cookie` line. One small helper for each would remove most of that.

12. Dead branch. `BetterAuthResponse` at `user.schema.ts:27` has an error variant and every return sets `error: null`, but the service throws on failure. Drop the `error` field and the `AuthError` type.

13. The names don't match. `user.controller.ts`, `user.routes.ts` and `user.service.ts` hold `UserController`, `userRouter` and `AuthService`, mounted at `/auth`. Name all of it auth. `SIGN_IN_VALIDATION` reads like a constant, and `signInSchema` is the usual name. The `username` field is stored in `name`, which isn't unique. Either call the field `name` or use better-auth's username plugin.

14. Unused code. `middleware/auth.middleware.ts` is never mounted. `authRelations` in `db/schema.ts:83` is never passed to `drizzle()`, so it has no effect. The comment at `auth.middleware.ts:15` says "spreading" but the code assigns.

## Worth doing next

15. Remove `express.urlencoded` at `app.ts:35`. This is a JSON API, and that parser lets a plain HTML form on another site POST to `/api/v1/auth/sign-in`. better-auth's origin check doesn't run for `auth.api.*` calls, so nothing else blocks it.

16. Give sign-in and sign-up a stricter rate limit of their own. The global limiter at `app.ts:58` allows 100 requests per 15 minutes per IP, shared by the whole API. That's too loose for a login form.

17. Outside `src/`, `AGENTS.md` is out of date. It describes `src/modules/` and `docs/adr/`, and neither exists. Agents and new contributors follow that file, so update it to match the current layout.
