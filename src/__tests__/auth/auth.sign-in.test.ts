import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../app.js";
import {
  resetStore,
  seedUser,
  sessionFor,
  store,
  TEST_USER,
  toCookieHeader,
} from "./auth.helpers.js";

vi.mock("../../lib/auth.js", async () => {
  const { testAuth } = await import("./auth.helpers.js");
  return { auth: testAuth };
});

beforeEach(resetStore);

const SIGN_IN = "/api/v1/auth/sign-in";

/** A Set-Cookie value carrying a non-empty better-auth session token. */
const SESSION_COOKIE = /session_token=[^;]+/;

function signIn(body: object) {
  return request(app).post(SIGN_IN).send(body);
}

describe("POST /api/v1/auth/sign-in", () => {
  it("responds 200 for a registered user with the right password", async () => {
    const user = await seedUser();

    const response = await signIn(user.credentials);

    expect(response.status).toBe(200);
  });

  it("responds as JSON", async () => {
    const user = await seedUser();

    const response = await signIn(user.credentials);

    expect(response.headers["content-type"]).toMatch(/application\/json/);
  });

  it("wraps the result in the success envelope", async () => {
    const user = await seedUser();

    const response = await signIn(user.credentials);

    expect(response.body).toEqual({
      success: true,
      message: expect.any(String),
      data: expect.any(Object),
    });
  });

  it("returns exactly the id, name and email of the user", async () => {
    const user = await seedUser();

    const response = await signIn(user.credentials);

    expect(response.body.data).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  });

  it("returns the user whose credentials were sent when several are registered", async () => {
    await seedUser();
    const mate = await seedUser({
      username: "First Mate",
      email: "mate@example.com",
      password: "bowline7",
    });

    const response = await signIn(mate.credentials);

    expect(response.body.data).toEqual({
      id: mate.id,
      name: mate.name,
      email: mate.email,
    });
  });

  it("never echoes the password", async () => {
    const user = await seedUser();

    const response = await signIn(user.credentials);

    expect(response.text).not.toContain(user.credentials.password);
  });

  it("opens one session for the user", async () => {
    const user = await seedUser();

    await signIn(user.credentials);

    expect(store.session.map((session) => session.userId)).toEqual([user.id]);
  });

  it("sets the session cookie", async () => {
    const user = await seedUser();

    const response = await signIn(user.credentials);

    expect(response.get("Set-Cookie") ?? []).toEqual(
      expect.arrayContaining([expect.stringMatching(SESSION_COOKIE)]),
    );
  });

  it("marks the session cookie HttpOnly", async () => {
    const user = await seedUser();

    const response = await signIn(user.credentials);

    expect(response.get("Set-Cookie") ?? []).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/session_token=[^;]+.*;\s*HttpOnly/i),
      ]),
    );
  });

  it("sets a cookie that better-auth resolves to the signed-in user", async () => {
    const user = await seedUser();

    const response = await signIn(user.credentials);
    const session = await sessionFor(toCookieHeader(response.get("Set-Cookie")));

    expect(session?.user.id).toBe(user.id);
  });

  it("lets the configured web origin receive the response with credentials", async () => {
    const user = await seedUser();

    const response = await signIn(user.credentials).set(
      "Origin",
      "http://localhost:3000",
    );

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("matches the email without regard to letter case", async () => {
    const user = await seedUser();

    const response = await signIn({
      email: user.credentials.email.toUpperCase(),
      password: user.credentials.password,
    });

    expect(response.status).toBe(200);
  });

  it("ignores fields the schema does not declare", async () => {
    await seedUser();

    const response = await signIn({ ...TEST_USER, role: "admin" });

    expect(response.status).toBe(200);
  });
});

describe("POST /api/v1/auth/sign-in with a wrong password", () => {
  it("responds 401 with the error envelope", async () => {
    const user = await seedUser();

    const response = await signIn({ email: user.credentials.email, password: "wrong42" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid email or password",
      code: "INVALID_EMAIL_OR_PASSWORD",
      requestId: expect.any(String),
    });
  });

  it("does not open a session", async () => {
    const user = await seedUser();

    await signIn({ email: user.credentials.email, password: "wrong42" });

    expect(store.session).toHaveLength(0);
  });

  it("does not set a session cookie", async () => {
    const user = await seedUser();

    const response = await signIn({ email: user.credentials.email, password: "wrong42" });

    expect(toCookieHeader(response.get("Set-Cookie"))).not.toContain("session_token");
  });

  it("treats the password as case-sensitive", async () => {
    const user = await seedUser();

    const response = await signIn({
      email: user.credentials.email,
      password: user.credentials.password.toUpperCase(),
    });

    expect(response.status).toBe(401);
  });
});

