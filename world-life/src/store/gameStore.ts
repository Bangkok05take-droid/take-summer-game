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
import { clearSave, loadGame, saveGame, type KeyValueStorage } from '../core/save';
import type { GameState } from '../core/types';
import { bangkokContext } from '../data/config';

export const ctx = bangkokContext;

/** 描画側が提供する演出ポート */
export interface ViewPort {
  animateMove(playerId: string, path: string[], stepMs: number): Promise<void>;
  focusNode(nodeId: string): void;
}

const SPEED = {
  normal: { dice: 650, step: 260, think: 550, landing: 700 },
  fast: { dice: 110, step: 70, think: 60, landing: 120 },
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
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let aiTimer: ReturnType<typeof setTimeout> | null = null;
/** 新しいゲームを始めたら古い非同期処理を無効化する */
let session = 0;

export const useGame = create<Store>((set, get) => {
  const speed = () => (get().fastForward ? SPEED.fast : SPEED.normal);

  function commit(state: GameState): void {
    set({ game: state });
    const st = storage();
    if (st) saveGame(st, state);
    scheduleAi();
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
    set({ busy: true, diceRolling: true });
    const res = rollDice(g, ctx);
    // サイコロ演出
    const end = performance.now() + speed().dice;
    while (performance.now() < end) {
      set({ diceFace: 1 + Math.floor(Math.random() * 6) });
      await sleep(60);
      if (sid !== session) return;
    }
    set({ diceFace: res.roll, diceRolling: false });
    await sleep(get().fastForward ? 0 : 150);
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
      case 'landed':
        commit(endAction(g, ctx));
        break;
    }
  }

  function scheduleAi(): void {
    const { game: g, busy } = get();
    if (aiTimer || busy || !g || g.phase === 'gameOver' || currentPlayer(g).isHuman) return;
    const delay = g.phase === 'landed' || g.phase === 'awaitPurchase' ? speed().landing : speed().think;
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
    fastForward: false,
    hasSave: !!(st && loadGame(st)),
    view: null,

    registerView: (v) => set({ view: v }),

    newGame() {
      reset();
      const g = createGame(ctx);
      set({ screen: 'game', busy: false, diceFace: null, diceRolling: false });
      commit(g);
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
      if (g && !get().busy && g.phase === 'landed' && currentPlayer(g).isHuman) commit(endAction(g, ctx));
    },
  };
});
