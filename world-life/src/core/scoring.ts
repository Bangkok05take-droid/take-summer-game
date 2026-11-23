import { SCORE_WEIGHTS } from '../data/config';
import { netWorth } from './economy';
import type { GameContext, GameState } from './types';

export interface ScoreRow {
  playerId: string;
  name: string;
  netWorth: number;
  assetPoints: number;
  fame: number;
  network: number;
  happiness: number;
  total: number;
  rank: number;
}

/** 最終スコア：資産点60% + 名声15% + 人脈10% + 幸福度15%（0〜100点） */
export function computeScores(state: GameState, ctx: GameContext): ScoreRow[] {
  const worths = state.players.map((p) => netWorth(state, ctx, p.id));
  const best = Math.max(...worths);
  const rows = state.players.map((p, i) => {
    const nw = worths[i];
    const assetPoints = best > 0 && nw > 0 ? (nw / best) * 100 : 0;
    const total =
      assetPoints * SCORE_WEIGHTS.asset +
      p.fame * SCORE_WEIGHTS.fame +
      p.network * SCORE_WEIGHTS.network +
      p.happiness * SCORE_WEIGHTS.happiness;
    return {
      playerId: p.id,
      name: p.name,
      netWorth: nw,
      assetPoints: Math.round(assetPoints * 100) / 100,
      fame: p.fame,
      network: p.network,
      happiness: p.happiness,
      total: Math.round(total * 100) / 100,
      rank: 0,
    };
  });
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  for (const r of rows) r.rank = sorted.findIndex((s) => s.total === r.total) + 1;
  return rows;
}
