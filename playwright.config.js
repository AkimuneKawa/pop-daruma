import { defineConfig } from '@playwright/test';

// e2e は専用のポートで毎回自分の開発サーバーを起動する（手元の npm run dev を使い回さない）。
// 手元の npm run dev は .env.local で本物の Supabase につながるので、使い回すとテストが本物のランキングに触れてしまうため。
// ランキングは疑似の Supabase（e2e/ranking.spec.js の page.route）に向ける
const PORT = 5199;
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`, url: `http://localhost:${PORT}`, reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: 'https://mock.supabase.test', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
  },
});
