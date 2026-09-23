import { describe, it, expect } from 'vitest';
import * as sim from '../src/sim.js';
import { seeded, yen, cnt, poisson } from '../src/util.js';
import { RANKS, START_CASH, QTY, OLD_SAVES, MEAN_BUY, POP, RENT } from '../src/constants.js';
import { migrate } from '../src/save.js';
import { play, passive, active } from '../scripts/autoplay.js';

describe('newGame', () => {
  it('初期状態が仕様どおり', () => {
    const S = sim.newGame(seeded(1));
    expect(S.cash).toBe(START_CASH);
    expect(S.mat).toBe(10 * QTY);
    expect(S.fin).toEqual({ red: 2 * QTY, green: 0, sky: 0, yellow: 0 });
    expect(sim.rackCap(S)).toBe(6 * QTY);
    expect(sim.whCap(S)).toBe(20 * QTY);
    expect(S.sup).toBe(40 * QTY);
    expect(S.events.filter(e => e.type === 'tv')).toHaveLength(3);
    expect(S.events.filter(e => e.type === 'inbound')).toHaveLength(2);
  });
  it('同じシードなら同じイベント', () => {
    expect(sim.newGame(seeded(7)).events).toEqual(sim.newGame(seeded(7)).events);
  });
});

describe('market', () => {
  it('年末ラッシュ中は目標1.9・入荷12', () => {
    const S = sim.newGame(seeded(1));
    S.events = [];
    expect(sim.marketTarget(S, 85)).toEqual({ t: 1.9, cap: 12 * QTY });
    expect(sim.marketTarget(S, 75)).toEqual({ t: 1.4, cap: 20 * QTY });
    expect(sim.marketTarget(S, 5)).toEqual({ t: 1, cap: 40 * QTY });
  });
  it('相場は上昇+0.2／下降-0.12ずつ', () => {
    const S = sim.newGame(seeded(1));
    S.events = []; S.day = 85; S.m = 1;
    sim.updateMarket(S, false);
    expect(S.m).toBe(1.2);
    S.day = 5; S.m = 1.5;
    sim.updateMarket(S, false);
    expect(S.m).toBe(1.38);
  });
});

describe('production & payment', () => {
  it('素材を使って棚に入り、3日で完成品になる', () => {
    const rng = seeded(3);
    const S = sim.newGame(rng);
    S.events = [];
    for (let i = 0; i < 100; i++) sim.step(S, 0.01, {}, rng);
    // 本人 2QTY 個/日（小数の端数で±1個ずれうる）
    expect(Math.abs(S.mat - 8 * QTY)).toBeLessThanOrEqual(1);
    expect(Math.abs(sim.rackUsed(S) - 2 * QTY)).toBeLessThanOrEqual(1);
    for (let i = 0; i < 375; i++) sim.step(S, 0.01, {}, rng); // t=4.75：t≦1.75 に作った分は乾いている
    expect(S.fin.red + S.stats.sold).toBeGreaterThanOrEqual(2 * QTY + 3.4 * QTY);
    // 素材→棚→完成品→販売 で個数が保存される（最初の素材と完成品の合計）
    expect(sim.finN(S) + sim.rackUsed(S) + S.mat + S.stats.sold).toBe(12 * QTY);
  });
  it('月末に払えなければ資金ショート', () => {
    const S = sim.newGame(seeded(1));
    S.cash = 120000;
    let short = null;
    sim.newDay(S, 10, { short: s => { short = s; } }, seeded(2));
    expect(S.strikes).toBe(1);
    expect(S.cash).toBe(0);
    expect(short).toEqual({ cost: RENT, paid: 120000 });
  });
  it('3回ショートで閉店', () => {
    const S = sim.newGame(seeded(1));
    S.strikes = 2; S.cash = 0;
    let ended = null;
    sim.newDay(S, 10, { end: b => { ended = b; } }, seeded(2));
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
    S.fin = { red: 1000, green: 0, sky: 0, yellow: 0 };
    const before = S.pop;
    for (let i = 0; i < 100; i++) sim.step(S, 0.01, {}, seeded(i + 1)); // 1日分
    expect(S.pop).toBeGreaterThan(before);
    S.fin = { red: 0, green: 0, sky: 0, yellow: 0 }; S.color = 'stop';
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
  it('v1 セーブは金額と数量を QTY 倍に変換する', () => {
    const v1 = { cash: 20000, mat: 10, fin: { red: 2, green: 0, sky: 1, yellow: 0 }, rack: [{ c: 'red', ready: 3 }], sup: 40,
      recv: [{ amt: 1500, due: 3 }], stats: { sold: 1, missed: 2, rev: 1500 }, today: { sold: 1, missed: 0, rev: 1500 } };
    const S = migrate(v1, OLD_SAVES.find(o => o.key.endsWith('v1')));
    expect(S.cash).toBe(20000 * QTY);
    expect(S.recv[0].amt).toBe(1500 * QTY);
    expect(S.mat).toBe(10 * QTY);
    expect(S.fin.sky).toBe(QTY);
    expect(S.rack).toEqual([{ c: 'red', n: QTY, ready: 3 }]);
    expect(S.stats).toEqual({ sold: QTY, missed: 2 * QTY, rev: 1500 * QTY });
    expect(sim.isValidSave(S)).toBe(true);
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
  // 難しめの調整：あかだけ作るプレイは一人前と見習いの境目、上手に回しても名工には届きにくい
  it('投資なし＝一人前と見習いの境目', () => {
    const s = avg(passive, 10);
    expect(s).toBeGreaterThanOrEqual(rankMin('一人前') * 0.9);
    expect(s).toBeLessThan(rankMin('名工'));
  });
  it('投資あり＝一人前〜名工の手前', () => {
    const s = avg(active, 10);
    expect(s).toBeGreaterThanOrEqual(rankMin('一人前') * 1.4);
    expect(s).toBeLessThan(rankMin('名工'));
  });
});
