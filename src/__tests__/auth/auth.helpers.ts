import {
  betterAuth,
  type Account,
  type Session,
  type User,
  type Verification,
} from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import type { SignInType, SignUpType } from "../../schemas/user.schema.js";

/**
 * Shared harness for the auth route specs: a real better-auth instance on an
 * in-memory database, so the routes run their true logic with no MySQL.
 *
 * Wire it in at the top of a spec. `vi.mock` is hoisted above the imports, so
 * the app only ever sees this instance and `src/db/index.ts` is never loaded:
 *
 *   vi.mock("../../lib/auth.js", async () => {
 *     const { testAuth } = await import("./auth.helpers.js");
 *     return { auth: testAuth };
 *   });
 */

/**
 * The in-memory database. Read a table at the moment you assert on it
 * (`store.user`); better-auth swaps the arrays on write, so a reference taken
 * earlier goes stale.
 */
export const store: {
  user: User[];
  session: Session[];
  account: Account[];
  verification: Verification[];
} = { user: [], session: [], account: [], verification: [] };

export const testAuth = betterAuth({
  secret: "test-only-secret-never-used-outside-vitest",
  baseURL: "http://localhost:8000",
  database: memoryAdapter(store),
  // Failed sign-ins would otherwise print WARN lines into the reporter.
  logger: { disabled: true },
  // Must be kept in sync with `emailAndPassword` in src/lib/auth.ts.
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
});

/** Empties every table in place. Call it in `beforeEach`. */
export function resetStore(): void {
  for (const rows of Object.values(store)) rows.length = 0;
}

/** Passes SIGN_UP_VALIDATION, and SIGN_IN_VALIDATION too since that strips `username`. */
export const TEST_USER: SignUpType = {
  username: "Test Sailor",
  email: "sailor@example.com",
  password: "anchor42",
};

/**
 * Registers a user through better-auth itself, not through the HTTP routes.
 * The session that `autoSignIn` opens is dropped again, so the result is a
 * registered user who is signed out: one `user` row, one `account` row.
 */
export async function seedUser(overrides: Partial<SignUpType> = {}) {
  const { username, email, password } = { ...TEST_USER, ...overrides };
  const { user } = await testAuth.api.signUpEmail({
    body: { name: username, email, password },
  });
  store.session = store.session.filter((session) => session.userId !== user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    credentials: { email, password },
  };
}

/** Joins Set-Cookie values (`response.get("Set-Cookie")`) into a Cookie request header. */
export function toCookieHeader(setCookie: string[] = []): string {
  return setCookie.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

/**
 * Signs in through better-auth itself and returns the value to send as the
 * `Cookie` request header. The user must exist already; see `seedUser`.
 */
export async function sessionCookieFor(
  credentials: SignInType = TEST_USER,
): Promise<string> {
  const { headers } = await testAuth.api.signInEmail({
    body: { email: credentials.email, password: credentials.password },
    returnHeaders: true,
  });
  return toCookieHeader(headers.getSetCookie());
}

/** What better-auth makes of a Cookie header: `{ session, user }`, or null if it is not a live session. */
export function sessionFor(cookie: string) {
  return testAuth.api.getSession({ headers: new Headers({ cookie }) });
}
