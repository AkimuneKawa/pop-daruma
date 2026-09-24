// ゲームのシミュレーション本体。DOM に依存しない。
// 状態 S を引数で受け取り、画面側への通知は hooks 経由で行う。
import { COLORS, CK, TOTAL, YEAR, YEARS, GROWTH, RENT_BY_YEAR, DRY, PAY_DELAY, WEEKS, MARKET_STEP, MM, BASE, MAT, RENT, SELF_RATE, CRAFT, RACK_UP, WH_UP, FLAVOR, START_CASH, PRICE_UNIT, STOCK_VALUE, RANKS, REVENUE_GOAL, QTY, START_MAT, START_STOCK, RACK_BASE, RACK_STEP, WH_BASE, WH_STEP, BUYERS, MEAN_BUY, POP, SHARE, RUSH, ORIGIN_BASE, ADS, MARKET_SWING, MARKET_EVENT_SCALE, TAX_RATE, ACCIDENTS, ACCIDENT_EQUIP, PRICING, LOTS, START_LOT, DEMAND } from './constants.js';
import { rint, pick, yen, cnt, poisson, monthOf, dateStr, fullDateStr, weekOfYear, yearOf } from './util.js';
import { ROSTER, wageOf } from './roster.js';
import { EVENT_TYPES, genEvents, demandOf, priceOf } from './events.js';

export { genEvents };

/* ---------- 派生値 ---------- */
export const rackCap = S => RACK_BASE + RACK_STEP * S.rackLv;
export const whCap = S => WH_BASE + WH_STEP * S.whLv;
// 乾燥棚は同じ時刻に入れた同じ色をまとめて {c, n, ready} で持つ
export const rackUsed = S => S.rack.reduce((a, r) => a + r.n, 0);
export const finN = S => CK.reduce((a, k) => a + S.fin[k], 0);
export const whUsed = S => S.mat + finN(S);
export const whFree = S => whCap(S) - whUsed(S);
export const rackFree = S => rackCap(S) - rackUsed(S);
// 職人 S.staff は名簿から写した {id, name, skill, speed, wage, fee, desc, look}
export const craftRate = c => c.speed * CRAFT.ratePerSpeed;
const staffMorale = S => (S.lowMorale ? 0.5 : 1);
export const staffRate = S => S.staff.reduce((a, c) => a + craftRate(c), 0);
export const prodRate = S => SELF_RATE + staffRate(S) * staffMorale(S);
// 家賃は年ごとに上がる
export const rentOf = d => RENT_BY_YEAR[Math.min(YEARS, yearOf(d)) - 1];
// 月の支払い（家賃＋給料）。d はその月に含まれる週（省略時は今週）
export const monthly = (S, d = S.day) => rentOf(d) + S.staff.reduce((a, c) => a + c.wage, 0);
// これまでの設備投資額（乾燥棚と倉庫）
export const equipValue = S => RACK_UP.slice(0, S.rackLv).reduce((a, b) => a + b, 0) + WH_UP.slice(0, S.whLv).reduce((a, b) => a + b, 0);
// 次の月末に払う額（家賃・給料＋税金・修理代）
export const billsTotal = S => (S.bills ?? []).reduce((a, b) => a + b.amt, 0);
export const dueTotal = S => monthly(S) + billsTotal(S);
// 工房の腕前：本人と職人のうまさを、作る量で重み付けした平均
export const teamSkill = S => {
  const m = staffMorale(S);
  const w = S.staff.reduce((a, c) => a + craftRate(c) * m, SELF_RATE);
  return S.staff.reduce((a, c) => a + craftRate(c) * m * c.skill, SELF_RATE * CRAFT.selfSkill) / w;
};
// 工房の腕前による、客の基準の値段の倍率（★2で1倍。うまいほど高くても買ってもらえる）
export const quality = S => 1 + PRICING.skillRef * (teamSkill(S) - CRAFT.selfSkill);
// 安売りの評判による客足の倍率
export const priceDraw = S => Math.min(PRICING.drawMax, Math.max(PRICING.drawMin, Math.pow(BASE * quality(S) / S.price, PRICING.draw)));
// 売値が基準の r 倍のとき、値段を気にする客が「高い」と断る確率（まとめ買いの客はより敏感）
export const refuseProb = (r, type = 'person') => {
  const b = PRICING.bulk[type] ?? PRICING;
  return 1 / (1 + Math.exp(-b.slope * (r - b.mid)));
};
// 色 k の売値（きんは高級品）
export const salePrice = (S, k) => Math.round(S.price * COLORS[k].price / PRICE_UNIT) * PRICE_UNIT;
// 国籍 o・種類 type の客が、基準の倍率 refMult のときに断る確率（値段を気にしない客も含めた平均）
export const refuseRate = (S, refMult = 1, o = 'jp', type = 'person') =>
  (PRICING.bulk[type] ? 1 : 1 - PRICING.indifferent[o]) * refuseProb(S.price / (BASE * refMult * quality(S)), type);
