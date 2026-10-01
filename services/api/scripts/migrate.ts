import Database from "better-sqlite3";
import crypto from "node:crypto";
import { chmodSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export async function migrateDatabase(path: string, directory = resolve("drizzle")): Promise<void> {
  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys = ON");
  try {
    sqlite.exec("CREATE TABLE IF NOT EXISTS telefoninho_migrations (name text PRIMARY KEY, checksum text NOT NULL)");
    const files = readdirSync(directory).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort();
    const pending: { name: string; source: string; checksum: string; baseline: boolean }[] = [];
    for (const name of files) {
      const source = readFileSync(resolve(directory, name), "utf8");
      const checksum = crypto.createHash("sha256").update(source).digest("hex");
      const applied = sqlite.prepare("SELECT checksum FROM telefoninho_migrations WHERE name = ?").get(name);
      if (applied) {
        if (typeof applied !== "object" || !("checksum" in applied) || applied.checksum !== checksum) throw new Error(`Migração modificada: ${name}`);
        continue;
      }
      const footprints: boolean[] = [];
      for (const match of source.matchAll(/CREATE TABLE [`"]?(\w+)[`"]?/g)) footprints.push(Boolean(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(match[1])));
      for (const match of source.matchAll(/ALTER TABLE [`"]?(\w+)[`"]? ADD (?:COLUMN )?[`"]?(\w+)[`"]?/g)) {
        const columns = sqlite.prepare(`PRAGMA table_info("${match[1]}")`).all();
        footprints.push(columns.some((column) => typeof column === "object" && column !== null && "name" in column && column.name === match[2]));
      }
      if (footprints.some(Boolean) && !footprints.every(Boolean)) throw new Error(`Schema parcial: ${name}. Revise antes de migrar.`);
      pending.push({ name, source, checksum, baseline: footprints.length > 0 && footprints.every(Boolean) });
    }
    if (pending.some((migration) => !migration.baseline) && sqlite.prepare("SELECT name FROM sqlite_master WHERE name='parent_user'").get()) {
      const backup = `${path}.before-beta-${Date.now()}.db`;
      await sqlite.backup(backup);
      chmodSync(backup, 0o600);
      console.log(`Backup do banco: ${backup}`);
    }
    for (const migration of pending) {
      sqlite.transaction(() => {
        if (!migration.baseline) sqlite.exec(migration.source.replaceAll("--> statement-breakpoint", ""));
        sqlite.prepare("INSERT INTO telefoninho_migrations (name, checksum) VALUES (?, ?)").run(migration.name, migration.checksum);
      })();
    }
  } finally { sqlite.close(); }
}

if (process.argv[1]?.endsWith("scripts/migrate.ts")) {
  await migrateDatabase((process.env.DATABASE_URL || "file:./dev.db").replace("file:", ""));
}
