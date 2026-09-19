import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { AppError, ValidationError } from "../lib/errors.js";
import { codeForStatus, errorHandler, type HttpError } from "../middleware/error.js";
import { requestId } from "../middleware/request-id.js";

/** A throwaway app so each case controls exactly what the route throws. */
function appThrowing(error: HttpError) {
  const app = express();
  app.use(requestId);
  app.get("/boom", () => {
    throw error;
  });
  app.use(errorHandler);
  return app;
}

function httpError(message: string, status: number, code?: string): HttpError {
  const error: HttpError = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

describe("errorHandler", () => {
  it("hides the message and stack for 5xx", async () => {
    const response = await request(appThrowing(new Error("db password is hunter2"))).get(
      "/boom",
    );

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      message: "Internal server error",
      code: "INTERNAL_ERROR",
      requestId: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toContain("hunter2");
  });

  it("passes a 4xx message through with a code derived from the status", async () => {
    const response = await request(appThrowing(httpError("Missing name", 400))).get(
      "/boom",
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ message: "Missing name", code: "BAD_REQUEST" });
  });

  it("prefers an explicit code over the derived one", async () => {
    const response = await request(
      appThrowing(httpError("Slug taken", 409, "SLUG_TAKEN")),
    ).get("/boom");

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("SLUG_TAKEN");
  });

  it("honours statusCode when status is absent", async () => {
    const error: HttpError = new Error("Nope");
    error.statusCode = 403;

    const response = await request(appThrowing(error)).get("/boom");

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });
});

describe("errorHandler with AppError", () => {
  it("uses the status and code the error declares", async () => {
    const error = new AppError("Slug taken", { status: 409, code: "SLUG_TAKEN" });

    const response = await request(appThrowing(error)).get("/boom");

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ message: "Slug taken", code: "SLUG_TAKEN" });
  });

  it("exposes client-safe details on 4xx", async () => {
    const error = new ValidationError({ body: { fieldErrors: { email: ["Invalid"] } } });

    const response = await request(appThrowing(error)).get("/boom");

    expect(response.status).toBe(422);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.body.details).toEqual({
      body: { fieldErrors: { email: ["Invalid"] } },
    });
  });

  it("never exposes details on 5xx", async () => {
    const error = new AppError("Upstream down", {
      status: 503,
      code: "UPSTREAM",
      details: { host: "db.internal" },
    });

    const response = await request(appThrowing(error)).get("/boom");

    expect(response.status).toBe(503);
    expect(response.body.details).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("db.internal");
  });
});

describe("codeForStatus", () => {
  it("maps known statuses and falls back sensibly", () => {
    expect(codeForStatus(404)).toBe("NOT_FOUND");
    expect(codeForStatus(418)).toBe("CLIENT_ERROR");
    expect(codeForStatus(503)).toBe("INTERNAL_ERROR");
  });
});
