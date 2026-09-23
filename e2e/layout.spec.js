// 最重要要件：スマホ縦画面でスクロールなしに1画面へ収まること
import { test, expect } from '@playwright/test';

const SIZES = [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
];

for (const vp of SIZES) {
  test(`${vp.width}x${vp.height} でスクロールなし・はみ出しなし`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.click('#tNew');
    await page.waitForTimeout(1500);

    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const overflow = [...document.querySelectorAll('.app *')]
        .filter(el => el.offsetParent !== null)
        .map(el => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5 || r.left < -0.5)
        .map(({ el, r }) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${el.className} ${Math.round(r.right)}x${Math.round(r.bottom)}`);
      return { sh: de.scrollHeight, sw: de.scrollWidth, ih: innerHeight, iw: innerWidth, overflow };
    });
    await page.screenshot({ path: `e2e/screenshots/${vp.width}x${vp.height}.png` });

    expect(m.sh).toBeLessThanOrEqual(m.ih);
    expect(m.sw).toBeLessThanOrEqual(m.iw);
    expect(m.overflow).toEqual([]);
  });
}
