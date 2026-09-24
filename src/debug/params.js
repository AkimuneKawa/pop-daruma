// デバッグパネルで変えられるパラメータと、テンプレ（プリセット）。
// バランス値は constants.js のオブジェクトを直接書き換える（sim.js はそれを毎回読むので、すぐ効く）
import { BALANCE, PRICING, DEMAND, POP, RENT_BY_YEAR, GROWTH, MARKET_SWING } from '../constants.js';

// { key, group, label, get, set, step }。key は書き出し・読み込み・テンプレで使う名前
const P = (key, group, label, obj, prop, step = 0.01) => ({ key, group, label, step, get: () => obj[prop], set: v => { obj[prop] = v; } });
export const PARAMS = [
  P('base', 'お金', 'だるまの基準の売値（円）', BALANCE, 'base', 50),
  P('mat', 'お金', '素材1個の基準の値段（円）', BALANCE, 'mat', 50),
  P('startCash', 'お金', '開店資金（円・はじめからで効く）', BALANCE, 'startCash', 100000),
  P('rent1', 'お金', '家賃 1年目（円/月）', RENT_BY_YEAR, 0, 10000),
  P('rent2', 'お金', '家賃 2年目（円/月）', RENT_BY_YEAR, 1, 10000),
  P('rent3', 'お金', '家賃 3年目（円/月）', RENT_BY_YEAR, 2, 10000),
  P('taxRate', 'お金', '税率', BALANCE, 'taxRate'),
  P('accidentEquip', 'お金', '修理代の設備比率', BALANCE, 'accidentEquip'),
  P('stockValue', 'お金', '決算時の在庫1個の評価（円）', BALANCE, 'stockValue', 50),
  P('demand', '客足', '基本の客足', DEMAND, 'base', 0.1),
  P('growth2', '客足', '2年目の客足の倍率', GROWTH, 1, 0.1),
  P('growth3', '客足', '3年目の客足の倍率', GROWTH, 2, 0.1),
  P('draw', '客足', '安売りで客足が増える強さ', PRICING, 'draw', 0.1),
  P('mid', '値段', 'ふつうの客の半分が断る値段（基準の何倍）', PRICING, 'mid', 0.05),
  P('slope', '値段', '断り方の急さ', PRICING, 'slope', 0.5),
  P('skillRef', '値段', '腕前★1あたり基準が上がる割合', PRICING, 'skillRef'),
  P('refusePop', '値段', '断られたときに下がる人気', PRICING, 'refusePop', 0.05),
  P('indJp', '値段', '値段を気にしない日本客の割合', PRICING.indifferent, 'jp', 0.05),
  P('indCn', '値段', '値段を気にしない中国客の割合', PRICING.indifferent, 'cn', 0.05),
  P('indWest', '値段', '値段を気にしない欧米客の割合', PRICING.indifferent, 'west', 0.05),
  P('shopMid', '値段', '小売店の半分が断る値段（基準の何倍）', PRICING.bulk.shop, 'mid', 0.05),
  P('traderMid', '値段', '業者の半分が断る値段（基準の何倍）', PRICING.bulk.trader, 'mid', 0.05),
  P('popMax', '人気', '人気が最大になるポイント', POP, 'max', 50),
  P('popMin', '人気', '人気が最低のときの客足の倍率', POP, 'minMult', 0.05),
  P('popMaxMult', '人気', '人気が最大のときの客足の倍率', POP, 'maxMult', 0.05),
  P('popMiss', '人気', '何も買えなかった客で下がる人気', POP, 'miss', 0.1),
  P('swingSd', '相場', '相場の毎週の揺れの大きさ', MARKET_SWING, 'sd', 0.01),
  P('swingKeep', '相場', '揺れが続く強さ（0〜1）', MARKET_SWING, 'keep', 0.05),
  P('stepSec', '進み方', '1週の秒数（小さいほど速い）', BALANCE, 'stepSec', 1),
];
export const PARAM_BY_KEY = Object.fromEntries(PARAMS.map(p => [p.key, p]));

// 読み込み時の値（標準）
export const DEFAULTS = Object.fromEntries(PARAMS.map(p => [p.key, p.get()]));

// テンプレ。values に書いたものだけ変え、それ以外は標準に戻す
export const PRESETS = [
  { id: 'standard', name: '標準', desc: 'いまのバランスそのまま', values: {} },
  { id: 'easy', name: 'やさしい', desc: '家賃・税・修理代が軽く、開店資金とお客さんが多い', values: { startCash: 5000000, rent1: 180000, rent2: 216000, rent3: 252000, taxRate: 0.15, accidentEquip: 0.1, demand: 1.8 } },
  { id: 'hard', name: 'きびしい', desc: '家賃・税・修理代が重く、お客さんが少ない', values: { rent1: 360000, rent2: 432000, rent3: 504000, taxRate: 0.4, accidentEquip: 0.5, demand: 1.2 } },
  { id: 'highPrice', name: '高価格が有利', desc: 'お客さんが値段を気にしにくく、腕前の効果が大きい', values: { mid: 1.8, skillRef: 0.35, draw: 0.6 } },
  { id: 'lowPrice', name: '低価格が有利', desc: '安売りでお客さんが大きく増える', values: { draw: 2, mid: 1.3 } },
  { id: 'volatile', name: '相場が荒れる', desc: '素材の相場が大きく上下する', values: { swingSd: 0.35, swingKeep: 0.7 } },
  { id: 'fast', name: '早送り', desc: '1週2秒で進む（動作確認用）', values: { stepSec: 2 } },
];

export function applyValues(values) {
  for (const p of PARAMS) p.set(p.key in values ? Number(values[p.key]) : DEFAULTS[p.key]);
}
export const applyPreset = id => applyValues(PRESETS.find(p => p.id === id)?.values ?? {});
// 標準と違う値だけを取り出す（書き出し・保存用）
export function changedValues() {
  const out = {};
  for (const p of PARAMS) if (p.get() !== DEFAULTS[p.key]) out[p.key] = p.get();
  return out;
}
export const isDefault = () => Object.keys(changedValues()).length === 0;

// ブラウザに保存しておき、再読み込みしても続けて使えるようにする
const KEY = 'popdaruma_debug_params';
export function saveValues() { try { localStorage.setItem(KEY, JSON.stringify(changedValues())); } catch (e) { /* 保存できない環境 */ } }
export function loadValues() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); applyValues(v); return v; } catch (e) { return {}; }
}
// 書き出した JSON を読み込む。知らない名前や数でない値は無視して、読み込んだ数を返す
export function importValues(text) {
  const v = JSON.parse(text);
  if (!v || typeof v !== 'object') throw new Error('JSON のオブジェクトではありません');
  const ok = Object.fromEntries(Object.entries(v).filter(([k, x]) => PARAM_BY_KEY[k] && Number.isFinite(Number(x))));
  applyValues(ok);
  return Object.keys(ok).length;
}
