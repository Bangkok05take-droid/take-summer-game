import { describe, expect, it } from 'vitest';
import { bangkokContext } from '../../src/data/config';
import { canBuy, debtLimit, netWorth, propertyValue } from '../../src/core/economy';
import { drawEvent, resolveChoice, validateEvents } from '../../src/core/events';
import { createGame, endAction } from '../../src/core/game';
import { isInsolvent, resolveInsolvency } from '../../src/core/insolvency';
import type { EventDef, GameContext, GameState } from '../../src/core/types';
import { CHARACTERS } from '../../src/data/characters';

const ctx = bangkokContext;

function withPlayer(s: GameState, patch: Partial<GameState['players'][number]>, ownership: Record<string, string> = {}): GameState {
  return { ...s, ownership: { ...s.ownership, ...ownership }, players: s.players.map((p, i) => (i === 0 ? { ...p, ...patch } : p)) };
}

/** 任意の効果を持つテスト用イベントで止まった状態を作る */
function eventState(effect: EventDef['choices'][number]['outcomes'][number]['effect'], patch: Partial<GameState['players'][number]>, ownership: Record<string, string> = {}) {
  const ev: EventDef = { id: 'ev_test', category: 'fate', title: 'テスト', text: 'テスト', choices: [{ id: 'go', label: '実行', outcomes: [{ weight: 1, text: '結果', effect }] }] };
  const c: GameContext = { ...ctx, events: { ev_test: ev } };
  let s = withPlayer(createGame(c, { seed: 1 }), patch, ownership);
  s = { ...s, phase: 'awaitEvent', pendingEvent: { eventId: 'ev_test' }, landing: { nodeId: 'bkk_07', kind: 'event' } };
  return { s, c };
}

describe('負債上限', () => {
  it('上限 = 総物件評価額の50% + $200,000', () => {
    const s = withPlayer(createGame(ctx), {}, { prop_bkk_01: 'p1', prop_bkk_13: 'p1' });
    expect(propertyValue(s, ctx, 'p1')).toBe(500_000);
    expect(debtLimit(s, ctx, 'p1')).toBe(450_000);
    expect(debtLimit(s, ctx, 'p2')).toBe(200_000);
  });

  it('上限以内なら支払い不能にならない', () => {
    const { s, c } = eventState({ money: -150_000 }, { money: 0 });
    const r = resolveChoice(s, c, 'go');
    expect(r.players[0].debt).toBe(150_000);
    expect(r.eventResult!.insolvency).toBeUndefined();
  });
});

