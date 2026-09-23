// ランキング：疑似の Supabase（REST API）で、登録・順位・一覧・タブ切り替えを確かめる
import { test, expect } from '@playwright/test';

function mockSupabase(page, rows) {
  return page.route('https://mock.supabase.test/rest/v1/scores**', async route => {
    const req = route.request(), url = new URL(req.url());
    expect(req.headers()['apikey']).toBe('test-anon-key');
    if (req.method() === 'POST') {
      const row = { id: `id-${rows.length + 1}`, created_at: new Date().toISOString(), ...JSON.parse(req.postData()) };
      rows.push(row);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([row]) });
    }
    // 順位：?select=id&score=gt.123（件数は Content-Range で返す）
    const gt = [...url.searchParams].find(([k, v]) => v.startsWith('gt.'));
    if (gt) {
      const n = rows.filter(r => r[gt[0]] > Number(gt[1].slice(3))).length;
      // 本物の Supabase と同じく、ブラウザが Content-Range を読めるようにする
      return route.fulfill({ status: 206, headers: { 'content-range': `0-0/${n}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range' }, contentType: 'application/json', body: '[]' });
    }
    const kind = url.searchParams.get('order').split('.')[0];
    const list = rows.slice().sort((a, b) => b[kind] - a[kind]);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(list) });
  });
}

test('決算でランキングに登録し、順位と一覧が出る', async ({ page }) => {
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const rows = [
    { id: 'a', name: 'たつ', score: 40000000, best_year: 150000000, title: '名工', created_at: '2026-01-01' },
    { id: 'b', name: 'はな', score: 10000000, best_year: 250000000, title: '見習い', created_at: '2026-01-02' },
  ];
  await mockSupabase(page, rows);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();

  // タイトルからランキングを開く（総資産順→最高の年商順）
  await page.click('#tRank');
  await expect(page.locator('.rank-list li')).toHaveCount(2);
  await expect(page.locator('.rank-list li').first()).toContainText('たつ');
  await page.click('[data-kind="best_year"]');
  await expect(page.locator('.rank-list li').first()).toContainText('はな');
  await page.click('#rClose');
  await expect(page.locator('#title')).toHaveClass(/show/);

  // 3年目の最後まで進めて決算
  await page.click('#tNew');
  await page.evaluate(() => { const S = window.__daruma.S; S.t = 143.97; S.day = 143; S.cash = 25000000; S.history = [{ year: 1, rev: 90000000 }, { year: 2, rev: 200000000 }]; });
  await expect(page.locator('#rName')).toBeVisible({ timeout: 5000 });
  await page.fill('#rName', '<b>だるま太郎</b>だよ');
  await page.click('#rSend');
  await expect(page.locator('#entry')).toContainText('総資産 2位');
  expect(rows[2].name).toBe('<b>だるま太郎</b>'); // 12文字で切る
  expect(rows[2].version).toBeTruthy();

  // 一覧では自分の行が目立ち、名前はタグとして解釈されない
  await page.click('#seeRank');
  await expect(page.locator('.rank-list li.me')).toContainText('<b>だるま太郎</b>');
  await page.click('#rClose');
  await expect(page.locator('#again')).toBeVisible();
  expect(errs).toEqual([]);
});
