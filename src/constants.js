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

// 規模の倍率。v1（HANDOFF.md）に比べて、数量（生産・需要・在庫・容量・仕入れ・入荷上限）と
// 固定費（家賃・給料・投資・初期資金）を QTY 倍にし、単価（売値・素材）は据え置く。
// 売上＝単価×数量なので、比率は v1 と同じままで年商が QTY 倍になる（上手なプレイで1億円）
export const QTY = 120;
export const DRAW_UNIT = 10; // 工房シーンのだるま1体が表す個数（乾燥棚は容量に応じて増える）

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

// 客の種類。p＝割合、min〜max＝1人が欲しがる個数。在庫が足りなければあるだけ買い、残りは売り逃し
export const BUYERS = [
  { type: 'person', p: 0.85, min: 1, max: 3 }, // ふつうのお客さん
  { type: 'shop', p: 0.13, min: 5, max: 30 }, // 土産物屋・小売店
  { type: 'trader', p: 0.02, min: 50, max: 100 }, // 卸の業者
];
export const MEAN_BUY = BUYERS.reduce((a, b) => a + b.p * (b.min + b.max) / 2, 0); // 1人あたりの平均個数

// 固定費・投資
export const RENT = 360000;
export const START_CASH = 2400000;
export const STAFF = {
  tatsu: { name: 'タツ', desc: '作業が速いベテラン', fee: 600000, wage: 480000, rate: 2.5 * QTY },
  hana: { name: 'ハナ', desc: '堅実な職人', fee: 600000, wage: 480000, rate: 1.5 * QTY },
};
export const RACK_UP = [960000, 1440000, 1920000], WH_UP = [600000, 960000, 1440000];
// 総資産による称号（上から判定）
export const RANKS = [[48000000, 'だるま大名'], [24000000, '名工'], [9600000, '一人前'], [0, '見習い']];
export const REVENUE_GOAL = 100000000;

// セーブ。v1＝元の単一HTML、v2＝金額1200倍、v3＝数量1200倍、v4＝いま（数量120倍・客は1人ずつ）
export const SAVE_KEY = 'popdaruma_rt_v4';
// 旧セーブの変換倍率：数量×qty、金額×money、乾燥棚が1個ずつ（束でない）なら batch=false
export const OLD_SAVES = [
  { key: 'popdaruma_rt_v3', qty: QTY / 1200, money: QTY / 1200, batch: true },
  { key: 'popdaruma_rt_v2', qty: QTY, money: QTY / 1200, batch: false },
  { key: 'popdaruma_rt_v1', qty: QTY, money: QTY, batch: false },
];
export const FLAVOR = ['常連のおばあちゃんが赤だるまを褒めてくれた', '隣の駄菓子屋からラムネの差し入れ', 'ラジオから昭和歌謡が流れている', '今日もいい天気。筆がよくのる', '近所の子どもがだるまを数えに来た'];
