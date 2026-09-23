// ゲームのシミュレーション本体。DOM に依存しない。
// 状態 S を引数で受け取り、画面側への通知は hooks 経由で行う。
import { COLORS, CK, TOTAL, DRY, BUY_N, MM, BASE, MAT, RENT, SELF_RATE, CRAFT, RACK_UP, WH_UP, FLAVOR, START_CASH, PRICE_UNIT, STOCK_VALUE, RANKS, REVENUE_GOAL, QTY, START_MAT, START_RED, RACK_BASE, RACK_STEP, WH_BASE, WH_STEP, BUYERS, MEAN_BUY, POP } from './constants.js';
import { rint, pick, yen, cnt, poisson, monthOf, dateStr } from './util.js';
import { ROSTER, wageOf } from './roster.js';

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
export const monthly = S => RENT + S.staff.reduce((a, c) => a + c.wage, 0);
// 工房の腕前：本人と職人のうまさを、作る量で重み付けした平均
export const teamSkill = S => {
  const m = staffMorale(S);
  const w = S.staff.reduce((a, c) => a + craftRate(c) * m, SELF_RATE);
  return S.staff.reduce((a, c) => a + craftRate(c) * m * c.skill, SELF_RATE * CRAFT.selfSkill) / w;
};
// 満足した客で上がる人気の倍率（腕前★2で1倍）
export const skillMult = S => teamSkill(S) / CRAFT.selfSkill;
export const recvTotal = S => S.recv.reduce((a, r) => a + r.amt, 0);
export const matPrice = S => Math.round(MAT * S.m / PRICE_UNIT) * PRICE_UNIT;
export const phase = (e, d) => (d >= e.start && d < e.start + e.len) ? 'act' : ((d >= e.start - e.ann && d < e.start) ? 'ann' : null);
export const curDay = S => Math.min(S.day, TOTAL - 1);
// 人気：0〜1 の割合、客足の倍率、★の数（1〜5）
export const popRatio = S => Math.min(1, S.pop / POP.max);
export const popMult = S => POP.minMult + (POP.maxMult - POP.minMult) * popRatio(S);
export const popStars = S => Math.min(5, 1 + Math.floor(popRatio(S) * 5));

/* ---------- 開始・セーブ互換 ---------- */
export function genEvents(rng = Math.random) {
  const ev = [], pop = ['green', 'sky', 'yellow', 'green', 'sky', 'red'];
  ev.push({ type: 'inbound', start: rint(6, 18, rng), len: 6, ann: 4 });
  ev.push({ type: 'inbound', start: rint(62, 70, rng), len: 6, ann: 4 });
  for (const [a, b] of [[22, 38], [42, 56], [102, 112]]) ev.push({ type: 'tv', start: rint(a, b, rng), len: 4, ann: 3, color: pick(pop, rng) });
  return ev;
}
export function newGame(rng = Math.random) {
  const S = {
    t: 0, day: 0, cash: START_CASH, mat: START_MAT, fin: { red: START_RED, green: 0, sky: 0, yellow: 0 }, rack: [], color: 'red', prog: 0,
    rackLv: 0, whLv: 0, staff: [], recv: [], m: 1, sup: 0, noise: 1, events: genEvents(rng), strikes: 0, lowMorale: false,
    stats: { sold: 0, missed: 0, rev: 0 }, today: { sold: 0, missed: 0, rev: 0 }, news: [], banner: '', over: false,
    pop: 0, popStars: 1, pool: [],
  };
  refreshPool(S, rng);
  updateMarket(S, true);
  S.banner = '4月1日、だるま堂 開店！素材を切らさないように';
  S.news = [{ t: '職人が「作る色」のだるまを自動で作ります' }, { t: 'お客さんの欲しいだるまを切らさず売ると、人気が上がって客足が増えます' }, { t: '12月〜1月の年末ラッシュが一番の書き入れ時です' }];
  return S;
}
// 求職者を入れ替える（雇っている人は除く）
export function refreshPool(S, rng = Math.random) {
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
  if (!Array.isArray(S.pool)) refreshPool(S);
  return S;
}
export const isValidSave = sv => !!(sv && sv.fin && typeof sv.fin.red === 'number' && Array.isArray(sv.rack) && sv.rack.every(r => typeof r.n === 'number'));

