// BGM と効果音：エラーなく鳴り、切り替えが効くこと
import { test, expect } from '@playwright/test';

test('音：タップで有効になり、BGMは動いている間だけ、切り替えが効く', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.click('#tNew');
  await page.waitForTimeout(800);
  const st = () => page.evaluate(() => window.__daruma.sound.debugState());
  expect(await st()).toEqual({ ctx: 'running', bgm: 'normal' });

  // 売れた・売り切れ・仕入れ・投資の音を鳴らしてもエラーにならない
  await page.evaluate(() => { const s = window.__daruma.sound; s.sold(1); s.sold(40); s.soldOut(); s.buy(); s.invest(); s.hire(); s.news(); s.short(); s.end(false); });

  // 一時停止で BGM が止まる
  await page.click('.spd[data-s="0"]');
  expect((await st()).bgm).toBeNull();
  await page.click('.spd[data-s="1"]');
  expect((await st()).bgm).toBe('normal');

  // 年末商戦に入るとお祭りの曲に替わる
  await page.evaluate(() => { const S = window.__daruma.S; S.t = 72.1; S.day = 72; });
  await page.waitForTimeout(600);
  expect((await st()).bgm).toBe('rush');

  // 音：ぜんぶ → 効果音だけ → なし → ぜんぶ
  await expect(page.locator('#bSound')).toHaveText('音：ぜんぶ');
  await page.click('#bSound');
  await expect(page.locator('#bSound')).toHaveText('音：効果音だけ');
  await page.click('#bSound');
  await expect(page.locator('#bSound')).toHaveText('音：なし');
  await page.reload();
  await expect(page.locator('#bSound')).toHaveText('音：なし'); // 設定を覚えている
  expect(errs).toEqual([]);
});
