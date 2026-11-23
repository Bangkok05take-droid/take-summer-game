// ゲーム進行（純粋関数）。各関数は新しい GameState を返し、不正な操作は GameRuleError を投げる。
import { BASE_RULES, PLAYER_PRESETS } from '../data/config';
import { canBuy, canBuyout, computeIncome, netWorth } from './economy';
import { categoryForNode, drawEvent } from './events';
import { walk } from './movement';
import { nextInt } from './rng';
import type { GameContext, GameState, LandingInfo, Player } from './types';
import { GameRuleError } from './types';

export const SAVE_VERSION = 3;
const LOG_LIMIT = 40;

export interface NewGameOptions {
  seed?: number;
  humanName?: string;
  maxTurns?: number;
}

export function createGame(ctx: GameContext, opts: NewGameOptions = {}): GameState {
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const players: Player[] = PLAYER_PRESETS.map((p) => ({
    id: p.id,
    name: p.isHuman && opts.humanName ? opts.humanName : p.name,
    isHuman: p.isHuman,
    color: p.color,
    money: BASE_RULES.initialMoney,
    fame: BASE_RULES.initialFame,
    network: BASE_RULES.initialNetwork,
    happiness: BASE_RULES.initialHappiness,
    debt: 0,
    position: ctx.map.startNodeId,
  }));
  return {
    saveVersion: SAVE_VERSION,
    cityId: ctx.map.id,
    seed,
    rngState: seed,
    turn: 1,
    maxTurns: opts.maxTurns ?? BASE_RULES.maxTurns,
    currentPlayerIndex: 0,
    players,
    ownership: {},
    phase: 'awaitRoll',
    lastRoll: null,
    stepsRemaining: 0,
    branchOptions: [],
    landing: null,
    pendingEvent: null,
    eventResult: null,
    lastSettledTurn: 0,
    history: [players.map((p) => p.money)],
    actionCount: 0,
    log: ['ゲーム開始：バンコク'],
  };
}

export function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

function requirePhase(state: GameState, ...phases: GameState['phase'][]): void {
  if (!phases.includes(state.phase)) {
    throw new GameRuleError(`この操作はフェーズ ${state.phase} では行えません`);
  }
}

function pushLog(state: GameState, msg: string): string[] {
  return [...state.log, msg].slice(-LOG_LIMIT);
}

function updatePlayer(state: GameState, id: string, fn: (p: Player) => Player): Player[] {
  return state.players.map((p) => (p.id === id ? fn(p) : p));
}

export interface MoveResult {
  state: GameState;
  /** 今回のアニメーション対象経路 */
  path: string[];
}

/** サイコロの目を指定して移動（テスト・演出用）。通常は rollDice を使う */
export function moveByRoll(state: GameState, ctx: GameContext, roll: number): MoveResult {
  requirePhase(state, 'awaitRoll');
  if (!Number.isInteger(roll) || roll < BASE_RULES.diceMin || roll > BASE_RULES.diceMax) {
    throw new GameRuleError(`不正なサイコロの目: ${roll}`);
  }
  const player = currentPlayer(state);
  const w = walk(ctx.map, player.position, roll);
  let next: GameState = {
    ...state,
    lastRoll: roll,
    players: updatePlayer(state, player.id, (p) => ({ ...p, position: w.position })),
    log: pushLog(state, `${player.name} はサイコロで ${roll} を出した`),
  };
  next = afterWalk(next, ctx, w.stepsRemaining, w.branchOptions);
  return { state: next, path: w.path };
}

export function rollDice(state: GameState, ctx: GameContext): MoveResult & { roll: number } {
  requirePhase(state, 'awaitRoll');
  const r = nextInt(state.rngState, BASE_RULES.diceMin, BASE_RULES.diceMax);
  const res = moveByRoll({ ...state, rngState: r.state }, ctx, r.value);
  return { ...res, roll: r.value };
}

/** 分岐で次の1歩を選ぶ。選んだだけではイベントは起きない */
export function chooseBranch(state: GameState, ctx: GameContext, nodeId: string): MoveResult {
  requirePhase(state, 'awaitBranch');
  if (!state.branchOptions.includes(nodeId)) throw new GameRuleError(`選択できない分岐先: ${nodeId}`);
  const player = currentPlayer(state);
  const w = walk(ctx.map, player.position, state.stepsRemaining, nodeId);
  let next: GameState = {
    ...state,
    players: updatePlayer(state, player.id, (p) => ({ ...p, position: w.position })),
    log: pushLog(state, `${player.name} は ${ctx.map.nodes[nodeId].label} 方面へ進んだ`),
  };
  next = afterWalk(next, ctx, w.stepsRemaining, w.branchOptions);
  return { state: next, path: w.path };
}