describe("POST /api/v1/auth/sign-in with an unregistered email", () => {
  it("responds 401 with the error envelope", async () => {
    const user = await seedUser();

    const response = await signIn({
      email: "stranger@example.com",
      password: user.credentials.password,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid email or password",
      code: "INVALID_EMAIL_OR_PASSWORD",
      requestId: expect.any(String),
    });
  });

  it("answers exactly as it does for a wrong password", async () => {
    const user = await seedUser();

    const wrongPassword = await signIn({
      email: user.credentials.email,
      password: "wrong42",
    });
    const unregistered = await signIn({
      email: "stranger@example.com",
      password: "wrong42",
    });

    expect({
      status: unregistered.status,
      code: unregistered.body.code,
      message: unregistered.body.message,
    }).toEqual({
      status: wrongPassword.status,
      code: wrongPassword.body.code,
      message: wrongPassword.body.message,
    });
  });

  it("does not open a session", async () => {
    const user = await seedUser();

    await signIn({ email: "stranger@example.com", password: user.credentials.password });

    expect(store.session).toHaveLength(0);
  });

  it("does not register the email", async () => {
    const user = await seedUser();

    await signIn({ email: "stranger@example.com", password: user.credentials.password });

    expect(store.user.map((row) => row.email)).toEqual([user.email]);
  });
});

describe("POST /api/v1/auth/sign-in validation", () => {
  it.each([
    { when: "the email is missing", body: { password: TEST_USER.password } },
    { when: "the password is missing", body: { email: TEST_USER.email } },
    {
      when: "the email is not an email address",
      body: { email: "not-an-email", password: TEST_USER.password },
    },
    {
      when: "the email is not a string",
      body: { email: 42, password: TEST_USER.password },
    },
    {
      when: "the password is not a string",
      body: { email: TEST_USER.email, password: 12345678 },
    },
    {
      when: "the password is empty",
      body: { email: TEST_USER.email, password: "" },
    },
    { when: "the body is an empty object", body: {} },
  ])("responds 422 with the error envelope when $when", async ({ body }) => {
    const response = await signIn(body);

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      success: false,
      message: expect.stringMatching(/sign in/i),
      code: "VALIDATION_ERROR",
      requestId: expect.any(String),
    });
  });

  it("responds 422 with the error envelope when there is no body at all", async () => {
    const response = await request(app).post(SIGN_IN);

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      success: false,
      message: expect.stringMatching(/sign in/i),
      code: "VALIDATION_ERROR",
      requestId: expect.any(String),
    });
  });

  // A length rule here would lock out users whose password predates it.
  it("passes a password shorter than sign-up allows on to the credential check", async () => {
    const user = await seedUser();

    const response = await signIn({ email: user.credentials.email, password: "a" });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_EMAIL_OR_PASSWORD");
  });

  it("accepts the longest password sign-up allows", async () => {
    const user = await seedUser({ password: "p".repeat(128) });

    const response = await signIn(user.credentials);

    expect(response.status).toBe(200);
  });
});

describe("POST /api/v1/auth/sign-in validation details", () => {
  it("lists the failing field under details.body.fieldErrors", async () => {
    const response = await signIn({
      email: "not-an-email",
      password: TEST_USER.password,
    });

    expect(response.body.details).toMatchObject({
      body: { fieldErrors: { email: expect.arrayContaining([expect.any(String)]) } },
    });
  });

  it("reports the schema's message for an empty password", async () => {
    const response = await signIn({ email: TEST_USER.email, password: "" });

    expect(response.body.details).toMatchObject({
      body: {
        fieldErrors: { password: ["Password is required."] },
      },
    });
  });

  it("lists every missing field for an empty body", async () => {
    const response = await signIn({});

    expect(response.body.details).toMatchObject({
      body: {
        fieldErrors: { email: expect.any(Array), password: expect.any(Array) },
      },
    });
  });

  it("does not echo the password of a rejected body", async () => {
    const response = await signIn({
      email: "not-an-email",
      password: "hunter2-hunter2",
    });

    expect(response.status).toBe(422);

    expect(response.text).not.toContain("hunter2-hunter2");
  });
});

describe("POST /api/v1/auth/sign-in surrounding whitespace", () => {
  it("signs in when the email has surrounding whitespace", async () => {
    const user = await seedUser();

    const response = await signIn({
      email: `  ${user.credentials.email}  `,
      password: user.credentials.password,
    });

    expect(response.status).toBe(200);
  });

  it("does not trim the password", async () => {
    const user = await seedUser({ password: "anchor42" });

    const response = await signIn({
      email: user.credentials.email,
      password: " anchor42 ",
    });

    expect(response.status).toBe(401);
  });

  it("signs in with a password whose surrounding whitespace is part of it", async () => {
    const user = await seedUser({ password: " anchor42 " });

    const response = await signIn(user.credentials);

    expect(response.status).toBe(200);
  });
});

describe("POST /api/v1/auth/sign-in body parsing", () => {
  it("responds 400 with the error envelope for malformed json", async () => {
    const response = await request(app)
      .post(SIGN_IN)
      .set("Content-Type", "application/json")
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: expect.any(String),
      code: "BAD_REQUEST",
      requestId: expect.any(String),
    });
  });
});

describe("GET /api/v1/auth/sign-in", () => {
  it("responds 404 with the error envelope", async () => {
    const response = await request(app).get(SIGN_IN);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: "Route not found",
      code: "NOT_FOUND",
      requestId: expect.any(String),
    });
  });
});
