import { expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateDatabase } from "../../scripts/migrate.js";

it("baselines the existing schema, backs up, preserves accounts and is repeatable", async () => {
  const root = mkdtempSync(join(tmpdir(), "telefoninho-migration-")); const path = join(root, "legacy.db");
  const sqlite = new Database(path);
  for (const name of readdirSync("drizzle").filter((name) => /^000[0-4]_.*sql$/.test(name)).sort()) sqlite.exec(readFileSync(join("drizzle", name), "utf8").replaceAll("--> statement-breakpoint", ""));
  sqlite.prepare("INSERT INTO parent_user (id,email,password_hash,display_name,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("parent", "parent@test.com", "legacy-hash", "Parent", 1, 1);
  sqlite.close(); await migrateDatabase(path); await migrateDatabase(path);
  const migrated = new Database(path);
  expect(migrated.prepare("SELECT password_hash FROM parent_user WHERE id='parent'").get()).toEqual({ password_hash: "legacy-hash" });
  expect(migrated.prepare("SELECT auth_version FROM parent_user WHERE id='parent'").get()).toEqual({ auth_version: 0 });
  expect(readdirSync(root).filter((name) => name.includes("before-beta"))).toHaveLength(1);
  migrated.close();
});
