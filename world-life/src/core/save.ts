// セーブ・ロード（localStorage を抽象化して、テストではメモリで代用）
import { SAVE_VERSION } from './game';
import type { GameState } from './types';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'worldlife.save.v1';

export function serializeGame(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeGame(json: string): GameState | null {
  try {
    const data = migrate(JSON.parse(json));
    if (!data || data.saveVersion !== SAVE_VERSION) return null;
    if (!Array.isArray(data.players) || data.players.length === 0) return null;
    if (typeof data.turn !== 'number' || typeof data.phase !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

/** 旧バージョンのセーブを現行形式へ変換 */
function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as GameState & { saveVersion: number };
  if (data.saveVersion === 1) {
    return {
      ...data,
      saveVersion: 2,
      players: data.players.map((p) => ({ ...p, debt: p.debt ?? 0 })),
      pendingEvent: null,
      eventResult: null,
    };
  }
  return data;
}

export function saveGame(storage: KeyValueStorage, state: GameState): boolean {
  try {
    storage.setItem(SAVE_KEY, serializeGame(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage: KeyValueStorage): GameState | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return raw ? deserializeGame(raw) : null;
  } catch {
    return null;
  }
}

export function clearSave(storage: KeyValueStorage): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    /* noop */
  }
}

export function createMemoryStorage(): KeyValueStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}
