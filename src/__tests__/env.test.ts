import { describe, expect, it } from "vitest";
import { envSchema } from "../config/env.js";

/** The variables with no default; every parse needs them. */
const required = {
  DATABASE_URL: "mysql://user:password@127.0.0.1:3306/friendship-yachts",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:8000",
  ADMIN_URL: "http://localhost:3000",
};

describe("envSchema", () => {
  it("applies defaults when only the required variables are set", () => {
    const env = envSchema.parse(required);

    expect(env.PORT).toBe(8000);
    expect(env.CORS_ORIGIN).toEqual(["http://localhost:3000"]);
    expect(env.RATE_LIMIT_MAX).toBe(100);
    expect(env.RATE_LIMIT_WINDOW_MS).toBe(900000);
    expect(env.TRUST_PROXY).toBe(false);
  });

  it("coerces PORT from the string the shell provides", () => {
    expect(envSchema.parse({ ...required, PORT: "3001" }).PORT).toBe(3001);
  });

  it("rejects a PORT outside the valid range", () => {
    expect(envSchema.safeParse({ ...required, PORT: "70000" }).success).toBe(false);
    expect(envSchema.safeParse({ ...required, PORT: "abc" }).success).toBe(false);
  });

  it("splits CORS_ORIGIN on commas and trims whitespace", () => {
    const env = envSchema.parse({
      ...required,
      CORS_ORIGIN: "https://friendshipyachts.com, https://www.friendshipyachts.com ,",
    });

    expect(env.CORS_ORIGIN).toEqual([
      "https://friendshipyachts.com",
      "https://www.friendshipyachts.com",
    ]);
  });

  it("rejects a CORS_ORIGIN entry that is not a URL", () => {
    expect(
      envSchema.safeParse({ ...required, CORS_ORIGIN: "friendshipyachts.com" }).success,
    ).toBe(false);
  });

  it.each(Object.keys(required))("rejects a missing %s", (key) => {
    const { [key as keyof typeof required]: _omitted, ...rest } = required;

    expect(envSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a BETTER_AUTH_SECRET shorter than 32 characters", () => {
    expect(
      envSchema.safeParse({ ...required, BETTER_AUTH_SECRET: "too-short" }).success,
    ).toBe(false);
  });
});
