// 自動プレイでバランスを検証する。
// 使い方: npm run autoplay [-- 試行回数]
// 目安は CLAUDE.md の「バランスを変えたら」を参照。戦略の中身は src/strategies.js
import { yen, cnt } from '../src/util.js';
import { REVENUE_GOAL } from '../src/constants.js';
import { play, passive, activeHigh, activeLow } from '../src/strategies.js';

function summarize(name, runs) {
  const avg = f => Math.round(runs.reduce((a, r) => a + f(r), 0) / runs.length);
  const ranks = {};
  for (const r of runs) ranks[r.rank] = (ranks[r.rank] || 0) + 1;
  const ok = runs.filter(r => !r.bankrupt);
  const pct = (arr, f) => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : 0; };
  const man = n => `${Math.round(n / 1e4).toLocaleString('ja-JP')}万`;
  console.log(`${name}  平均総資産 ${yen(avg(r => r.score))}  販売 ${cnt(avg(r => r.sold))}個  称号 ${JSON.stringify(ranks)}`);
  const sc = ok.map(r => r.score);
  console.log(`  総資産 p10 ${man(pct(sc, .1))}／p50 ${man(pct(sc, .5))}／p90 ${man(pct(sc, .9))}`);
  const yrs = [0, 1, 2].map(i => man(pct(ok.map(r => r.years[i] ?? 0), .5))).join('・');
  const reached = runs.filter(r => r.popDay != null).map(r => r.popDay).sort((a, b) => a - b);
  console.log(`  年商の中央値（1・2・3年目） ${yrs}／${yen(REVENUE_GOAL)}達成 ${runs.filter(r => r.goal).length}回／人気Lv5到達 ${reached.length}回（中央値 ${reached[reached.length >> 1] ?? '-'}週目）`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +process.argv[2] || 50;
  summarize('投資なし', Array.from({ length: n }, (_, i) => play(passive, i + 1)));
  summarize('投資あり・高価格', Array.from({ length: n }, (_, i) => play(activeHigh, i + 1)));
  summarize('投資あり・低価格', Array.from({ length: n }, (_, i) => play(activeLow, i + 1)));
}

export { play, passive, active, activeHigh, activeLow, makeActive } from '../src/strategies.js';
