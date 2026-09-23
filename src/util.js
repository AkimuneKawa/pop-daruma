import { MONTHS } from './constants.js';

// rng は () => [0,1) の関数。テスト・自動プレイではシード付きのものを渡す
export const rint = (a, b, rng = Math.random) => a + Math.floor(rng() * (b - a + 1));
export const pick = (a, rng = Math.random) => a[Math.floor(rng() * a.length)];
// 金額を「2,400万円」「12億3,456万円」の形にする
export function yen(n) {
  const v = Math.round(n), a = Math.abs(v);
  const oku = Math.floor(a / 1e8), man = Math.floor(a % 1e8 / 1e4), rest = a % 1e4;
  const f = x => x.toLocaleString('ja-JP');
  const s = (oku ? f(oku) + '億' : '') + (man ? f(man) + '万' : '') + (rest || (!oku && !man) ? f(rest) : '');
  return (v < 0 ? '-' : '') + s + '円';
}
// 狭い欄用：1億以上は「12.34億円」（小数2桁で切り捨て）、それ未満は yen と同じ
export function yenShort(n) {
  const v = Math.round(n), a = Math.abs(v);
  if (a < 1e8) return yen(v);
  return (v < 0 ? '-' : '') + Math.floor(a / 1e6) / 100 + '億円';
}
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const monthOf = d => Math.min(11, Math.floor(d / 10));
export const dateStr = d => `${MONTHS[monthOf(d)]}${d % 10 + 1}日`;

// シード付き乱数（mulberry32）
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
