// イベントの抽選・選択・効果適用（純粋関数）
import { nextRandom } from './rng';
import { clampStat } from './stats';
import type { EventCategory, EventChoice, EventDef, EventEffect, GameContext, GameState, NodeType, Player } from './types';
import { GameRuleError } from './types';

const EVENT_NODE_TYPES: ReadonlySet<NodeType> = new Set(['social', 'romance', 'fate', 'vip', 'business', 'scandal', 'party', 'bigfate']);

export function categoryForNode(type: NodeType): EventCategory | null {
  return EVENT_NODE_TYPES.has(type) ? (type as EventCategory) : null;
}

export function eventsInCategory(ctx: GameContext, category: EventCategory): EventDef[] {
  return Object.values(ctx.events).filter((e) => e.category === category);
}

/** カテゴリからイベントを1つ抽選 */
export function drawEvent(rngState: number, ctx: GameContext, category: EventCategory): { eventId: string | null; rngState: number } {
  const list = eventsInCategory(ctx, category);
  if (list.length === 0) return { eventId: null, rngState };
  const r = nextRandom(rngState);
  return { eventId: list[Math.floor(r.value * list.length)].id, rngState: r.state };
}

export function canChoose(player: Player, choice: EventChoice): boolean {
  return choice.requiresMoney === undefined || player.money >= choice.requiresMoney;
}

/** 効果を適用。所持金がマイナスになる分は負債に回す（暫定ルール） */
export function applyEffect(player: Player, effect: EventEffect): { player: Player; applied: Required<EventEffect> } {
  let money = player.money + (effect.money ?? 0);
  let debt = Math.max(0, player.debt + (effect.debt ?? 0));
  if (money < 0) {
    debt += -money;
    money = 0;
  }
  const fame = clampStat(player.fame + (effect.fame ?? 0));
  const network = clampStat(player.network + (effect.network ?? 0));
  const happiness = clampStat(player.happiness + (effect.happiness ?? 0));
  const next = { ...player, money, debt, fame, network, happiness };
  return {
    player: next,
    applied: {
      money: money - player.money,
      debt: debt - player.debt,
      fame: fame - player.fame,
      network: network - player.network,
      happiness: happiness - player.happiness,
    },
  };
}

/** 選択肢を確定し、結果を抽選して適用 */
export function resolveChoice(state: GameState, ctx: GameContext, choiceId: string): GameState {
  if (state.phase !== 'awaitEvent' || !state.pendingEvent) throw new GameRuleError('イベント選択中ではありません');
  const ev = ctx.events[state.pendingEvent.eventId];
  if (!ev) throw new GameRuleError(`不明なイベント: ${state.pendingEvent.eventId}`);
  const choice = ev.choices.find((c) => c.id === choiceId);
  if (!choice) throw new GameRuleError(`不明な選択肢: ${choiceId}`);
  const player = state.players[state.currentPlayerIndex];
  if (!canChoose(player, choice)) throw new GameRuleError('所持金が足りません');

  const total = choice.outcomes.reduce((s, o) => s + o.weight, 0);
  const r = nextRandom(state.rngState);
  let pick = r.value * total;
  let outcomeIndex = 0;
  for (; outcomeIndex < choice.outcomes.length - 1; outcomeIndex++) {
    pick -= choice.outcomes[outcomeIndex].weight;
    if (pick < 0) break;
  }
  const outcome = choice.outcomes[outcomeIndex];
  const { player: updated, applied } = applyEffect(player, outcome.effect);
  return {
    ...state,
    rngState: r.state,
    players: state.players.map((p) => (p.id === player.id ? updated : p)),
    phase: 'eventResult',
    eventResult: { eventId: ev.id, choiceId, outcomeIndex, text: outcome.text, applied },
    log: [...state.log, `${player.name}「${ev.title}」→ ${choice.label}：${outcome.text}`].slice(-40),
  };
}

/** AI の選択（aiWeight による抽選、選べないものは除外） */
export function aiChooseEventChoice(state: GameState, ctx: GameContext): { choiceId: string; rngState: number } {
  const ev = ctx.events[state.pendingEvent!.eventId];
  const player = state.players[state.currentPlayerIndex];
  const options = ev.choices.filter((c) => canChoose(player, c) && (c.aiWeight ?? 1) > 0);
  const pool = options.length ? options : ev.choices.filter((c) => canChoose(player, c));
  const total = pool.reduce((s, c) => s + (c.aiWeight ?? 1), 0);
  const r = nextRandom(state.rngState);
  let pick = r.value * total;
  for (const c of pool) {
    pick -= c.aiWeight ?? 1;
    if (pick < 0) return { choiceId: c.id, rngState: r.state };
  }
  return { choiceId: pool[pool.length - 1].id, rngState: r.state };
}

/** データ検証（テスト・起動時チェック用） */
export function validateEvents(ctx: GameContext): string[] {
  const errors: string[] = [];
  for (const ev of Object.values(ctx.events)) {
    if (!ev.choices.length) errors.push(`${ev.id}: 選択肢なし`);
    if (!ev.choices.some((c) => c.requiresMoney === undefined)) errors.push(`${ev.id}: 無条件で選べる選択肢がない`);
    for (const c of ev.choices) {
      if (!c.outcomes.length) errors.push(`${ev.id}/${c.id}: 結果なし`);
      if (c.outcomes.some((o) => !(o.weight > 0))) errors.push(`${ev.id}/${c.id}: 重みが不正`);
    }
  }
  for (const n of Object.values(ctx.map.nodes)) {
    const cat = categoryForNode(n.type);
    if (cat && eventsInCategory(ctx, cat).length === 0) errors.push(`${n.id}: カテゴリ ${cat} のイベントがない`);
  }
  return errors;
}
