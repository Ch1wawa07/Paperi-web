import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3100', headless: true, locale: 'zh-CN', screenshot: 'only-on-failure', trace: 'retain-on-failure', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] } },
  // Separate local ports and fake credentials prevent regression tests from contacting a paid service.
  webServer: [
    { command: 'npm run start -- --port 3100', url: 'http://127.0.0.1:3100', reuseExistingServer: false, timeout: 60000, env: { AI_API_KEY: '', AI_MODEL: '', AI_BASE_URL: '' } },
    { command: 'node tests/fixtures/ai-provider.mjs', url: 'http://127.0.0.1:3110/health', reuseExistingServer: false },
    { command: 'npm run start -- --port 3101', url: 'http://127.0.0.1:3101', reuseExistingServer: false, timeout: 60000, env: { AI_API_KEY: 'test-only-not-a-real-key', AI_MODEL: 'fixture-model', AI_BASE_URL: 'http://127.0.0.1:3110/v1' } },
  ],
});
