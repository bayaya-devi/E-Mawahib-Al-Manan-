import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? "test-results",
  fullyParallel: true,
  workers: process.env.CI ? "50%" : 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "tablet", use: { ...devices["iPad Mini"], browserName: "chromium", channel: "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 5"], channel: "chrome" } },
  ],
  webServer: {
    command: process.env.PLAYWRIGHT_USE_BUILD === '1' ? "npm run start -- --port 3001" : "npm run dev -- --port 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_DIST_DIR: process.env.PLAYWRIGHT_DIST_DIR ?? ".next-e2e",
      NEXT_CONSTRAINED_BUILD: "1",
      NODE_OPTIONS: "--max-old-space-size=2048",
      NEXT_PUBLIC_APP_ENV: "test",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-publishable-key-with-safe-length",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-with-safe-length",
      INTERACTION_HMAC_KEY: "test-interaction-hmac-key-000000000000",
      AUTH_INTERNAL_EMAIL_DOMAIN: "accounts.test.invalid",
      APP_BASE_URL: "http://127.0.0.1:3001",
    },
  },
});
