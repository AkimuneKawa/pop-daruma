// 自動プレイの戦略（バランス検証の npm run autoplay と、デバッグパネルの「ジャンプ」で使う）
import * as sim from './sim.js';
import { seeded } from './util.js';
import { CK, TOTAL, YEAR, QTY, RUSH, ADS, SELF_RATE, BALANCE, LOTS } from './constants.js';

const STEP = 0.01;

// 投資なし：あかを作り続け、素材が減ったら買い足すだけ
export function passive(S) {
  if (S.mat < SELF_RATE) sim.buy(S);
}

// 投資あり：在庫が何日分あるかを見て足りない色を作り、特需と年末ラッシュを先読みする。
// 棚・倉庫・職人には支払いの余裕を残して投資する
// 上手なプレイ。priceK＝客の基準の値段に対して何倍で売るか（高価格戦略・低価格戦略）
export function makeActive(priceK) {
  return S => activePolicy(S, priceK);
}
function activePolicy(S, priceK) {
  const d = sim.curDay(S), w = d % YEAR, y0 = d - w; // w＝年内の週、y0＝今年の始まり
  // 売値：年末商戦や特需で客の基準が上がったら、それに合わせて上げる（きん以外の色の平均で見る）
  // 低価格戦略は、作るのが追いつかない年末商戦だけは普通の値段（安くしても売れる数は増えないため）
  const now = sim.lambda(S, d), refMult = now.mult.red; // よく売れるあかの基準で決める
  const k = priceK < 1 && sim.inRush(d) ? 1.05 : priceK;
  sim.setPrice(S, BALANCE.base * sim.quality(S) * refMult * k);
  // 9〜10月は年末商戦（11月）の需要を見越して備蓄する。それ以外は乾燥の1週＋αを見越す
  const prep = w >= 16 && w < RUSH.start;
  const ahead = prep ? y0 + RUSH.start + 2 : Math.min(TOTAL - 1, d + 2);
  const { rate } = sim.lambda(S, ahead);
  const onRack = k => S.rack.reduce((a, r) => a + (r.c === k ? r.n : 0), 0);
  const cover = k => (S.fin[k] + onRack(k)) / Math.max(1, rate[k]); // 何週分あるか
  const target = prep ? 4 : 2; // 何週分の在庫を目指すか
  const kc = CK.reduce((a, c) => (cover(c) < cover(a) ? c : a), CK[0]);
  const makable = CK.filter(c => !sim.colorStopped(S, c));
  const k2 = makable.includes(kc) ? kc : makable.reduce((a, c) => (cover(c) < cover(a) ? c : a), makable[0]);
  S.color = d >= TOTAL - 2 || cover(k2) >= target ? 'stop' : k2;
  // 支払い3か月分を残して投資する（利益が薄いので慎重に）。
  // 棚が詰まっていたら棚、倉庫が7割埋まったら倉庫、職人は「作る量＋うまさ」あたりの給料が割安な人から
  const reserve = sim.monthly(S) * 3 + sim.billsTotal(S);
  const items = Object.fromEntries(sim.investItems(S).map(it => [it.id, it]));
  const want = {
    rack: sim.rackFree(S) < sim.prodRate(S),
    wh: sim.whUsed(S) > sim.whCap(S) * 0.7,
  };
  for (const id of ['rack', 'wh']) {
    const it = items[id];
    if (want[id] && !it.done && S.cash - it.cost >= reserve && d < TOTAL - YEAR + RUSH.end) sim.invest(S, id);
  }
  // 高価格なら腕のいい職人、低価格なら手の速い職人を重く見る
  const value = c => (sim.craftRate(c) + c.skill * (priceK > 1 ? 0.6 : 0.2) * QTY) / c.wage;
  const best = sim.poolCrafts(S).sort((a, b) => value(b) - value(a))[0];
  // 作る量が見込みの客足（仕込み期は年末商戦の客足）に足りないときだけ雇う
  const demandSoon = CK.reduce((a, c) => a + rate[c], 0);
  if (best && d >= 8 && sim.prodRate(S) < demandSoon * 1.1 && S.cash - best.fee >= (sim.monthly(S) + best.wage) * 3 + sim.billsTotal(S)) sim.hire(S, best.id);
  // 在庫が十分（需要の1.5週分以上）で資金に余裕（支払い4か月分）があれば宣伝を打つ
  const stock = sim.finN(S), demand = CK.reduce((a, c) => a + rate[c], 0);
  for (const id of ['tvcm', 'sns', 'flyer']) {
    if (stock > demand * 1.5 && S.cash - ADS[id].cost >= sim.monthly(S) * 4 + sim.billsTotal(S) && sim.canAd(S, id)) { sim.runAd(S, id); break; }
  }
  // 素材は1週強を目安に、支払い1か月分を残して買う
  const keep = sim.monthly(S) + sim.billsTotal(S);
  // 相場が安い週は多めに（倉庫の許すかぎり）、高い週は最低限だけ。
  // 仕入れ量は、倉庫とお金（支払い分を残す）の許す範囲でいちばん大きい単位を選ぶ（まとめ買いほど安い）
  const cheap = S.m < 0.95, dear = S.m > 1.3;
  const matWant = sim.prodRate(S) * (cheap ? (prep ? 4 : 3) : dear ? 0.5 : (prep ? 2.4 : 1.2));
  if (S.color !== 'stop' && S.mat < matWant) {
    const need = matWant - S.mat;
    const lots = LOTS.map(([n]) => n).filter(n => n <= Math.max(500, need * 2) && sim.canBuy(S, n) && S.cash - sim.buyCost(S, n) >= keep);
    if (lots.length) { S.lot = lots[lots.length - 1]; sim.buy(S); }
  }
}

// 高価格戦略（基準の1.2倍・腕のいい職人）と低価格戦略（基準の0.9倍・手の速い職人）。active は高価格戦略
export const activeHigh = makeActive(1.2), activeLow = makeActive(0.9), active = activeHigh;

// 戦略どおりに S を week 週目まで（省略時は最後まで）進める。1週に4回だけ判断する（人間のプレイ頻度の目安）
export function playUntil(S, policy, week = Infinity, hooks = {}, rng = Math.random) {
  let lastDecision = -1;
  while (!S.over && S.t < week) {
    const q = Math.floor(S.t * 4);
    if (q !== lastDecision) { lastDecision = q; policy(S); }
    sim.step(S, STEP, hooks, rng);
    if (S.popStars >= 5 && S.popDay == null) S.popDay = S.day; // ★5に届いた週
    if (S.t > TOTAL + 1) break;
  }
  return S;
}

// 新しいゲームを戦略どおりに最後まで遊んだ結果（バランス検証用）
export function play(policy, seed) {
  const rng = seeded(seed);
  const S = sim.newGame(rng);
  let bankrupt = false;
  playUntil(S, policy, Infinity, { end: b => { bankrupt = b; } }, rng);
  return { ...sim.settle(S, bankrupt), sold: S.stats.sold, missed: S.stats.missed, strikes: S.strikes, bankrupt, stars: S.popStars, popDay: S.popDay };
}

// デバッグパネルなどで選べる戦略
export const STRATEGIES = {
  high: { name: '投資あり・高価格', policy: activeHigh },
  low: { name: '投資あり・低価格', policy: activeLow },
  passive: { name: '投資なし（あかだけ）', policy: passive },
};
