import express from "express";
import { rateLimit } from "express-rate-limit";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TooManyRequestsError } from "../lib/errors.js";
import { errorHandler } from "../middleware/error.js";
import { requestId } from "../middleware/request-id.js";
import { validate, validated } from "../middleware/validate.js";

const schemas = {
  body: z.object({ name: z.string().min(1) }),
  query: z.object({ verbose: z.stringbool().default(false) }),
  params: z.object({ id: z.coerce.number().int() }),
};

function makeApp() {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.post("/items/:id", validate(schemas), (req, res) => {
    res.json(validated(req, schemas));
  });
  app.use(errorHandler);
  return app;
}

describe("validate()", () => {
  it("parses and coerces all three parts", async () => {
    const response = await request(makeApp())
      .post("/items/42?verbose=true")
      .send({ name: "Mast", extra: "dropped" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      body: { name: "Mast" },
      query: { verbose: true },
      params: { id: 42 },
    });
  });

  it("reports every failing part at once", async () => {
    const response = await request(makeApp())
      .post("/items/abc?verbose=maybe")
      .send({ name: "" });

    expect(response.status).toBe(422);
    expect(Object.keys(response.body.details).sort()).toEqual([
      "body",
      "params",
      "query",
    ]);
  });

  it("validated() throws if the middleware was skipped", () => {
    expect(() => validated({}, schemas)).toThrow(/without validate\(\)/);
  });
});

describe("rate limiting", () => {
  it("returns the shared error shape when the limit is exceeded", async () => {
    const app = express();
    app.use(requestId);
    app.use(
      rateLimit({
        windowMs: 60_000,
        limit: 1,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        handler: (_req, _res, next) => next(new TooManyRequestsError()),
      }),
    );
    app.get("/", (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    await request(app).get("/");
    const response = await request(app).get("/");

    expect(response.status).toBe(429);
    expect(response.body.code).toBe("TOO_MANY_REQUESTS");
    expect(response.headers["ratelimit"]).toBeDefined();
  });
});
