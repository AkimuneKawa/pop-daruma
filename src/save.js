import { SAVE_KEY, LEGACY_SAVE_KEY, LEGACY_MONEY_SCALE } from './constants.js';

// 形式は S をそのまま JSON 化したもの。構造を変えるときはキーを更新するか変換処理を追加すること
export function save(S) { try { if (S) localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 保存できない環境では無視 */ } }

export function load() {
  try {
    const v = localStorage.getItem(SAVE_KEY);
    if (v) return JSON.parse(v);
    const old = localStorage.getItem(LEGACY_SAVE_KEY);
    return old ? migrateV1(JSON.parse(old)) : null;
  } catch (e) { return null; }
}

// v1（金額が1/1200）のセーブを現在の金額スケールに変換する
export function migrateV1(S) {
  if (!S || typeof S !== 'object') return S;
  const k = LEGACY_MONEY_SCALE;
  if (typeof S.cash === 'number') S.cash *= k;
  if (Array.isArray(S.recv)) for (const r of S.recv) r.amt *= k;
  if (S.stats) S.stats.rev *= k;
  if (S.today) S.today.rev *= k;
  return S;
}
