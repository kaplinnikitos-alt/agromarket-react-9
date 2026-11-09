import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,               // сервер Free может «просыпаться» до минуты
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',  // при падении — «запись» каждого шага
    screenshot: 'only-on-failure',
  },
  // Локально (без E2E_BASE_URL) сам поднимает dev-сервер Vite;
  // API (agromarket-server на :3000) нужно запустить отдельно.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 60_000 },
});
