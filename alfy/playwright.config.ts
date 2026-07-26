import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3141",
    // CI環境にプリインストールされたChromiumがあれば使う
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: "npm run dev -- --port 3141",
    port: 3141,
    reuseExistingServer: !process.env.CI,
    env: {
      // E2EはAPIをモックするため実際のキーは不要(ダミーで起動させる)
      SUPABASE_URL: process.env.SUPABASE_URL ?? "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dummy",
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "dummy",
      NEXT_PUBLIC_APP_URL: "http://localhost:3141",
      CRON_SECRET: "dummy",
    },
  },
});
