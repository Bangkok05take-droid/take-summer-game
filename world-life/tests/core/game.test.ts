import { describe, expect, it } from 'vitest';
import { bangkokContext, BASE_RULES } from '../../src/data/config';
import { aiChooseBranch, aiWantsToBuy } from '../../src/core/ai/simpleAi';
import { aiChooseEventChoice, resolveChoice } from '../../src/core/events';
import { computeIncome, netWorth } from '../../src/core/economy';
import {
  buyProperty,
  chooseBranch,
  createGame,
  currentPlayer,
  endAction,
  moveByRoll,
  rollDice,
  settleIncome,
  skipPurchase,
} from '../../src/core/game';
import { reachableNodes, walk } from '../../src/core/movement';
import { createMemoryStorage, loadGame, saveGame, serializeGame, deserializeGame } from '../../src/core/save';
import { computeScores } from '../../src/core/scoring';
import { applyStatDelta, clampStat } from '../../src/core/stats';
import type { GameState } from '../../src/core/types';
import { GameRuleError } from '../../src/core/types';

// 基本ルールのテストはイベントを無効にした状態で検証する（イベントは events.test.ts）
const ctx = { ...bangkokContext, events: {} };
const map = ctx.map;
const ids = Array.from({ length: 16 }, (_, i) => `bkk_${String(i).padStart(2, '0')}`);

/** 現在の手番を1行動分進める（分岐は先頭、購入は見送り） */
function playOneAction(s: GameState, opts: { roll?: number; branch?: 0 | 1; buy?: boolean } = {}): GameState {
  let st = opts.roll ? moveByRoll(s, ctx, opts.roll).state : rollDice(s, ctx).state;
  while (st.phase === 'awaitBranch') st = chooseBranch(st, ctx, st.branchOptions[opts.branch ?? 0]).state;
  if (st.phase === 'awaitPurchase') return opts.buy ? buyProperty(st, ctx) : skipPurchase(st, ctx);
  return endAction(st, ctx);
}

/** 指定プレイヤーの位置を書き換えたテスト用状態 */
function placeCurrent(s: GameState, nodeId: string): GameState {
  return { ...s, players: s.players.map((p, i) => (i === s.currentPlayerIndex ? { ...p, position: nodeId } : p)) };
}

describe('マップ構造', () => {
  it('16マスで、指定のIDがすべて存在する', () => {
    expect(Object.keys(map.nodes).sort()).toEqual(ids);
  });

  it('16マスすべてに START から到達可能', () => {
    expect(reachableNodes(map).size).toBe(16);
  });

  it('全マスから START に戻れる（周回できる）', () => {
    for (const id of ids) expect(reachableNodes(map, id).has('bkk_00')).toBe(true);
  });

  it('実際のサイコロ移動で16マスすべてに停止できる', () => {
    const landed = new Set<string>();
    for (const from of ids) {
      for (let roll = 1; roll <= 6; roll++) {
        for (const pick of [0, 1]) {
          let w = walk(map, from, roll);
          while (w.branchOptions.length) w = walk(map, w.position, w.stepsRemaining, w.branchOptions[pick]);
          landed.add(w.position);
        }
      }
    }
    expect(landed.size).toBe(16);
  });

  it('分岐は03と11の2か所のみ', () => {
    const branches = ids.filter((id) => map.nodes[id].next.length > 1);
    expect(branches).toEqual(['bkk_03', 'bkk_11']);
    expect(map.nodes.bkk_03.next).toEqual(['bkk_04', 'bkk_07']);
    expect(map.nodes.bkk_11.next).toEqual(['bkk_12', 'bkk_15']);
  });
});

