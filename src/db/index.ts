import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2";
import { env } from "../config/env.js";

const pool = createPool({ uri: env.DATABASE_URL, supportBigNumbers: true });

export const db = drizzle({ client: pool });