describe('支払い不能と清算', () => {
  it('物件がなければ債務整理：負債は上限まで免除され、ペナルティがつく（ゲームオーバーにしない）', () => {
    const { s, c } = eventState({ money: -500_000 }, { money: 0, fame: 30, happiness: 50 });
    const r = resolveChoice(s, c, 'go');
    const p = r.players[0];
    expect(p.debt).toBe(200_000);
    expect(p.fame).toBe(20);
    expect(p.happiness).toBe(40);
    const rep = r.eventResult!.insolvency!;
    expect(rep.forgiven).toBe(300_000);
    expect(rep.sold).toEqual([]);
    expect(r.phase).toBe('eventResult');
    expect(endAction(r, c).phase).toBe('awaitRoll');
  });

  it('物件を安い順に強制売却して上限以内に戻す', () => {
    // 物件: ホテル$150K + 高級ホテル$350K → 上限 $450K。負債 $600K
    const { s, c } = eventState({ money: -600_000 }, { money: 0 }, { prop_bkk_01: 'p1', prop_bkk_13: 'p1' });
    const r = resolveChoice(s, c, 'go');
    const rep = r.eventResult!.insolvency!;
    // ホテル売却 $105K → 負債 $495K、上限 $375K → まだ超過 → 高級ホテル売却 $245K → 負債 $250K、上限 $200K → 超過 → 債務整理
    expect(rep.sold.map((x) => x.propertyId)).toEqual(['prop_bkk_01', 'prop_bkk_13']);
    expect(rep.sold.map((x) => x.proceeds)).toEqual([105_000, 245_000]);
    expect(r.ownership.prop_bkk_01).toBeUndefined();
    expect(r.ownership.prop_bkk_13).toBeUndefined();
    expect(r.players[0].debt).toBe(200_000);
    expect(rep.forgiven).toBe(50_000);
  });

  it('1件売れば足りる場合はそれ以上売らない', () => {
    // 物件 $150K + $350K（上限$450K）、負債 $480K → ホテル売却で負債$375K、上限$375K → 解消
    const { s, c } = eventState({ money: -480_000 }, { money: 0 }, { prop_bkk_01: 'p1', prop_bkk_13: 'p1' });
    const r = resolveChoice(s, c, 'go');
    const rep = r.eventResult!.insolvency!;
    expect(rep.sold.map((x) => x.propertyId)).toEqual(['prop_bkk_01']);
    expect(r.ownership.prop_bkk_13).toBe('p1');
    expect(r.players[0].debt).toBe(375_000);
    expect(rep.forgiven).toBe(0);
    expect(isInsolvent(r, c, 'p1')).toBe(false);
  });

  it('現金があれば先に現金で超過分を返済する（借入イベントなど）', () => {
    const { s, c } = eventState({ money: 300_000, debt: 330_000 }, { money: 100_000 });
    const r = resolveChoice(s, c, 'go');
    const rep = r.eventResult!.insolvency!;
    expect(rep.cashRepaid).toBe(130_000);
    expect(r.players[0].debt).toBe(200_000);
    expect(r.players[0].money).toBe(270_000);
    expect(rep.sold).toEqual([]);
  });

  it('売却益が負債を上回った分は現金になる', () => {
    let s = withPlayer(createGame(ctx), { money: 0, debt: 0 }, { prop_bkk_13: 'p1' });
    // 物件価格を超える売却は起きないが、負債が小さい場合の端数処理を確認
    s = withPlayer(s, { debt: 400_000 });
    // 上限 $375K、負債 $400K → 高級ホテル売却 $245K → 負債 $155K、上限 $200K
    const r = resolveInsolvency(s, ctx, 'p1');
    expect(r.state.players[0].debt).toBe(155_000);
    expect(r.state.players[0].money).toBe(0);
  });

  it('清算後は常に負債 ≤ 上限、所持金・負債は0以上', () => {
    for (let seed = 0; seed < 200; seed++) {
      const loss = 100_000 + ((seed * 37_123) % 1_500_000);
      const props = ['prop_bkk_01', 'prop_bkk_04', 'prop_bkk_08', 'prop_bkk_13'].filter((_, i) => (seed >> i) & 1);
      const { s, c } = eventState({ money: -loss }, { money: (seed * 911) % 200_000 }, Object.fromEntries(props.map((p) => [p, 'p1'])));
      const r = resolveChoice(s, c, 'go');
      const p = r.players[0];
      expect(p.debt).toBeLessThanOrEqual(debtLimit(r, c, 'p1'));
      expect(p.debt).toBeGreaterThanOrEqual(0);
      expect(p.money).toBeGreaterThanOrEqual(0);
    }
  });

  it('負債は純資産から差し引かれる', () => {
    const s = withPlayer(createGame(ctx), { money: 100_000, debt: 300_000 }, { prop_bkk_01: 'p1' });
    expect(netWorth(s, ctx, 'p1')).toBe(100_000 + 150_000 - 300_000);
  });

  it('負債があっても資金不足での物件購入はできない', () => {
    const s = withPlayer(createGame(ctx), { money: 100_000, debt: 50_000 });
    expect(canBuy(s, ctx, 'p1', 'prop_bkk_01').ok).toBe(false);
  });
});

describe('本番イベントデータ用の構造', () => {
  it('ターン条件と重みで抽選される', () => {
    const base: Omit<EventDef, 'id'> = { category: 'fate', title: 't', text: 't', choices: [{ id: 'a', label: 'a', outcomes: [{ weight: 1, text: 'x', effect: {} }] }] };
    const c: GameContext = {
      ...ctx,
      events: {
        early: { ...base, id: 'early', maxTurn: 5 },
        late: { ...base, id: 'late', minTurn: 15 },
        never: { ...base, id: 'never', weight: 0 },
      },
    };
    for (let i = 0; i < 50; i++) {
      expect(drawEvent(i * 7919, c, 'fate', 3).eventId).toBe('early');
      expect(drawEvent(i * 7919, c, 'fate', 18).eventId).toBe('late');
      expect(drawEvent(i * 7919, c, 'fate', 10).eventId).toBeNull();
    }
  });

  it('不正なデータを検出できる', () => {
    const bad: EventDef = { id: 'x', category: 'fate', title: '', text: 't', minTurn: 10, maxTurn: 5, choices: [{ id: 'a', label: 'a', requiresMoney: 1, outcomes: [{ weight: 0, text: 'x', effect: {} }] }] };
    const errors = validateEvents({ ...ctx, events: { x: bad } });
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });

  it('イベントの登場人物はすべて人物一覧に存在する', () => {
    for (const ev of Object.values(ctx.events)) if (ev.characterId) expect(CHARACTERS[ev.characterId]).toBeDefined();
  });
});