describe('移動と分岐', () => {
  it('サイコロの歩数と移動数が一致（分岐なし区間）', () => {
    for (let roll = 1; roll <= 6; roll++) {
      const s = placeCurrent(createGame(ctx, { seed: 1 }), 'bkk_04');
      const r = moveByRoll(s, ctx, roll);
      expect(r.path.length).toBe(roll);
      expect(currentPlayer(r.state).position).toBe(ids[4 + roll]);
    }
  });

  it('分岐をはさんでも合計移動数がサイコロの目と一致', () => {
    for (const pick of [0, 1]) {
      for (let roll = 1; roll <= 6; roll++) {
        let s = placeCurrent(createGame(ctx, { seed: 2 }), 'bkk_01');
        let r = moveByRoll(s, ctx, roll);
        let total = r.path.length;
        s = r.state;
        while (s.phase === 'awaitBranch') {
          r = chooseBranch(s, ctx, s.branchOptions[pick]);
          total += r.path.length;
          s = r.state;
        }
        expect(total).toBe(roll);
      }
    }
  });

  it('分岐A：近道を選ぶと 03 → 07 → 08 と進む', () => {
    let s = placeCurrent(createGame(ctx, { seed: 3 }), 'bkk_02');
    const r1 = moveByRoll(s, ctx, 3);
    expect(r1.state.phase).toBe('awaitBranch');
    expect(r1.path).toEqual(['bkk_03']);
    expect(r1.state.branchOptions).toEqual(['bkk_04', 'bkk_07']);
    expect(r1.state.stepsRemaining).toBe(2);
    s = r1.state;
    const r2 = chooseBranch(s, ctx, 'bkk_07');
    expect(r2.path).toEqual(['bkk_07', 'bkk_08']);
    expect(currentPlayer(r2.state).position).toBe('bkk_08');
    expect(r2.state.phase).toBe('awaitPurchase');
  });

  it('分岐B：通常ルートを選ぶと 11 → 12 → 13 と進む', () => {
    const s = placeCurrent(createGame(ctx, { seed: 3 }), 'bkk_10');
    const r1 = moveByRoll(s, ctx, 3);
    expect(r1.state.branchOptions).toEqual(['bkk_12', 'bkk_15']);
    const r2 = chooseBranch(r1.state, ctx, 'bkk_12');
    expect(r2.path).toEqual(['bkk_12', 'bkk_13']);
  });

  it('分岐マスにちょうど止まった場合は選択なしで停止し、次の手番の最初に選ぶ', () => {
    let s = placeCurrent(createGame(ctx, { seed: 4 }), 'bkk_00');
    const r = moveByRoll(s, ctx, 3);
    expect(currentPlayer(r.state).position).toBe('bkk_03');
    expect(r.state.phase).toBe('awaitPurchase');
    // 次に同じプレイヤーが 03 から振ると即分岐
    s = { ...placeCurrent(createGame(ctx, { seed: 4 }), 'bkk_03') };
    const r2 = moveByRoll(s, ctx, 2);
    expect(r2.path).toEqual([]);
    expect(r2.state.phase).toBe('awaitBranch');
    expect(r2.state.stepsRemaining).toBe(2);
  });

  it('分岐の選択だけではイベント（停止処理）が起きない', () => {
    const s = placeCurrent(createGame(ctx, { seed: 5 }), 'bkk_02');
    const r = moveByRoll(s, ctx, 3);
    expect(r.state.landing).toBeNull();
    expect(r.state.phase).toBe('awaitBranch');
  });

  it('選べない分岐先は拒否される', () => {
    const s = moveByRoll(placeCurrent(createGame(ctx, { seed: 6 }), 'bkk_02'), ctx, 3).state;
    expect(() => chooseBranch(s, ctx, 'bkk_05')).toThrow(GameRuleError);
  });

  it('START を一周して周回できる', () => {
    const s = placeCurrent(createGame(ctx, { seed: 7 }), 'bkk_14');
    const r = moveByRoll(s, ctx, 3);
    expect(r.path).toEqual(['bkk_15', 'bkk_00', 'bkk_01']);
  });

  it('サイコロは常に1〜6', () => {
    let s = createGame(ctx, { seed: 8 });
    for (let i = 0; i < 300; i++) {
      const r = rollDice(s, ctx);
      expect(r.roll).toBeGreaterThanOrEqual(1);
      expect(r.roll).toBeLessThanOrEqual(6);
      s = { ...s, rngState: r.state.rngState };
    }
    expect(() => moveByRoll(createGame(ctx), ctx, 7)).toThrow(GameRuleError);
  });
});