export const recvTotal = S => S.recv.reduce((a, r) => a + r.amt, 0);
export const matPrice = S => Math.round(MAT * S.m / PRICE_UNIT) * PRICE_UNIT;
export const phase = (e, d) => (d >= e.start && d < e.start + e.len) ? 'act' : ((d >= e.start - e.ann && d < e.start) ? 'ann' : null);
export const curDay = S => Math.min(S.day, TOTAL - 1);
// 人気：0〜1 の割合、客足の倍率、★の数（1〜5）
export const popRatio = S => Math.min(1, S.pop / POP.max);
export const popMult = S => POP.minMult + (POP.maxMult - POP.minMult) * popRatio(S);
export const popStars = S => Math.min(5, 1 + Math.floor(popRatio(S) * 5));

/* ---------- 開始・セーブ互換 ---------- */
// 季節の判定は年内の週で行う（毎年くり返す）
export const inRush = d => weekOfYear(d) >= RUSH.start && weekOfYear(d) < RUSH.end;
const inPreRush = d => weekOfYear(d) >= RUSH.preStart && weekOfYear(d) < RUSH.start;
// その週に起きている（act）／予告中（ann）のイベント
export const activeEvents = (S, d, p = 'act') => S.events.filter(e => phase(e, d) === p);
// 色 k が作れない（ホルムズ海峡封鎖中のきん など）
export const colorStopped = (S, k, d = curDay(S)) => activeEvents(S, d).some(e => EVENT_TYPES[e.type].stop?.includes(k));
export function newGame(rng = Math.random) {
  const S = {
    t: 0, day: 0, cash: START_CASH, mat: START_MAT, fin: { ...START_STOCK }, rack: [], color: 'red', prog: 0,
    rackLv: 0, whLv: 0, staff: [], recv: [], m: 1, sup: 0, noise: 1, events: genEvents(rng), strikes: 0, lowMorale: false,
    stats: { sold: 0, missed: 0, rev: 0, refused: 0 }, today: { sold: 0, missed: 0, rev: 0, refused: 0 }, news: [], banner: '', over: false,
    year: { sold: 0, missed: 0, rev: 0, cost: 0, refused: 0 }, history: [], // year＝今年の成績（cost＝経費）、history＝終わった年の成績
    bills: [], // 次の月末に家賃・給料と一緒に払う出費 {name, amt}（税金・修理代）
    pop: 0, popStars: 1, pool: [], ads: [], price: PRICING.start, lot: START_LOT,
  };
  refreshPool(S, rng);
  updateMarket(S, true);
  S.banner = '4月第1週、だるま堂 開店！素材を切らさないように';
  S.news = [...dayNews(S, 0).map(t => ({ t })), { t: '職人が「作る色」のだるまを自動で作ります' }, { t: 'お客さんの欲しいだるまを切らさず売ると、人気が上がって客足が増えます' }, { t: '11月〜12月の年末商戦が一番の書き入れ時。11月からは素材も職人も足りなくなるので、10月までに仕込もう' }];
  return S;
}
// 求職者を入れ替える（雇っている人は除く）
export function refreshPool(S, rng = Math.random) {
  if (inRush(S.day)) { S.pool = []; return; } // 年末商戦中は職人の手が空かない
  const hired = new Set(S.staff.map(c => c.id));
  const free = ROSTER.filter(c => !hired.has(c.id)).map(c => c.id);
  const pool = [];
  while (pool.length < CRAFT.poolSize && free.length) pool.push(free.splice(rint(0, free.length - 1, rng), 1)[0]);
  S.pool = pool;
}
export const nextPoolIn = S => CRAFT.poolEvery - (S.day % CRAFT.poolEvery);
// 旧版の職人（'tatsu'・'hana'）は同じくらいの能力の職人に置き換える
const LEGACY_STAFF = { tatsu: { skill: 3, speed: 3 }, hana: { skill: 3, speed: 2 } };
// 旧セーブに無いフィールドを補う
export function normalize(S) {
  if (!S) return S;
  if (typeof S.pop !== 'number') { S.pop = POP.max * POP.legacy; S.popStars = popStars(S); }
  if (!Array.isArray(S.staff)) S.staff = [];
  if (S.staff.some(c => typeof c === 'string')) {
    S.staff = S.staff.map(c => {
      if (typeof c !== 'string') return c;
      const base = ROSTER.find(r => r.name === (c === 'tatsu' ? 'タツ' : 'ハナ'));
      const { skill, speed } = LEGACY_STAFF[c] ?? { skill: 3, speed: 3 };
      const wage = wageOf(skill, speed);
      return { ...base, skill, speed, wage, fee: wage };
    });
  }
  // 4色（きいろあり）時代のセーブ：きいろはきんに置き換え、ピンクを足し、イベントを作り直す
  if (S.fin && 'yellow' in S.fin) {
    S.fin = { red: S.fin.red, gold: S.fin.yellow, pink: 0, sky: S.fin.sky, green: S.fin.green };
    for (const r of S.rack ?? []) if (r.c === 'yellow') r.c = 'gold';
    if (S.color === 'yellow') S.color = 'gold';
  }
  if (!Array.isArray(S.events) || S.events.some(e => !EVENT_TYPES[e.type])) { S.events = genEvents(); updateMarket(S, true); }
  if (!Array.isArray(S.pool)) refreshPool(S);
  if (!Array.isArray(S.ads)) S.ads = [];
  // 1年版のセーブ：今年の成績と、2年目以降のイベントを補う
  if (!S.stats) S.stats = { sold: 0, missed: 0, rev: 0 };
  if (typeof S.price !== 'number') S.price = PRICING.start;
  if (!LOTS.some(([q]) => q === S.lot)) S.lot = START_LOT;
  for (const o of [S.stats, S.today, S.year]) if (o && typeof o.refused !== 'number') o.refused = 0;
  if (!Array.isArray(S.bills)) S.bills = [];
  if (S.year && typeof S.year.cost !== 'number') S.year.cost = 0;
  if (!S.year) { S.year = { sold: S.stats.sold, missed: S.stats.missed, rev: S.stats.rev }; S.history = []; }
  const lastYear = Math.floor(Math.max(0, ...S.events.map(e => e.start)) / YEAR) + 1;
  if (lastYear < YEARS) S.events.push(...genEvents(Math.random, YEARS, lastYear));
  return S;
}
export const isValidSave = sv => !!(sv && sv.fin && typeof sv.fin.red === 'number' && Array.isArray(sv.rack) && sv.rack.every(r => typeof r.n === 'number'));

