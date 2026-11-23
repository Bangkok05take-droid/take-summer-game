// core（ルール）と UI/描画の橋渡し。演出の待ち合わせ・AI進行・自動セーブを担当。
import { create } from 'zustand';
import { aiChooseBranch, aiWantsToBuy } from '../core/ai/simpleAi';
import {
  buyProperty,
  chooseBranch,
  createGame,
  currentPlayer,
  endAction,
  rollDice,
  skipPurchase,
  type MoveResult,
} from '../core/game';
import { computeIncome, ownsWholeArea } from '../core/economy';
import { aiChooseEventChoice, resolveChoice } from '../core/events';
import { clearSave, loadGame, saveGame, type KeyValueStorage } from '../core/save';
import type { GameState } from '../core/types';
import { bangkokContext } from '../data/config';
import { fxBus } from '../fx/bus';

export const ctx = bangkokContext;

/** 描画側が提供する演出ポート */
export interface ViewPort {
  animateMove(playerId: string, path: string[], stepMs: number): Promise<void>;
  focusNode(nodeId: string): void;
}

const SPEED = {
  normal: { dice: 900, step: 220, think: 500, landing: 750, eventThink: 1400, eventResult: 1900 },
  fast: { dice: 110, step: 70, think: 60, landing: 120, eventThink: 80, eventResult: 260 },
};

function storage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

interface Store {
  screen: 'title' | 'game';
  game: GameState | null;
  busy: boolean;
  diceFace: number | null;
  diceRolling: boolean;
  /** サイコロを振るたびに増える（演出のトリガー） */
  diceRollId: number;
  fastForward: boolean;
  hasSave: boolean;
  view: ViewPort | null;

