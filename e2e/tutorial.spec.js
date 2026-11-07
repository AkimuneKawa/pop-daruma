// チュートリアル：最初の「はじめから」で選べる。最後まで進める・途中でスキップする・最初にスキップする
import { test, expect } from '@playwright/test';

async function open(page, vp = { width: 390, height: 844 }) {
  await page.setViewportSize(vp);
  await page.goto('/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await page.click('#tNew');
}

for (const vp of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
  test(`${vp.width}x${vp.height} で最後まで進められる（操作の段は実際にタップ）`, async ({ page }) => {
    await open(page, vp);
    await page.click('#tutGo');
    const shot = n => page.screenshot({ path: `e2e/screenshots/tutorial-${vp.width}-${n}.png` });
    const box = page.locator('.tut-box');
    await shot(1); await page.click('#tutNext');
    // 照らした所以外は押せない
    await page.locator('#bInvest').click({ force: true });
    await expect(page.locator('#modal')).not.toHaveClass(/show/);
    await shot(2); await page.click('.cbtn[data-c="pink"]');
    await expect(box).toContainText('3 / 6');
    expect(await page.evaluate(() => window.__daruma.S.color)).toBe('pink');
    const mat = await page.evaluate(() => window.__daruma.S.mat);
    await shot(3); await page.click('#bBuy');
    await expect(box).toContainText('4 / 6');
    expect(await page.evaluate(() => window.__daruma.S.mat)).toBeGreaterThan(mat);
    // 吹き出しが画面に収まっている
    for (const n of [4, 5, 6]) {
      const r = await box.boundingBox();
      expect(r.y).toBeGreaterThanOrEqual(0); expect(r.y + r.height).toBeLessThanOrEqual(vp.height);
      await shot(n); await page.click('#tutNext');
    }
    await expect(page.locator('.tut')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('popdaruma_tutorial_done'))).toBe('1');
  });
}

test('途中でスキップでき、次からは聞かれない', async ({ page }) => {
  await open(page);
  await page.click('#tutGo');
  await page.click('#tutNext');
  await page.click('#tutSkip');
  await expect(page.locator('.tut')).toHaveCount(0);
  const t = await page.evaluate(() => window.__daruma.S.t);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__daruma.S.t)).toBeGreaterThan(t); // ゲームが動きだす
  await page.click('#bTitle');
  await page.click('#tNew');
  await expect(page.locator('#modal')).not.toHaveClass(/show/); // 2回目は聞かれない
});

test('最初にスキップでき、あそびかたからもう一度見られる', async ({ page }) => {
  await open(page);
  await page.click('#tutNo');
  await expect(page.locator('#modal')).not.toHaveClass(/show/);
  await page.click('#bHelp');
  await page.click('#tutAgain');
  await expect(page.locator('.tut-box')).toContainText('1 / 6');
});