/* ---------- 市場 ---------- */
export function marketTarget(S, d) {
  let t = 1, cap = 40;
  if (inPreRush(d)) { t = Math.max(t, 1.4); cap = Math.min(cap, 20); } // 10月後半
  if (inRush(d)) { t = Math.max(t, 1.9); cap = Math.min(cap, 12); } // 年末商戦：素材不足
  for (const e of S.events) {
    const p = phase(e, d), T = EVENT_TYPES[e.type];
    if (p === 'ann') { t = Math.max(t, 1.3); cap = Math.min(cap, 24); }
    if (p === 'act') { t = Math.max(t, T.market.t); cap = Math.min(cap, T.market.cap); }
  }
  return { t: Math.round((1 + (t - 1) * MARKET_EVENT_SCALE) * 100) / 100, cap: cap * QTY }; // 入荷上限（個/週）
}
// 相場を1週ぶん動かす。mBase＝季節やイベントによる流れ、mSwing＝毎週の揺れ、m＝実際の相場
export function updateMarket(S, first, rng = Math.random) {
  const { t, cap } = marketTarget(S, S.day);
  if (first || typeof S.mBase !== 'number') { S.mBase = t; S.mSwing = 0; }
  else if (t > S.mBase) S.mBase = Math.min(t, S.mBase + MARKET_STEP.up);
  else S.mBase = Math.max(t, S.mBase - MARKET_STEP.down);
  if (!first) {
    const g = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()); // 標準正規乱数
    S.mSwing = MARKET_SWING.keep * S.mSwing + MARKET_SWING.sd * g;
  }
  S.m = Math.round(Math.min(MARKET_SWING.max, Math.max(MARKET_SWING.min, S.mBase * (1 + S.mSwing))) * 100) / 100;
  S.sup = cap;
}

