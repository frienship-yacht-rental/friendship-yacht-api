import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { env } from "../config/env.js";
import { db } from "../db/index.js";
import { account, session, user, verification } from "../db/schema.js";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "mysql",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 6,
    maxPasswordLength: 10,
  },
});