describe('ターン管理', () => {
  it('初期状態は基本ルールどおり', () => {
    const s = createGame(ctx, { seed: 9 });
    expect(s.players).toHaveLength(4);
    expect(s.players.filter((p) => p.isHuman)).toHaveLength(1);
    for (const p of s.players) {
      expect(p.money).toBe(1_000_000);
      expect(p.fame).toBe(30);
      expect(p.network).toBe(30);
      expect(p.happiness).toBe(50);
      expect(p.position).toBe('bkk_00');
    }
    expect(s.turn).toBe(1);
    expect(s.maxTurns).toBe(20);
  });

  it('4人の行動終了で1ターン進む', () => {
    let s = createGame(ctx, { seed: 10 });
    for (let i = 0; i < 3; i++) {
      s = playOneAction(s);
      expect(s.turn).toBe(1);
      expect(s.currentPlayerIndex).toBe(i + 1);
    }
    s = playOneAction(s);
    expect(s.turn).toBe(2);
    expect(s.currentPlayerIndex).toBe(0);
  });

  it('20ターン（80行動）で終了し、それ以上は行動できない', () => {
    let s = createGame(ctx, { seed: 11 });
    let actions = 0;
    while (s.phase !== 'gameOver') {
      s = playOneAction(s, { buy: true });
      actions++;
      expect(actions).toBeLessThanOrEqual(80);
    }
    expect(actions).toBe(80);
    expect(s.turn).toBe(20);
    expect(s.lastSettledTurn).toBe(20);
    expect(() => rollDice(s, ctx)).toThrow(GameRuleError);
  });

  it('フェーズ外の操作は拒否される', () => {
    const s = createGame(ctx, { seed: 12 });
    expect(() => endAction(s, ctx)).toThrow(GameRuleError);
    expect(() => buyProperty(s, ctx)).toThrow(GameRuleError);
    expect(() => chooseBranch(s, ctx, 'bkk_04')).toThrow(GameRuleError);
  });
});

