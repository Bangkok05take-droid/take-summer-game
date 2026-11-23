// 演出イベントバス。ルール進行（store）から発火し、描画・音・UIバナーが購読する。
export type FxEvent =
  | { type: 'tap' }
  | { type: 'diceRoll'; value: number; durationMs: number; human: boolean }
  | { type: 'diceResult'; value: number }
  | { type: 'step'; playerId: string; nodeId: string; index: number; human: boolean }
  | { type: 'land'; playerId: string; nodeId: string; human: boolean }
  | { type: 'branchPrompt' }
  | { type: 'purchase'; playerId: string; nodeId: string; price: number; color: number; monopoly: boolean }
  | { type: 'income'; playerId: string; amount: number }
  | { type: 'turnStart'; turn: number; maxTurns: number }
  | { type: 'yourTurn' }
  | { type: 'gameOver' }
  | { type: 'eventOpen'; eventId: string; human: boolean }
  | { type: 'eventResult'; playerId: string; good: boolean; applied: { money: number; debt: number; fame: number; network: number; happiness: number } };

type Listener = (e: FxEvent) => void;
const listeners = new Set<Listener>();

export const fxBus = {
  emit(e: FxEvent): void {
    for (const l of listeners) {
      try {
        l(e);
      } catch (err) {
        console.error(err);
      }
    }
  },
  on(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
