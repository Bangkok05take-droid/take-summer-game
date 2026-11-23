// core（ルール）と UI/描画の橋渡し。演出の待ち合わせ・AI進行・自動セーブを担当。
import { create } from 'zustand';
import { aiChooseBranch, aiChooseEvent, aiDecidePurchase } from '../core/ai/simpleAi';
import { assetRanking } from '../core/advisor';
import { personalityOf } from '../data/aiPersonalities';
import {
  moveByRoll,
  buyProperty,
  chooseBranch,
  createGame,
  currentPlayer,
  endAction,
  rollDice,
  skipPurchase,
  type MoveResult,
} from '../core/game';
import { buyoutPrice, computeIncome, ownsWholeArea } from '../core/economy';
import { resolveChoice } from '../core/events';
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
  // 人間の手番はじっくり、AIの手番はテンポよく
  normal: { dice: 900, aiDice: 520, step: 220, aiStep: 150, think: 380, landing: 650, eventThink: 1100, eventResult: 1700 },
  fast: { dice: 110, aiDice: 110, step: 70, aiStep: 60, think: 60, landing: 120, eventThink: 80, eventResult: 260 },
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
  /** 今回のサイコロ演出時間(ms) */
  diceDuration: number;
  fastForward: boolean;
  hasSave: boolean;
  view: ViewPort | null;

  registerView(v: ViewPort | null): void;
  newGame(): void;
  /** チュートリアルなどでAIの進行を止める */
  hold: boolean;
  setHold(v: boolean): void;
  /** 次の人間のサイコロの目を固定（チュートリアル用） */
  rollOverride: number | null;
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
    scheduleAutoAdvance(state);
  }

  /** 選択の必要がない着地（自分・他人の物件、空港）は少し見せてから自動で次へ */
  let autoTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleAutoAdvance(state: GameState): void {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = null;
    if (state.phase !== 'landed' || !currentPlayer(state).isHuman) return;
    autoTimer = setTimeout(() => {
      autoTimer = null;
      const g = get().game;
      if (g === state && !get().busy) commit(endAction(g, ctx));
    }, get().fastForward ? 500 : 1600);
  }

  /** AIのセリフ（演出用。ゲーム状態の乱数は使わない） */
  function talk(playerId: string, kind: 'buy' | 'buyout' | 'boughtOut' | 'bigWin' | 'bigLoss'): void {
    const per = personalityOf(playerId);
    const g = get().game;
    const p = g?.players.find((x) => x.id === playerId);
    if (!per || !p || p.isHuman || get().fastForward) return;
    const lines = per.lines[kind];
    if (!lines.length) return;
    fxBus.emit({ type: 'aiTalk', playerId, text: lines[Math.floor(Math.random() * lines.length)] });
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
      if (a.money >= 200_000) talk(cur.id, 'bigWin');
      else if (a.money <= -150_000 || next.eventResult.insolvency) talk(cur.id, 'bigLoss');
      const score = a.money / 50_000 - a.debt / 50_000 + a.fame / 4 + a.network / 4 + a.happiness / 4;
      fxBus.emit({ type: 'eventResult', playerId: cur.id, good: score >= 0, applied: a });
      const ins = next.eventResult.insolvency;
      if (ins) {
        const soldNodeIds = ins.sold.map((s) => ctx.properties[s.propertyId].nodeId);
        setTimeout(() => fxBus.emit({ type: 'insolvency', playerId: cur.id, soldNodeIds, restructured: ins.forgiven > 0 }), fast ? 0 : 700);
      }
    }
    // 購入・買収
    for (const pid of Object.keys(next.ownership)) {
      if (prev.ownership[pid] === next.ownership[pid]) continue;
      const owner = next.players.find((p) => p.id === next.ownership[pid])!;
      const prop = ctx.properties[pid];
      const monopoly = ownsWholeArea(next, ctx, owner.id, prop.area);
      const prevOwner = prev.ownership[pid];
      if (prevOwner) {
        const price = buyoutPrice(prev, ctx, pid);
        fxBus.emit({ type: 'buyout', buyerId: owner.id, ownerId: prevOwner, nodeId: prop.nodeId, price, color: owner.color });
        talk(owner.id, 'buyout');
        setTimeout(() => talk(prevOwner, 'boughtOut'), fast ? 0 : 1300);
      } else {
        fxBus.emit({ type: 'purchase', playerId: owner.id, nodeId: prop.nodeId, price: prop.price, color: owner.color, monopoly });
        talk(owner.id, 'buy');
      }
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
      const human = next.players.findIndex((p) => p.isHuman);
      const row = assetRanking(next, ctx)[human];
      if (row) setTimeout(() => fxBus.emit({ type: 'rank', change: row.change, rank: row.rank }), delay + (fast ? 0 : 700));
      holdUntil = performance.now() + delay + (fast ? 300 : 1500);
    }
    if (cur.isHuman && next.phase === 'awaitRoll' && (prev.currentPlayerIndex !== next.currentPlayerIndex || prev.phase === 'gameOver')) {
      setTimeout(() => fxBus.emit({ type: 'yourTurn' }), next.turn > prev.turn ? delay + 1300 : 0);
    }
  }

  async function runMove(sid: number, playerId: string, res: MoveResult): Promise<void> {
    const view = get().view;
    const human = !!get().game?.players.find((p) => p.id === playerId)?.isHuman;
    if (view) await view.animateMove(playerId, res.path, human ? speed().step : speed().aiStep);
    if (sid !== session) return;
    commit(res.state);
  }

  async function doRoll(): Promise<void> {
    const g = get().game;
    if (!g || g.phase !== 'awaitRoll' || get().busy) return;
    const sid = session;
    // チュートリアル中は目を固定（物件マスに止まって購入を体験させる）
    const forced = currentPlayer(g).isHuman ? get().rollOverride : null;
    const res = forced ? { ...moveByRoll(g, ctx, forced), roll: forced } : rollDice(g, ctx);
    if (forced) set({ rollOverride: null });
    const human = currentPlayer(g).isHuman;
    const dur = human ? speed().dice : speed().aiDice;
    // サイコロ演出（結果は先に確定し、3Dダイスがその面で止まる）
    set({ busy: true, diceRolling: true, diceFace: res.roll, diceRollId: get().diceRollId + 1, diceDuration: dur });
    fxBus.emit({ type: 'diceRoll', value: res.roll, durationMs: dur, human });
    await sleep(dur);
    if (sid !== session) return;
    set({ diceRolling: false });
    fxBus.emit({ type: 'diceResult', value: res.roll });
    await sleep(get().fastForward ? 30 : human ? 260 : 120);
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
      case 'awaitPurchase': {
        const d = aiDecidePurchase(g, ctx);
        const st = { ...g, rngState: d.rngState };
        commit(d.buy ? buyProperty(st, ctx) : skipPurchase(st, ctx));
        break;
      }
      case 'awaitEvent': {
        const c = aiChooseEvent(g, ctx);
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
    if (aiTimer || busy || get().hold || !g || g.phase === 'gameOver' || currentPlayer(g).isHuman) return;
    const sp = speed();
    const base =
      g.phase === 'awaitEvent' ? sp.eventThink
      : g.phase === 'eventResult' ? sp.eventResult + (g.eventResult?.insolvency && !get().fastForward ? 2200 : 0)
      : g.phase === 'landed' || g.phase === 'awaitPurchase' ? sp.landing
      : sp.think;
    const delay = Math.max(base, holdUntil - performance.now());
    aiTimer = setTimeout(aiStep, delay);
  }

  function reset(): void {
    session++;
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = null;
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = null;
  }

  const st = storage();
  return {
    screen: 'title',
    game: null,
    busy: false,
    diceFace: null,
    diceRolling: false,
    diceRollId: 0,
    diceDuration: 900,
    hold: false,
    rollOverride: null,
    setHold(v) {
      if (get().hold === v) return;
      set({ hold: v });
      if (!v) scheduleAi();
    },
    fastForward: false,
    hasSave: !!(st && loadGame(st)),
    view: null,

    registerView: (v) => set({ view: v }),

    newGame() {
      reset();
      const g = createGame(ctx);
      set({ screen: 'game', game: null, busy: false, diceFace: null, diceRolling: false, hold: false, rollOverride: null });
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