describe('物件と収益', () => {
  it('空き物件を購入でき、代金が引かれる', () => {
    const s = moveByRoll(createGame(ctx, { seed: 13 }), ctx, 1).state;
    expect(s.phase).toBe('awaitPurchase');
    const after = buyProperty(s, ctx);
    expect(after.ownership.prop_bkk_01).toBe('p1');
    expect(after.players[0].money).toBe(1_000_000 - 150_000);
  });

  it('物件の二重購入を防止する', () => {
    let s = createGame(ctx, { seed: 14 });
    s = buyProperty(moveByRoll(s, ctx, 1).state, ctx); // p1 が購入
    const p2 = moveByRoll(s, ctx, 1).state; // p2 が同じ物件へ
    expect(p2.phase).toBe('landed');
    expect(p2.landing?.kind).toBe('property-owned-other');
    // 強制的に購入フェーズにしても拒否される
    expect(() => buyProperty({ ...p2, phase: 'awaitPurchase' }, ctx)).toThrow(GameRuleError);
    expect(p2.ownership.prop_bkk_01).toBe('p1');
  });

  it('他人の物件に止まっても通行料は発生しない', () => {
    let s = createGame(ctx, { seed: 15 });
    s = buyProperty(moveByRoll(s, ctx, 1).state, ctx);
    const before = s.players[1].money;
    const p2 = endAction(moveByRoll(s, ctx, 1).state, ctx);
    expect(p2.players[1].money).toBe(before);
  });

  it('資金不足時は購入できない', () => {
    let s = moveByRoll(createGame(ctx, { seed: 16 }), ctx, 1).state;
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, money: 149_999 } : p)) };
    expect(() => buyProperty(s, ctx)).toThrow(GameRuleError);
    expect(s.ownership.prop_bkk_01).toBeUndefined();
  });

  it('エリア独占で通常収益が20%増える', () => {
    const s = createGame(ctx, { seed: 17 });
    const one = { ...s, ownership: { prop_bkk_01: 'p1' } };
    expect(computeIncome(one, ctx, 'p1')).toBe(15_000);
    const both = { ...s, ownership: { prop_bkk_01: 'p1', prop_bkk_03: 'p1' } };
    expect(computeIncome(both, ctx, 'p1')).toBe(Math.round((15_000 + 20_000) * 1.2));
  });

  it('物件が1件だけのエリア（シーロム）は独占扱いにしない', () => {
    const s = { ...createGame(ctx, { seed: 30 }), ownership: { prop_bkk_08: 'p1' } };
    expect(computeIncome(s, ctx, 'p1')).toBe(32_000);
  });

  it('ターン終了時に収益を一括精算し、二重精算しない', () => {
    let s = createGame(ctx, { seed: 18 });
    s = { ...s, ownership: { prop_bkk_01: 'p2' } };
    const settled = settleIncome(s, ctx, 1);
    expect(settled.players[1].money).toBe(1_000_000 + 15_000);
    const again = settleIncome(settled, ctx, 1);
    expect(again.players[1].money).toBe(1_000_000 + 15_000);
    expect(again).toBe(settled);
  });

  it('ターン進行で毎ターン1回だけ収益が入る', () => {
    let s = createGame(ctx, { seed: 19 });
    s = { ...s, ownership: { prop_bkk_13: 'p3', prop_bkk_12: 'p4' } };
    for (let i = 0; i < 4 * 3; i++) s = playOneAction(s);
    // 3ターン分 + p3 が購入しない前提（購入見送り）
    expect(s.turn).toBe(4);
    expect(s.players[2].money).toBe(1_000_000 + 35_000 * 3);
  });
});

describe('ステータス', () => {
  it('上限100・下限0に収まる', () => {
    const p = createGame(ctx).players[0];
    expect(applyStatDelta(p, { fame: 500 }).fame).toBe(100);
    expect(applyStatDelta(p, { network: -500 }).network).toBe(0);
    expect(applyStatDelta(p, { happiness: 10 }).happiness).toBe(60);
    expect(clampStat(-1)).toBe(BASE_RULES.statMin);
    expect(clampStat(101)).toBe(BASE_RULES.statMax);
  });
});

describe('セーブ・ロード', () => {
  it('保存した状態を完全に復元できる', () => {
    let s = createGame(ctx, { seed: 20 });
    for (let i = 0; i < 9; i++) s = playOneAction(s, { buy: true });
    const storage = createMemoryStorage();
    expect(saveGame(storage, s)).toBe(true);
    expect(loadGame(storage)).toEqual(s);
  });

  it('分岐待ちの途中でも保存・復元でき、同じ結果になる', () => {
    const s = moveByRoll(placeCurrent(createGame(ctx, { seed: 21 }), 'bkk_02'), ctx, 4).state;
    expect(s.phase).toBe('awaitBranch');
    const restored = deserializeGame(serializeGame(s))!;
    expect(chooseBranch(restored, ctx, 'bkk_07')).toEqual(chooseBranch(s, ctx, 'bkk_07'));
  });

  it('ロード後も乱数が同じ（再現性）', () => {
    let s = createGame(ctx, { seed: 22 });
    for (let i = 0; i < 5; i++) s = playOneAction(s);
    const restored = deserializeGame(serializeGame(s))!;
    let a = s;
    let b = restored;
    for (let i = 0; i < 10; i++) {
      a = playOneAction(a, { buy: true });
      b = playOneAction(b, { buy: true });
    }
    expect(b).toEqual(a);
  });

  it('旧形式（v1）のセーブは負債0として読み込める', () => {
    const v2 = createGame(ctx, { seed: 32 });
    const v1 = {
      ...v2,
      saveVersion: 1,
      players: v2.players.map(({ debt: _d, ...rest }) => rest),
      pendingEvent: undefined,
      eventResult: undefined,
    };
    const loaded = deserializeGame(JSON.stringify(v1))!;
    expect(loaded.saveVersion).toBe(2);
    expect(loaded.players.every((p) => p.debt === 0)).toBe(true);
    expect(loaded.pendingEvent).toBeNull();
  });

  it('壊れたデータや旧バージョンは読み込まない', () => {
    expect(deserializeGame('{broken')).toBeNull();
    expect(deserializeGame(JSON.stringify({ ...createGame(ctx), saveVersion: 999 }))).toBeNull();
    expect(loadGame(createMemoryStorage())).toBeNull();
  });
});

