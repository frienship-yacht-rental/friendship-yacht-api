import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) throw new Error("Database connection string is missing");

export const db = drizzle({ connection: { uri: dbUrl } });
