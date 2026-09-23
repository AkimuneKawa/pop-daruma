// 自動プレイでバランスを検証する。
// 使い方: npm run autoplay [-- 試行回数]
// 目安（難しめ）: 投資なし＝一人前6割・見習い4割、投資あり＝ほぼ一人前・閉店5%前後（年商 中央値約7,600万）、人気★5は11月ごろ
import * as sim from '../src/sim.js';
import { seeded, yen, cnt } from '../src/util.js';
import { CK, TOTAL, RENT, MAT, REVENUE_GOAL, QTY } from '../src/constants.js';

const STEP = 0.01;

// 投資なし：あかを作り続け、素材が減ったら買い足すだけ
function passive(S) {
  if (S.mat < 6 * QTY) sim.buy(S);
}

// 投資あり：在庫が何日分あるかを見て足りない色を作り、特需と年末ラッシュを先読みする。
// 棚・倉庫・職人には支払いの余裕を残して投資する
function active(S) {
  const d = sim.curDay(S);
  const ahead = Math.min(TOTAL - 1, d + 4); // 乾燥にかかる3日＋αを見越した需要
  const { rate } = sim.lambda(S, ahead);
  const onRack = k => S.rack.reduce((a, r) => a + (r.c === k ? r.n : 0), 0);
  const cover = k => (S.fin[k] + onRack(k)) / Math.max(1, rate[k]); // 何日分あるか
  const target = d >= 70 && d < 95 ? 8 : 5; // 年末ラッシュ前は多めに備蓄
  const k = CK.reduce((a, c) => (cover(c) < cover(a) ? c : a), CK[0]);
  S.color = d >= TOTAL - 4 || cover(k) >= target ? 'stop' : k;
  // 支払い分を残して投資する
  const reserve = sim.monthly(S) * 2;
  for (const it of sim.investItems(S)) {
    if (!it.done && S.cash - it.cost >= reserve && d < 90) sim.invest(S, it.id);
  }
  // 素材は3日分を目安に、支払い分を残して買う
  const keep = sim.monthly(S) * (10 - S.day % 10 <= 3 ? 1 : 0.5);
  if (S.color !== 'stop' && S.mat < sim.prodRate(S) * 3 && S.cash - sim.buyQty(S) * sim.matPrice(S) >= keep && sim.matPrice(S) <= MAT * 2) sim.buy(S);
  else if (S.color !== 'stop' && S.mat < 2 * QTY && S.cash - sim.buyQty(S) * sim.matPrice(S) >= keep) sim.buy(S);
}

export function play(policy, seed) {
  const rng = seeded(seed);
  const S = sim.newGame(rng);
  let bankrupt = false;
  const hooks = { end: b => { bankrupt = b; } };
  let lastDecision = -1;
  while (!S.over) {
    // 1日に4回だけ判断する（人間のプレイ頻度の目安）
    const q = Math.floor(S.t * 4);
    if (q !== lastDecision) { lastDecision = q; policy(S); }
    sim.step(S, STEP, hooks, rng);
    if (S.popStars >= 5 && S.popDay == null) S.popDay = S.day; // ★5に届いた日
    if (S.t > TOTAL + 1) break;
  }
  return { ...sim.settle(S, bankrupt), sold: S.stats.sold, missed: S.stats.missed, strikes: S.strikes, bankrupt, stars: S.popStars, popDay: S.popDay };
}

function summarize(name, runs) {
  const avg = f => Math.round(runs.reduce((a, r) => a + f(r), 0) / runs.length);
  const ranks = {};
  for (const r of runs) ranks[r.rank] = (ranks[r.rank] || 0) + 1;
  const rev = runs.filter(r => !r.bankrupt).map(r => r.revenue).sort((a, b) => a - b);
  const q = f => yen(rev[Math.floor(f * (rev.length - 1))] ?? 0);
  console.log(`${name}  平均総資産 ${yen(avg(r => r.score))}  販売 ${cnt(avg(r => r.sold))}個  売り逃し ${cnt(avg(r => r.missed))}個  称号 ${JSON.stringify(ranks)}`);
  const st = {}; for (const r of runs) st[r.stars] = (st[r.stars] || 0) + 1;
  const reached = runs.filter(r => r.popDay != null).map(r => r.popDay).sort((a, b) => a - b);
  console.log(`  最終の人気★ ${JSON.stringify(st)}／★5到達 ${reached.length}回（中央値 ${reached[reached.length >> 1] ?? '-'}日目）`);
  console.log(`  年商 中央値 ${q(.5)}／上位10% ${q(.9)}／最高 ${q(1)}／${yen(REVENUE_GOAL)}達成 ${rev.filter(x => x >= REVENUE_GOAL).length}回`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +process.argv[2] || 50;
  summarize('投資なし', Array.from({ length: n }, (_, i) => play(passive, i + 1)));
  summarize('投資あり', Array.from({ length: n }, (_, i) => play(active, i + 1)));
}

export { passive, active };
