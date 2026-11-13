import { defineConfig } from "@playwright/test";

const remote = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: remote || "http://127.0.0.1:8083",
    browserName: "chromium",
    viewport: { width: 1440, height: 1050 },
    permissions: ["microphone"],
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: remote ? undefined : {
    command: "node .next/standalone/server.js",
    env: { PORT: "8083", HOSTNAME: "127.0.0.1" },
    url: "http://127.0.0.1:8083",
    reuseExistingServer: !process.env.CI,
  },
});