describe('最終スコア', () => {
  it('資産60%・名声15%・人脈10%・幸福度15%で計算', () => {
    let s = createGame(ctx, { seed: 23 });
    s = {
      ...s,
      players: [
        { ...s.players[0], money: 2_000_000, fame: 100, network: 100, happiness: 100 },
        { ...s.players[1], money: 1_000_000, fame: 0, network: 0, happiness: 0 },
        { ...s.players[2], money: -500_000, fame: 50, network: 50, happiness: 50 },
        { ...s.players[3], money: 500_000, fame: 30, network: 30, happiness: 40 },
      ],
    };
    const rows = computeScores(s, ctx);
    expect(rows[0].assetPoints).toBe(100);
    expect(rows[0].total).toBe(100);
    expect(rows[1].assetPoints).toBe(50);
    expect(rows[1].total).toBe(30);
    expect(rows[2].assetPoints).toBe(0); // マイナスは0点
    expect(rows[2].total).toBe(20);
    expect(rows[3].total).toBe(25 * 0.6 + 30 * 0.15 + 30 * 0.1 + 40 * 0.15);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 4, 3]);
  });

  it('純資産 = 現金 + 物件購入価格 − 負債', () => {
    let s = { ...createGame(ctx, { seed: 24 }), ownership: { prop_bkk_13: 'p1' } };
    expect(netWorth(s, ctx, 'p1')).toBe(1_350_000);
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, debt: 400_000 } : p)) };
    expect(netWorth(s, ctx, 'p1')).toBe(950_000);
  });

  it('負債で純資産がマイナスなら資産点は0', () => {
    let s = createGame(ctx, { seed: 31 });
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, money: 100_000, debt: 500_000 } : p)) };
    expect(computeScores(s, ctx)[0].assetPoints).toBe(0);
  });

  it('全員純資産0以下でもエラーにならない', () => {
    let s = createGame(ctx);
    s = { ...s, players: s.players.map((p) => ({ ...p, money: 0 })) };
    expect(computeScores(s, ctx).every((r) => r.assetPoints === 0)).toBe(true);
  });
});

describe('AI', () => {
  it('AIだけで最後までプレイできる（イベントあり）', () => {
    const ctx = bangkokContext;
    let s = createGame(ctx, { seed: 25 });
    let guard = 0;
    while (s.phase !== 'gameOver' && guard++ < 1000) {
      if (s.phase === 'awaitRoll') s = rollDice(s, ctx).state;
      else if (s.phase === 'awaitBranch') {
        const c = aiChooseBranch(s, ctx);
        s = chooseBranch({ ...s, rngState: c.rngState }, ctx, c.choice).state;
      } else if (s.phase === 'awaitPurchase') s = aiWantsToBuy(s, ctx) ? buyProperty(s, ctx) : skipPurchase(s, ctx);
      else if (s.phase === 'awaitEvent') {
        const c = aiChooseEventChoice(s, ctx);
        s = resolveChoice({ ...s, rngState: c.rngState }, ctx, c.choiceId);
      } else s = endAction(s, ctx);
    }
    expect(s.phase).toBe('gameOver');
    for (const p of s.players) {
      expect(p.money).toBeGreaterThanOrEqual(0);
      expect(p.debt).toBeGreaterThanOrEqual(0);
    }
  });
});
