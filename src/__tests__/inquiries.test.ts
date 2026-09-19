import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app.js";
import { inquiryReceiptSchema } from "../modules/inquiries/schema.js";

const valid = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "I would like to arrange a sea trial next month.",
};

describe("POST /api/v1/inquiries", () => {
  it("accepts a valid enquiry and returns a receipt", async () => {
    const response = await request(app).post("/api/v1/inquiries").send(valid);

    expect(response.status).toBe(201);
    expect(inquiryReceiptSchema.safeParse(response.body).success).toBe(true);
  });

  it("accepts an enquiry about a specific yacht", async () => {
    const response = await request(app)
      .post("/api/v1/inquiries")
      .send({ ...valid, yachtSlug: "aurora-42" });

    expect(response.status).toBe(201);
  });

  it("rejects an enquiry about a yacht that does not exist", async () => {
    const response = await request(app)
      .post("/api/v1/inquiries")
      .send({ ...valid, yachtSlug: "ghost-99" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("BAD_REQUEST");
    expect(response.body.details).toEqual({ field: "yachtSlug" });
  });

  it("returns field errors the form can render", async () => {
    const response = await request(app)
      .post("/api/v1/inquiries")
      .send({ name: "A", email: "not-an-email", message: "short" });

    expect(response.status).toBe(422);
    const fieldErrors = response.body.details.body.fieldErrors;
    expect(Object.keys(fieldErrors).sort()).toEqual(["email", "message", "name"]);
  });

  it("strips fields that are not part of the contract", async () => {
    const response = await request(app)
      .post("/api/v1/inquiries")
      .send({ ...valid, isAdmin: true });

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty("isAdmin");
  });
});
