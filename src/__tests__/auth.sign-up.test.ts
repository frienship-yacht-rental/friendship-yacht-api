import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app.js";
import {
  resetStore,
  seedUser,
  sessionCookieFor,
  sessionFor,
  store,
  TEST_USER,
  toCookieHeader,
} from "./auth.helpers.js";

vi.mock("../lib/auth.js", async () => {
  const { testAuth } = await import("./auth.helpers.js");
  return { auth: testAuth };
});

beforeEach(resetStore);

const SIGN_UP = "/api/v1/auth/sign-up";

/** POSTs a JSON body to the route. Defaults to a payload the schema accepts. */
function signUp(body: object = TEST_USER) {
  return request(app).post(SIGN_UP).send(body);
}

/** What the controller declares for a body that fails SIGN_UP_VALIDATION. */
const validationError = {
  success: false,
  message: "Sign up validation failed.",
  code: "VALIDATION_ERROR",
  requestId: expect.any(String),
};

const { username, email, password } = TEST_USER;

const invalidBodies: { label: string; body: object }[] = [
  { label: "a missing username", body: { email, password } },
  { label: "a missing email", body: { username, password } },
  { label: "a missing password", body: { username, email } },
  { label: "an invalid email", body: { username, email: "not-an-email", password } },
  { label: "a 5-character password", body: { username, email, password: "p".repeat(5) } },
  {
    label: "an 11-character password",
    body: { username, email, password: "p".repeat(11) },
  },
  { label: "an empty JSON body", body: {} },
];

