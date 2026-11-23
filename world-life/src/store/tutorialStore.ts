// 体験型チュートリアルの進行。ゲームの状態を見て自動で次の段階へ進む。
import { create } from 'zustand';
import type { GameState } from '../core/types';
import { useGame } from './gameStore';

export type TutStepId = 'welcome' | 'goal' | 'dice' | 'buy' | 'rivals' | 'income' | 'events' | 'guide';

export interface TutStep {
  id: TutStepId;
  title: string;
  text: string;
  /** 「次へ」で進む段階（表示中はAIが待つ） */
  blocking: boolean;
  /** 光らせる操作対象 */
  target?: 'dice' | 'buy';
}

export const TUTORIAL_STEPS: TutStep[] = [
  { id: 'welcome', title: 'ようこそ、WORLD LIFEへ', text: '世界の都市を巡り、20ターンで最高の人生をつかむゲームです。ライバル3人と競いましょう。', blocking: true },
  { id: 'goal', title: '勝利条件', text: '最終スコア ＝ 資産60%＋名声15%＋人脈10%＋幸福度15%。お金だけでなく、人生の充実も勝敗を分けます。', blocking: true },
  { id: 'dice', title: 'サイコロを振ろう', text: '光っているボタンでサイコロを振ります。出た目の数だけ進みます。', blocking: false, target: 'dice' },
  { id: 'buy', title: '物件を手に入れよう', text: '空き物件に止まりました！購入すると毎ターン収益が入ります。早く買うほど得をします。', blocking: false, target: 'buy' },
  { id: 'rivals', title: 'ライバルの番', text: 'AIのライバルも物件を狙っています。他人の物件に止まると「買収」で奪うこともできます（代金は相手へ）。', blocking: true },
  { id: 'income', title: '収益が入った！', text: 'ターンの終わりに物件の収益が一括で入ります。上のカードで資産順位と推移（折れ線）をチェックしましょう。', blocking: true },
  { id: 'events', title: '人生イベント', text: '恋愛・社交・商談・運命などのマスでは人生の選択が起きます。選び方で名声・人脈・幸福度が変わります。', blocking: true },
  { id: 'guide', title: '迷ったら', text: '画面上の 💡おすすめ と 🎯目標 を見れば、今やるべきことが分かります。それでは、良い人生を！', blocking: true },
];

const DONE_KEY = 'worldlife.tutorialDone';

export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return true;
  }
}

function markDone(): void {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    /* noop */
  }
}

interface TutStore {
  active: boolean;
  index: number;
  start(): void;
  next(): void;
  skip(): void;
  /** 完了扱いにせず中断（タイトルへ戻ったときなど） */
  cancel(): void;
}

export const useTutorial = create<TutStore>((set, get) => ({
  active: false,
  index: 0,
  start() {
    set({ active: true, index: 0 });
    useGame.setState({ rollOverride: 1 });
    syncHold();
  },
  next() {
    const i = get().index + 1;
    if (i >= TUTORIAL_STEPS.length) return get().skip();
    set({ index: i });
    syncHold();
  },
  skip() {
    markDone();
    useGame.setState({ rollOverride: null });
    set({ active: false, index: 0 });
    syncHold();
  },
  cancel() {
    set({ active: false, index: 0 });
    useGame.setState({ rollOverride: null });
    syncHold();
  },
}));

export function currentStep(): TutStep | null {
  const t = useTutorial.getState();
  return t.active ? TUTORIAL_STEPS[t.index] : null;
}

/** その段階のカードを今表示すべきか（ゲーム状態に依存） */
export function stepVisible(step: TutStep, g: GameState | null): boolean {
  if (!g) return false;
  const humanTurn = g.players[g.currentPlayerIndex]?.isHuman;
  switch (step.id) {
    case 'dice':
      return humanTurn && g.phase === 'awaitRoll' && !useGame.getState().busy;
    case 'buy':
      return humanTurn && g.phase === 'awaitPurchase';
    case 'rivals':
      return !humanTurn;
    case 'income':
      return g.turn >= 2;
    default:
      return true;
  }
}

/** 表示中の段階が「次へ」待ちならAIを止める */
function syncHold(): void {
  const step = currentStep();
  const g = useGame.getState().game;
  useGame.getState().setHold(!!step && step.blocking && stepVisible(step, g));
}

// ゲームの進行に合わせて段階を進める
useGame.subscribe((s, prev) => {
  const step = currentStep();
  if (!step) return;
  const g = s.game;
  if (!g) return;
  const human = g.players.findIndex((p) => p.isHuman);
  if (step.id === 'dice' && prev.game?.phase === 'awaitRoll' && g.phase !== 'awaitRoll') {
    useTutorial.getState().next();
    return;
  }
  if (step.id === 'buy' && g.currentPlayerIndex !== human) {
    useTutorial.getState().next();
    return;
  }
  if (s.busy !== prev.busy || s.game !== prev.game) syncHold();
});
