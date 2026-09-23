import { describe, it, expect } from 'vitest';
import * as sim from '../src/sim.js';
import { seeded, yen, yenShort, cnt, poisson } from '../src/util.js';
import { RANKS, START_CASH, QTY, OLD_SAVES, MEAN_BUY } from '../src/constants.js';
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
    expect(short).toEqual({ cost: 360000, paid: 120000 });
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

describe('money', () => {
  it('万・億で表示する', () => {
    expect(yen(0)).toBe('0円');
    expect(yen(24000000)).toBe('2,400万円');
    expect(yen(1000000000)).toBe('10億円');
    expect(yen(1234560000)).toBe('12億3,456万円');
    expect(yen(23985210)).toBe('2,398万5,210円');
  });
  it('狭い欄は切り捨てて短く表示する', () => {
    expect(yenShort(23985210)).toBe('2,398万円');
    expect(yenShort(1234560000)).toBe('12.34億円');
    expect(yenShort(5210)).toBe('5,210円');
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
  it('投資なし＝一人前前後', () => {
    const s = avg(passive, 10);
    expect(s).toBeGreaterThanOrEqual(rankMin('一人前'));
    expect(s).toBeLessThan(rankMin('名工'));
  });
  it('投資あり＝名工前後', () => {
    expect(avg(active, 10)).toBeGreaterThanOrEqual(rankMin('名工') * 0.75);
  });
});
