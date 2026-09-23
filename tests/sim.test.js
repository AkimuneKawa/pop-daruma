import { describe, it, expect } from 'vitest';
import * as sim from '../src/sim.js';
import { seeded, yen, cnt, poisson } from '../src/util.js';
import { RANKS, START_CASH, QTY, OLD_SAVES, MEAN_BUY, POP, RENT, CRAFT, ADS, MARKET_EVENT_SCALE, START_MAT, START_RED, RACK_BASE, WH_BASE, WEEKS, TOTAL } from '../src/constants.js';
import { migrate, weekify } from '../src/save.js';
import { ROSTER, wageOf } from '../src/roster.js';
import { play, passive, active } from '../scripts/autoplay.js';

describe('newGame', () => {
  it('初期状態が仕様どおり', () => {
    const S = sim.newGame(seeded(1));
    expect(S.cash).toBe(START_CASH);
    expect(S.mat).toBe(START_MAT);
    expect(S.fin).toEqual({ red: START_RED, gold: 0, pink: 0, sky: 0, green: 0 });
    expect(sim.rackCap(S)).toBe(RACK_BASE);
    expect(sim.whCap(S)).toBe(WH_BASE);
    expect(S.sup).toBe(24 * QTY); // 開店週は桜の予告中で入荷が絞られる
    expect(TOTAL).toBe(3 * 12 * WEEKS); // 3年＝144週
    // 毎年：バズ3回・桜・春節・事件2回
    expect(S.events.filter(e => e.type === 'tv' || e.type === 'sns')).toHaveLength(9);
    expect(S.events.filter(e => e.type === 'sakura').map(e => e.start)).toEqual([1, 49, 97]);
    expect(S.events.filter(e => e.type === 'shunsetsu')).toHaveLength(3);
    expect(S.events.filter(e => ['typhoon', 'surge', 'hormuz'].includes(e.type))).toHaveLength(6);
  });
  it('同じシードなら同じイベント', () => {
    expect(sim.newGame(seeded(7)).events).toEqual(sim.newGame(seeded(7)).events);
  });
});

describe('market', () => {
  it('年末商戦（11〜12月）と10月後半は相場の目標が上がり、入荷が絞られる', () => {
    const S = sim.newGame(seeded(1));
    S.events = [];
    const up = t => Math.round((1 + (t - 1) * MARKET_EVENT_SCALE) * 100) / 100; // 上げ幅は7割に縮める
    expect(sim.marketTarget(S, 29)).toEqual({ t: up(1.9), cap: 12 * QTY }); // 11月
    expect(sim.marketTarget(S, 34)).toEqual({ t: up(1.9), cap: 12 * QTY }); // 12月
    expect(sim.marketTarget(S, 26)).toEqual({ t: up(1.4), cap: 20 * QTY }); // 10月後半
    expect(sim.marketTarget(S, 37)).toEqual({ t: 1, cap: 40 * QTY }); // 1月
  });
  it('相場の流れは1週で上昇+0.5／下降-0.3ずつ、実際の相場は毎週揺れる', () => {
    const S = sim.newGame(seeded(1));
    S.events = []; S.day = 30; S.mBase = 1; S.mSwing = 0;
    sim.updateMarket(S, false, seeded(5));
    expect(S.mBase).toBe(1.5); // 目標（1.63）へ1週で+0.5まで
    S.day = 2; S.mBase = 1.5;
    sim.updateMarket(S, false, seeded(6));
    expect(S.mBase).toBe(1.2);
    // 揺れ：平常時でも安い週・高い週がある
    const ms = [];
    for (let i = 0; i < 200; i++) { sim.updateMarket(S, false, seeded(100 + i)); ms.push(S.m); }
    expect(Math.min(...ms)).toBeLessThan(0.9);
    expect(Math.max(...ms)).toBeGreaterThan(1.2);
  });
});