/* ---------- 需要 ---------- */
export function lambda(S, d) {
  const mo = monthOf(d), share = inRush(d) ? SHARE.rush : SHARE.normal;
  const growth = GROWTH[Math.min(YEARS, yearOf(d)) - 1]; // 年々評判が広まって客足が増える
  // rate は需要（個/週）。イベントの上乗せは人気・値段に関係しない。mult は客の基準の値段の倍率
  const base = DEMAND.base * QTY * MM[mo] * growth * S.noise * popMult(S) * (1 + adBoost(S, d)) * priceDraw(S), rate = {}, mult = {};
  const org = {}; // 色ごとの客の国籍の重み
  for (const k of CK) {
    rate[k] = base * share[k]; mult[k] = inRush(d) ? RUSH.price : 1;
    org[k] = Object.fromEntries(Object.entries(ORIGIN_BASE).map(([o, p]) => [o, rate[k] * p]));
  }
  for (const e of activeEvents(S, d)) for (const k of CK) {
    const add = demandOf(e, k);
    rate[k] += add; mult[k] *= priceOf(e, k);
    for (const [o, p] of Object.entries(EVENT_TYPES[e.type].origin ?? ORIGIN_BASE)) org[k][o] = (org[k][o] ?? 0) + add * p;
  }
  return { rate, mult, org };
}
// 客1人が欲しがる個数と種類を決める
export function rollBuyer(rng = Math.random) {
  let x = rng();
  for (const b of BUYERS) {
    if (x < b.p) return { type: b.type, want: rint(b.min, b.max, rng) };
    x -= b.p;
  }
  const b = BUYERS[0];
  return { type: b.type, want: rint(b.min, b.max, rng) };
}
// 重みつきで国籍を選ぶ
function rollOrigin(w, rng) {
  const tot = Object.values(w).reduce((a, b) => a + b, 0);
  let x = rng() * tot;
  for (const [o, p] of Object.entries(w)) { if (x < p) return o; x -= p; }
  return 'jp';
}
// 色 k を n 個欲しい type の客が来る。値段が高いと断り（人気が少し下がる）、
// 買うなら在庫があるだけ売れて残りは売り逃し。満足度で人気が動く
function arrive(S, k, n, refMult, type, origin, rng) {
  if (rng() < refuseRate(S, refMult, origin, type)) {
    S.pop = Math.max(0, S.pop - PRICING.refusePop);
    S.today.refused++; S.stats.refused++; S.year.refused++;
    return { sold: 0, missed: 0, amt: 0, refused: true };
  }
  const sold = Math.min(n, S.fin[k]), missed = n - sold, amt = sold * salePrice(S, k);
  if (sold === n) S.pop += POP.gain[type] * Math.pow(BASE * quality(S) / S.price, PRICING.popPrice);
  else if (sold === 0) S.pop = Math.max(0, S.pop - POP.miss);
  S.fin[k] -= sold;
  S.today.sold += sold; S.today.rev += amt; S.stats.sold += sold; S.stats.rev += amt; S.year.sold += sold; S.year.rev += amt; S.year.missed += missed;
  S.today.missed += missed; S.stats.missed += missed;
  return { sold, missed, amt };
}

/* ---------- 宣伝 ---------- */
// 効果中の宣伝 {id, until}（until は S.t の単位）
export const activeAd = (S, id) => S.ads.find(a => a.id === id && S.t < a.until);
export const adBoost = (S, d = S.day) => S.ads.reduce((a, ad) => a + (d < ad.until ? ADS[ad.id].boost : 0), 0);
export const canAd = (S, id) => !activeAd(S, id) && S.cash >= ADS[id].cost && !S.over;
// 宣伝を打つ。打てなければ null
export function runAd(S, id) {
  if (!canAd(S, id)) return null;
  const A = ADS[id];
  S.cash -= A.cost; S.pop += A.pop; S.year.cost += A.cost;
  S.ads = S.ads.filter(a => S.t < a.until).concat({ id, until: S.t + A.weeks });
  return `${A.name}を打った！人気が上がり、${A.weeks}週間お客さんが増える`;
}

