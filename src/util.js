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
// 狭い欄用：1億以上は「12.34億円」、1万以上は「2,398万円」、それ未満は「5,210円」（いずれも切り捨て）
export function yenShort(n) {
  const v = Math.round(n), a = Math.abs(v), sign = v < 0 ? '-' : '';
  if (a >= 1e8) return sign + Math.floor(a / 1e6) / 100 + '億円';
  if (a >= 1e4) return sign + Math.floor(a / 1e4).toLocaleString('ja-JP') + '万円';
  return yen(v);
}
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
