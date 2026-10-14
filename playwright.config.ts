import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5175",
    browserName: "chromium",
    launchOptions: process.env.CHROMIUM_PATH
      ? {
          executablePath: process.env.CHROMIUM_PATH,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        }
      : {},
  },
  webServer: [
    {
      command: "npm run dev:auth-test",
      url: "http://127.0.0.1:9099/emulator/v1/projects/demo-nalarostore/config",
      reuseExistingServer: false,
      timeout: 180000,
    },
    {
      command: "npm run dev:test",
      url: "http://127.0.0.1:5175/api/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
  reporter: "list",
});
