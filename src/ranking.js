// ランキング（Supabase）。公式ライブラリは使わず、REST API を fetch で直接呼ぶ。
// 接続先はビルド時の環境変数 VITE_SUPABASE_URL・VITE_SUPABASE_ANON_KEY（未設定ならランキングは無効）
import { RANKING_VERSION } from './constants.js';

const BASE = import.meta.env?.VITE_SUPABASE_URL;
const KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;
export const enabled = () => !!(BASE && KEY);

// 並べ方：score＝3年後の総資産、best_year＝最高の年商
export const KINDS = { score: '総資産', best_year: '最高の年商' };
const NAME_KEY = 'popdaruma_name';

const headers = extra => ({ apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...extra });
const endpoint = q => `${BASE}/rest/v1/scores${q}`;

export function cleanName(s) { return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 12); }
export function savedName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
function rememberName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) { /* 保存できない環境 */ } }

// スコアを登録し、{id, rank: {score, best_year}}（それぞれ何位か）を返す
export async function submit({ name, score, best, revenue, title }) {
  const row = { name: cleanName(name), score: Math.round(score), best_year: Math.round(best), revenue: Math.round(revenue), title, version: RANKING_VERSION };
  if (!row.name) throw new Error('名前を入れてください');
  const res = await fetch(endpoint(''), { method: 'POST', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(row) });
  if (!res.ok) throw new Error(`登録できませんでした（${res.status}）`);
  const [saved] = await res.json();
  rememberName(row.name);
  const [a, b] = await Promise.all([placeOf('score', row.score), placeOf('best_year', row.best_year)]);
  return { id: saved?.id, rank: { score: a, best_year: b } };
}

// value より上の件数＋1＝順位
async function placeOf(kind, value) {
  const res = await fetch(endpoint(`?select=id&version=eq.${RANKING_VERSION}&${kind}=gt.${value}`), { headers: headers({ Prefer: 'count=exact', Range: '0-0' }) });
  if (!res.ok) return null;
  const total = Number((res.headers.get('content-range') || '').split('/')[1]);
  return Number.isFinite(total) ? total + 1 : null;
}

// 上位 limit 件
export async function top(kind = 'score', limit = 50) {
  const res = await fetch(endpoint(`?select=id,name,score,best_year,title,created_at&version=eq.${RANKING_VERSION}&order=${kind}.desc,created_at.asc&limit=${limit}`), { headers: headers() });
  if (!res.ok) throw new Error(`読み込めませんでした（${res.status}）`);
  return res.json();
}
