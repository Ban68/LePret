import { defineConfig, devices } from "@playwright/test";

process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT ?? "tsconfig.playwright.json";

const defaultPort = process.env.PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${defaultPort}`;
const webServerURL = process.env.PLAYWRIGHT_WEB_SERVER_URL ?? baseURL;
const webServerCommand = process.env.PLAYWRIGHT_WEB_COMMAND ?? "npm run dev";
const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "true";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL,
    storageState: storageState || undefined,
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: skipWebServer
    ? undefined
    : {
        command: webServerCommand,
        url: webServerURL,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe",
        stderr: "pipe",
      },
});
