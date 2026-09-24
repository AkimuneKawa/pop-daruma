import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // 自動プレイでバランスを確かめるテストは重い（GitHub Actions では手元より遅い）ので制限時間を長めに
  test: { include: ['tests/**/*.test.js'], testTimeout: 60000 },
});
