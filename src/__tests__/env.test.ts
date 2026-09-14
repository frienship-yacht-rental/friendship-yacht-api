import { describe, expect, it } from "vitest";
import { envSchema } from "../config/env.js";

describe("envSchema", () => {
  it("applies development defaults when nothing is set", () => {
    const env = envSchema.parse({});

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(8000);
    expect(env.LOG_LEVEL).toBeUndefined();
    expect(env.CORS_ORIGIN).toEqual(["http://localhost:3000"]);
  });

  it("coerces PORT from the string the shell provides", () => {
    expect(envSchema.parse({ PORT: "3001" }).PORT).toBe(3001);
  });

  it("rejects a PORT outside the valid range", () => {
    expect(envSchema.safeParse({ PORT: "70000" }).success).toBe(false);
    expect(envSchema.safeParse({ PORT: "abc" }).success).toBe(false);
  });

  it("splits CORS_ORIGIN on commas and trims whitespace", () => {
    const env = envSchema.parse({
      CORS_ORIGIN: "https://friendshipyachts.com, https://www.friendshipyachts.com ,",
    });

    expect(env.CORS_ORIGIN).toEqual([
      "https://friendshipyachts.com",
      "https://www.friendshipyachts.com",
    ]);
  });

  it("rejects a CORS_ORIGIN entry that is not a URL", () => {
    expect(envSchema.safeParse({ CORS_ORIGIN: "friendshipyachts.com" }).success).toBe(
      false,
    );
  });

  it("rejects an unknown LOG_LEVEL", () => {
    expect(envSchema.safeParse({ LOG_LEVEL: "loud" }).success).toBe(false);
  });
});