function afterWalk(state: GameState, ctx: GameContext, remaining: number, options: string[]): GameState {
  if (remaining > 0) {
    return { ...state, phase: 'awaitBranch', stepsRemaining: remaining, branchOptions: options };
  }
  const player = currentPlayer(state);
  const node = ctx.map.nodes[player.position];
  let landing: LandingInfo;
  if (node.propertyId && ctx.properties[node.propertyId]) {
    const owner = state.ownership[node.propertyId];
    landing = !owner
      ? { nodeId: node.id, kind: 'property-available' }
      : { nodeId: node.id, kind: owner === player.id ? 'property-owned-self' : 'property-owned-other', ownerId: owner };
  } else {
    landing = { nodeId: node.id, kind: node.type === 'start' ? 'start' : 'event' };
    const cat = categoryForNode(node.type);
    const drawn = cat ? drawEvent(state.rngState, ctx, cat, state.turn) : null;
    if (drawn?.eventId) {
      return {
        ...state,
        rngState: drawn.rngState,
        phase: 'awaitEvent',
        stepsRemaining: 0,
        branchOptions: [],
        landing,
        pendingEvent: { eventId: drawn.eventId },
        log: pushLog(state, `${player.name} は「${node.label}」に止まった`),
      };
    }
  }
  return {
    ...state,
    // 空き物件は購入、他人の物件は買収の判断へ
    phase: landing.kind === 'property-available' || landing.kind === 'property-owned-other' ? 'awaitPurchase' : 'landed',
    stepsRemaining: 0,
    branchOptions: [],
    landing,
    log: pushLog(state, `${player.name} は「${node.label}」に止まった`),
  };
}

/** 停止中の空き物件を購入して手番終了 */
export function buyProperty(state: GameState, ctx: GameContext): GameState {
  requirePhase(state, 'awaitPurchase');
  const player = currentPlayer(state);
  const propertyId = ctx.map.nodes[player.position].propertyId;
  if (propertyId && state.ownership[propertyId] && state.ownership[propertyId] !== player.id) return buyoutProperty(state, ctx);
  const check = canBuy(state, ctx, player.id, propertyId);
  if (!check.ok) {
    throw new GameRuleError(check.reason === 'funds' ? '資金が不足しています' : check.reason === 'owned' ? 'すでに所有者がいます' : '物件ではありません');
  }
  const prop = ctx.properties[propertyId!];
  const bought: GameState = {
    ...state,
    ownership: { ...state.ownership, [prop.id]: player.id },
    players: updatePlayer(state, player.id, (p) => ({ ...p, money: p.money - prop.price })),
    log: pushLog(state, `${player.name} は ${prop.name} を $${prop.price.toLocaleString()} で購入`),
  };
  return endAction(bought, ctx);
}

/** 他人の物件を買収して手番終了（代金は元の所有者へ） */
export function buyoutProperty(state: GameState, ctx: GameContext): GameState {
  requirePhase(state, 'awaitPurchase');
  const player = currentPlayer(state);
  const propertyId = ctx.map.nodes[player.position].propertyId;
  const check = canBuyout(state, ctx, player.id, propertyId);
  if (!check.ok) throw new GameRuleError(check.reason === 'funds' ? '買収資金が不足しています' : '買収できない物件です');
  const prop = ctx.properties[propertyId!];
  const ownerId = state.ownership[prop.id];
  const owner = state.players.find((p) => p.id === ownerId)!;
  const done: GameState = {
    ...state,
    ownership: { ...state.ownership, [prop.id]: player.id },
    players: state.players.map((p) =>
      p.id === player.id ? { ...p, money: p.money - check.price } : p.id === ownerId ? { ...p, money: p.money + check.price } : p,
    ),
    log: pushLog(state, `${player.name} が ${owner.name} から ${prop.name} を $${check.price.toLocaleString()} で買収！`),
  };
  return endAction(done, ctx);
}

/** 購入を見送って手番終了 */
export function skipPurchase(state: GameState, ctx: GameContext): GameState {
  requirePhase(state, 'awaitPurchase');
  return endAction(state, ctx);
}

/** 手番を終了。4人全員が行動したらターン終了（収益精算→次ターン） */
export function endAction(state: GameState, ctx: GameContext): GameState {
  requirePhase(state, 'landed', 'awaitPurchase', 'eventResult');
  let next: GameState = {
    ...state,
    phase: 'awaitRoll',
    landing: null,
    pendingEvent: null,
    eventResult: null,
    lastRoll: null,
    actionCount: state.actionCount + 1,
  };
  const nextIndex = state.currentPlayerIndex + 1;
  if (nextIndex < state.players.length) {
    return { ...next, currentPlayerIndex: nextIndex };
  }
  // ターン終了
  next = settleIncome(next, ctx, state.turn);
  if (state.turn >= state.maxTurns) {
    return { ...next, currentPlayerIndex: 0, phase: 'gameOver', log: pushLog(next, 'ゲーム終了') };
  }
  return {
    ...next,
    currentPlayerIndex: 0,
    turn: state.turn + 1,
    log: pushLog(next, `ターン ${state.turn + 1} 開始`),
  };
}

/** 物件収益の一括精算。同じターンを二度精算しない */
export function settleIncome(state: GameState, ctx: GameContext, turn: number): GameState {
  if (turn <= state.lastSettledTurn) return state;
  let log = state.log;
  const players = state.players.map((p) => {
    const income = computeIncome(state, ctx, p.id);
    if (income > 0) log = [...log, `${p.name} 物件収益 +$${income.toLocaleString()}`].slice(-LOG_LIMIT);
    return income > 0 ? { ...p, money: p.money + income } : p;
  });
  const settled = { ...state, players, lastSettledTurn: turn, log };
  const snapshot = settled.players.map((p) => netWorth(settled, ctx, p.id));
  return { ...settled, history: [...(state.history ?? []).slice(0, turn), snapshot] };
}