describe('production & payment', () => {
  it('素材を使って棚に入り、1週で完成品になる', () => {
    const rng = seeded(3);
    const S = sim.newGame(rng);
    S.events = [];
    for (let i = 0; i < 50; i++) sim.step(S, 0.01, {}, rng); // 半週
    // 本人 2QTY 個/週（小数の端数で±1個ずれうる）
    expect(Math.abs(S.mat - (START_MAT - QTY))).toBeLessThanOrEqual(1);
    expect(Math.abs(sim.rackUsed(S) - QTY)).toBeLessThanOrEqual(1);
    for (let i = 0; i < 125; i++) sim.step(S, 0.01, {}, rng); // t=1.75：t≦0.75 に作った分は乾いている
    expect(S.fin.red + S.stats.sold).toBeGreaterThanOrEqual(START_RED + 1.4 * QTY);
    // 素材→棚→完成品→販売 で個数が保存される（最初の素材と完成品の合計）
    expect(sim.finN(S) + sim.rackUsed(S) + S.mat + S.stats.sold).toBe(START_MAT + START_RED);
  });
  it('月末に払えなければ資金ショート', () => {
    const S = sim.newGame(seeded(1));
    S.cash = 120000;
    let short = null;
    sim.newDay(S, WEEKS, { short: s => { short = s; } }, seeded(2));
    expect(S.strikes).toBe(1);
    expect(S.cash).toBe(0);
    expect(short).toEqual({ cost: RENT, paid: 120000 });
  });
  it('3回ショートで閉店', () => {
    const S = sim.newGame(seeded(1));
    S.strikes = 2; S.cash = 0;
    let ended = null;
    sim.newDay(S, WEEKS, { end: b => { ended = b; } }, seeded(2));
    expect(S.over).toBe(true);
    expect(ended).toBe(true);
    expect(sim.settle(S, true).rank).toBe('閉店');
  });
});

const rankMin = name => RANKS.find(r => r[1] === name)[0];

describe('popularity', () => {
  it('開店時は★1で、客足は minMult 倍', () => {
    const S = sim.newGame(seeded(1));
    expect(sim.popStars(S)).toBe(1);
    expect(sim.popMult(S)).toBeCloseTo(POP.minMult);
  });
  it('満足した客で上がり、何も買えない客で下がる', () => {
    const S = sim.newGame(seeded(1));
    S.events = []; S.noise = 1;
    S.fin = { red: 1000, gold: 0, pink: 0, sky: 0, green: 0 };
    const before = S.pop;
    for (let i = 0; i < 100; i++) sim.step(S, 0.01, {}, seeded(i + 1)); // 1日分
    expect(S.pop).toBeGreaterThan(before);
    S.fin = { red: 0, gold: 0, pink: 0, sky: 0, green: 0 }; S.rack = []; S.color = 'stop';
    const high = S.pop;
    for (let i = 0; i < 100; i++) sim.step(S, 0.01, {}, seeded(i + 500));
    expect(S.pop).toBeLessThan(high);
  });
  it('人気が最大なら通常の客足は maxMult 倍', () => {
    const S = sim.newGame(seeded(1));
    S.events = []; S.noise = 1;
    const low = sim.lambda(S, 5).rate.red;
    S.pop = POP.max;
    expect(sim.popStars(S)).toBe(5);
    expect(sim.lambda(S, 5).rate.red / low).toBeCloseTo(POP.maxMult / POP.minMult);
  });
  it('人気の無い旧セーブは legacy の割合で補う', () => {
    const S = sim.normalize({ fin: { red: 0 } });
    expect(S.pop).toBe(POP.max * POP.legacy);
  });
});

