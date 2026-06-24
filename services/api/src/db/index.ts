import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const url = process.env.DATABASE_URL || "file:./dev.db";
const path = url.replace("file:", "");

const sqlite = new Database(path);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

export { db, sqlite };
export * from "./schema.js";
