import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@telefoninho/shared/beta": resolve(__dirname, "../../packages/shared/src/beta.ts"),
      "@telefoninho/shared/validation": resolve(__dirname, "../../packages/shared/src/validation.ts"),
      "@telefoninho/shared/types": resolve(__dirname, "../../packages/shared/src/types.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/tests/integration/**", "node_modules/**"],
  },
});
