import { SAVE_KEY, OLD_SAVES, WEEKIFY } from './constants.js';

// 形式は S をそのまま JSON 化したもの。構造を変えるときはキーを更新するか変換処理を追加すること
export function save(S) { try { if (S) localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 保存できない環境では無視 */ } }

export function load() {
  try {
    const v = localStorage.getItem(SAVE_KEY);
    if (v) return JSON.parse(v);
    for (const o of OLD_SAVES) {
      const old = localStorage.getItem(o.key);
      if (old) return weekify(migrate(JSON.parse(old), o));
    }
    return null;
  } catch (e) { return null; }
}

// 旧セーブを現在の規模に変換する。数量は qty 倍、金額は money 倍。
// batch=false の版は乾燥棚が1個ずつ {c, ready} なので {c, n, ready} の束にする
export function migrate(S, { qty, money, batch }) {
  if (!S || typeof S !== 'object') return S;
  const q = n => Math.round(n * qty), m = n => Math.round(n * money);
  if (typeof S.cash === 'number') S.cash = m(S.cash);
  if (Array.isArray(S.recv)) for (const r of S.recv) r.amt = m(r.amt);
  for (const o of [S.stats, S.today]) if (o) { o.rev = m(o.rev); o.sold = q(o.sold); o.missed = q(o.missed); }
  if (typeof S.mat === 'number') S.mat = q(S.mat);
  if (S.fin) for (const c in S.fin) S.fin[c] = q(S.fin[c]);
  if (Array.isArray(S.rack)) S.rack = S.rack.map(r => ({ c: r.c, n: q(batch ? r.n : 1), ready: r.ready })).filter(r => r.n > 0);
  if (typeof S.sup === 'number') S.sup = q(S.sup);
  S.prog = 0;
  return S;
}

// v4（1日単位・売値1,500円）のセーブを v5（1週単位・売値3,000円）に直す。
// 時刻は×time、数量は×qty、人気は×pop。金額はそのまま（年商の規模は変わらない）。
// 季節やイベントの時期は作り直す（sim.normalize が events を作り直す）
export function weekify(S) {
  if (!S || typeof S !== 'object') return S;
  const { time, qty, pop } = WEEKIFY;
  const q = n => Math.round(n * qty);
  if (typeof S.t === 'number') { S.t *= time; S.day = Math.floor(S.t); }
  for (const r of S.rack ?? []) { r.ready *= time; r.n = q(r.n); }
  S.rack = (S.rack ?? []).filter(r => r.n > 0);
  for (const r of S.recv ?? []) r.due *= time;
  for (const a of S.ads ?? []) a.until *= time;
  if (typeof S.mat === 'number') S.mat = q(S.mat);
  if (S.fin) for (const c in S.fin) S.fin[c] = q(S.fin[c]);
  for (const o of [S.stats, S.today]) if (o) { o.sold = q(o.sold); o.missed = q(o.missed); }
  if (typeof S.pop === 'number') S.pop *= pop;
  S.sup = 0; S.prog = 0;
  S.events = null; // 週の暦で作り直す
  return S;
}
