// バランス調整値・ゲーム定数（HANDOFF.md 第3章）
export const INK = '#2a2320';
// だるまの色。price は売値の倍率（きんは高級品）
export const COLORS = {
  red: { name: 'あか', b: '#d8382a', d: '#8f1f15', h: '#f57a62', g: '#f5c742', price: 1 },
  gold: { name: 'きん', b: '#e0ad2e', d: '#946a12', h: '#fbe38a', g: '#d8382a', price: 1.6 },
  pink: { name: 'ピンク', b: '#f07aa8', d: '#b04a74', h: '#fbc3d8', g: '#f5c742', price: 1 },
  sky: { name: 'あお', b: '#3a78d8', d: '#1f4a92', h: '#9cc2f2', g: '#f5c742', price: 1 }, // キー sky はセーブ互換のため維持
  green: { name: 'みどり', b: '#3aae78', d: '#1f6e4a', h: '#8fdcb4', g: '#f5c742', price: 1 },
};
export const GRAY = { b: '#bdb2a4', d: '#8c8378', h: '#d8d0c4', g: '#a8a097' };
export const CK = ['red', 'gold', 'pink', 'sky', 'green'];
// 客が欲しがる色の割合（通常月と年末商戦）
export const SHARE = {
  normal: { red: 0.4, gold: 0.08, pink: 0.2, sky: 0.16, green: 0.16 },
  rush: { red: 0.7, gold: 0.14, pink: 0.06, sky: 0.05, green: 0.05 },
};
export const MONTHS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月'];
export const TOTAL = 120, DAY_SEC = 15, DRY = 3;
// 月別の需要倍率（4月始まり）。11〜12月が年末商戦、1月は年明けで客足が急に減る
export const MM = [1.0, 0.8, 0.7, 0.8, 0.9, 0.8, 1.2, 3.5, 4.5, 0.5, 1.0, 0.8];
// 年末商戦（11〜12月）。売値が上がり、素材の入荷が細り、職人の求人が止まる。
// 10月後半から素材の相場が上がり始める
export const RUSH = { start: 70, end: 90, price: 1.4, preStart: 65 };

// 規模の倍率。v1（HANDOFF.md）に比べて、数量（生産・需要・在庫・容量・仕入れ・入荷上限）と
// 固定費（家賃・給料・投資・初期資金）を QTY 倍にし、単価（売値・素材）は据え置く。
// 売上＝単価×数量なので、比率は v1 と同じままで年商が QTY 倍になる（上手なプレイで1億円）
export const QTY = 120;
export const DRAW_UNIT = 10; // 工房シーンのだるま1体が表す個数（乾燥棚は容量に応じて増える）

// 単価（1個あたり。売値は v1 と同じ、素材は難易度調整で v1 の350円から上げている）
export const BASE = 1500, MAT = 550;
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
// 客の国籍。普段の客の割合（イベントで増えた客は events.js の origin で決まる）
export const ORIGIN_BASE = { jp: 0.84, cn: 0.08, west: 0.08 };
export const MEAN_BUY = BUYERS.reduce((a, b) => a + b.p * (b.min + b.max) / 2, 0); // 1人あたりの平均個数

// 人気。欲しい分を全部買えた客で上がり、何も買えなかった客で下がる。
// 通常の客足（特需を除く）は人気に応じて minMult〜maxMult 倍になる
export const POP = {
  max: 4500, // この値で客足が最大になる（上手なプレイで11月ごろ）
  minMult: 0.5, maxMult: 1.45,
  gain: { person: 1, shop: 3, trader: 8 }, // 満足した客1人あたり
  miss: 1, // 何も買えなかった客1人あたり
  names: ['町の小さな店', 'ご近所の評判店', '町の人気店', '行列のできる店', '日本一のだるま堂'], // ★1〜★5
  legacy: 0.6, // 人気のない旧セーブを読み込んだときの人気（max に対する割合）
};

// 固定費・投資（家賃・給料は難易度調整で v1×QTY より高め）
export const RENT = 500000;
export const START_CASH = 2400000;
// 職人。名簿（roster.js）の100人から、週ごとに入れ替わる求職者を雇う
export const CRAFT = {
  max: 6, // 同時に雇える人数
  poolSize: 4, poolEvery: 5, // 求職者の人数と入れ替わる間隔（日）。1ヶ月10日なので「週」＝5日
  ratePerSpeed: 0.8 * QTY, // 素早さ★1あたりの生産（個/日）
  selfSkill: 2, // 本人のうまさ。工房の腕前の基準（★2で人気の上がり方1倍）
  // 月給＝base＋perSpeed×素早さ＋perSkill×うまさ＋both×素早さ×うまさ（円）
  wage: { base: 100000, perSpeed: 60000, perSkill: 60000, both: 15000 },
  feeRatio: 1.2, // 契約金＝月給×この倍率
};
// 乾燥棚・倉庫の増強（段階ごとの費用。配列の長さが段階数）
export const RACK_UP = [960000, 1440000, 1920000, 2400000, 3000000, 3600000, 4300000, 5000000];
export const WH_UP = [600000, 960000, 1440000, 2000000, 2600000, 3300000];
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