describe('craftsmen', () => {
  it('名簿は100人で、うまさ・素早さが高いほど月給が高い', () => {
    expect(ROSTER).toHaveLength(100);
    expect(new Set(ROSTER.map(c => c.name)).size).toBe(100);
    expect(wageOf(5, 5)).toBeGreaterThan(wageOf(3, 3));
    expect(wageOf(3, 3)).toBeGreaterThan(wageOf(1, 1));
    expect(wageOf(4, 2)).toBeGreaterThan(wageOf(2, 2));
    expect(wageOf(2, 4)).toBeGreaterThan(wageOf(2, 2));
  });
  it('求職者は5日ごとに入れ替わり、雇うと生産と給料が増える', () => {
    const rng = seeded(4);
    const S = sim.newGame(rng);
    expect(S.pool).toHaveLength(CRAFT.poolSize);
    const c = sim.poolCrafts(S)[0];
    S.cash = 1e8;
    const rate = sim.prodRate(S), pay = sim.monthly(S);
    expect(sim.hire(S, c.id)).toContain(c.name);
    expect(sim.prodRate(S)).toBe(rate + c.speed * CRAFT.ratePerSpeed);
    expect(sim.monthly(S)).toBe(pay + c.wage);
    expect(S.pool).not.toContain(c.id);
    const before = S.pool.slice();
    sim.newDay(S, 5, {}, rng);
    expect(S.pool).not.toEqual(before);
    expect(S.pool).not.toContain(c.id); // 雇っている人は求職者に出ない
    sim.fire(S, c.id);
    expect(S.staff).toHaveLength(0);
  });
  it('最大人数を超えては雇えない', () => {
    const S = sim.newGame(seeded(1));
    S.cash = 1e9;
    S.staff = ROSTER.slice(90, 90 + CRAFT.max).map(c => ({ ...c }));
    expect(sim.hire(S, S.pool[0])).toBeNull();
  });
  it('うまさの高い職人がいると人気の上がり方が大きい', () => {
    const S = sim.newGame(seeded(1));
    expect(sim.skillMult(S)).toBe(1);
    S.staff = [{ ...ROSTER[0], skill: 5, speed: 5 }];
    expect(sim.skillMult(S)).toBeGreaterThan(1.5);
    S.staff = [{ ...ROSTER[0], skill: 1, speed: 5 }];
    expect(sim.skillMult(S)).toBeLessThan(1);
  });
  it('旧版の職人（tatsu/hana）は名簿の職人に置き換える', () => {
    const S = sim.normalize({ fin: { red: 0 }, pop: 0, staff: ['tatsu', 'hana'] });
    expect(S.staff.map(c => c.name)).toEqual(['タツ', 'ハナ']);
    expect(S.staff[0].speed).toBe(3);
    expect(S.pool.length).toBe(CRAFT.poolSize);
  });
});

