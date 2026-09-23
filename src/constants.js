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
// 時間：1ステップ＝1週（実時間 STEP_SEC 秒）。1ヶ月＝4週、1年＝48週（4月第1週〜3月第4週）、3年で決算
export const WEEKS = 4, YEAR = 48, YEARS = 3, TOTAL = YEAR * YEARS, STEP_SEC = 15;
// 年ごとの変化（1年目・2年目・3年目）。評判が広まって通常の客足が増え、家賃も上がる
export const GROWTH = [1.0, 1.3, 1.6], RENT_BY_YEAR = [500000, 600000, 700000];
export const DRY = 1, PAY_DELAY = 1; // 乾燥にかかる週数、売上が入金されるまでの週数
// 月別の需要倍率（4月始まり）。11〜12月が年末商戦、1月は年明けで客足が急に減る
export const MM = [1.0, 0.8, 0.7, 0.8, 0.9, 0.8, 1.2, 3.5, 4.5, 0.5, 1.0, 0.8];
// 年末商戦（毎年11〜12月＝年内28〜35週）。売値が上がり、素材の入荷が細り、職人の求人が止まる。
// 10月後半（年内26週）から素材の相場が上がり始める
export const RUSH = { start: 28, end: 36, price: 1.4, preStart: 26 };
// 素材の相場。季節やイベントで決まる目標に向かって1週に up/down ずつ動く「流れ」に、毎週の値動き（揺れ）をかける。
// 揺れは平均に戻ろうとする乱数：揺れ＝keep×先週の揺れ＋ばらつき sd。相場は min〜max 倍に収める
export const MARKET_STEP = { up: 0.5, down: 0.3 };
export const MARKET_SWING = { keep: 0.5, sd: 0.18, min: 0.6, max: 3 };
// 季節やイベントで相場が上がる幅の倍率（上げ幅×この値。原価50%でも高値の時期に利益がぎりぎり残るように）
export const MARKET_EVENT_SCALE = 0.7;
// 相場の表示（安値・ふつう・高騰）の境目
export const MARKET_LEVELS = [0.9, 1.25];

// 規模。QTY は「1週あたりの量」の単位で、v1（HANDOFF.md）の「1日あたり1個」を QTY 個/週に置き換える
// （生産・需要・仕入れ・入荷上限）。在庫・容量は1年に作って売る量に合わせて別に決める。
// 売値3,000円×年間の数量で、上手なプレイの年商が1億円前後になる
export const QTY = 140;
export const DRAW_UNIT = 10; // 工房シーンのだるま1体が表す個数（乾燥棚は容量に応じて増える）

// 単価（1個あたり）。素材は売値の約50%（相場で上下するので、安いときに仕入れるのが腕の見せどころ）
export const BASE = 3000, MAT = 1500;
export const PRICE_UNIT = 10; // 売値・素材価格は10円単位で丸める
export const STOCK_VALUE = 1200; // 決算時の完成品1個の評価額

// 数量
export const SELF_RATE = 2 * QTY; // 本人の生産数（個/週）
export const BUY_N = 500; // 1タップで仕入れる数
export const START_MAT = 600; // 開店時の素材
// 開店時の完成品。全色そろえておき、客の色の割合に合わせて1週半ほど売り切れない量（上手に作れば売り逃しゼロもありうる）
export const START_STOCK = { red: 100, gold: 30, pink: 60, sky: 50, green: 50 };
export const RACK_BASE = 300, RACK_STEP = 200; // 乾燥棚の容量と1段階の増分（乾燥1週ぶんの生産に合わせる）
export const WH_BASE = 1200, WH_STEP = 900; // 倉庫の容量と1段階の増分

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
  max: 1250, // この値で客足が最大になる（上手なプレイで5〜6月ごろ）
  minMult: 0.5, maxMult: 1.45,
  gain: { person: 1, shop: 3, trader: 8 }, // 満足した客1人あたり
  miss: 0.5, // 何も買えなかった客1人あたり
  names: ['町の小さな店', 'ご近所の評判店', '町の人気店', '行列のできる店', '日本一のだるま堂'], // ★1〜★5
  legacy: 0.6, // 人気のない旧セーブを読み込んだときの人気（max に対する割合）
};

