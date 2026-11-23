import { useEffect, useState } from 'react';
import { characterCutinUrl } from '../assets/manifest';
import { useImageAvailable } from '../assets/useImage';
import { fxBus } from '../fx/bus';
import { useGame } from '../store/gameStore';
import { stepVisible, TUTORIAL_STEPS, useTutorial } from '../store/tutorialStore';

function GuideFace() {
  const url = characterCutinUrl('concierge');
  const ok = useImageAvailable(url);
  if (ok) return <img className="tut-face" src={url} alt="" draggable={false} />;
  return <div className="tut-face ph">{ok === false ? '🎩' : ''}</div>;
}

/** チュートリアルのカード（案内役＋説明）と操作対象の強調 */
export function Tutorial() {
  const { active, index, next, skip, cancel } = useTutorial();
  const game = useGame((s) => s.game);
  const screen = useGame((s) => s.screen);
  useGame((s) => s.busy);
  const step = active ? TUTORIAL_STEPS[index] : null;
  const ready = !!step && stepVisible(step, game);
  // 直前の演出（物件GETなど）を見せてから表示する
  const [shownStep, setShownStep] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || !step) return;
    const delay = step.id === 'rivals' ? 2300 : step.id === 'income' ? 1600 : 0;
    const t = setTimeout(() => setShownStep(step.id), delay);
    return () => clearTimeout(t);
  }, [ready, step]);
  const visible = ready && shownStep === step?.id;

  // 操作対象を光らせる
  useEffect(() => {
    const target = visible && step?.target ? step.target : '';
    document.body.dataset.tut = target;
    return () => {
      document.body.dataset.tut = '';
    };
  }, [visible, step]);

  useEffect(() => {
    if (screen === 'title' && active) cancel();
  }, [screen, active, cancel]);

  if (!step || !visible) return null;
  const press = (fn: () => void) => () => {
    fxBus.emit({ type: 'tap' });
    fn();
  };
  const last = index === TUTORIAL_STEPS.length - 1;
  return (
    <div className={`tutorial ${step.blocking ? 'blocking' : 'hint'}`} key={step.id}>
      {step.blocking && <div className="tut-dim" />}
      <div className="tut-card">
        <GuideFace />
        <div className="tut-body">
          <div className="tut-step">
            チュートリアル {index + 1}/{TUTORIAL_STEPS.length}
          </div>
          <div className="tut-title">{step.title}</div>
          <div className="tut-text">{step.text}</div>
          <div className="tut-actions">
            <button className="tut-skip" onClick={press(skip)}>
              スキップ
            </button>
            {step.blocking && (
              <button className="btn gold tut-next" onClick={press(next)}>
                {last ? 'ゲームを始める' : '次へ'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
