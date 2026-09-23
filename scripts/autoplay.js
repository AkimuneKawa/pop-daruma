// 自動プレイでバランスを検証する。
// 使い方: npm run autoplay [-- 試行回数]
// 目安（3年）: RANKS の基準に対して、投資なし＝一人前が中心、投資あり＝名工が中心・だるま大名は上位のみ
import * as sim from '../src/sim.js';
import { seeded, yen, cnt } from '../src/util.js';
import { CK, TOTAL, YEAR, WEEKS, RENT, MAT, REVENUE_GOAL, QTY, RUSH, ADS, SELF_RATE } from '../src/constants.js';

const STEP = 0.01;

// 投資なし：あかを作り続け、素材が減ったら買い足すだけ
function passive(S) {
  if (S.mat < SELF_RATE) sim.buy(S);
}

// 投資あり：在庫が何日分あるかを見て足りない色を作り、特需と年末ラッシュを先読みする。
// 棚・倉庫・職人には支払いの余裕を残して投資する
function active(S) {
  const d = sim.curDay(S), w = d % YEAR, y0 = d - w; // w＝年内の週、y0＝今年の始まり
  // 9〜10月は年末商戦（11月）の需要を見越して備蓄する。それ以外は乾燥の1週＋αを見越す
  const prep = w >= 16 && w < RUSH.start;
  const ahead = prep ? y0 + RUSH.start + 2 : Math.min(TOTAL - 1, d + 2);
  const { rate } = sim.lambda(S, ahead);
  const onRack = k => S.rack.reduce((a, r) => a + (r.c === k ? r.n : 0), 0);
  const cover = k => (S.fin[k] + onRack(k)) / Math.max(1, rate[k]); // 何週分あるか
  const target = prep ? 4 : 2; // 何週分の在庫を目指すか
  const k = CK.reduce((a, c) => (cover(c) < cover(a) ? c : a), CK[0]);
  const makable = CK.filter(c => !sim.colorStopped(S, c));
  const k2 = makable.includes(k) ? k : makable.reduce((a, c) => (cover(c) < cover(a) ? c : a), makable[0]);
  S.color = d >= TOTAL - 2 || cover(k2) >= target ? 'stop' : k2;
  // 支払い分を残して投資する。9〜10月の仕込み期は思い切って（支払い1か月分だけ残す）。
  // 棚が詰まっていたら棚、倉庫が7割埋まったら倉庫、職人は「作る量＋うまさ」あたりの給料が割安な人から
  const reserve = sim.monthly(S) * (prep ? 1 : 2) + sim.billsTotal(S);
  const items = Object.fromEntries(sim.investItems(S).map(it => [it.id, it]));
  const want = {
    rack: sim.rackFree(S) < sim.prodRate(S),
    wh: sim.whUsed(S) > sim.whCap(S) * 0.7,
  };
  for (const id of ['rack', 'wh']) {
    const it = items[id];
    if (want[id] && !it.done && S.cash - it.cost >= reserve && d < TOTAL - YEAR + RUSH.end) sim.invest(S, id);
  }
  const value = c => (sim.craftRate(c) + c.skill * 0.3 * QTY) / c.wage;
  const best = sim.poolCrafts(S).sort((a, b) => value(b) - value(a))[0];
  if (best && d >= 8 && S.cash - best.fee >= (sim.monthly(S) + best.wage) * (prep ? 1 : 2)) sim.hire(S, best.id);
  // 在庫が十分（需要の1.5週分以上）で資金に余裕があれば宣伝を打つ
  const stock = sim.finN(S), demand = CK.reduce((a, c) => a + rate[c], 0);
  for (const id of ['tvcm', 'sns', 'flyer']) {
    if (stock > demand * 1.5 && S.cash - ADS[id].cost >= sim.monthly(S) * 2 && sim.canAd(S, id)) { sim.runAd(S, id); break; }
  }
  // 素材は1週強を目安に、支払い分を残して買う（月末が近ければ多めに残す）
  const keep = sim.monthly(S) * (WEEKS - S.day % WEEKS <= 1 ? 1 : 0.5) + sim.billsTotal(S);
  // 相場が安い週は多めに（倉庫の許すかぎり）、高い週は最低限だけ
  const afford = Math.max(0, (S.cash - keep) / sim.matPrice(S)); // 支払い分を残して買える数
  const cheap = S.m < 0.95, dear = S.m > 1.3;
  const matWant = sim.prodRate(S) * (cheap ? (prep ? 4 : 3) : dear ? 0.5 : (prep ? 2.4 : 1.2));
  if (S.color !== 'stop' && S.mat < matWant) sim.buy(S, afford);
}

export function play(policy, seed) {
  const rng = seeded(seed);
  const S = sim.newGame(rng);
  let bankrupt = false;
  const hooks = { end: b => { bankrupt = b; } };
  let lastDecision = -1;
  while (!S.over) {
    // 1週に4回だけ判断する（人間のプレイ頻度の目安）
    const q = Math.floor(S.t * 4);
    if (q !== lastDecision) { lastDecision = q; policy(S); }
    sim.step(S, STEP, hooks, rng);
    if (S.popStars >= 5 && S.popDay == null) S.popDay = S.day; // ★5に届いた週
    if (S.t > TOTAL + 1) break;
  }
  return { ...sim.settle(S, bankrupt), sold: S.stats.sold, missed: S.stats.missed, strikes: S.strikes, bankrupt, stars: S.popStars, popDay: S.popDay };
}

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
  summarize('投資あり', Array.from({ length: n }, (_, i) => play(active, i + 1)));
}

export { passive, active };
