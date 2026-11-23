import type { AreaId, GameContext, GameState, PropertyDef } from './types';

export function propertiesOwnedBy(state: GameState, playerId: string): string[] {
  return Object.keys(state.ownership).filter((pid) => state.ownership[pid] === playerId);
}

export function propertiesInArea(ctx: GameContext, area: AreaId): PropertyDef[] {
  return Object.values(ctx.properties).filter((p) => p.area === area);
}

/** エリアの購入可能物件をすべて所有しているか */
export function ownsWholeArea(state: GameState, ctx: GameContext, playerId: string, area: AreaId): boolean {
  const list = propertiesInArea(ctx, area);
  return list.length > 0 && list.every((p) => state.ownership[p.id] === playerId);
}

/** 1ターン分の収益（エリア独占ボーナス込み） */
export function computeIncome(state: GameState, ctx: GameContext, playerId: string): number {
  let total = 0;
  for (const pid of propertiesOwnedBy(state, playerId)) {
    const prop = ctx.properties[pid];
    if (!prop) continue;
    const mult = ownsWholeArea(state, ctx, playerId, prop.area) ? ctx.economy.areaMonopolyMultiplier : 1;
    total += prop.income * mult;
  }
  return Math.round(total);
}

export type PurchaseCheck = { ok: true } | { ok: false; reason: 'owned' | 'funds' | 'not-property' };

export function canBuy(state: GameState, ctx: GameContext, playerId: string, propertyId: string | undefined): PurchaseCheck {
  if (!propertyId || !ctx.properties[propertyId]) return { ok: false, reason: 'not-property' };
  if (state.ownership[propertyId]) return { ok: false, reason: 'owned' };
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.money < ctx.properties[propertyId].price) return { ok: false, reason: 'funds' };
  return { ok: true };
}

/** 純資産 = 現金 + 所有物件の価格 */
export function netWorth(state: GameState, ctx: GameContext, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  return player.money + propertiesOwnedBy(state, playerId).reduce((s, pid) => s + (ctx.properties[pid]?.price ?? 0), 0);
}
