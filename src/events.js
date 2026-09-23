// 季節イベント・バズ・ランダムな事件の定義。
// 各イベント {type, start, len, ann, color?} は ann 日前に予告され、start から len 日間続く
import { COLORS, QTY } from './constants.js';
import { rint, pick } from './util.js';

// type ごとの効果とニュース文。
//   demand: 色ごとの需要の上乗せ（v1 の個/日。QTY 倍して使う。人気に関係しない）
//   price:  色ごとの売値の倍率
//   market: 素材の相場の目標 t と入荷上限 cap（v1 の個/日）
//   stop:   作れなくなる色
//   mood:   町の空気の表示
//   flags:  旗飾りの色
//   origin: このイベントで増えた客の国籍の割合
export const EVENT_TYPES = {
  sakura: {
    demand: { pink: 2.5, sky: 1.5, green: 1.5 }, price: { pink: 1.4, sky: 1.4, green: 1.4 },
    market: { t: 1.3, cap: 24 }, mood: '桜で大にぎわい', origin: { west: 0.6, cn: 0.4 },
    flags: ['#f7b7cf', '#fff6e6'],
    ann: e => `${e.ann}日後から桜が満開。観光客でピンク・あお・みどりが人気になりそう`,
    start: e => `桜が満開！観光客がカラフルなだるまを高く買っていく（${e.len}日間）`,
    end: () => '桜が散って、観光客が落ち着いた',
  },
  shunsetsu: {
    demand: { red: 3, gold: 3 }, price: { red: 1.4, gold: 1.5 },
    market: { t: 1.5, cap: 16 }, mood: '春節で大にぎわい', origin: { cn: 1 },
    flags: ['#d8382a', '#e0ad2e'],
    ann: e => `${e.ann}日後から春節。中国からの観光客で、あか・きんが売れそう`,
    start: e => `春節の観光客が押し寄せた！あか・きんが高く売れる（${e.len}日間）`,
    end: () => '春節の観光客が帰っていった',
  },
  tv: {
    buzz: true, market: { t: 2.0, cap: 10 }, mood: '大にぎわい！', origin: { jp: 1 },
    ann: e => `${e.ann}日後、テレビで${COLORS[e.color].name}だるま特集！`,
    start: e => `放送開始！${COLORS[e.color].name}だるまに注文殺到（${e.len}日間・高値）`,
    end: () => 'テレビのブームがひと段落した',
  },
  sns: {
    buzz: true, market: { t: 2.0, cap: 10 }, mood: 'SNSでバズり中', origin: { jp: 0.5, west: 0.25, cn: 0.25 },
    ann: e => `インフルエンサーが${COLORS[e.color].name}だるまを紹介するらしい（${e.ann}日後に公開）`,
    start: e => `SNSでバズった！${COLORS[e.color].name}だるまの注文が殺到（${e.len}日間・高値）`,
    end: () => 'SNSのバズが落ち着いた',
  },
  typhoon: {
    market: { t: 1.4, cap: 0 }, mood: '物流ストップ',
    ann: e => `台風が接近中。${e.ann}日後から物流が止まり、素材が入荷しなくなる`,
    start: e => `台風で物流がストップ！${e.len}日間、素材が入荷しない`,
    end: () => '台風が去って物流が戻った',
  },
  surge: {
    market: { t: 2.2, cap: 24 }, mood: '材料が高騰',
    ann: e => `原材料の値上がりの噂。${e.ann}日後から素材が高くなりそう`,
    start: e => `原材料が高騰！素材の相場が跳ね上がる（${e.len}日間）`,
    end: () => '原材料の高騰が落ち着いた',
  },
  hormuz: {
    stop: ['gold'], market: { t: 1.6, cap: 20 }, mood: 'シンナー不足',
    ann: e => `中東の情勢が緊迫…${e.ann}日後、ホルムズ海峡が封鎖されるかもしれない`,
    start: e => `ホルムズ海峡が封鎖！シンナー不足で金だるまが作れない（${e.len}日間）`,
    end: () => 'ホルムズ海峡の封鎖が解けた。金だるまの生産再開',
  },
};

// バズの対象になりやすい色（同じ色を複数入れて重み付け）
const BUZZ_COLORS = ['pink', 'sky', 'green', 'gold', 'pink', 'sky', 'green', 'red'];

export function genEvents(rng = Math.random) {
  const ev = [
    { type: 'sakura', start: 2, len: 7, ann: 2 }, // 4月3日〜
    { type: 'shunsetsu', start: rint(100, 104, rng), len: 6, ann: 4 }, // 2月
  ];
  // バズ3回（年末商戦の時期は避ける）
  for (const [a, b] of [[18, 32], [38, 56], [92, 98]]) {
    ev.push({ type: rng() < 0.5 ? 'tv' : 'sns', start: rint(a, b, rng), len: 4, ann: 3, color: pick(BUZZ_COLORS, rng) });
  }
  // ランダムな事件2回：3つの時期のうち2つに、違う種類を1つずつ
  const kinds = ['typhoon', 'surge', 'hormuz'].sort(() => rng() - 0.5);
  const slots = [[10, 30], [40, 62], [94, 110]].sort(() => rng() - 0.5).slice(0, 2);
  slots.forEach(([a, b], i) => {
    const type = kinds[i];
    ev.push({ type, start: rint(a, b, rng), len: type === 'typhoon' ? 3 : type === 'surge' ? 8 : 10, ann: type === 'typhoon' ? 2 : 1 });
  });
  return ev;
}

// イベントの効果（demand）を個/日に直す
export const demandOf = (e, k) => {
  const T = EVENT_TYPES[e.type];
  if (T.buzz) return e.color === k ? 5.5 * QTY : 0;
  return (T.demand?.[k] ?? 0) * QTY;
};
export const priceOf = (e, k) => {
  const T = EVENT_TYPES[e.type];
  if (T.buzz) return e.color === k ? 1.5 : 1;
  return T.price?.[k] ?? 1;
};