describe('money', () => {
  it('金額はカンマ区切り', () => {
    expect(yen(0)).toBe('0円');
    expect(yen(2400000)).toBe('2,400,000円');
    expect(yen(100000000)).toBe('100,000,000円');
  });
  it('個数は1万以上を万で表示する', () => {
    expect(cnt(7200)).toBe('7,200');
    expect(cnt(24000)).toBe('2.4万');
    expect(cnt(206543)).toBe('20.6万');
  });
  it('v1 セーブは金額と数量を120倍（v4 の規模）にそろえる', () => {
    const v1 = { cash: 20000, mat: 10, fin: { red: 2, green: 0, sky: 1, yellow: 0 }, rack: [{ c: 'red', ready: 3 }], sup: 40,
      recv: [{ amt: 1500, due: 3 }], stats: { sold: 1, missed: 2, rev: 1500 }, today: { sold: 1, missed: 0, rev: 1500 } };
    const S = migrate(v1, OLD_SAVES.find(o => o.key.endsWith('v1')));
    expect(S.cash).toBe(20000 * 120);
    expect(S.recv[0].amt).toBe(1500 * 120);
    expect(S.mat).toBe(10 * 120);
    expect(S.fin.sky).toBe(120);
    expect(S.rack).toEqual([{ c: 'red', n: 120, ready: 3 }]);
    expect(S.stats).toEqual({ sold: 120, missed: 240, rev: 1500 * 120 });
    expect(sim.isValidSave(S)).toBe(true);
  });
  it('v4（1日単位）のセーブを週単位に直す', () => {
    const v4 = { t: 50.5, day: 50, cash: 5000000, mat: 1000, fin: { red: 400, gold: 0, pink: 0, sky: 0, green: 0 }, rack: [{ c: 'red', n: 300, ready: 52 }],
      recv: [{ amt: 1000, due: 53 }], stats: { sold: 2000, missed: 100, rev: 3000000 }, today: { sold: 10, missed: 0, rev: 15000 }, pop: 2000, ads: [{ id: 'sns', until: 52 }],
      events: [{ type: 'tv', start: 60, len: 4, ann: 3, color: 'red' }], staff: [], pool: [], color: 'red' };
    const S = sim.normalize(weekify(v4));
    expect(S.day).toBe(20);
    expect(S.t).toBeCloseTo(20.2);
    expect(S.mat).toBe(500);
    expect(S.fin.red).toBe(200);
    expect(S.rack[0]).toEqual({ c: 'red', n: 150, ready: 52 * 0.4 });
    expect(S.cash).toBe(5000000); // 金額はそのまま
    expect(S.pop).toBe(1000);
    expect(S.events.some(e => e.type === 'sakura')).toBe(true); // 週の暦で作り直す
  });
  it('v3 セーブ（数量・金額とも1200倍）は1/10にする', () => {
    const v3 = { cash: 24000000, mat: 12000, fin: { red: 2400, green: 0, sky: 0, yellow: 0 }, rack: [{ c: 'sky', n: 2400, ready: 5 }], sup: 48000,
      recv: [{ amt: 3600000, due: 3 }], stats: { sold: 2400, missed: 0, rev: 3600000 }, today: { sold: 0, missed: 0, rev: 0 } };
    const S = migrate(v3, OLD_SAVES.find(o => o.key.endsWith('v3')));
    expect(S.cash).toBe(2400000);
    expect(S.mat).toBe(1200);
    expect(S.rack).toEqual([{ c: 'sky', n: 240, ready: 5 }]);
    expect(S.stats.rev).toBe(360000);
  });
  it('客の種類ごとの個数が範囲内で、平均が MEAN_BUY に近い', () => {
    const rng = seeded(9);
    let sum = 0, maxWant = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) { const b = sim.rollBuyer(rng); sum += b.want; maxWant = Math.max(maxWant, b.want); expect(b.want).toBeGreaterThanOrEqual(1); }
    expect(maxWant).toBe(100);
    expect(sum / N).toBeCloseTo(MEAN_BUY, 0);
  });
  it('ポアソン乱数の平均が合う', () => {
    const rng = seeded(5);
    for (const lam of [0.5, 12, 800]) {
      let sum = 0;
      for (let i = 0; i < 4000; i++) sum += poisson(lam, rng);
      expect(sum / 4000).toBeCloseTo(lam, lam < 1 ? 1 : 0);
    }
  });
});

describe('balance (autoplay)', () => {
  const avg = (policy, n) => {
    const runs = Array.from({ length: n }, (_, i) => play(policy, i + 1));
    return runs.reduce((a, r) => a + r.score, 0) / n;
  };
  // 3年版（厳しめ）：あかだけ作るプレイは半分ほど閉店、上手に投資しても2割ほど閉店する
  it('投資なしは閉店が多い（10回中3回以上）', () => {
    const runs = Array.from({ length: 10 }, (_, i) => play(passive, i + 1));
    expect(runs.filter(r => r.bankrupt).length).toBeGreaterThanOrEqual(3);
  });
  it('投資ありは投資なしより閉店が少なく、年商は3倍以上', () => {
    const A = Array.from({ length: 20 }, (_, i) => play(active, i + 1)), P = Array.from({ length: 20 }, (_, i) => play(passive, i + 1));
    expect(A.filter(r => r.bankrupt).length).toBeLessThan(P.filter(r => r.bankrupt).length);
    const rev = a => a.reduce((s, r) => s + r.revenue, 0);
    expect(rev(A)).toBeGreaterThan(rev(P) * 3);
  });
});