describe("POST /api/v1/auth/sign-up", () => {
  describe("with a valid body", () => {
    it("responds 201", async () => {
      const response = await signUp();

      expect(response.status).toBe(201);
    });

    it("responds with the success envelope and only the new id as data", async () => {
      const response = await signUp();

      expect(response.body).toEqual({
        success: true,
        message: expect.any(String),
        data: { id: expect.any(String) },
      });
    });

    it("returns the id of the user it stored", async () => {
      const response = await signUp();

      expect(store.user).toHaveLength(1);
      expect(response.body.data?.id).toBe(store.user[0]?.id);
    });

    it("stores the submitted username as the user's name", async () => {
      await signUp();

      expect(store.user[0]?.name).toBe(TEST_USER.username);
    });

    it("stores the submitted email", async () => {
      await signUp();

      expect(store.user[0]?.email).toBe(TEST_USER.email);
    });

    it("never stores the password in plain text", async () => {
      await signUp();

      expect(store.account).toHaveLength(1);
      expect(JSON.stringify(store)).not.toContain(TEST_USER.password);
    });

    it("never echoes the password in the response", async () => {
      const response = await signUp();

      expect(response.text).not.toContain(TEST_USER.password);
    });

    it("never returns the stored password hash", async () => {
      const response = await signUp();

      const hash = store.account[0]?.password;
      expect(hash).toEqual(expect.any(String));
      expect(response.text).not.toContain(hash);
    });

    it("lets the new user sign in with the same credentials", async () => {
      await signUp();

      await expect(sessionCookieFor(TEST_USER)).resolves.toContain("session_token=");
    });
  });

  describe("session", () => {
    it("opens a session for the new user", async () => {
      const response = await signUp();

      expect(store.session).toHaveLength(1);
      expect(store.session[0]?.userId).toBe(response.body.data?.id);
    });

    it("sets a session cookie on the response", async () => {
      const response = await signUp();

      expect(response.get("Set-Cookie")).toEqual(
        expect.arrayContaining([expect.stringContaining("session_token=")]),
      );
    });

    it("sets a cookie that is a live session for the new user", async () => {
      const response = await signUp();

      const session = await sessionFor(toCookieHeader(response.get("Set-Cookie")));
      expect(session?.user.id).toBe(response.body.data?.id);
    });
  });

  describe("validation", () => {
    it.each(invalidBodies)(
      "rejects $label with the 422 validation error",
      async ({ body }) => {
        const response = await signUp(body);

        expect(response.status).toBe(422);
        expect(response.body).toMatchObject(validationError);
      },
    );

    it.each(invalidBodies)("stores nothing for $label", async ({ body }) => {
      await signUp(body);

      expect(store.user).toHaveLength(0);
      expect(store.account).toHaveLength(0);
      expect(store.session).toHaveLength(0);
    });

    it("rejects a request with no body with the 422 validation error", async () => {
      const response = await request(app).post(SIGN_UP);

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject(validationError);
    });

    it.each([6, 10])("accepts a %i-character password", async (length) => {
      const response = await signUp({ ...TEST_USER, password: "p".repeat(length) });

      expect(response.status).toBe(201);
    });

    it("carries the caller's request id in the error body", async () => {
      const response = await signUp({}).set("X-Request-Id", "trace-sign-up-1");

      expect(response.body.requestId).toBe("trace-sign-up-1");
    });
  });

  // The shape the README documents under "Error responses".
  describe("validation details", () => {
    it("names the failing field under details.body.fieldErrors", async () => {
      const response = await signUp({ ...TEST_USER, email: "not-an-email" });

      expect(response.body.details).toMatchObject({
        body: { fieldErrors: { email: [expect.any(String)] } },
      });
    });

    it("passes the schema's own message through for the failing field", async () => {
      const response = await signUp({ ...TEST_USER, password: "p".repeat(5) });

      expect(response.body.details).toMatchObject({
        body: {
          fieldErrors: { password: ["Password should be atleast 6 characters long."] },
        },
      });
    });

    it("lists every missing field of an empty body", async () => {
      const response = await signUp({});

      expect(response.body.details).toMatchObject({
        body: {
          fieldErrors: {
            username: [expect.any(String)],
            email: [expect.any(String)],
            password: [expect.any(String)],
          },
        },
      });
    });

    it("does not echo a rejected password back in the error", async () => {
      const response = await signUp({ ...TEST_USER, password: "rejected-secret" });

      expect(response.status).toBe(422);
      expect(response.text).not.toContain("rejected-secret");
    });
  });

  // SIGN_UP_VALIDATION declares .trim() on all three fields.
  describe("surrounding whitespace", () => {
    it("stores the username without its surrounding whitespace", async () => {
      await signUp({ ...TEST_USER, username: "  Test Sailor  " });

      expect(store.user[0]?.name).toBe("Test Sailor");
    });

    it("accepts an email with surrounding whitespace and stores it trimmed", async () => {
      const response = await signUp({ ...TEST_USER, email: "  sailor@example.com  " });

      expect(response.status).toBe(201);
      expect(store.user[0]?.email).toBe("sailor@example.com");
    });

    it("stores the password without its surrounding whitespace", async () => {
      await signUp({ ...TEST_USER, password: " anchor42 " });

      await expect(
        sessionCookieFor({ email: TEST_USER.email, password: "anchor42" }),
      ).resolves.toContain("session_token=");
    });

    it("applies the minimum password length to the trimmed password", async () => {
      const response = await signUp({ ...TEST_USER, password: "  abc  " });

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject(validationError);
    });

    it("rejects a whitespace-only password with the 422 validation error", async () => {
      const response = await signUp({ ...TEST_USER, password: " ".repeat(8) });

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject(validationError);
    });

    it("applies the maximum password length to the trimmed password", async () => {
      const response = await signUp({ ...TEST_USER, password: "  anchor42  " });

      expect(response.status).toBe(201);
    });

    it.each([
      { label: "an empty", blank: "" },
      { label: "a whitespace-only", blank: "   " },
    ])("rejects $label username with the 422 validation error", async ({ blank }) => {
      const response = await signUp({ ...TEST_USER, username: blank });

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject(validationError);
    });
  });

  describe("with an email that is already registered", () => {
    it("responds 422 USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL in the error contract", async () => {
      await seedUser();

      const response = await signUp();

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        success: false,
        message: expect.any(String),
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
        requestId: expect.any(String),
      });
    });

    it("does not store a second user", async () => {
      await seedUser();

      await signUp();

      expect(store.user).toHaveLength(1);
      expect(store.account).toHaveLength(1);
    });

    it("does not sign the caller in", async () => {
      await seedUser();

      const response = await signUp();

      expect(store.session).toHaveLength(0);
      expect(toCookieHeader(response.get("Set-Cookie"))).not.toContain("session_token=");
    });

    it("leaves the registered user's name and password unchanged", async () => {
      await seedUser();

      await signUp({ ...TEST_USER, username: "Impostor", password: "hijack99" });

      expect(store.user[0]?.name).toBe(TEST_USER.username);
      await expect(sessionCookieFor(TEST_USER)).resolves.toContain("session_token=");
    });

    it("treats an email that differs only by case as already registered", async () => {
      await seedUser();

      const response = await signUp({
        ...TEST_USER,
        email: TEST_USER.email.toUpperCase(),
      });

      expect(response.status).toBe(422);
      expect(response.body.code).toBe("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL");
      expect(store.user).toHaveLength(1);
    });
  });

  describe("fields the client must not control", () => {
    const forged = {
      ...TEST_USER,
      id: "client-chosen-id",
      emailVerified: true,
      role: "admin",
    };

    it("does not let the client choose the user id", async () => {
      const response = await signUp(forged);

      expect(response.status).toBe(201);
      expect(response.body.data?.id).not.toBe("client-chosen-id");
      expect(store.user[0]?.id).not.toBe("client-chosen-id");
    });

    it("does not let the client mark the email as verified", async () => {
      const response = await signUp(forged);

      expect(response.status).toBe(201);
      expect(store.user[0]?.emailVerified).toBe(false);
    });

    it("does not let the client give itself a role", async () => {
      const response = await signUp(forged);

      expect(response.status).toBe(201);
      expect(store.user[0]).not.toHaveProperty("role");
    });
  });

  describe("malformed JSON", () => {
    it("responds 400 BAD_REQUEST in the error contract", async () => {
      const response = await request(app)
        .post(SIGN_UP)
        .set("Content-Type", "application/json")
        .send('{"email":');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        message: expect.any(String),
        code: "BAD_REQUEST",
        requestId: expect.any(String),
      });
      expect(store.user).toHaveLength(0);
    });
  });

  describe("other methods", () => {
    it("responds 404 NOT_FOUND in the error contract to a GET", async () => {
      const response = await request(app).get(SIGN_UP);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        message: "Route not found",
        code: "NOT_FOUND",
        requestId: expect.any(String),
      });
    });
  });
});
