// ゲームルールの型定義（描画・UIに依存しない）

export type AreaId = 'sukhumvit' | 'siam' | 'silom' | 'riverside';

export type NodeType =
  | 'start'
  | 'property'
  | 'social'
  | 'romance'
  | 'fate'
  | 'vip'
  | 'business'
  | 'scandal'
  | 'party'
  | 'bigfate';

export interface MapNode {
  id: string;
  area: AreaId;
  type: NodeType;
  label: string;
  /** マップ画像上の座標（ワールド座標） */
  pos: { x: number; y: number };
  /** 次に進めるノード。2つ以上なら分岐（先頭が通常ルート） */
  next: string[];
  propertyId?: string;
}

export interface AreaDef {
  id: AreaId;
  name: string;
  color: number;
}

export interface CityMap {
  id: string;
  name: string;
  startNodeId: string;
  /** ワールドの大きさ */
  size: { width: number; height: number };
  areas: Record<AreaId, AreaDef>;
  nodes: Record<string, MapNode>;
}

export interface PropertyDef {
  id: string;
  nodeId: string;
  area: AreaId;
  name: string;
  price: number;
  /** 1ターンごとの通常収益 */
  income: number;
}

export interface EconomyRules {
  /** エリア独占時の収益倍率（1.2 = +20%） */
  areaMonopolyMultiplier: number;
}

/** ゲームが参照する静的データ一式 */
export interface GameContext {
  map: CityMap;
  properties: Record<string, PropertyDef>;
  economy: EconomyRules;
}

export type StatKey = 'fame' | 'network' | 'happiness';

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  color: number;
  money: number;
  fame: number;
  network: number;
  happiness: number;
  position: string;
}

export type Phase =
  | 'awaitRoll'
  | 'awaitBranch'
  | 'awaitPurchase'
  | 'landed'
  | 'gameOver';

export interface LandingInfo {
  nodeId: string;
  kind: 'property-available' | 'property-owned-self' | 'property-owned-other' | 'event' | 'start';
  ownerId?: string;
}

export interface GameState {
  saveVersion: number;
  cityId: string;
  seed: number;
  rngState: number;
  /** 1始まり。gameOver時は maxTurns のまま */
  turn: number;
  maxTurns: number;
  currentPlayerIndex: number;
  players: Player[];
  /** propertyId -> playerId */
  ownership: Record<string, string>;
  phase: Phase;
  lastRoll: number | null;
  stepsRemaining: number;
  branchOptions: string[];
  landing: LandingInfo | null;
  /** 最後に収益精算を行ったターン（二重精算防止） */
  lastSettledTurn: number;
  /** 通算の行動確定数（セーブ整合性チェック用） */
  actionCount: number;
  log: string[];
}

export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameRuleError';
  }
}
