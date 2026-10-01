import { defineConfig, devices } from '@playwright/test';

const MOCK = 'http://127.0.0.1:54329';

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://127.0.0.1:4796',
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'node e2e/mock-supabase.mjs', url: `${MOCK}/__db`, reuseExistingServer: !process.env.CI },
    {
      command: `VITE_SUPABASE_URL=${MOCK} npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4796 --strictPort --host 127.0.0.1`,
      url: 'http://127.0.0.1:4796',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
