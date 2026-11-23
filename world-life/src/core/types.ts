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
  /** 独占ボーナスが成立するエリア内物件数の下限（1件のみのエリアは独占扱いしない） */
  monopolyMinProperties: number;
  /** 負債上限 = 所有物件評価額 × この割合 + debtLimitBase */
  debtLimitPropertyRatio: number;
  debtLimitBase: number;
  /** 強制売却時の売却額（購入価格に対する割合） */
  forcedSaleRatio: number;
  /** 物件を売り尽くしても上限を超える場合の債務整理ペナルティ */
  restructurePenalty: { fame: number; happiness: number };
}

/** ゲームが参照する静的データ一式 */
export interface GameContext {
  map: CityMap;
  properties: Record<string, PropertyDef>;
  economy: EconomyRules;
  events: Record<string, EventDef>;
}

// ---------- イベント ----------
export type EventCategory = 'social' | 'romance' | 'fate' | 'vip' | 'business' | 'scandal' | 'party' | 'bigfate';

/** イベントの効果（正負の増減値） */
export interface EventEffect {
  money?: number;
  fame?: number;
  network?: number;
  happiness?: number;
  /** 負債の増減 */
  debt?: number;
}

export interface EventOutcome {
  /** 抽選の重み */
  weight: number;
  text: string;
  effect: EventEffect;
}

export interface EventChoice {
  id: string;
  label: string;
  /** 選択に必要な所持金（不足なら選べない） */
  requiresMoney?: number;
  /** AIがこの選択肢を選ぶ重み（省略時1） */
  aiWeight?: number;
  outcomes: EventOutcome[];
}

export interface EventDef {
  id: string;
  category: EventCategory;
  title: string;
  text: string;
  /** 登場人物（素材ID: character.<id>.cutin） */
  characterId?: string;
  choices: EventChoice[];
  /** 抽選の出やすさ（省略時1） */
  weight?: number;
  /** 発生するターン範囲（省略時は全ターン） */
  minTurn?: number;
  maxTurn?: number;
  /** 仮データ（本部の本番データ待ち） */
  placeholder?: boolean;
}

export interface PendingEvent {
  eventId: string;
}

export interface EventResult {
  eventId: string;
  choiceId: string;
  outcomeIndex: number;
  text: string;
  /** 実際に適用された差分（上下限で丸めた後） */
  applied: Required<EventEffect>;
  /** 支払い不能が発生した場合の清算内容 */
  insolvency?: InsolvencyReport;
}

/** 支払い不能（負債上限超過）の清算結果 */
export interface InsolvencyReport {
  debtBefore: number;
  limitBefore: number;
  /** 手持ち現金からの返済額 */
  cashRepaid: number;
  /** 強制売却した物件（売却額） */
  sold: { propertyId: string; proceeds: number }[];
  /** 債務整理で免除された額 */
  forgiven: number;
  /** 債務整理のペナルティ（適用後の実変化量） */
  penalty: { fame: number; happiness: number };
  debtAfter: number;
  limitAfter: number;
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
  /** 負債（0以上） */
  debt: number;
  position: string;
}

export type Phase =
  | 'awaitRoll'
  | 'awaitBranch'
  | 'awaitPurchase'
  | 'landed'
  | 'awaitEvent'
  | 'eventResult'
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
  pendingEvent: PendingEvent | null;
  eventResult: EventResult | null;
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
