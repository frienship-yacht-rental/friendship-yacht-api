import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2";

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) throw new Error("Database connection string is missing");

const pool = createPool({ uri: dbUrl, supportBigNumbers: true });

export const db = drizzle({ client: pool });