/* ---------- ニュース・町の空気 ---------- */
export function dayNews(S, d) {
  const out = [];
  for (const e of S.events) {
    const T = EVENT_TYPES[e.type];
    if (T.silent) continue; // 突発の出費は newDay で知らせる
    if (e.ann && d === e.start - e.ann) out.push(T.ann(e));
    if (d === e.start) out.push(T.start(e));
    if (d === e.start + e.len) out.push(T.end(e));
  }
  const w = weekOfYear(d), y = yearOf(d);
  if (w === 0 && y > 1) out.push(`${y}年目が始まった！評判が広まって客足が増えた。家賃は月${yen(RENT_BY_YEAR[Math.min(YEARS, y) - 1])}に値上がり`);
  if (w === 24) out.push('10月。年末商戦に向けて在庫と素材を仕込む時期。11月からは素材も職人も足りなくなる');
  if (w === RUSH.preStart) out.push('素材の問屋が年末に向けて値上げを始めた');
  if (w === RUSH.start) out.push('年末商戦開幕！あかだるまが飛ぶように売れる。素材の入荷は細り、職人の求人も止まった');
  if (w === 32) out.push('12月。書き入れ時の本番！');
  if (w === RUSH.end) out.push('年が明けた…客足がぱったり途絶えた。売れ残りを抱えすぎないように');
  if (w === 44) out.push(y >= YEARS ? '最終月。3月第4週の営業終了で最終決算です' : `3月。今月末で${y}年目の決算です`);
  return out;
}
export function mood(S) {
  const d = curDay(S), act = activeEvents(S, d).filter(e => !EVENT_TYPES[e.type].silent);
  if (act.length) return EVENT_TYPES[act[act.length - 1].type].mood;
  if (inRush(d)) return '年末商戦！';
  if (weekOfYear(d) >= RUSH.end && weekOfYear(d) < RUSH.end + WEEKS) return '年明けで閑散';
  if (activeEvents(S, d, 'ann').length || inPreRush(d)) return '町がざわついています';
  return 'いつもの町';
}

