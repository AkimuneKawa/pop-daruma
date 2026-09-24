// デバッグパネル（npm run dev のときだけ出る）
import { test, expect } from '@playwright/test';

test('デバッグパネル：クリア直前へ飛ぶと決算になり、ランキングには登録できない', async ({ page }) => {
  test.setTimeout(60000);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.click('#dbgTab');
  await expect(page.locator('#dbg')).toBeVisible();
  await page.click('[data-jump="143.8"]');
  await expect(page.locator('#dbg .msg')).toContainText('3年目 3月第4週');
  await page.click('#dClose');
  await expect(page.locator('#dlg h2')).toHaveText(/決算|閉店/, { timeout: 20000 });
  await expect(page.locator('#rName')).toHaveCount(0);
  await expect(page.locator('#dlg')).toContainText('デバッグプレイなのでランキングには登録できません');
  expect(errs).toEqual([]);
});

test('デバッグパネル：パラメータとテンプレ、中盤へのジャンプ', async ({ page }) => {
  test.setTimeout(60000);
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.click('#tNew');
  await page.click('#dbgTab');
  // パラメータ：素材の基準の値段を変えると、素材ボタンの値段が変わる
  await page.click('[data-tab="params"]');
  const before = await page.textContent('#bBuyT');
  await page.fill('#p-mat', '3000');
  await page.dispatchEvent('#p-mat', 'change');
  await expect(page.locator('#dbgTab')).toHaveClass(/changed/);
  await page.waitForTimeout(400);
  expect(await page.textContent('#bBuyT')).not.toBe(before);
  // テンプレ：標準に戻す
  await page.click('[data-tab="presets"]');
  await page.click('[data-preset="standard"]');
  await expect(page.locator('#dbgTab')).not.toHaveClass(/changed/);
  // 中盤（2年目10月）へ、低価格戦略で飛ぶ
  await page.click('[data-tab="jump"]');
  await page.selectOption('#dStrat', 'low');
  await page.click('[data-jump="72"]');
  await expect(page.locator('#dbg .msg')).toContainText('2年目 10月第1週');
  expect(await page.evaluate(() => window.__daruma.S.staff.length)).toBeGreaterThan(0);
  // 状態：止めてから所持金を書き換える
  await page.click('#dPause');
  await expect(page.locator('#ptag')).toBeVisible();
  await page.click('[data-tab="state"]');
  await page.fill('#s-cash', '99999999');
  await page.click('#dApply');
  await page.waitForTimeout(600);
  await expect(page.locator('#cash')).toHaveText('99,999,999円');
  await page.click('#dPause'); // 再開
  await expect(page.locator('#ptag')).toBeHidden();
  expect(errs).toEqual([]);
});