// 宣伝。お金で人気を買い（pop）、weeks 週間は通常の客足が boost だけ増える。同じ宣伝は効果が切れるまで重ねられない
export const ADS = {
  flyer: { name: 'チラシ', desc: '近所にチラシを配る', cost: 150000, pop: 50, boost: 0.25, weeks: 1 },
  sns: { name: 'SNS広告', desc: 'スマホに広告を出す', cost: 500000, pop: 125, boost: 0.5, weeks: 2 },
  tvcm: { name: 'テレビCM', desc: '地元のテレビでCMを流す', cost: 1800000, pop: 300, boost: 1.0, weeks: 2 },
};

// 固定費・投資（家賃・給料は難易度調整で v1×QTY より高め）
export const RENT = RENT_BY_YEAR[0]; // 1年目の家賃（月）
export const START_CASH = 1700000; // 開店資金（在庫を全色そろえたぶん少なめ）
// 職人。名簿（roster.js）の100人から、週ごとに入れ替わる求職者を雇う
export const CRAFT = {
  max: 6, // 同時に雇える人数
  poolSize: 4, poolEvery: 1, // 求職者の人数と入れ替わる間隔（週）
  ratePerSpeed: 0.8 * QTY, // 素早さ★1あたりの生産（個/週）
  selfSkill: 2, // 本人のうまさ。工房の腕前の基準（★2で人気の上がり方1倍）
  // 月給＝base＋perSpeed×素早さ＋perSkill×うまさ＋both×素早さ×うまさ（円）
  wage: { base: 100000, perSpeed: 60000, perSkill: 60000, both: 15000 },
  feeRatio: 1.2, // 契約金＝月給×この倍率
};
// 乾燥棚・倉庫の増強（段階ごとの費用。配列の長さが段階数）
export const RACK_UP = [960000, 1440000, 1920000, 2400000, 3000000, 3600000, 4300000, 5000000, 6000000, 7000000, 8200000, 9500000, 11000000, 12500000];
export const WH_UP = [600000, 960000, 1440000, 2000000, 2600000, 3300000, 4200000, 5200000, 6400000, 7800000];
// 3年後の総資産による称号（上から判定）
export const RANKS = [[45000000, 'だるま大名'], [30000000, '名工'], [20000000, '一人前'], [0, '見習い']];
// 税金：年の利益（売上−素材・家賃・給料・宣伝・投資・契約金）にかかり、翌年最初の月末に払う
export const TAX_RATE = 0.3;
// 突発の出費：年に1回、予告なしに起きる。修理代は「家賃の min〜max か月分＋設備投資額の ACCIDENT_EQUIP 割」を月末に払う
// （設備が大きい店ほど修理代も高い）
export const ACCIDENT_EQUIP = 0.04;
export const ACCIDENTS = [
  { name: '乾燥機が壊れた', min: 2, max: 5 },
  { name: '工房が雨漏りした', min: 2, max: 4 },
  { name: '配送トラックが事故を起こした', min: 3, max: 5 },
];
export const REVENUE_GOAL = 300000000; // どこかの年でこの年商を超えたら達成（上級者の目標）

// セーブ。v1＝元の単一HTML、v2＝金額1200倍、v3＝数量1200倍、v4＝数量120倍（1日単位）、v5＝いま（1週単位・売値3,000円）
export const SAVE_KEY = 'popdaruma_rt_v5';
// 旧セーブの変換。まず数量×qty・金額×money で v4 の規模にそろえ（乾燥棚が1個ずつなら batch=false）、
// そのあと日→週に直す（weekify）
export const OLD_SAVES = [
  { key: 'popdaruma_rt_v4', qty: 1, money: 1, batch: true },
  { key: 'popdaruma_rt_v3', qty: 120 / 1200, money: 120 / 1200, batch: true },
  { key: 'popdaruma_rt_v2', qty: 120, money: 120 / 1200, batch: false },
  { key: 'popdaruma_rt_v1', qty: 120, money: 120, batch: false },
];
// v4（1日単位）→ v5（1週単位）：時刻×time、数量×qty、人気×pop
export const WEEKIFY = { time: 0.4, qty: 0.5, pop: 0.5 };
export const FLAVOR = ['常連のおばあちゃんが赤だるまを褒めてくれた', '隣の駄菓子屋からラムネの差し入れ', 'ラジオから昭和歌謡が流れている', 'いい天気が続いて、筆がよくのる', '近所の子どもがだるまを数えに来た'];
