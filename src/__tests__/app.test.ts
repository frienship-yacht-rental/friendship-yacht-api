import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app.js";

describe("GET /health", () => {
  it("responds 200 with the status payload", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Server status OK" });
  });

  it("responds as JSON", async () => {
    const response = await request(app).get("/health");

    expect(response.headers["content-type"]).toMatch(/application\/json/);
  });
});

describe("unknown routes", () => {
  it("responds 404 with a message instead of the default express html", async () => {
    const response = await request(app).get("/this-route-does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: "Route not found",
      code: "NOT_FOUND",
      requestId: expect.any(String),
    });
  });
});

describe("body parsing", () => {
  it("rejects malformed json with a 4xx rather than crashing", async () => {
    const response = await request(app)
      .post("/health")
      .set("Content-Type", "application/json")
      .send('{"broken":');

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });
});

describe("security headers", () => {
  it("sets helmet defaults and hides the framework", async () => {
    const response = await request(app).get("/health");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBeDefined();
    expect(response.headers["strict-transport-security"]).toBeDefined();
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("cors", () => {
  it("allows the configured web origin", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:3000");

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not echo an origin that is not on the list", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "https://evil.example");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers preflight for the configured origin", async () => {
    const response = await request(app)
      .options("/health")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
  });
});

describe("request id", () => {
  it("mints an id and echoes it in the response", async () => {
    const response = await request(app).get("/health");

    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("propagates an id supplied by an upstream caller", async () => {
    const response = await request(app)
      .get("/health")
      .set("X-Request-Id", "trace-abc-123");

    expect(response.headers["x-request-id"]).toBe("trace-abc-123");
  });

  it("includes the id in error bodies so users can quote it", async () => {
    const response = await request(app)
      .get("/does-not-exist")
      .set("X-Request-Id", "trace-abc-123");

    expect(response.body.requestId).toBe("trace-abc-123");
  });
});
