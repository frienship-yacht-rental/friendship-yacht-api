import request, { type Response } from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app.js";
import {
  resetStore,
  seedUser,
  sessionCookieFor,
  sessionFor,
  store,
} from "./auth.helpers.js";

vi.mock("../lib/auth.js", async () => {
  const { testAuth } = await import("./auth.helpers.js");
  return { auth: testAuth };
});

beforeEach(resetStore);

const SIGN_OUT = "/api/v1/auth/sign-out";
const SESSION_COOKIE = "better-auth.session_token";
const WEB_ORIGIN = "http://localhost:3000";

/** Sign-out without a live session may succeed quietly or be refused as unauthenticated. */
const SIGNED_OUT_OR_UNAUTHENTICATED = [204, 401];

/** The keys every non-2xx body carries; see "Error responses" in the README. */
const ERROR_ENVELOPE = {
  success: false,
  message: expect.any(String),
  code: expect.any(String),
  requestId: expect.any(String),
};

/** A registered user holding one live session, arranged without the HTTP routes. */
async function signedIn(overrides: Parameters<typeof seedUser>[0] = {}) {
  const user = await seedUser(overrides);
  const cookie = await sessionCookieFor(user.credentials);
  return { user, cookie };
}

/** Names of the cookies a response tells the browser to drop: emptied, or expired on arrival. */
function droppedCookies(response: Response): string[] {
  return (response.get("Set-Cookie") ?? [])
    .filter((cookie) => {
      const emptied = /^[^=]+=(;|$)/.test(cookie);
      const maxAge = /;\s*max-age=(-?\d+)/i.exec(cookie)?.[1];
      const expires = /;\s*expires=([^;]+)/i.exec(cookie)?.[1];
      return (
        emptied ||
        (maxAge !== undefined && Number(maxAge) <= 0) ||
        (expires !== undefined && Date.parse(expires) <= Date.now())
      );
    })
    .map((cookie) => cookie.slice(0, cookie.indexOf("=")));
}

/** The same session token under a well-formed signature the server never issued. */
function withForgedSignature(cookie: string): string {
  return `${cookie.slice(0, cookie.lastIndexOf(".") + 1)}${"A".repeat(43)}%3D`;
}

/** A 204 has no body; anything else must be an error in the documented envelope. */
function expectNoBodyOrErrorEnvelope(response: Response): void {
  if (response.status === 204) {
    expect(response.text).toBe("");
  } else {
    expect(response.body).toMatchObject(ERROR_ENVELOPE);
  }
}

