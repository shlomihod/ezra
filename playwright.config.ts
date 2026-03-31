import { defineConfig } from "@playwright/test";

const isCI = !!process.env.CI;
const port = process.env.PORT || (isCI ? 3333 : 5173);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL },
  webServer: isCI
    ? {
        command: "bun run start",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 30000,
      }
    : {
        command: "bun run dev:server & bun run dev:client",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 30000,
      },
});
