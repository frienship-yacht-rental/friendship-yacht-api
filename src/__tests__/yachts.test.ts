import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app.js";
import { NotFoundError } from "../lib/errors.js";
import { InMemoryYachtRepository } from "../modules/yachts/repository.js";
import { yachtListSchema, yachtSchema } from "../modules/yachts/schema.js";
import { YachtService } from "../modules/yachts/service.js";

describe("GET /api/v1/yachts", () => {
  it("returns a page that matches the public contract", async () => {
    const response = await request(app).get("/api/v1/yachts");

    expect(response.status).toBe(200);
    expect(yachtListSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.total).toBeGreaterThan(0);
  });

  it("paginates with limit and offset", async () => {
    const response = await request(app).get("/api/v1/yachts?limit=1&offset=1");

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].slug).toBe("meridian-52");
    expect(response.body.total).toBe(3);
  });

  it("rejects an out-of-range limit with field-level details", async () => {
    const response = await request(app).get("/api/v1/yachts?limit=500");

    expect(response.status).toBe(422);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.body.details.query.fieldErrors.limit).toBeDefined();
  });
});

describe("GET /api/v1/yachts/:slug", () => {
  it("returns the yacht", async () => {
    const response = await request(app).get("/api/v1/yachts/aurora-42");

    expect(response.status).toBe(200);
    expect(yachtSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.name).toBe("Aurora");
  });

  it("404s an unknown slug with the shared error shape", async () => {
    const response = await request(app).get("/api/v1/yachts/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      message: "Yacht not found",
      code: "NOT_FOUND",
    });
  });

  it("rejects a malformed slug before touching the service", async () => {
    const response = await request(app).get("/api/v1/yachts/Not%20A%20Slug");

    expect(response.status).toBe(422);
    expect(response.body.details.params.fieldErrors.slug).toBeDefined();
  });
});

describe("YachtService", () => {
  const service = new YachtService(new InMemoryYachtRepository());

  it("throws NotFoundError rather than returning null", async () => {
    await expect(service.getBySlug("nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});
