// 最重要要件：スマホ縦画面でスクロールなしに1画面へ収まること
import { test, expect } from '@playwright/test';

const SIZES = [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
];

// 表示が最も長くなる金額（億単位の所持金・予定収入、職人2人分の月末支払い）
async function setWorstCaseMoney(page) {
  await page.evaluate(() => {
    const S = window.__daruma.S;
    S.cash = 1234560000;
    S.recv.push({ amt: 987650000, due: 99 });
    S.staff = ['tatsu', 'hana'];
  });
}

for (const vp of SIZES) for (const big of [false, true]) {
  test(`${vp.width}x${vp.height}${big ? '（億単位の金額）' : ''} でスクロールなし・はみ出しなし`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.click('#tNew');
    if (big) await setWorstCaseMoney(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `e2e/screenshots/${vp.width}x${vp.height}${big ? '-big' : ''}.png` });

    // 文字そのものが枠（罫線の内側）に収まっているか。右寄せのはみ出しも拾うため Range で測る
    const clipped = await page.evaluate(() => ['#cash', '#due', '#recv', '#bBuyT', '#date', '#left']
      .map(s => document.querySelector(s))
      .filter(el => {
        const range = document.createRange(); range.selectNodeContents(el);
        const t = range.getBoundingClientRect();
        const box = el.closest('.box,.btn'), b = box.getBoundingClientRect(), cs = getComputedStyle(box);
        return t.left < b.left + parseFloat(cs.borderLeftWidth) - 0.5 || t.right > b.right - parseFloat(cs.borderRightWidth) + 0.5;
      })
      .map(el => `#${el.id}: ${el.textContent}`));
    expect(clipped).toEqual([]);

    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const overflow = [...document.querySelectorAll('.app *')]
        .filter(el => el.offsetParent !== null)
        .map(el => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5 || r.left < -0.5)
        .map(({ el, r }) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${el.className} ${Math.round(r.right)}x${Math.round(r.bottom)}`);
      return { sh: de.scrollHeight, sw: de.scrollWidth, ih: innerHeight, iw: innerWidth, overflow };
    });

    expect(m.sh).toBeLessThanOrEqual(m.ih);
    expect(m.sw).toBeLessThanOrEqual(m.iw);
    expect(m.overflow).toEqual([]);
  });
}