/* ---------- 時間進行 ---------- */
// hooks（すべて省略可）:
//   sale(k, type, want, sold, origin, refused)  客1人ごと（type＝客の種類、want＝欲しい個数、sold＝買えた個数、origin＝jp/cn/west、refused＝高いと断った）
//   news()           その週のニュースがバナーに出たとき
//   save()           週替わりの保存タイミング
//   short(info)      資金ショート {cost, paid}
//   yearEnd(info)    年の終わり（最終年を除く） {year, rev, sold, missed, pop}
//   end(bankrupt)    ゲーム終了（S.over=true 済み）
export function step(S, dd, hooks = {}, rng = Math.random) {
  const prevDay = S.day;
  S.t += dd;
  if (S.color !== 'stop' && !colorStopped(S, S.color, S.day)) {
    S.prog += prodRate(S) * dd;
    const whole = Math.floor(S.prog), n = Math.max(0, Math.min(whole, S.mat, rackFree(S)));
    if (n > 0) { S.prog -= n; S.mat -= n; S.rack.push({ c: S.color, n, ready: S.t + DRY }); }
    if (n < whole) S.prog = 1; // 素材切れ・棚満杯のときは作りかけ1個分で止める
  } else S.prog = 0;
  for (let i = 0; i < S.rack.length; i++) {
    const r = S.rack[i];
    if (r.ready > S.t) continue;
    const m = Math.min(r.n, whFree(S));
    if (m <= 0) break;
    S.fin[r.c] += m; r.n -= m;
    if (r.n === 0) { S.rack.splice(i, 1); i--; }
  }
  const { rate, mult, org } = lambda(S, S.day);
  let amt = 0;
  for (const k of CK) {
    // 需要（個）を1人あたりの平均個数で割った人数が来る
    const n = poisson(rate[k] / MEAN_BUY * dd, rng);
    for (let i = 0; i < n; i++) {
      const b = rollBuyer(rng), origin = rollOrigin(org[k], rng), r = arrive(S, k, b.want, mult[k], b.type, origin, rng);
      amt += r.amt;
      if (hooks.sale) hooks.sale(k, b.type, b.want, r.sold, origin, r.refused);
    }
  }
  if (amt) S.recv.push({ amt, due: S.t + PAY_DELAY });
  let got = 0;
  S.recv = S.recv.filter(r => { if (r.due <= S.t) { got += r.amt; return false; } return true; });
  S.cash += got;
  const nd = Math.floor(S.t);
  if (nd > prevDay) newDay(S, nd, hooks, rng);
}
export function newDay(S, nd, hooks = {}, rng = Math.random) {
  const td = S.today;
  S.day = nd;
  const lines = [`${fullDateStr(nd - 1)}：販売${cnt(td.sold)}個 ${yen(td.rev)}${td.missed ? `／売り逃し${cnt(td.missed)}個` : ''}${td.refused ? `／「高い」と断られた${cnt(td.refused)}人` : ''}`];
  S.today = { sold: 0, missed: 0, rev: 0, refused: 0 };
  let short = null, hot = [];
  if (nd % WEEKS === 0) {
    const base = monthly(S, nd - 1), cost = base + billsTotal(S); // 終わった月（先週まで）の家賃で払う
    S.year.cost += base; // 税金・修理代は経費に入れない（税金の計算を単純にするため）
    S.bills = [];
    if (S.cash >= cost) { S.cash -= cost; S.lowMorale = false; hot.push(`月末の支払い ${yen(cost)} を済ませた`); }
    else { const paid = S.cash; S.cash = 0; S.strikes++; S.lowMorale = S.staff.length > 0; hot.push(`資金ショート（${S.strikes}/3）`); short = { cost, paid }; }
  }
  // 年の終わり：その年の成績を記録する（最終年は最終決算で）
  let yearEnd = null;
  if (nd % YEAR === 0 && S.strikes < 3) {
    const tax = Math.round(Math.max(0, S.year.rev - S.year.cost) * TAX_RATE / 10000) * 10000;
    yearEnd = { year: nd / YEAR, ...S.year, pop: popStars(S), tax };
    S.history.push(yearEnd);
    S.year = { sold: 0, missed: 0, rev: 0, cost: 0, refused: 0 };
    if (tax > 0 && nd < TOTAL) { S.bills.push({ name: '税金', amt: tax }); hot.push(`${yearEnd.year}年目の税金 ${yen(tax)} を来月末に納める`); }
  }
  if (S.strikes >= 3 || nd >= TOTAL) {
    S.news = [...hot, ...lines].map(t => ({ t })).concat(S.news).slice(0, 30);
    S.over = true;
    hooks.end?.(S.strikes >= 3);
    return;
  }
  const prev = S.m;
  S.noise = 0.7 + rng() * 0.6;
  updateMarket(S, false, rng);
  hot = hot.concat(dayNews(S, nd));
  // 突発の出費（予告なし）：修理代を次の月末の支払いに足す
  for (const e of S.events) if (e.type === 'accident' && e.start === nd) {
    const A = ACCIDENTS[e.kind], amt = Math.round((rentOf(nd) * (A.min + (A.max - A.min) * e.months) + equipValue(S) * ACCIDENT_EQUIP) / 10000) * 10000;
    S.bills.push({ name: '修理代', amt });
    hot.push(`${A.name}！修理代 ${yen(amt)} を月末に払う`);
  }
  for (const a of S.ads) if (a.until <= nd && a.until > nd - 1) hot.push(`${ADS[a.id].name}の効果が切れた`);
  S.ads = S.ads.filter(a => a.until > nd);
  if (nd % CRAFT.poolEvery === 0) refreshPool(S, rng); // 求職者は毎週入れ替わる（ニュースにはしない）
  const stars = popStars(S);
  if (stars > S.popStars) hot.push(`人気が上がった！「${POP.names[stars - 1]}」に。客足が増える`);
  if (stars < S.popStars) hot.push(`品切れ続きで人気が下がった…「${POP.names[stars - 1]}」に`);
  S.popStars = stars;
  if (!hot.length && S.m > prev + 0.01) hot.push('素材の相場がじわじわ上がっている');
  if (!hot.length && S.m < prev - 0.01) hot.push('素材の相場が落ち着いてきた');
  if (!hot.length && rng() < 0.25) hot.push(pick(FLAVOR, rng));
  S.news = [...hot, ...lines].map(t => ({ t })).concat(S.news).slice(0, 30);
  if (hot.length) { S.banner = hot[hot.length - 1]; hooks.news?.(); }
  hooks.save?.();
  if (short) hooks.short?.(short);
  else if (yearEnd) hooks.yearEnd?.(yearEnd);
}

