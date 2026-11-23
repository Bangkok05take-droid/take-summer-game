import { BASE_RULES } from '../data/config';
import type { Player, StatKey } from './types';

export function clampStat(v: number): number {
  return Math.max(BASE_RULES.statMin, Math.min(BASE_RULES.statMax, Math.round(v)));
}

/** ステータス変化を適用（0〜100に丸める） */
export function applyStatDelta(player: Player, delta: Partial<Record<StatKey, number>>): Player {
  const next = { ...player };
  for (const key of Object.keys(delta) as StatKey[]) {
    next[key] = clampStat(player[key] + (delta[key] ?? 0));
  }
  return next;
}
