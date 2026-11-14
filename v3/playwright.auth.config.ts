import { defineConfig, devices } from "@playwright/test";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the isolated Auth suite`);
  return value;
}

export default defineConfig({
  testDir: "./tests/e2e-real",
  outputDir: "test-results/auth-real",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["line"], ["html", { outputFolder: "playwright-report/auth-real", open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    browserName: "chromium",
    baseURL: "http://127.0.0.1:3001",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3001",
    url: "http://127.0.0.1:3001/ready",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_DIST_DIR: ".next-auth-e2e",
      NEXT_PUBLIC_APP_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
      INTERACTION_HMAC_KEY: "isolated-auth-interaction-hmac-key-2026",
      AUTH_INTERNAL_EMAIL_DOMAIN: "accounts.test.invalid",
      APP_BASE_URL: "http://127.0.0.1:3001",
      MAINTENANCE_MODE: "0",
    },
  },
});
