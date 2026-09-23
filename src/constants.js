// バランス調整値・ゲーム定数（HANDOFF.md 第3章）
export const INK = '#2a2320';
export const COLORS = {
  red: { name: 'あか', b: '#d8382a', d: '#8f1f15', h: '#f57a62', g: '#f5c742' },
  green: { name: 'みどり', b: '#3aae78', d: '#1f6e4a', h: '#8fdcb4', g: '#f5c742' },
  sky: { name: 'あお', b: '#3a78d8', d: '#1f4a92', h: '#9cc2f2', g: '#f5c742' }, // キー sky はセーブ互換のため維持
  yellow: { name: 'きいろ', b: '#f2c230', d: '#b3841a', h: '#fbe38a', g: '#e2412f' },
};
export const GRAY = { b: '#bdb2a4', d: '#8c8378', h: '#d8d0c4', g: '#a8a097' };
export const CK = ['red', 'green', 'sky', 'yellow'];
export const MONTHS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
export const TOTAL = 120, DAY_SEC = 15, DRY = 3, BUY_N = 10;
export const MM = [1.0, 0.8, 0.7, 0.8, 0.9, 0.8, 1.0, 1.3, 4.0, 4.5, 1.8, 1.2];
export const BASE = 1500, MAT = 350, RENT = 3000, SELF_RATE = 2;
export const STAFF = {
  tatsu: { name: 'タツ', desc: '作業が速いベテラン。生産+2.5個/日', fee: 5000, wage: 4000, rate: 2.5 },
  hana: { name: 'ハナ', desc: '堅実な職人。生産+1.5個/日', fee: 5000, wage: 4000, rate: 1.5 },
};
export const RACK_UP = [8000, 12000, 16000], WH_UP = [5000, 8000, 12000];
export const SAVE_KEY = 'popdaruma_rt_v1';
export const FLAVOR = ['常連のおばあちゃんが赤だるまを褒めてくれた', '隣の駄菓子屋からラムネの差し入れ', 'ラジオから昭和歌謡が流れている', '今日もいい天気。筆がよくのる', '近所の子どもがだるまを数えに来た'];
