# Test report: auth routes

|                 |                                                                            |
| --------------- | -------------------------------------------------------------------------- |
| Date            | 2026-10-13                                                                 |
| Command         | `pnpm test` (`vitest run`), run twice with identical results               |
| Code under test | branch `parth/feat/auth` at `04a9143`, plus the new uncommitted spec files |
| Tooling         | vitest 5.0.0, supertest 7.2.2, Node 22.19.0                                |

The three auth specs drive the real Express app with supertest. `better-auth` runs for real
on its in-memory adapter (`src/__tests__/auth.helpers.ts`), so the tests need no MySQL and
never touch the development database.

## Result

| File                                            | Tests | Passed | Failed |
| ----------------------------------------------- | ----: | -----: | -----: |
| `src/__tests__/auth.sign-up.test.ts`            |    52 |     41 |     11 |
| `src/__tests__/auth.sign-in.test.ts`            |    43 |     33 |     10 |
| `src/__tests__/auth.sign-out.test.ts`           |    19 |     10 |      9 |
| **New auth specs**                              |   114 |     84 |     30 |
| `src/__tests__/app.test.ts` (existing)          |    11 |      9 |      2 |
| `env`, `error`, `logger`, `validate` (existing) |    24 |     24 |      0 |
| **Whole suite**                                 |   149 |    117 |     32 |

`pnpm type-check`, `pnpm lint` and `pnpm format:check` pass.

No application code was changed. Every one of the 30 new failures was checked against the
application code and comes from one of the five causes below.

## Failures in the new auth specs

### 1. Sign-out is called without the request's headers (9 tests)

**Where:** `src/services/user.service.ts:52` calls `auth.api.signOut()` with no headers.
`src/controllers/user.controller.ts:58` passes nothing from the request to the service.

**What happens:** every `POST /api/v1/auth/sign-out` returns
`400 { code: "VALIDATION_ERROR", message: "Headers is required" }`. No session is ended and
no cookie is cleared.

**Expected:** `204` for a live session, with the session row deleted and the cookie cleared;
`204` or `401` when there is no live session.

All in `src/__tests__/auth.sign-out.test.ts`:

| Test                                                                                 | Fails at | Got                             |
| ------------------------------------------------------------------------------------ | -------: | ------------------------------- |
| with a live session > responds 204 with an empty body                                |      :77 | status 400                      |
| with a live session > deletes the session row                                        |      :87 | session row still present       |
| with a live session > tells the browser to drop the session cookie                   |      :95 | no `Set-Cookie` header          |
| with a live session > leaves the old cookie unable to resolve a session              |     :104 | cookie still resolves a session |
| request body > signs out when a body is sent, without validating it                  |     :148 | status 400                      |
| without a cookie > answers 204 or 401, not a validation error                        |     :170 | status 400                      |
| not a live session > answers 204 or 401 for a cookie the server never issued         |     :194 | status 400                      |
| not a live session > answers 204 or 401 for a forged signature                       |     :210 | status 400                      |
| not a live session > answers 204 or 401 when the same cookie signs out a second time |     :227 | status 400                      |

The cookie test (`:95`) also needs the controller to copy better-auth's `Set-Cookie` onto
the response.

### 2. Sign-in and sign-up do not give the client a session cookie (5 tests)

**Where:** `src/services/user.service.ts:9` (sign-in) and `:30` (sign-up) keep only the data
better-auth returns and discard its response headers. `src/controllers/user.controller.ts:22`
and `:43` send JSON only.

**What happens:** the session row is created and the route answers `201` / `200`, but there
is no `Set-Cookie` header and no token in the body, so the caller has nothing to
authenticate with afterwards.

**Expected:** a `better-auth.session_token` cookie, marked `HttpOnly`, that resolves to the
user. `src/app.ts` enables CORS with credentials and `src/lib/auth.ts` sets `autoSignIn`.

| Test                                                                      | Fails at                   | Got                    |
| ------------------------------------------------------------------------- | -------------------------- | ---------------------- |
| sign-up > session > sets a session cookie on the response                 | `auth.sign-up.test.ts:127` | no `Set-Cookie` header |
| sign-up > session > sets a cookie that is a live session for the new user | `auth.sign-up.test.ts:136` | no session resolves    |
| sign-in > sets the session cookie                                         | `auth.sign-in.test.ts:108` | no `Set-Cookie` header |
| sign-in > marks the session cookie HttpOnly                               | `auth.sign-in.test.ts:118` | no `Set-Cookie` header |
| sign-in > sets a cookie that better-auth resolves to the signed-in user   | `auth.sign-in.test.ts:131` | no session resolves    |

### 3. Validation `details` is a serialised ZodError (7 tests)

**Where:** `src/controllers/user.controller.ts:16` (sign-up) and `:37` (sign-in) pass the raw
`ZodError` to `ValidationError`.

**What happens:** `details` arrives as `{ "name": "ZodError", "message": "<one JSON string>" }`.

**Expected:** the shape `README.md` documents under "Error responses":
`{ "body": { "fieldErrors": { "<field>": ["<message>"] } } }`.