describe('seasons & events', () => {
  it('年末商戦は11〜12月で、1月に客足が急に減る', () => {
    const S = sim.newGame(seeded(1));
    S.events = []; S.noise = 1;
    const nov = sim.lambda(S, 29).rate.red, jan = sim.lambda(S, 37).rate.red, oct = sim.lambda(S, 24).rate.red;
    expect(nov).toBeGreaterThan(oct * 3);
    expect(jan).toBeLessThan(oct);
    expect(sim.inRush(29)).toBe(true);
    expect(sim.inRush(37)).toBe(false);
  });
  it('年末商戦中は求職者が来ない', () => {
    const S = sim.newGame(seeded(1));
    S.day = 30;
    sim.refreshPool(S);
    expect(S.pool).toHaveLength(0);
  });
  it('ホルムズ海峡封鎖中はきんが作れない', () => {
    const S = sim.newGame(seeded(1));
    S.events = [{ type: 'hormuz', start: 0, len: 10, ann: 1 }];
    S.color = 'gold';
    expect(sim.colorStopped(S, 'gold')).toBe(true);
    expect(sim.prodReason(S)).toContain('生産停止');
    const mat = S.mat;
    for (let i = 0; i < 50; i++) sim.step(S, 0.01, {}, seeded(i + 1));
    expect(S.mat).toBe(mat);
  });
  it('台風の間は素材が入荷しない', () => {
    const S = sim.newGame(seeded(1));
    S.events = [{ type: 'typhoon', start: 0, len: 3, ann: 2 }];
    sim.updateMarket(S, true);
    expect(S.sup).toBe(0);
    expect(sim.buyBlockReason(S)).toBe('物流ストップ中');
  });
  it('春節の客は中国客', () => {
    const S = sim.newGame(seeded(1));
    S.events = [{ type: 'shunsetsu', start: 0, len: 6, ann: 4 }]; S.noise = 1;
    const { org } = sim.lambda(S, 2);
    expect(org.gold.cn).toBeGreaterThan(org.gold.jp);
  });
  it('4色時代のセーブはきいろをきんに置き換える', () => {
    const S = sim.normalize({ fin: { red: 5, green: 1, sky: 2, yellow: 3 }, rack: [{ c: 'yellow', n: 4, ready: 1 }], color: 'yellow', pop: 0, staff: [],
      events: [{ type: 'inbound', start: 6, len: 6, ann: 4 }] });
    expect(S.fin).toEqual({ red: 5, gold: 3, pink: 0, sky: 2, green: 1 });
    expect(S.rack[0].c).toBe('gold');
    expect(S.color).toBe('gold');
    expect(S.events.some(e => e.type === 'sakura')).toBe(true);
  });
});

describe('ads', () => {
  it('宣伝を打つと人気が上がり、期間中は客足が増え、重ねて打てない', () => {
    const S = sim.newGame(seeded(1));
    S.events = []; S.noise = 1; S.cash = 1e7;
    const before = sim.lambda(S, 5).rate.red, pop = S.pop;
    expect(sim.runAd(S, 'sns')).toContain('SNS広告');
    expect(S.pop).toBe(pop + ADS.sns.pop);
    expect(S.cash).toBe(1e7 - ADS.sns.cost);
    // 人気が上がったぶんと宣伝のぶんで客足が増える
    expect(sim.lambda(S, 0).rate.red).toBeGreaterThan(before * (1 + ADS.sns.boost));
    expect(sim.runAd(S, 'sns')).toBeNull();
    expect(sim.canAd(S, 'flyer')).toBe(true);
  });
  it('効果が切れたらニュースになり、客足が戻る', () => {
    const S = sim.newGame(seeded(1));
    S.events = []; S.cash = 1e7;
    sim.runAd(S, 'flyer');
    for (let i = 0; i < 400; i++) sim.step(S, 0.01, {}, seeded(i + 1));
    expect(sim.activeAd(S, 'flyer')).toBeUndefined();
    expect(sim.adBoost(S)).toBe(0);
    expect(S.news.some(n => n.t.includes('チラシの効果が切れた'))).toBe(true);
  });
});