describe("POST /api/v1/auth/sign-out with a live session", () => {
  it("responds 204 with an empty body", async () => {
    const { cookie } = await signedIn();

    const response = await request(app).post(SIGN_OUT).set("Cookie", cookie);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("deletes the session row", async () => {
    const { cookie } = await signedIn();
    expect(store.session).toHaveLength(1);

    await request(app).post(SIGN_OUT).set("Cookie", cookie);

    expect(store.session).toHaveLength(0);
  });

  it("tells the browser to drop the session cookie", async () => {
    const { cookie } = await signedIn();

    const response = await request(app).post(SIGN_OUT).set("Cookie", cookie);

    expect(droppedCookies(response)).toContain(SESSION_COOKIE);
  });

  it("leaves the old cookie unable to resolve a session", async () => {
    const { cookie } = await signedIn();
    expect(await sessionFor(cookie)).not.toBeNull();

    await request(app).post(SIGN_OUT).set("Cookie", cookie);

    expect(await sessionFor(cookie)).toBeNull();
  });

  it("keeps the user and their credentials", async () => {
    const { cookie } = await signedIn();

    await request(app).post(SIGN_OUT).set("Cookie", cookie);

    expect(store.user).toHaveLength(1);
    expect(store.account).toHaveLength(1);
  });

  it("leaves another user's session untouched", async () => {
    const { cookie } = await signedIn();
    const other = await signedIn({ email: "mate@example.com" });

    await request(app).post(SIGN_OUT).set("Cookie", cookie);

    expect(store.session.map((session) => session.userId)).toContain(other.user.id);
    expect(await sessionFor(other.cookie)).not.toBeNull();
  });

  it("allows the configured web origin to send its cookie", async () => {
    const { cookie } = await signedIn();

    const response = await request(app)
      .post(SIGN_OUT)
      .set("Origin", WEB_ORIGIN)
      .set("Cookie", cookie);

    expect(response.headers["access-control-allow-origin"]).toBe(WEB_ORIGIN);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
});

describe("POST /api/v1/auth/sign-out request body", () => {
  it("signs out when a body is sent, without validating it", async () => {
    const { cookie } = await signedIn();

    const response = await request(app)
      .post(SIGN_OUT)
      .set("Cookie", cookie)
      .send({ email: "not-an-email", password: 42, unexpected: true });

    expect(response.status).toBe(204);
  });

  it("does not let the body choose whose session ends", async () => {
    const { cookie } = await signedIn();
    const other = await signedIn({ email: "mate@example.com" });
    const otherSession = await sessionFor(other.cookie);

    await request(app).post(SIGN_OUT).set("Cookie", cookie).send({
      userId: other.user.id,
      email: other.user.email,
      token: otherSession?.session.token,
    });

    expect(await sessionFor(other.cookie)).not.toBeNull();
  });
});

describe("POST /api/v1/auth/sign-out without a cookie", () => {
  it("answers 204 or 401, not a validation error", async () => {
    const response = await request(app).post(SIGN_OUT);

    expect(SIGNED_OUT_OR_UNAUTHENTICATED).toContain(response.status);
  });

  it("sends no body, or an error in the documented envelope", async () => {
    const response = await request(app).post(SIGN_OUT);

    expectNoBodyOrErrorEnvelope(response);
  });

  it("leaves existing sessions in place", async () => {
    const { cookie } = await signedIn();

    await request(app).post(SIGN_OUT);

    expect(await sessionFor(cookie)).not.toBeNull();
  });
});

describe("POST /api/v1/auth/sign-out with a cookie that is not a live session", () => {
  const neverIssued = `${SESSION_COOKIE}=not-a-real-token.not-a-real-signature`;

  it("answers 204 or 401 for a cookie the server never issued", async () => {
    const response = await request(app).post(SIGN_OUT).set("Cookie", neverIssued);

    expect(SIGNED_OUT_OR_UNAUTHENTICATED).toContain(response.status);
  });

  it("sends no body, or an error in the documented envelope, for a cookie the server never issued", async () => {
    const response = await request(app).post(SIGN_OUT).set("Cookie", neverIssued);

    expectNoBodyOrErrorEnvelope(response);
  });

  it("answers 204 or 401 for a forged signature", async () => {
    const { cookie } = await signedIn();

    const response = await request(app)
      .post(SIGN_OUT)
      .set("Cookie", withForgedSignature(cookie));

    expect(SIGNED_OUT_OR_UNAUTHENTICATED).toContain(response.status);
  });

  it("does not end the session a forged cookie points at", async () => {
    const { cookie } = await signedIn();

    await request(app).post(SIGN_OUT).set("Cookie", withForgedSignature(cookie));

    expect(await sessionFor(cookie)).not.toBeNull();
  });

  it("answers 204 or 401 when the same cookie signs out a second time", async () => {
    const { cookie } = await signedIn();
    await request(app).post(SIGN_OUT).set("Cookie", cookie);

    const response = await request(app).post(SIGN_OUT).set("Cookie", cookie);

    expect(SIGNED_OUT_OR_UNAUTHENTICATED).toContain(response.status);
  });
});

describe("GET /api/v1/auth/sign-out", () => {
  it("responds 404 with the error envelope", async () => {
    const response = await request(app).get(SIGN_OUT);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: "Route not found",
      code: "NOT_FOUND",
      requestId: expect.any(String),
    });
  });

  it("does not end the caller's session", async () => {
    const { cookie } = await signedIn();

    await request(app).get(SIGN_OUT).set("Cookie", cookie);

    expect(await sessionFor(cookie)).not.toBeNull();
  });
});
