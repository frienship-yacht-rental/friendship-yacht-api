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
    expect(response.body).toEqual({ message: "Route not found" });
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
