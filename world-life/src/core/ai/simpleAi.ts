// 初期版AI：分岐は先の空き物件数で判断、購入は手元資金に余裕があれば行う
import { canBuy } from '../economy';
import { currentPlayer } from '../game';
import { nextRandom } from '../rng';
import type { GameContext, GameState } from '../types';

/** 手元に残したい最低資金 */
const CASH_RESERVE = 150_000;

export function aiChooseBranch(state: GameState, ctx: GameContext): { choice: string; rngState: number } {
  const options = state.branchOptions;
  const scores = options.map((start) => {
    // 合流点までの空き物件数を数える
    let id = start;
    let free = 0;
    for (let i = 0; i < 8; i++) {
      const node = ctx.map.nodes[id];
      if (node.propertyId && !state.ownership[node.propertyId]) free++;
      if (node.type === 'fate' || node.type === 'bigfate' || node.next.length !== 1) break;
      id = node.next[0];
    }
    return free;
  });
  const r = nextRandom(state.rngState);
  // 空き物件が多いほど通常ルートを選びやすく、たまに近道で冒険する
  const best = scores.indexOf(Math.max(...scores));
  const choice = r.value < 0.7 ? options[best] : options[(best + 1) % options.length];
  return { choice, rngState: r.state };
}

export function aiWantsToBuy(state: GameState, ctx: GameContext): boolean {
  const player = currentPlayer(state);
  const pid = ctx.map.nodes[player.position].propertyId;
  if (!canBuy(state, ctx, player.id, pid).ok) return false;
  return player.money - ctx.properties[pid!].price >= CASH_RESERVE;
}
