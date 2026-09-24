// タイトル画面のバージョン表示とアップデート内容
import { test, expect } from '@playwright/test';
import { CHANGELOG, VERSION } from '../src/changelog.js';

test('タイトルにバージョンが出て、アップデート内容を見ると NEW が消える', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await expect(page.locator('#tVer')).toHaveText(`ver ${VERSION}`);
  await expect(page.locator('#tNewMark')).toBeVisible();
  await page.click('#tNews');
  await expect(page.locator('.changes h3')).toHaveCount(CHANGELOG.length);
  await expect(page.locator('.changes h3').first()).toContainText(`ver ${VERSION}`);
  await page.click('#cClose');
  await expect(page.locator('#title')).toHaveClass(/show/);
  await expect(page.locator('#tNewMark')).toBeHidden();
  expect(errs).toEqual([]);
});