/* ---------- プレイヤー操作 ---------- */
// 仕入れ：1回に S.lot 個ちょうど買う（まとめ買いほど1個が安い）。足りない分だけ減らして買うことはしない
export const lotMult = n => (LOTS.find(([q]) => q === n) ?? [n, 1])[1];
export const lotPrice = (S, n = S.lot) => Math.round(matPrice(S) * lotMult(n) / PRICE_UNIT) * PRICE_UNIT; // 素材1個の値段
export const buyCost = (S, n = S.lot) => n * lotPrice(S, n);
// 買えない理由（買えるなら ''）
export function buyBlockReason(S, n = S.lot) {
  if (S.sup < n) return marketTarget(S, S.day).cap === 0 ? '物流ストップ中' : S.sup < 1 ? '今週は入荷終了' : `今週はあと${S.sup}個まで`;
  if (whFree(S) < n) return '倉庫に入らない';
  if (S.cash < buyCost(S, n)) return 'お金が足りない';
  return '';
}
export const canBuy = (S, n = S.lot) => !S.over && !buyBlockReason(S, n);
export function buy(S, n = S.lot) {
  if (!canBuy(S, n)) return null;
  const cost = buyCost(S, n);
  S.cash -= cost; S.mat += n; S.sup -= n; S.year.cost += cost;
  return { n, cost };
}
// 売値を決める（PRICING.min〜max、step 刻み）
export function setPrice(S, p) {
  S.price = Math.min(PRICING.max, Math.max(PRICING.min, Math.round(p / PRICING.step) * PRICING.step));
}
export function prodReason(S) {
  if (S.color === 'stop') return '停止中';
  if (colorStopped(S, S.color)) return `${COLORS[S.color].name}は生産停止`;
  if (S.mat < 1) return '素材切れ！';
  if (rackFree(S) < 1) return '棚が満杯';
  return '';
}

// 投資メニューの項目。done が空文字なら購入可能な状態
export function investItems(S) {
  const items = [
    { id: 'rack', name: '乾燥棚を増やす', sub: `+${cnt(RACK_STEP)}個（いま${cnt(rackCap(S))}個）`, cost: RACK_UP[S.rackLv], done: S.rackLv >= RACK_UP.length ? '最大' : '', lv: `${S.rackLv}/${RACK_UP.length}` },
    { id: 'wh', name: '倉庫を広げる', sub: `+${cnt(WH_STEP)}個（いま${cnt(whCap(S))}個）`, cost: WH_UP[S.whLv], done: S.whLv >= WH_UP.length ? '最大' : '', lv: `${S.whLv}/${WH_UP.length}` },
  ];
  return items;
}
// 今週の求職者（雇える人）
export const poolCrafts = S => S.pool.map(id => ROSTER[id]);
export const canHire = (S, c) => S.staff.length < CRAFT.max && S.cash >= c.fee && S.pool.includes(c.id);
// 投資（乾燥棚・倉庫）を実行してトースト用の文言を返す（可否チェックは呼び出し側＝ボタンの disabled）
export function invest(S, u) {
  if (u === 'rack') { S.cash -= RACK_UP[S.rackLv]; S.year.cost += RACK_UP[S.rackLv]; S.rackLv++; return '乾燥棚を増やした'; }
  if (u === 'wh') { S.cash -= WH_UP[S.whLv]; S.year.cost += WH_UP[S.whLv]; S.whLv++; return '倉庫を広げた'; }
  return '';
}
// 求職者を雇う。雇えなければ null
export function hire(S, id) {
  const c = ROSTER[id];
  if (!c || !canHire(S, c)) return null;
  S.cash -= c.fee; S.year.cost += c.fee;
  S.staff.push({ ...c, look: { ...c.look } });
  S.pool = S.pool.filter(p => p !== id);
  return `${c.name}が工房に加わった`;
}
// 職人にやめてもらう（契約金は戻らない）
export function fire(S, id) {
  const c = S.staff.find(x => x.id === id);
  if (!c) return null;
  S.staff = S.staff.filter(x => x.id !== id);
  return `${c.name}が工房を去った`;
}

/* ---------- 決算 ---------- */
export function settle(S, bankrupt) {
  const stock = finN(S) * STOCK_VALUE + S.mat * MAT, score = S.cash + recvTotal(S) + stock;
  const rank = bankrupt ? '閉店' : RANKS.find(([min]) => score >= min)[1];
  const years = S.history.map(h => h.rev), best = Math.max(0, ...years);
  return { stock, score, rank, revenue: S.stats.rev, years, best, goal: best >= REVENUE_GOAL };
}
