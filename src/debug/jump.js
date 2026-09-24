// ゲームの途中へ飛ぶ。新しいゲームを自動プレイの戦略でその週まで早送りして、ありそうな状態を作る
import * as sim from '../sim.js';
import { STRATEGIES, playUntil } from '../strategies.js';
import { YEAR, TOTAL } from '../constants.js';

export const JUMPS = [
  { id: 'early', name: '序盤', desc: '1年目の7月（職人を雇い始めるころ）', week: 12 },
  { id: 'prep', name: '年末商戦の前', desc: '1年目の10月（仕込みの時期）', week: 24 },
  { id: 'mid', name: '中盤', desc: '2年目の10月', week: YEAR + 24 },
  { id: 'late', name: '後半', desc: '3年目の11月（最後の年末商戦）', week: YEAR * 2 + 28 },
  { id: 'end', name: 'クリア直前', desc: '3年目の3月の最終週（まもなく最終決算）', week: TOTAL - 0.2 },
];

// 新しいゲームを week 週目まで進めた状態を返す。途中で閉店したら別の乱数でやり直す
export function jumpTo(week, strategyId = 'high', tries = 8) {
  const { policy } = STRATEGIES[strategyId] ?? STRATEGIES.high;
  for (let i = 1; i <= tries; i++) {
    const S = sim.newGame();
    playUntil(S, policy, Math.min(week, TOTAL - 0.01));
    if (!S.over) return { S, tries: i };
  }
  throw new Error(`${tries}回やり直しても途中で閉店しました（パラメータがきびしすぎるかもしれません）`);
}

// 今のゲームを weeks 週ぶん、戦略どおりに早送りする（閉店したらそこで止まる）
export function fastForward(S, weeks, strategyId = 'high') {
  const { policy } = STRATEGIES[strategyId] ?? STRATEGIES.high;
  let bankrupt = null;
  playUntil(S, policy, Math.min(S.t + weeks, TOTAL - 0.01), { end: b => { bankrupt = b; } });
  return { bankrupt };
}
