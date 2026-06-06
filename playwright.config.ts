import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:18080',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run server:prepare-web && node scripts/e2e-server.mjs',
    url: 'http://127.0.0.1:18080/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