  registerView(v: ViewPort | null): void;
  newGame(): void;
  continueGame(): void;
  backToTitle(): void;
  setFastForward(v: boolean): void;
  roll(): void;
  pickBranch(nodeId: string): void;
  buy(): void;
  skip(): void;
  next(): void;
  chooseEvent(choiceId: string): void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let aiTimer: ReturnType<typeof setTimeout> | null = null;
/** 新しいゲームを始めたら古い非同期処理を無効化する */
let session = 0;

export const useGame = create<Store>((set, get) => {
  const speed = () => (get().fastForward ? SPEED.fast : SPEED.normal);
  /** ターン開始演出の間、AIを待たせる時刻 */
  let holdUntil = 0;

  function commit(state: GameState): void {
    const prev = get().game;
    set({ game: state });
    const st = storage();
    if (st) saveGame(st, state);
    if (prev) emitDiff(prev, state);
    scheduleAi();
  }

  /** 状態の差分から演出イベントを発火 */
  function emitDiff(prev: GameState, next: GameState): void {
    const fast = get().fastForward;
    const cur = currentPlayer(next);
    // 着地
    if ((prev.phase === 'awaitRoll' || prev.phase === 'awaitBranch') && (next.phase === 'landed' || next.phase === 'awaitPurchase')) {
      fxBus.emit({ type: 'land', playerId: cur.id, nodeId: cur.position, human: cur.isHuman });
    }
    if (next.phase === 'awaitBranch' && prev.phase !== 'awaitBranch' && cur.isHuman) fxBus.emit({ type: 'branchPrompt' });
    // イベント
    if (next.phase === 'awaitEvent' && prev.phase !== 'awaitEvent' && next.pendingEvent) {
      const eventId = next.pendingEvent.eventId;
      setTimeout(() => fxBus.emit({ type: 'eventOpen', eventId, human: cur.isHuman }), fast ? 0 : 350);
    }
    if (next.phase === 'eventResult' && prev.phase === 'awaitEvent' && next.eventResult) {
      const a = next.eventResult.applied;
      const score = a.money / 50_000 - a.debt / 50_000 + a.fame / 4 + a.network / 4 + a.happiness / 4;
      fxBus.emit({ type: 'eventResult', playerId: cur.id, good: score >= 0, applied: a });
    }
    // 購入
    for (const pid of Object.keys(next.ownership)) {
      if (prev.ownership[pid]) continue;
      const owner = next.players.find((p) => p.id === next.ownership[pid])!;
      const prop = ctx.properties[pid];
      fxBus.emit({
        type: 'purchase',
        playerId: owner.id,
        nodeId: prop.nodeId,
        price: prop.price,
        color: owner.color,
        monopoly: ownsWholeArea(next, ctx, owner.id, prop.area),
      });
    }
    // 収益精算
    let delay = 0;
    if (next.lastSettledTurn > prev.lastSettledTurn) {
      delay = 350;
      next.players.forEach((p) => {
        const amount = computeIncome(next, ctx, p.id);
        if (amount <= 0) return;
        setTimeout(() => fxBus.emit({ type: 'income', playerId: p.id, amount }), delay);
        delay += fast ? 60 : 220;
      });
    }
    if (next.phase === 'gameOver' && prev.phase !== 'gameOver') {
      setTimeout(() => fxBus.emit({ type: 'gameOver' }), delay + 200);
      return;
    }
    if (next.turn > prev.turn) {
      setTimeout(() => fxBus.emit({ type: 'turnStart', turn: next.turn, maxTurns: next.maxTurns }), delay);
      holdUntil = performance.now() + delay + (fast ? 300 : 1500);
    }
    if (cur.isHuman && next.phase === 'awaitRoll' && (prev.currentPlayerIndex !== next.currentPlayerIndex || prev.phase === 'gameOver')) {
      setTimeout(() => fxBus.emit({ type: 'yourTurn' }), next.turn > prev.turn ? delay + 1300 : 0);
    }
  }

  async function runMove(sid: number, playerId: string, res: MoveResult): Promise<void> {
    const view = get().view;
    if (view) await view.animateMove(playerId, res.path, speed().step);
    if (sid !== session) return;
    commit(res.state);
  }

  async function doRoll(): Promise<void> {
    const g = get().game;
    if (!g || g.phase !== 'awaitRoll' || get().busy) return;
    const sid = session;
    const res = rollDice(g, ctx);
    const dur = speed().dice;
    const human = currentPlayer(g).isHuman;
    // サイコロ演出（結果は先に確定し、3Dダイスがその面で止まる）
    set({ busy: true, diceRolling: true, diceFace: res.roll, diceRollId: get().diceRollId + 1 });
    fxBus.emit({ type: 'diceRoll', value: res.roll, durationMs: dur, human });
    await sleep(dur);
    if (sid !== session) return;
    set({ diceRolling: false });
    fxBus.emit({ type: 'diceResult', value: res.roll });
    await sleep(get().fastForward ? 30 : 260);
    if (sid !== session) return;
    await runMove(sid, currentPlayer(g).id, res);
    if (sid === session) set({ busy: false });
    scheduleAi();
  }

  async function doBranch(nodeId: string): Promise<void> {
    const g = get().game;
    if (!g || g.phase !== 'awaitBranch' || get().busy) return;
    const sid = session;
    set({ busy: true });
    await runMove(sid, currentPlayer(g).id, chooseBranch(g, ctx, nodeId));
    if (sid === session) set({ busy: false });
    scheduleAi();
  }

  function aiStep(): void {
    aiTimer = null;
    const { game: g, busy } = get();
    if (!g || busy || g.phase === 'gameOver' || currentPlayer(g).isHuman) return;
    switch (g.phase) {
      case 'awaitRoll':
        void doRoll();
        break;
      case 'awaitBranch': {
        const c = aiChooseBranch(g, ctx);
        set({ game: { ...g, rngState: c.rngState } });
        void doBranch(c.choice);
        break;
      }
      case 'awaitPurchase':
        commit(aiWantsToBuy(g, ctx) ? buyProperty(g, ctx) : skipPurchase(g, ctx));
        break;
      case 'awaitEvent': {
        const c = aiChooseEventChoice(g, ctx);
        commit(resolveChoice({ ...g, rngState: c.rngState }, ctx, c.choiceId));
        break;
      }
      case 'landed':
      case 'eventResult':
        commit(endAction(g, ctx));
        break;
    }
  }

  function scheduleAi(): void {
    const { game: g, busy } = get();
    if (aiTimer || busy || !g || g.phase === 'gameOver' || currentPlayer(g).isHuman) return;
    const sp = speed();
    const base =
      g.phase === 'awaitEvent' ? sp.eventThink
      : g.phase === 'eventResult' ? sp.eventResult
      : g.phase === 'landed' || g.phase === 'awaitPurchase' ? sp.landing
      : sp.think;
    const delay = Math.max(base, holdUntil - performance.now());
    aiTimer = setTimeout(aiStep, delay);
  }

  function reset(): void {
    session++;
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
  }

  const st = storage();
  return {
    screen: 'title',
    game: null,
    busy: false,
    diceFace: null,
    diceRolling: false,
    diceRollId: 0,
    fastForward: false,
    hasSave: !!(st && loadGame(st)),
    view: null,

    registerView: (v) => set({ view: v }),

    newGame() {
      reset();
      const g = createGame(ctx);
      set({ screen: 'game', game: null, busy: false, diceFace: null, diceRolling: false });
      commit(g);
      setTimeout(() => fxBus.emit({ type: 'turnStart', turn: 1, maxTurns: g.maxTurns }), 300);
      setTimeout(() => fxBus.emit({ type: 'yourTurn' }), 1600);
    },

    continueGame() {
      const s = storage();
      const g = s ? loadGame(s) : null;
      if (!g) return;
      reset();
      set({ screen: 'game', game: g, busy: false, diceFace: g.lastRoll, diceRolling: false });
      scheduleAi();
    },

    backToTitle() {
      reset();
      const s = storage();
      const g = get().game;
      if (s && g?.phase === 'gameOver') clearSave(s);
      set({ screen: 'title', game: null, busy: false, hasSave: !!(s && loadGame(s)) });
    },

    setFastForward(v) {
      set({ fastForward: v });
      // 早送り切替時、待機中のAIをすぐ動かす
      if (v && aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
        scheduleAi();
      }
    },

    roll() {
      const g = get().game;
      if (g && currentPlayer(g).isHuman) void doRoll();
    },
    pickBranch(nodeId) {
      const g = get().game;
      if (g && currentPlayer(g).isHuman && g.branchOptions.includes(nodeId)) void doBranch(nodeId);
    },
    buy() {
      const g = get().game;
      if (g && !get().busy && g.phase === 'awaitPurchase' && currentPlayer(g).isHuman) commit(buyProperty(g, ctx));
    },
    skip() {
      const g = get().game;
      if (g && !get().busy && g.phase === 'awaitPurchase' && currentPlayer(g).isHuman) commit(skipPurchase(g, ctx));
    },
    next() {
      const g = get().game;
      if (g && !get().busy && (g.phase === 'landed' || g.phase === 'eventResult') && currentPlayer(g).isHuman) commit(endAction(g, ctx));
    },
    chooseEvent(choiceId) {
      const g = get().game;
      if (!g || get().busy || g.phase !== 'awaitEvent' || !currentPlayer(g).isHuman) return;
      try {
        commit(resolveChoice(g, ctx, choiceId));
      } catch {
        /* 選べない選択肢（UIで無効化済み） */
      }
    },
  };
});
