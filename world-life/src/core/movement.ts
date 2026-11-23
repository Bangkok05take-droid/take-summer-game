import type { CityMap } from './types';
import { GameRuleError } from './types';

export interface WalkResult {
  /** 通過・停止したノード（出発点は含まない） */
  path: string[];
  position: string;
  stepsRemaining: number;
  /** 分岐で停止した場合の選択肢（空なら移動完了） */
  branchOptions: string[];
}

/**
 * from から steps 歩進む。分岐ノード上で歩数が残っていれば、そこで停止して選択肢を返す。
 * firstStep を渡すと、最初の1歩をそのノードへ進める（分岐選択用）。
 */
export function walk(map: CityMap, from: string, steps: number, firstStep?: string): WalkResult {
  if (!map.nodes[from]) throw new GameRuleError(`不明なノード: ${from}`);
  const path: string[] = [];
  let pos = from;
  let remaining = steps;
  let forced = firstStep;
  while (remaining > 0) {
    const node = map.nodes[pos];
    let target: string;
    if (forced !== undefined) {
      if (!node.next.includes(forced)) throw new GameRuleError(`${pos} から ${forced} へは進めません`);
      target = forced;
      forced = undefined;
    } else if (node.next.length > 1) {
      return { path, position: pos, stepsRemaining: remaining, branchOptions: [...node.next] };
    } else {
      target = node.next[0];
    }
    pos = target;
    path.push(pos);
    remaining -= 1;
  }
  return { path, position: pos, stepsRemaining: 0, branchOptions: [] };
}

/** 開始ノードから到達可能なノード一覧（グラフ検証用） */
export function reachableNodes(map: CityMap, from = map.startNodeId): Set<string> {
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length) {
    const id = queue.shift()!;
    for (const n of map.nodes[id].next) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}
