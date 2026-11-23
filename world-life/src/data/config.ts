import type { GameContext } from '../core/types';
import { bangkokEvents } from './events/bangkok';
import { bangkokMap } from './maps/bangkok';
import { bangkokProperties, defaultEconomy } from './properties/bangkok';

export const bangkokContext: GameContext = {
  map: bangkokMap,
  properties: bangkokProperties,
  economy: defaultEconomy,
  events: bangkokEvents,
};

/** 基本ルール値（指令 No.001） */
export const BASE_RULES = {
  maxTurns: 20,
  initialMoney: 1_000_000,
  initialFame: 30,
  initialNetwork: 30,
  initialHappiness: 50,
  statMin: 0,
  statMax: 100,
  diceMin: 1,
  diceMax: 6,
} as const;

/** 最終スコアの重み */
export const SCORE_WEIGHTS = {
  asset: 0.6,
  fame: 0.15,
  network: 0.1,
  happiness: 0.15,
} as const;

export const PLAYER_PRESETS = [
  { id: 'p1', name: 'あなた', color: 0xf5c542, isHuman: true },
  { id: 'p2', name: 'AI・レオン', color: 0xb04dff, isHuman: false },
  { id: 'p3', name: 'AI・ミラ', color: 0x3da5ff, isHuman: false },
  { id: 'p4', name: 'AI・カイ', color: 0x35e0a1, isHuman: false },
] as const;