/* ---------- 市場 ---------- */
export function marketTarget(S, d) {
  let t = 1, cap = 40;
  if (d >= 74 && d < 80) { t = Math.max(t, 1.4); cap = Math.min(cap, 20); }
  if (d >= 80 && d < 100) { t = Math.max(t, 1.9); cap = Math.min(cap, 12); }
  for (const e of S.events) {
    const p = phase(e, d);
    if (p === 'ann') { t = Math.max(t, 1.3); cap = Math.min(cap, 24); }
    if (p === 'act') {
      if (e.type === 'tv') { t = Math.max(t, 2.0); cap = Math.min(cap, 10); }
      else { t = Math.max(t, 1.6); cap = Math.min(cap, 12); }
    }
  }
  return { t, cap: cap * QTY }; // 入荷上限（個/日）
}
export function updateMarket(S, first) {
  const { t, cap } = marketTarget(S, S.day);
  if (first) S.m = t;
  else if (t > S.m) S.m = Math.min(t, S.m + 0.2);
  else S.m = Math.max(t, S.m - 0.12);
  S.m = Math.round(S.m * 100) / 100;
  S.sup = cap;
}

/* ---------- 需要 ---------- */
export function lambda(S, d) {
  const mo = monthOf(d);
  const share = (mo >= 8 && mo <= 10) ? { red: .7, green: .1, sky: .1, yellow: .1 } : { red: .45, green: .2, sky: .15, yellow: .2 };
  const base = 2.4 * QTY * MM[mo] * S.noise * popMult(S), rate = {}, mult = {}; // rate は需要（個/日）。特需の上乗せは人気に関係しない
  for (const k of CK) { rate[k] = base * share[k]; mult[k] = (mo === 8 || mo === 9) ? 1.4 : 1; }
  for (const e of S.events) {
    if (phase(e, d) !== 'act') continue;
    if (e.type === 'tv') { rate[e.color] += 5.5 * QTY; mult[e.color] *= 1.5; }
    else { rate.sky += 2 * QTY; rate.yellow += 2 * QTY; rate.green += 1 * QTY; mult.sky *= 1.4; mult.yellow *= 1.4; mult.green *= 1.4; }
  }
  return { rate, mult };
}
export const unitPrice = mult => Math.round(BASE * mult / PRICE_UNIT) * PRICE_UNIT;
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
// 色 k を n 個欲しい type の客が来る。在庫があるだけ売れ、残りは売り逃し。満足度で人気が動く
function arrive(S, k, n, mult, type) {
  const sold = Math.min(n, S.fin[k]), missed = n - sold, amt = sold * unitPrice(mult);
  if (sold === n) S.pop += POP.gain[type] * skillMult(S);
  else if (sold === 0) S.pop = Math.max(0, S.pop - POP.miss);
  S.fin[k] -= sold;
  S.today.sold += sold; S.today.rev += amt; S.stats.sold += sold; S.stats.rev += amt;
  S.today.missed += missed; S.stats.missed += missed;
  return { sold, missed, amt };
}

/* ---------- ニュース・町の空気 ---------- */
export function dayNews(S, d) {
  const out = [];
  for (const e of S.events) {
    const c = e.color ? COLORS[e.color].name : '';
    if (d === e.start - e.ann) out.push(e.type === 'tv' ? `${e.ann}日後、テレビで${c}だるま特集！` : `${e.ann}日後から観光客が増えそう。あお・きいろ・みどりが人気の予感`);
    if (d === e.start) out.push(e.type === 'tv' ? `放送開始！${c}だるまに注文殺到（${e.len}日間・高値）` : `インバウンドラッシュ！ポップな色が高く売れる（${e.len}日間）`);
    if (d === e.start + e.len) out.push(e.type === 'tv' ? 'テレビのブームがひと段落した' : '観光ラッシュが落ち着いた');
  }
  if (d === 70) out.push('11月。年末ラッシュまであと10日。相場がもうすぐ上がる');
  if (d === 80) out.push('年末ラッシュ開幕！あかだるまが飛ぶように売れる');
  if (d === 90) out.push('新年のだるま市！まだまだ売れる');
  if (d === 100) out.push('受験シーズン。合格祈願の注文が続く');
  if (d === 110) out.push('最終月。3月10日の営業終了で決算です');
  return out;
}
export function mood(S) {
  const d = curDay(S);
  if (S.events.some(e => phase(e, d) === 'act')) return '大にぎわい！';
  if (d >= 80 && d < 100) return '年末ラッシュ！';
  if (S.events.some(e => phase(e, d) === 'ann') || (d >= 74 && d < 80)) return '町がざわついています';
  return 'いつもの町';
}

