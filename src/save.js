import { SAVE_KEY, OLD_SAVES } from './constants.js';

// 形式は S をそのまま JSON 化したもの。構造を変えるときはキーを更新するか変換処理を追加すること
export function save(S) { try { if (S) localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 保存できない環境では無視 */ } }

export function load() {
  try {
    const v = localStorage.getItem(SAVE_KEY);
    if (v) return JSON.parse(v);
    for (const o of OLD_SAVES) {
      const old = localStorage.getItem(o.key);
      if (old) return migrate(JSON.parse(old), o);
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