| Test                                                                                         | Fails at                   |
| -------------------------------------------------------------------------------------------- | -------------------------- |
| sign-up > validation details > names the failing field under details.body.fieldErrors        | `auth.sign-up.test.ts:184` |
| sign-up > validation details > passes the schema's own message through for the failing field | `auth.sign-up.test.ts:192` |
| sign-up > validation details > lists every missing field of an empty body                    | `auth.sign-up.test.ts:202` |
| sign-in validation details > lists the failing field under details.body.fieldErrors          | `auth.sign-in.test.ts:340` |
| sign-in validation details > reports the schema's message for a password that is too short   | `auth.sign-in.test.ts:348` |
| sign-in validation details > reports the schema's message for a password that is too long    | `auth.sign-in.test.ts:358` |
| sign-in validation details > lists every missing field for an empty body                     | `auth.sign-in.test.ts:368` |

### 4. `.trim()` runs after the checks it should come before (7 tests)

**Where:** `src/schemas/user.schema.ts:5` and `:15` (`z.email().trim()`), and `:6-10` and
`:16-20` (`.min(6).max(10).trim()`).

**What happens:** the email format and the password length are checked on the untrimmed
value, and only then is the value trimmed.

| Test                                                                                     | Fails at                   | Expected | Got |
| ---------------------------------------------------------------------------------------- | -------------------------- | -------: | --: |
| sign-up > accepts an email with surrounding whitespace and stores it trimmed             | `auth.sign-up.test.ts:232` |      201 | 422 |
| sign-up > applies the minimum password length to the trimmed password (`"  abc  "`)      | `auth.sign-up.test.ts:247` |      422 | 400 |
| sign-up > rejects a whitespace-only password with the 422 validation error               | `auth.sign-up.test.ts:254` |      422 | 400 |
| sign-up > applies the maximum password length to the trimmed password (`"  anchor42  "`) | `auth.sign-up.test.ts:261` |      201 | 422 |
| sign-in > signs in when the email has surrounding whitespace                             | `auth.sign-in.test.ts:394` |      200 | 422 |
| sign-in > accepts a password that is within 10 characters once trimmed                   | `auth.sign-in.test.ts:416` |      200 | 422 |
| sign-in > rejects a password that is under 6 characters once trimmed                     | `auth.sign-in.test.ts:427` |      422 | 401 |

The two `400`s are better-auth's own `PASSWORD_TOO_SHORT`: the short password gets past the
schema and is only caught further in.

These seven are the least certain. They assume input should be trimmed before it is
checked, which is what the `.trim()` calls suggest. If padded input should be rejected
instead, remove the `.trim()` calls and delete these tests.

### 5. An empty username is accepted (2 tests)

**Where:** `src/schemas/user.schema.ts:14` is `z.string().trim()` with no minimum length.

**What happens:** a username of `""` or `"   "` returns `201` and stores a user with an
empty name.

| Test                                                                       | Fails at                   | Expected | Got |
| -------------------------------------------------------------------------- | -------------------------- | -------: | --: |
| sign-up > rejects an empty username with the 422 validation error          | `auth.sign-up.test.ts:270` |      422 | 201 |
| sign-up > rejects a whitespace-only username with the 422 validation error | `auth.sign-up.test.ts:270` |      422 | 201 |

## Failures that were already there (2 tests)

These are in `src/__tests__/app.test.ts`, which was not written or changed in this round.

| Test                                                            | Fails at | Got                                | Cause                                                             |
| --------------------------------------------------------------- | -------: | ---------------------------------- | ----------------------------------------------------------------- |
| GET /health > responds 200 with the status payload              |       :9 | status 404                         | `src/app.ts:51` serves `/api/v1/health`, the test calls `/health` |
| security headers > sets helmet defaults and hides the framework |      :50 | no `x-content-type-options` header | `src/app.ts:28` only calls `helmet.hidePoweredBy()`               |

Either the test or the app is out of date in each case.

## What passes

- **Sign-up (41):** `201` with the success envelope and the stored user's id; name and
  email stored; password hashed and never echoed; a session row opened; every missing or
  invalid field rejected with `422` and nothing stored; 6- and 10-character passwords
  accepted; duplicate email rejected with `422 USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`,
  including a different letter case; client-supplied `id`, `emailVerified` and `role`
  ignored; malformed JSON is `400`; `GET` is `404`.
- **Sign-in (33):** `200` with exactly `{ id, name, email }`; one session row opened;
  wrong password and unknown email both `401` with the same code and message; every missing
  or invalid field rejected with `422` and a sign-in message; email matched without regard
  to case; malformed JSON is `400`; `GET` is `404`.
- **Sign-out (10):** other users' sessions, the user row and the account row are left
  alone; a forged cookie does not end the real session; errors use the error envelope;
  `GET` is `404` and ends nothing. Several of these pass today only because sign-out does
  nothing at all, so they start to mean something once cause 1 is fixed.

## Notes

- Run everything with `pnpm test`, or one file with
  `pnpm exec vitest run src/__tests__/auth.sign-in.test.ts`.
- `src/__tests__/auth.helpers.ts` copies the `emailAndPassword` options from
  `src/lib/auth.ts`. Change both together.
- The pre-push hook runs `pnpm run test`, so `git push` is refused while any test fails.
