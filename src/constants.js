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
export const TOTAL = 120, DAY_SEC = 15, DRY = 3;
export const MM = [1.0, 0.8, 0.7, 0.8, 0.9, 0.8, 1.0, 1.3, 4.0, 4.5, 1.8, 1.2];

// 規模の倍率。v1（HANDOFF.md）に比べて、数量（生産・客・在庫・容量・仕入れ）と
// 固定費（家賃・給料・投資・初期資金）を QTY 倍にし、単価（売値・素材）は据え置く。
// 売上＝単価×数量なので、比率は v1 と同じままで年商が QTY 倍になる（上手なプレイで10億円）
export const QTY = 1200;

// 単価（1個あたり。v1 と同じ）
export const BASE = 1500, MAT = 350;
export const PRICE_UNIT = 10; // 売値・素材価格は10円単位で丸める
export const STOCK_VALUE = 600; // 決算時の完成品1個の評価額

// 数量
export const SELF_RATE = 2 * QTY; // 本人の生産数（個/日）
export const BUY_N = 10 * QTY; // 1タップで仕入れる数
export const START_MAT = 10 * QTY, START_RED = 2 * QTY;
export const RACK_BASE = 6 * QTY, RACK_STEP = 4 * QTY; // 乾燥棚の容量と1段階の増分
export const WH_BASE = 20 * QTY, WH_STEP = 15 * QTY; // 倉庫の容量と1段階の増分

// 固定費・投資
export const RENT = 3600000;
export const START_CASH = 24000000;
export const STAFF = {
  tatsu: { name: 'タツ', desc: '作業が速いベテラン', fee: 6000000, wage: 4800000, rate: 2.5 * QTY },
  hana: { name: 'ハナ', desc: '堅実な職人', fee: 6000000, wage: 4800000, rate: 1.5 * QTY },
};
export const RACK_UP = [9600000, 14400000, 19200000], WH_UP = [6000000, 9600000, 14400000];
// 総資産による称号（上から判定）
export const RANKS = [[480000000, 'だるま大名'], [240000000, '名工'], [96000000, '一人前'], [0, '見習い']];
export const REVENUE_GOAL = 1000000000;

// セーブ。v1＝元の単一HTML、v2＝金額1200倍の版、v3＝いま（数量1200倍）
export const SAVE_KEY = 'popdaruma_rt_v3';
export const OLD_SAVE_KEYS = { v2: 'popdaruma_rt_v2', v1: 'popdaruma_rt_v1' };
export const FLAVOR = ['常連のおばあちゃんが赤だるまを褒めてくれた', '隣の駄菓子屋からラムネの差し入れ', 'ラジオから昭和歌謡が流れている', '今日もいい天気。筆がよくのる', '近所の子どもがだるまを数えに来た'];
