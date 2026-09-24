import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

// いまのブランチ名（デバッグパネルに出す）。git が使えなければ「不明」
let branch = '不明';
try { branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { /* git なし */ }

export default defineConfig({
  base: './',
  define: { __GIT_BRANCH__: JSON.stringify(branch) },
  // 自動プレイでバランスを確かめるテストは重い（GitHub Actions では手元より遅い）ので制限時間を長めに
  test: { include: ['tests/**/*.test.js'], testTimeout: 60000 },
});
