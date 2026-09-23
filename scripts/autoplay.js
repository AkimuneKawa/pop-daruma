// 自動プレイでバランスを検証する。
// 使い方: npm run autoplay [-- 試行回数]
// 目安（HANDOFF.md）: 投資なし＝一人前（販売約165個）、投資あり＝名工（販売約310個）
import * as sim from '../src/sim.js';
import { seeded } from '../src/util.js';
import { CK, TOTAL } from '../src/constants.js';

const STEP = 0.01;

// 投資なし：あかを作り続け、素材が減ったら買い足すだけ
function passive(S) {
  if (S.mat < 6) sim.buy(S);
}

// 投資あり：棚・倉庫・職人に投資し、特需の色に合わせて作る
function active(S) {
  const d = sim.curDay(S);
  const tv = S.events.find(e => e.type === 'tv' && (sim.phase(e, d) || sim.phase(e, d + 3)));
  const inbound = S.events.some(e => e.type === 'inbound' && sim.phase(e, d));
  if (tv) S.color = tv.color;
  else if (inbound) S.color = CK.slice(1).reduce((a, k) => (S.fin[k] < S.fin[a] ? k : a), 'green');
  else S.color = 'red';
  // 年末ラッシュ前は棚と倉庫を優先
  const reserve = sim.monthly(S) + 3000;
  for (const it of sim.investItems(S)) {
    if (!it.done && S.cash - it.cost >= reserve && d < 90) sim.invest(S, it.id);
  }
  if (S.mat < sim.prodRate(S) * 3 && sim.matPrice(S) <= 700) sim.buy(S);
  else if (S.mat < 2) sim.buy(S);
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
    if (S.t > TOTAL + 1) break;
  }
  return { ...sim.settle(S, bankrupt), sold: S.stats.sold, missed: S.stats.missed, strikes: S.strikes };
}

function summarize(name, runs) {
  const avg = f => Math.round(runs.reduce((a, r) => a + f(r), 0) / runs.length);
  const ranks = {};
  for (const r of runs) ranks[r.rank] = (ranks[r.rank] || 0) + 1;
  console.log(`${name.padEnd(8)} 平均総資産 ¥${avg(r => r.score).toLocaleString('ja-JP')}  販売 ${avg(r => r.sold)}個  売り逃し ${avg(r => r.missed)}個  称号 ${JSON.stringify(ranks)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = +process.argv[2] || 50;
  summarize('投資なし', Array.from({ length: n }, (_, i) => play(passive, i + 1)));
  summarize('投資あり', Array.from({ length: n }, (_, i) => play(active, i + 1)));
}

export { passive, active };
