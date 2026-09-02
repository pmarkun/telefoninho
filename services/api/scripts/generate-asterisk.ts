import { generateAsteriskConfig } from "../src/asterisk-config.js";

try {
  const result = generateAsteriskConfig({
    databaseUrl: process.env.DATABASE_URL || "file:./dev.db",
  });
  console.log(`✓ Generated configs for ${result.generatedAccounts} SIP accounts`);
  console.log(`  → ${result.pjsipPath}`);
  console.log(`  → ${result.extensionsPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Failed to generate Asterisk config");
  process.exit(1);
}