/* ---------- 時間進行 ---------- */
// hooks（すべて省略可）:
//   sale(k, type, want, sold)  客1人ごと（type＝客の種類、want＝欲しい個数、sold＝買えた個数）
//   news()           その日のニュースがバナーに出たとき
//   save()           日替わりの保存タイミング
//   short(info)      資金ショート {cost, paid}
//   end(bankrupt)    ゲーム終了（S.over=true 済み）
export function step(S, dd, hooks = {}, rng = Math.random) {
  const prevDay = S.day;
  S.t += dd;
  if (S.color !== 'stop') {
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
  const { rate, mult } = lambda(S, S.day);
  let amt = 0;
  for (const k of CK) {
    // 需要（個）を1人あたりの平均個数で割った人数が来る
    const n = poisson(rate[k] / MEAN_BUY * dd, rng);
    for (let i = 0; i < n; i++) {
      const b = rollBuyer(rng), r = arrive(S, k, b.want, mult[k], b.type);
      amt += r.amt;
      hooks.sale?.(k, b.type, b.want, r.sold);
    }
  }
  if (amt) S.recv.push({ amt, due: S.t + DRY });
  let got = 0;
  S.recv = S.recv.filter(r => { if (r.due <= S.t) { got += r.amt; return false; } return true; });
  S.cash += got;
  const nd = Math.floor(S.t);
  if (nd > prevDay) newDay(S, nd, hooks, rng);
}
export function newDay(S, nd, hooks = {}, rng = Math.random) {
  const td = S.today;
  S.day = nd;
  const lines = [`${dateStr(nd - 1)}：販売${cnt(td.sold)}個 ${yen(td.rev)}${td.missed ? `／売り逃し${cnt(td.missed)}個` : ''}`];
  S.today = { sold: 0, missed: 0, rev: 0 };
  let short = null, hot = [];
  if (nd % 10 === 0) {
    const cost = monthly(S);
    if (S.cash >= cost) { S.cash -= cost; S.lowMorale = false; hot.push(`月末の支払い ${yen(cost)} を済ませた`); }
    else { const paid = S.cash; S.cash = 0; S.strikes++; S.lowMorale = S.staff.length > 0; hot.push(`資金ショート（${S.strikes}/3）`); short = { cost, paid }; }
  }
  if (S.strikes >= 3 || nd >= TOTAL) {
    S.news = [...hot, ...lines].map(t => ({ t })).concat(S.news).slice(0, 30);
    S.over = true;
    hooks.end?.(S.strikes >= 3);
    return;
  }
  const prev = S.m;
  S.noise = 0.7 + rng() * 0.6;
  updateMarket(S, false);
  hot = hot.concat(dayNews(S, nd));
  if (nd % CRAFT.poolEvery === 0) { refreshPool(S, rng); hot.push('求職者が入れ替わった（投資メニューから雇える）'); }
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
}

/* ---------- プレイヤー操作 ---------- */
export const buyQty = S => Math.max(0, Math.min(BUY_N, S.sup, whFree(S), Math.floor(S.cash / matPrice(S))));
// 仕入れる。買えなければ null
export function buy(S) {
  const n = buyQty(S);
  if (n < 1) return null;
  const cost = n * matPrice(S);
  S.cash -= cost; S.mat += n; S.sup -= n;
  return { n, cost };
}
export const buyBlockReason = S => S.sup < 1 ? '本日は入荷終了' : whFree(S) < 1 ? '倉庫が満杯' : 'お金が足りない';
export function prodReason(S) {
  if (S.color === 'stop') return '停止中';
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
  if (u === 'rack') { S.cash -= RACK_UP[S.rackLv]; S.rackLv++; return '乾燥棚を増やした'; }
  if (u === 'wh') { S.cash -= WH_UP[S.whLv]; S.whLv++; return '倉庫を広げた'; }
  return '';
}
// 求職者を雇う。雇えなければ null
export function hire(S, id) {
  const c = ROSTER[id];
  if (!c || !canHire(S, c)) return null;
  S.cash -= c.fee;
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
  return { stock, score, rank, revenue: S.stats.rev, goal: S.stats.rev >= REVENUE_GOAL };
}
