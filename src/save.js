import { SAVE_KEY, OLD_SAVE_KEYS, QTY } from './constants.js';

// 形式は S をそのまま JSON 化したもの。構造を変えるときはキーを更新するか変換処理を追加すること
export function save(S) { try { if (S) localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 保存できない環境では無視 */ } }

export function load() {
  try {
    const v = localStorage.getItem(SAVE_KEY);
    if (v) return JSON.parse(v);
    const v2 = localStorage.getItem(OLD_SAVE_KEYS.v2);
    if (v2) return migrate(JSON.parse(v2), { money: false });
    const v1 = localStorage.getItem(OLD_SAVE_KEYS.v1);
    return v1 ? migrate(JSON.parse(v1), { money: true }) : null;
  } catch (e) { return null; }
}

// 旧セーブを現在の規模に変換する。
// v1・v2 とも数量は1/QTY、乾燥棚は1個ずつ。v1 はさらに金額も1/QTY（v2 は金額だけ変換済み）
export function migrate(S, { money }) {
  if (!S || typeof S !== 'object') return S;
  const k = QTY;
  if (money) {
    if (typeof S.cash === 'number') S.cash *= k;
    if (Array.isArray(S.recv)) for (const r of S.recv) r.amt *= k;
    if (S.stats) S.stats.rev *= k;
    if (S.today) S.today.rev *= k;
  }
  if (typeof S.mat === 'number') S.mat *= k;
  if (S.fin) for (const c in S.fin) S.fin[c] *= k;
  if (Array.isArray(S.rack)) S.rack = S.rack.map(r => ({ c: r.c, n: k, ready: r.ready }));
  if (typeof S.sup === 'number') S.sup *= k;
  for (const o of [S.stats, S.today]) if (o) { o.sold *= k; o.missed *= k; }
  S.prog = 0;
  return S;
}
