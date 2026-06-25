import { execSync } from "node:child_process";
import { resolve } from "node:path";

const infraScript = resolve(import.meta.dirname, "../../../infra/asterisk/scripts/generate-asterisk-config.ts");

try {
  execSync(`npx tsx ${infraScript}`, {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || "file:./dev.db" },
  });
} catch {
  process.exit(1);
}
