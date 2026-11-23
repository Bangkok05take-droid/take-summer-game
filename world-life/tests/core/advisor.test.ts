import { describe, expect, it } from 'vitest';
import { assetRanking, branchPreview, landingsByRoll, nextGoal, recommendation } from '../../src/core/advisor';
import { aiChooseEvent, aiDecidePurchase, scoreChoice } from '../../src/core/ai/simpleAi';
import { createGame, endAction, moveByRoll, skipPurchase } from '../../src/core/game';
import type { GameState } from '../../src/core/types';
import { AI_PERSONALITIES } from '../../src/data/aiPersonalities';
import { bangkokContext } from '../../src/data/config';

const ctx = bangkokContext;
const noEv = { ...ctx, events: {} };

function at(s: GameState, nodeId: string, idx = s.currentPlayerIndex, patch: Partial<GameState['players'][number]> = {}): GameState {
  return { ...s, currentPlayerIndex: idx, players: s.players.map((p, i) => (i === idx ? { ...p, position: nodeId, ...patch } : p)) };
}

describe('おすすめ・目標', () => {
  it('各サイコロの目で止まるマスを列挙（分岐は両方）', () => {
    const by = landingsByRoll(ctx, 'bkk_00');
    expect(by[1]).toEqual(['bkk_01']);
    expect(by[4].sort()).toEqual(['bkk_04', 'bkk_07']);
  });

  it('サイコロ前：空き物件に止まれる目を案内', () => {
    const h = recommendation(createGame(ctx), ctx)!;
    expect(h.text).toContain('1');
    expect(h.text).toContain('空き物件');
  });

  it('分岐：それぞれの行き先を示し、空き物件側をすすめる', () => {
    const s = moveByRoll(at(createGame(noEv), 'bkk_02'), noEv, 2).state; // 03で分岐、残り1歩
    expect(branchPreview(s, noEv)).toEqual([
      { option: 'bkk_04', landing: 'bkk_04' },
      { option: 'bkk_07', landing: 'bkk_07' },
    ]);
    const h = recommendation(s, noEv)!;
    expect(h.text).toContain('通常ルート');
    expect(h.sub).toContain('高級モール');
  });

  it('購入時：毎ターンの収益と残りターンの見込みを示す', () => {
    const s = moveByRoll(createGame(ctx), ctx, 1).state; // ホテル $150K / +$15K
    const h = recommendation(s, ctx)!;
    expect(h.text).toContain('+$15K');
    expect(h.sub).toContain('残り20ターン');
    expect(h.sub).toContain('+$300K');
    expect(h.sub).toContain('10ターン');
  });

  it('目標：物件なし → 物件を手に入れる／あと1件で独占', () => {
    const s = createGame(ctx);
    expect(nextGoal(s, ctx, 'p1').text).toContain('物件');
    const s2 = { ...s, ownership: { prop_bkk_04: 'p1' } };
    expect(nextGoal(s2, ctx, 'p1').text).toContain('サイアム');
  });

  it('資産順位と変動', () => {
    let s = createGame(noEv, { seed: 3 });
    s = { ...s, players: s.players.map((p, i) => (i === 2 ? { ...p, money: 2_000_000 } : p)) };
    const rows = assetRanking(s, noEv);
    expect(rows[2].rank).toBe(1);
    expect(rows[2].change).toBe(0);
    expect(rows[2].delta).toBe(1_000_000);
    // 1ターン回すと history が増える
    for (let i = 0; i < 4; i++) {
      let st = moveByRoll(s, noEv, 3).state;
      st = st.phase === 'awaitPurchase' ? skipPurchase(st, noEv) : endAction(st, noEv);
      s = st;
    }
    expect(s.history).toHaveLength(2);
  });
});

describe('AIの個性', () => {
  it('レオン（攻め）は資金が少なくても買い、ミラ（慎重）は買わない', () => {
    const base = moveByRoll(createGame(ctx), ctx, 1).state;
    const leon = at(base, 'bkk_01', 1, { money: 250_000 });
    const mira = at(base, 'bkk_01', 2, { money: 250_000 });
    expect(aiDecidePurchase(leon, ctx).buy).toBe(true);
    expect(aiDecidePurchase(mira, ctx).buy).toBe(false);
  });

  it('レオンはミラより買収を仕掛けやすい', () => {
    let leonBuys = 0;
    let miraBuys = 0;
    for (let seed = 0; seed < 200; seed++) {
      const s = { ...moveByRoll(createGame(ctx, { seed }), ctx, 1).state, ownership: { prop_bkk_01: 'p1' } };
      if (aiDecidePurchase(at(s, 'bkk_01', 1), ctx).buy) leonBuys++;
      if (aiDecidePurchase(at(s, 'bkk_01', 2), ctx).buy) miraBuys++;
    }
    expect(leonBuys).toBeGreaterThan(miraBuys * 2);
  });

  it('価値観で選択肢の評価が変わる（ミラは名声、カイはリスク）', () => {
    const fame = { id: 'a', label: '', outcomes: [{ weight: 1, text: '', effect: { fame: 10 } }] };
    const gamble = { id: 'b', label: '', outcomes: [{ weight: 1, text: '', effect: { money: 300_000 } }, { weight: 1, text: '', effect: { money: -300_000 } }] };
    expect(scoreChoice(fame, AI_PERSONALITIES.p3)).toBeGreaterThan(scoreChoice(gamble, AI_PERSONALITIES.p3));
    expect(scoreChoice(gamble, AI_PERSONALITIES.p4)).toBeGreaterThan(scoreChoice(gamble, AI_PERSONALITIES.p3));
  });

  it('AIのイベント選択は常に選べる選択肢', () => {
    for (let seed = 0; seed < 100; seed++) {
      const s0 = moveByRoll(at(createGame(ctx, { seed }), 'bkk_14', 3, { money: 40_000 }), ctx, 1).state;
      const c = aiChooseEvent(s0, ctx);
      const ch = ctx.events[s0.pendingEvent!.eventId].choices.find((x) => x.id === c.choiceId)!;
      expect(ch.requiresMoney === undefined || ch.requiresMoney <= 40_000).toBe(true);
    }
  });
});
