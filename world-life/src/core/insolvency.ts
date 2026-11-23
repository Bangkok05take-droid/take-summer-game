// 支払い不能（負債上限超過）の清算。ゲームオーバーにはしない（指令 No.004）。
// 手順: ①手持ち現金で超過分を返済 → ②物件を安い順に強制売却 → ③それでも超過なら債務整理（超過分免除＋ペナルティ）
import { debtLimit, propertiesOwnedBy } from './economy';
import { clampStat } from './stats';
import type { GameContext, GameState, InsolvencyReport, Player } from './types';

export function isInsolvent(state: GameState, ctx: GameContext, playerId: string): boolean {
  const p = state.players.find((x) => x.id === playerId);
  return !!p && p.debt > debtLimit(state, ctx, playerId);
}

export function resolveInsolvency(state: GameState, ctx: GameContext, playerId: string): { state: GameState; report: InsolvencyReport | null } {
  if (!isInsolvent(state, ctx, playerId)) return { state, report: null };
  let st = state;
  const get = (): Player => st.players.find((p) => p.id === playerId)!;
  const put = (p: Player) => {
    st = { ...st, players: st.players.map((x) => (x.id === playerId ? p : x)) };
  };

  const before = get();
  const report: InsolvencyReport = {
    debtBefore: before.debt,
    limitBefore: debtLimit(st, ctx, playerId),
    cashRepaid: 0,
    sold: [],
    forgiven: 0,
    penalty: { fame: 0, happiness: 0 },
    debtAfter: 0,
    limitAfter: 0,
  };

  // ① 現金で返済
  {
    const p = get();
    const pay = Math.min(p.money, p.debt - debtLimit(st, ctx, playerId));
    if (pay > 0) {
      put({ ...p, money: p.money - pay, debt: p.debt - pay });
      report.cashRepaid = pay;
    }
  }

  // ② 物件の強制売却（購入価格の安い順）
  const owned = propertiesOwnedBy(st, playerId).sort((a, b) => ctx.properties[a].price - ctx.properties[b].price);
  for (const pid of owned) {
    if (!isInsolvent(st, ctx, playerId)) break;
    const proceeds = Math.round(ctx.properties[pid].price * ctx.economy.forcedSaleRatio);
    const ownership = { ...st.ownership };
    delete ownership[pid];
    st = { ...st, ownership };
    const p = get();
    const debt = p.debt - proceeds;
    put({ ...p, debt: Math.max(0, debt), money: p.money + Math.max(0, -debt) });
    report.sold.push({ propertyId: pid, proceeds });
  }

  // ③ 債務整理
  if (isInsolvent(st, ctx, playerId)) {
    const p = get();
    const limit = debtLimit(st, ctx, playerId);
    const pen = ctx.economy.restructurePenalty;
    const fame = clampStat(p.fame + pen.fame);
    const happiness = clampStat(p.happiness + pen.happiness);
    report.forgiven = p.debt - limit;
    report.penalty = { fame: fame - p.fame, happiness: happiness - p.happiness };
    put({ ...p, debt: limit, fame, happiness });
  }

  report.debtAfter = get().debt;
  report.limitAfter = debtLimit(st, ctx, playerId);
  const names = report.sold.map((s) => ctx.properties[s.propertyId].name).join('、');
  const msg = `${before.name} 支払い不能！${names ? ` 強制売却：${names}` : ''}${report.forgiven ? ' 債務整理' : ''}`;
  st = { ...st, log: [...st.log, msg].slice(-40) };
  return { state: st, report };
}
