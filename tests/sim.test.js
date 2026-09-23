import { describe, it, expect } from 'vitest';
import * as sim from '../src/sim.js';
import { seeded } from '../src/util.js';
import { play, passive, active } from '../scripts/autoplay.js';

describe('newGame', () => {
  it('初期状態が仕様どおり', () => {
    const S = sim.newGame(seeded(1));
    expect(S.cash).toBe(20000);
    expect(S.mat).toBe(10);
    expect(S.fin).toEqual({ red: 2, green: 0, sky: 0, yellow: 0 });
    expect(sim.rackCap(S)).toBe(6);
    expect(sim.whCap(S)).toBe(20);
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
    expect(sim.marketTarget(S, 85)).toEqual({ t: 1.9, cap: 12 });
    expect(sim.marketTarget(S, 75)).toEqual({ t: 1.4, cap: 20 });
    expect(sim.marketTarget(S, 5)).toEqual({ t: 1, cap: 40 });
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
    const noSale = () => 1; // 来客なし
    for (let i = 0; i < 100; i++) sim.step(S, 0.01, {}, noSale);
    expect(S.mat).toBe(8); // 本人2個/日
    expect(S.rack).toHaveLength(2);
    for (let i = 0; i < 375; i++) sim.step(S, 0.01, {}, noSale); // t=4.75：t=0.5,1.0,1.5 に作った3個が乾いている
    expect(S.fin.red).toBeGreaterThanOrEqual(5);
  });
  it('月末に払えなければ資金ショート', () => {
    const S = sim.newGame(seeded(1));
    S.cash = 1000;
    let short = null;
    sim.newDay(S, 10, { short: s => { short = s; } }, seeded(2));
    expect(S.strikes).toBe(1);
    expect(S.cash).toBe(0);
    expect(short).toEqual({ cost: 3000, paid: 1000 });
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

describe('balance (autoplay)', () => {
  const avg = (policy, n) => {
    const runs = Array.from({ length: n }, (_, i) => play(policy, i + 1));
    return runs.reduce((a, r) => a + r.score, 0) / n;
  };
  it('投資なし＝一人前前後', () => {
    const s = avg(passive, 10);
    expect(s).toBeGreaterThanOrEqual(80000);
    expect(s).toBeLessThan(200000);
  });
  it('投資あり＝名工前後', () => {
    expect(avg(active, 10)).toBeGreaterThanOrEqual(150000);
  });
});
