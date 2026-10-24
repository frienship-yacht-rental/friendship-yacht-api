import { config as loadDotenv } from "dotenv";
import { z } from "zod";

// Tests get a fixed environment from vitest.config.ts; a developer's .env must
// not leak into them.
if (process.env.NODE_ENV !== "test") {
  loadDotenv({ quiet: true });
}

const environments = ["development", "test", "production"] as const;

export const envSchema = z.object({
  NODE_ENV: z.enum(environments).default("development"),

  PORT: z.coerce.number().int().min(1).max(65535).default(8000),

  /**
   * Comma-separated list of origins allowed to call this API from a browser.
   * Server-to-server callers (the Next.js server) are unaffected by CORS.
   */
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1)),

  /** Requests per window per client IP on /api routes. */
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .default(15 * 60 * 1000),

  /**
   * Set when running behind a load balancer or reverse proxy so `req.ip` and
   * rate limiting use the client address from X-Forwarded-For, not the proxy.
   */
  TRUST_PROXY: z.stringbool().default(false),

  /** MySQL connection string, e.g. mysql://user:pass@host:3306/db. */
  DATABASE_URL: z.url(),

  /** Signs session cookies and tokens. Generate with `openssl rand -base64 32`. */
  BETTER_AUTH_SECRET: z.string().min(32),
  /** Public base URL of this API; better-auth builds callback URLs from it. */
  BETTER_AUTH_URL: z.url(),

  ADMIN_URL: z.url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // The logger depends on this module, so this is the one place console is
  // the right tool. Fail fast: a misconfigured process must not start.
  console.error("Invalid environment variables:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

/**
 * Validated, typed environment. Import this instead of reading `process.env`
 * so every value is parsed once at startup rather than trusted at each use.
 */
export const env: z.infer<typeof envSchema> = parsed.data;

// NODE_ENV is set by the runner (vitest, the start command), not by .env.
export const isProduction = process.env.NODE_ENV === "production";
export const isTest = process.env.NODE_ENV === "test";
