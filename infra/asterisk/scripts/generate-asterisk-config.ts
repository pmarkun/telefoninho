import { resolve } from "node:path";
import { generateAsteriskConfig } from "../../../services/api/src/asterisk-config.js";

try {
  const result = generateAsteriskConfig({
    configDir: resolve(import.meta.dirname, "../config"),
  });
  console.log(`✓ Generated configs for ${result.generatedAccounts} SIP accounts`);
  console.log("  → pjsip.generated.conf");
  console.log("  → extensions.generated.conf");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Failed to generate Asterisk config");
  process.exit(1);
}
