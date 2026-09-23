import { MONTHS, WEEKS, YEAR } from './constants.js';

// rng は () => [0,1) の関数。テスト・自動プレイではシード付きのものを渡す
export const rint = (a, b, rng = Math.random) => a + Math.floor(rng() * (b - a + 1));
export const pick = (a, rng = Math.random) => a[Math.floor(rng() * a.length)];
// 金額をカンマ区切りにする（例：2,400,000円）
export const yen = n => Math.round(n).toLocaleString('ja-JP') + '円';
// 個数を「7,200」「2.4万」の形にする（1万以上は小数1桁で切り捨て）
export function cnt(n) {
  const v = Math.round(n);
  if (Math.abs(v) < 1e4) return v.toLocaleString('ja-JP');
  return Math.trunc(v / 1e3) / 10 + '万';
}
// 平均 lam のポアソン乱数。大きい lam は正規近似
export function poisson(lam, rng = Math.random) {
  if (lam <= 0) return 0;
  if (lam < 30) {
    const L = Math.exp(-lam);
    let k = 0, p = rng();
    while (p > L) { k++; p *= rng(); }
    return k;
  }
  const g = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  return Math.max(0, Math.round(lam + Math.sqrt(lam) * g));
}
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// d は通算の週。weekOfYear＝年内の週（0〜47）、yearOf＝何年目か（1〜）
export const weekOfYear = d => d % YEAR;
export const yearOf = d => Math.floor(d / YEAR) + 1;
export const monthOf = d => Math.min(11, Math.floor(weekOfYear(d) / WEEKS));
export const dateStr = d => `${MONTHS[monthOf(d)]}第${d % WEEKS + 1}週`;
export const fullDateStr = d => `${yearOf(d)}年目 ${dateStr(d)}`;

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