describe('three years', () => {
  it('年の終わりに年次決算があり、2年目は客足が増えて家賃が上がる', () => {
    const S = sim.newGame(seeded(1));
    S.events = []; S.noise = 1; S.cash = 1e8; S.year.rev = 12345;
    let ye = null;
    const y1 = sim.lambda(S, 5).rate.red, rent1 = sim.monthly(S);
    sim.newDay(S, 48, { yearEnd: y => { ye = y; } }, seeded(2));
    S.noise = 1; // 週替わりで変わる客足の揺れを固定して比べる
    expect(ye).toMatchObject({ year: 1, rev: 12345 });
    expect(S.history).toHaveLength(1);
    expect(S.year.rev).toBe(0);
    expect(sim.lambda(S, 48 + 5).rate.red).toBeCloseTo(y1 * 1.3);
    expect(sim.monthly(S)).toBeGreaterThan(rent1);
    expect(sim.inRush(48 + 29)).toBe(true); // 2年目の11月も年末商戦
  });
  it('1年版のセーブには2年目以降のイベントを補う', () => {
    const S = sim.normalize({ fin: { red: 0, gold: 0, pink: 0, sky: 0, green: 0 }, rack: [], pop: 0, staff: [], pool: [], ads: [],
      stats: { sold: 5, missed: 1, rev: 100 }, events: sim.newGame(seeded(1)).events.filter(e => e.start < 48) });
    expect(S.events.some(e => e.type === 'sakura' && e.start === 97)).toBe(true);
    expect(S.year.rev).toBe(100);
  });
});

describe('taxes & accidents', () => {
  it('年の利益の30%が税金として次の月末の支払いに乗る', () => {
    const S = sim.newGame(seeded(1));
    S.events = []; S.cash = 1e9; S.year = { sold: 0, missed: 0, rev: 50000000, cost: 20000000 };
    sim.newDay(S, 48, {}, seeded(2));
    // 利益＝売上5,000万−経費2,000万−1年目最後の月の家賃
    const tax = Math.round((50000000 - 20000000 - sim.rentOf(47)) * 0.3 / 10000) * 10000;
    expect(S.bills).toEqual([{ name: '税金', amt: tax }]);
    expect(sim.dueTotal(S)).toBe(sim.monthly(S) + tax);
    const cash = S.cash;
    sim.newDay(S, 52, {}, seeded(3));
    expect(S.bills).toEqual([]);
    expect(cash - S.cash).toBe(sim.monthly(S) + tax);
  });
  it('突発の出費は予告なしで、設備が大きいほど修理代が高い', () => {
    const run = (rackLv) => {
      const S = sim.newGame(seeded(1));
      S.events = [{ type: 'accident', start: 5, len: 1, ann: 0, kind: 0, months: 0 }]; S.rackLv = rackLv;
      sim.newDay(S, 5, {}, seeded(2));
      return S.bills[0].amt;
    };
    expect(run(0)).toBeGreaterThan(0);
    expect(run(6)).toBeGreaterThan(run(0));
    const S = sim.newGame(seeded(1));
    S.events = [{ type: 'accident', start: 5, len: 1, ann: 0, kind: 0, months: 0 }];
    expect(sim.dayNews(S, 4)).toEqual([]); // 予告はない
  });
});
