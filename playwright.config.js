import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5173' },
  // ランキングは疑似の Supabase（e2e/ranking.spec.js の page.route）に向ける
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true,
    env: { VITE_SUPABASE_URL: 'https://mock.supabase.test', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
  },
});
