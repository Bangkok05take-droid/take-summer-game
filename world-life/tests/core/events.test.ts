import { describe, expect, it } from 'vitest';
import { bangkokContext as ctx } from '../../src/data/config';
import { aiChooseEventChoice, applyEffect, canChoose, resolveChoice, validateEvents } from '../../src/core/events';
import { createGame, currentPlayer, endAction, moveByRoll } from '../../src/core/game';
import { deserializeGame, serializeGame } from '../../src/core/save';
import { GameRuleError, type GameState } from '../../src/core/types';

function at(s: GameState, nodeId: string): GameState {
  return { ...s, players: s.players.map((p, i) => (i === s.currentPlayerIndex ? { ...p, position: nodeId } : p)) };
}

describe('イベントデータ', () => {
  it('データが正しく、全イベントマスにイベントがある', () => {
    expect(validateEvents(ctx)).toEqual([]);
  });
});

describe('イベント進行', () => {
  it('イベントマスに止まると選択待ちになる', () => {
    const s = moveByRoll(createGame(ctx, { seed: 1 }), ctx, 2).state; // 02 ルーフトップバー（社交）
    expect(s.phase).toBe('awaitEvent');
    expect(ctx.events[s.pendingEvent!.eventId].category).toBe('social');
  });

  it('START・物件マスではイベントが起きない', () => {
    const s = moveByRoll(createGame(ctx, { seed: 2 }), ctx, 1).state;
    expect(s.phase).toBe('awaitPurchase');
    expect(s.pendingEvent).toBeNull();
  });

  it('選択すると結果が適用され、手番終了でクリアされる', () => {
    let s = moveByRoll(at(createGame(ctx, { seed: 3 }), 'bkk_13'), ctx, 1).state; // 14 パーティー
    expect(s.phase).toBe('awaitEvent');
    const ev = ctx.events[s.pendingEvent!.eventId];
    const choice = ev.choices.find((c) => c.requiresMoney === undefined)!;
    const before = currentPlayer(s);
    s = resolveChoice(s, ctx, choice.id);
    expect(s.phase).toBe('eventResult');
    const r = s.eventResult!;
    const after = currentPlayer(s);
    expect(after.happiness - before.happiness).toBe(r.applied.happiness);
    expect(after.network - before.network).toBe(r.applied.network);
    s = endAction(s, ctx);
    expect(s.pendingEvent).toBeNull();
    expect(s.eventResult).toBeNull();
    expect(s.currentPlayerIndex).toBe(1);
  });

  it('所持金不足の選択肢は選べない', () => {
    let s = moveByRoll(at(createGame(ctx, { seed: 4 }), 'bkk_14'), ctx, 1).state; // 15 大勝負
    s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, money: 10_000 } : p)) };
    const ev = ctx.events[s.pendingEvent!.eventId];
    const expensive = ev.choices.find((c) => (c.requiresMoney ?? 0) > 10_000)!;
    expect(canChoose(currentPlayer(s), expensive)).toBe(false);
    expect(() => resolveChoice(s, ctx, expensive.id)).toThrow(GameRuleError);
  });

  it('選択待ち中にほかの操作はできない', () => {
    const s = moveByRoll(createGame(ctx, { seed: 5 }), ctx, 2).state;
    expect(() => endAction(s, ctx)).toThrow(GameRuleError);
  });

  it('イベント選択待ちのままセーブ・ロードしても同じ結果になる', () => {
    const s = moveByRoll(createGame(ctx, { seed: 6 }), ctx, 2).state;
    const restored = deserializeGame(serializeGame(s))!;
    const choice = ctx.events[s.pendingEvent!.eventId].choices[1].id;
    expect(resolveChoice(restored, ctx, choice)).toEqual(resolveChoice(s, ctx, choice));
  });

  it('AIは選べる選択肢だけを選ぶ', () => {
    for (let seed = 0; seed < 50; seed++) {
      let s = moveByRoll(at(createGame(ctx, { seed }), 'bkk_14'), ctx, 1).state;
      s = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, money: 60_000 } : p)) };
      const c = aiChooseEventChoice(s, ctx);
      const choice = ctx.events[s.pendingEvent!.eventId].choices.find((x) => x.id === c.choiceId)!;
      expect(canChoose(currentPlayer(s), choice)).toBe(true);
    }
  });
});

describe('効果の適用', () => {
  const base = createGame(ctx).players[0];

  it('ステータスは0〜100に収まる', () => {
    const r = applyEffect({ ...base, fame: 95 }, { fame: 20, happiness: -100 });
    expect(r.player.fame).toBe(100);
    expect(r.player.happiness).toBe(0);
    expect(r.applied.fame).toBe(5);
    expect(r.applied.happiness).toBe(-50);
  });

  it('所持金が足りない支払いは不足分が負債になる', () => {
    const r = applyEffect({ ...base, money: 50_000 }, { money: -80_000 });
    expect(r.player.money).toBe(0);
    expect(r.player.debt).toBe(30_000);
  });

  it('負債は0未満にならない', () => {
    const r = applyEffect({ ...base, debt: 10_000 }, { debt: -50_000 });
    expect(r.player.debt).toBe(0);
  });
});
