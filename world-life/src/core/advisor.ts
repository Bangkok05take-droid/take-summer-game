// プレイヤーが迷わないための「次の目標」「今おすすめの行動」（純粋関数）
import { buyoutPrice, canBuy, canBuyout, computeIncome, netWorth, ownsWholeArea, propertiesInArea } from './economy';
import { currentPlayer } from './game';
import { walk } from './movement';
import { computeScores } from './scoring';
import type { GameContext, GameState, MapNode } from './types';

export interface Hint {
  /** 短い見出し */
  text: string;
  /** 補足（省略可） */
  sub?: string;
  tone: 'goal' | 'tip' | 'good' | 'warn';
}

function describeNode(state: GameState, _ctx: GameContext, node: MapNode, playerId: string): { label: string; kind: 'free' | 'rival' | 'own' | 'event' | 'start' } {
  const pid = node.propertyId;
  if (pid) {
    const owner = state.ownership[pid];
    if (!owner) return { label: `${node.label}（空き物件）`, kind: 'free' };
    if (owner === playerId) return { label: `${node.label}（自分の物件）`, kind: 'own' };
    return { label: `${node.label}（ライバル物件）`, kind: 'rival' };
  }
  if (node.type === 'start') return { label: node.label, kind: 'start' };
  return { label: node.label, kind: 'event' };
}

/** 各サイコロの目で止まりうるマス（分岐は両方） */
export function landingsByRoll(ctx: GameContext, from: string): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  for (let roll = 1; roll <= 6; roll++) {
    const ends = new Set<string>();
    const go = (pos: string, steps: number, first?: string) => {
      const w = walk(ctx.map, pos, steps, first);
      if (w.branchOptions.length) w.branchOptions.forEach((b) => go(w.position, w.stepsRemaining, b));
      else ends.add(w.position);
    };
    go(from, roll);
    out[roll] = [...ends];
  }
  return out;
}

/** 分岐の各選択肢で最終的に止まるマス */
export function branchPreview(state: GameState, ctx: GameContext): { option: string; landing: string }[] {
  const me = currentPlayer(state);
  return state.branchOptions.map((option) => {
    let w = walk(ctx.map, me.position, state.stepsRemaining, option);
    // 先にさらに分岐がある場合は通常ルートで見積もる
    while (w.branchOptions.length) w = walk(ctx.map, w.position, w.stepsRemaining, w.branchOptions[0]);
    return { option, landing: w.position };
  });
}

/** 次の目標（常に1つ） */
export function nextGoal(state: GameState, ctx: GameContext, playerId: string): Hint {
  const me = state.players.find((p) => p.id === playerId)!;
  const owned = Object.keys(state.ownership).filter((k) => state.ownership[k] === playerId);
  if (owned.length === 0) return { text: '目標：物件を1件手に入れよう', sub: '物件は毎ターン収益を生む。早く買うほど得', tone: 'goal' };
  // あと1件でエリア独占
  for (const areaId of Object.keys(ctx.map.areas) as (keyof typeof ctx.map.areas)[]) {
    const list = propertiesInArea(ctx, areaId);
    if (list.length < ctx.economy.monopolyMinProperties || ownsWholeArea(state, ctx, playerId, areaId)) continue;
    const mine = list.filter((p) => state.ownership[p.id] === playerId);
    const missing = list.filter((p) => state.ownership[p.id] !== playerId);
    if (mine.length > 0 && missing.length === 1) {
      return { text: `目標：あと1件で${ctx.map.areas[areaId].name}を独占！`, sub: `${ctx.map.nodes[missing[0].nodeId].label}を手に入れると収益+20%`, tone: 'goal' };
    }
  }
  const scores = computeScores(state, ctx).sort((a, b) => b.total - a.total);
  const mine = scores.find((s) => s.playerId === me.id)!;
  if (scores[0].playerId === me.id) {
    const second = scores[1];
    return { text: `首位をキープ！ 2位${second.name}と${(mine.total - second.total).toFixed(1)}点差`, sub: '物件と名声・人脈・幸福度をバランスよく', tone: 'good' };
  }
  const top = scores[0];
  return { text: `目標：1位 ${top.name} まであと${(top.total - mine.total).toFixed(1)}点`, sub: '物件の買収や大きなイベントで逆転を狙おう', tone: 'goal' };
}

