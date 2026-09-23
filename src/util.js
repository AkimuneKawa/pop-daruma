import { MONTHS } from './constants.js';

// rng は () => [0,1) の関数。テスト・自動プレイではシード付きのものを渡す
export const rint = (a, b, rng = Math.random) => a + Math.floor(rng() * (b - a + 1));
export const pick = (a, rng = Math.random) => a[Math.floor(rng() * a.length)];
export const yen = n => '¥' + Math.round(n).toLocaleString('ja-JP');
export const num = n => Math.round(n).toLocaleString('ja-JP');
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
