import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["dist/**", "node_modules/**"],
    env: { EZRA_DB_PATH: ":memory:" },
    server: { deps: { inline: ["zod"] } },
  },
});