/** 今おすすめの行動（フェーズ別） */
export function recommendation(state: GameState, ctx: GameContext): Hint | null {
  const me = currentPlayer(state);
  const remainingTurns = state.maxTurns - state.turn + 1;
  switch (state.phase) {
    case 'awaitRoll': {
      const by = landingsByRoll(ctx, me.position);
      const freeRolls: number[] = [];
      const rivalRolls: number[] = [];
      for (let r = 1; r <= 6; r++) {
        const kinds = by[r].map((id) => describeNode(state, ctx, ctx.map.nodes[id], me.id).kind);
        if (kinds.includes('free')) freeRolls.push(r);
        else if (kinds.includes('rival')) rivalRolls.push(r);
      }
      if (freeRolls.length) return { text: `${freeRolls.join('・')} が出れば空き物件！`, sub: 'サイコロを振ろう', tone: 'tip' };
      if (rivalRolls.length) return { text: `${rivalRolls.join('・')} でライバル物件。買収のチャンス`, sub: 'サイコロを振ろう', tone: 'tip' };
      return { text: 'サイコロを振ろう', sub: 'イベントで名声・人脈・幸福度を伸ばすチャンス', tone: 'tip' };
    }
    case 'awaitBranch': {
      const prev = branchPreview(state, ctx);
      const desc = prev.map((p, i) => ({ ...p, i, d: describeNode(state, ctx, ctx.map.nodes[p.landing], me.id) }));
      const rank = (k: string) => (k === 'free' ? 3 : k === 'rival' ? 2 : k === 'event' ? 1 : 0);
      const best = [...desc].sort((a, b) => rank(b.d.kind) - rank(a.d.kind))[0];
      return {
        text: `おすすめ：${best.i === 0 ? '通常ルート' : '近道'}`,
        sub: desc.map((d) => `${d.i === 0 ? '通常' : '近道'}→${d.d.label}`).join(' ／ '),
        tone: 'tip',
      };
    }
    case 'awaitPurchase': {
      const pid = ctx.map.nodes[me.position].propertyId!;
      const prop = ctx.properties[pid];
      const owner = state.ownership[pid];
      // 購入後の収益（独占ボーナス込み）
      const after = { ...state, ownership: { ...state.ownership, [pid]: me.id } };
      const gain = computeIncome(after, ctx, me.id) - computeIncome(state, ctx, me.id);
      if (owner) {
        const ownerName = state.players.find((p) => p.id === owner)?.name ?? '';
        const check = canBuyout(state, ctx, me.id, pid);
        if (!check.ok) return { text: '買収資金が足りない', sub: `買収には ${fmt(buyoutPrice(state, ctx, pid))} 必要`, tone: 'warn' };
        return {
          text: `買収で${ownerName}から奪える！ 毎ターン+${fmt(gain)}`,
          sub: `代金 ${fmt(check.price)} は${ownerName}へ。残り${remainingTurns}ターンで+${fmt(gain * remainingTurns)}見込み`,
          tone: 'tip',
        };
      }
      if (!canBuy(state, ctx, me.id, pid).ok) return { text: '資金が足りない', sub: 'イベントや収益で資金を増やそう', tone: 'warn' };
      const payback = Math.ceil(prop.price / Math.max(1, gain));
      return {
        text: `おすすめ：購入！ 毎ターン+${fmt(gain)}`,
        sub: `残り${remainingTurns}ターンで+${fmt(gain * remainingTurns)}見込み（${payback}ターンで元が取れる）`,
        tone: payback <= remainingTurns ? 'good' : 'warn',
      };
    }
    default:
      return null;
  }
}

/** 純資産の順位と前ターンからの変動 */
export interface RankRow {
  playerId: string;
  netWorth: number;
  rank: number;
  /** 前ターン比の順位変動（+は上昇） */
  change: number;
  /** 前ターン比の純資産変化 */
  delta: number;
}

export function assetRanking(state: GameState, ctx: GameContext): RankRow[] {
  const now = state.players.map((p) => netWorth(state, ctx, p.id));
  const hist = state.history ?? [];
  const prev = hist.length >= 2 ? hist[hist.length - 2] : hist[0] ?? now;
  const last = hist.length ? hist[hist.length - 1] : now;
  // ターン途中は「直近の精算時点」と比べる
  const base = state.lastSettledTurn === state.turn ? prev : last;
  const rankOf = (vals: number[], i: number) => vals.filter((v) => v > vals[i]).length + 1;
  return state.players.map((p, i) => ({
    playerId: p.id,
    netWorth: now[i],
    rank: rankOf(now, i),
    change: rankOf(base, i) - rankOf(now, i),
    delta: now[i] - base[i],
  }));
}

function fmt(v: number): string {
  const a = Math.abs(v);
  return a >= 1_000_000 ? `$${(a / 1_000_000).toFixed(2)}M` : `$${Math.round(a / 1000)}K`;
}
