// AI：個性（data/aiPersonalities）に従って分岐・購入・買収・イベント選択を行う
import { personalityOf, type AiPersonality } from '../../data/aiPersonalities';
import { canBuy, canBuyout } from '../economy';
import { canChoose } from '../events';
import { currentPlayer } from '../game';
import { nextRandom } from '../rng';
import type { EventChoice, GameContext, GameState } from '../types';

const DEFAULT: AiPersonality = {
  title: '',
  cashReserve: 150_000,
  buyoutChance: 0.3,
  buyoutReserve: 150_000,
  shortcutBias: 0,
  values: { money: 1, fame: 1, network: 1, happiness: 1, risk: 0 },
  lines: { buy: [], buyout: [], boughtOut: [], bigWin: [], bigLoss: [] },
};

function persona(state: GameState): AiPersonality {
  return personalityOf(currentPlayer(state).id) ?? DEFAULT;
}

/** 分岐：先にある空き物件・買収候補・近道の好みで評価 */
export function aiChooseBranch(state: GameState, ctx: GameContext): { choice: string; rngState: number } {
  const me = currentPlayer(state);
  const per = persona(state);
  const options = state.branchOptions;
  const scores = options.map((start, idx) => {
    let id = start;
    let score = 0;
    for (let i = 0; i < 8; i++) {
      const node = ctx.map.nodes[id];
      const pid = node.propertyId;
      if (pid && !state.ownership[pid]) score += 2;
      else if (pid && state.ownership[pid] !== me.id) score += per.buyoutChance * 1.5;
      if (node.type === 'fate' || node.type === 'bigfate' || node.next.length !== 1) break;
      id = node.next[0];
    }
    // 先頭が通常ルート、それ以外が近道
    if (idx > 0) score += per.shortcutBias * 2.5;
    return score;
  });
  const r = nextRandom(state.rngState);
  const best = scores.indexOf(Math.max(...scores));
  const choice = r.value < 0.8 ? options[best] : options[(best + 1) % options.length];
  return { choice, rngState: r.state };
}

/** 購入・買収の判断（乱数を使う場合があるので rngState を返す） */
export function aiDecidePurchase(state: GameState, ctx: GameContext): { buy: boolean; rngState: number } {
  const me = currentPlayer(state);
  const per = persona(state);
  const pid = ctx.map.nodes[me.position].propertyId;
  if (pid && state.ownership[pid] && state.ownership[pid] !== me.id) {
    const check = canBuyout(state, ctx, me.id, pid);
    if (!check.ok || me.money - check.price < per.buyoutReserve) return { buy: false, rngState: state.rngState };
    const r = nextRandom(state.rngState);
    return { buy: r.value < per.buyoutChance, rngState: r.state };
  }
  if (!canBuy(state, ctx, me.id, pid).ok) return { buy: false, rngState: state.rngState };
  return { buy: me.money - ctx.properties[pid!].price >= per.cashReserve, rngState: state.rngState };
}

/** 互換用：購入するか（乱数を消費しない判定） */
export function aiWantsToBuy(state: GameState, ctx: GameContext): boolean {
  return aiDecidePurchase(state, ctx).buy;
}

/** 選択肢の価値（期待値＋リスク嗜好） */
export function scoreChoice(choice: EventChoice, per: AiPersonality): number {
  const total = choice.outcomes.reduce((s, o) => s + o.weight, 0);
  let money = 0;
  let fame = 0;
  let network = 0;
  let happiness = 0;
  for (const o of choice.outcomes) {
    const w = o.weight / total;
    money += w * ((o.effect.money ?? 0) - (o.effect.debt ?? 0));
    fame += w * (o.effect.fame ?? 0);
    network += w * (o.effect.network ?? 0);
    happiness += w * (o.effect.happiness ?? 0);
  }
  const variance = choice.outcomes.reduce((s, o) => s + (o.weight / total) * (((o.effect.money ?? 0) - money) / 100_000) ** 2, 0);
  const v = per.values;
  return (money / 100_000) * v.money + (fame / 10) * v.fame + (network / 10) * v.network + (happiness / 10) * v.happiness + Math.sqrt(variance) * v.risk;
}

/** イベント選択：個性の価値観で最良の選択肢を選びやすい（たまに気まぐれ） */
export function aiChooseEvent(state: GameState, ctx: GameContext): { choiceId: string; rngState: number } {
  const ev = ctx.events[state.pendingEvent!.eventId];
  const me = currentPlayer(state);
  const per = persona(state);
  const pool = ev.choices.filter((c) => canChoose(me, c));
  const r = nextRandom(state.rngState);
  if (r.value < 0.8) {
    let best = pool[0];
    let bestScore = -Infinity;
    for (const c of pool) {
      const sc = scoreChoice(c, per) + Math.log(Math.max(0.05, c.aiWeight ?? 1)) * 0.3;
      if (sc > bestScore) {
        bestScore = sc;
        best = c;
      }
    }
    return { choiceId: best.id, rngState: r.state };
  }
  const r2 = nextRandom(r.state);
  return { choiceId: pool[Math.floor(r2.value * pool.length)].id, rngState: r2.state };
}
