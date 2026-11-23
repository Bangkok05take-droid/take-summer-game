import { TITLE_BG_URL } from '../assets/manifest';
import { useImageAvailable } from '../assets/useImage';
import { fxBus } from '../fx/bus';
import { tutorialDone, useTutorial } from '../store/tutorialStore';
import { useGame } from '../store/gameStore';

function TitleBg() {
  const ok = useImageAvailable(TITLE_BG_URL);
  return ok ? <img className="title-bg" src={TITLE_BG_URL} alt="" draggable={false} /> : null;
}

export function TitleScreen() {
  const hasSave = useGame((s) => s.hasSave);
  const newGame = useGame((s) => s.newGame);
  const continueGame = useGame((s) => s.continueGame);
  return (
    <div className="title">
      <TitleBg />
      <div className="title-glow" />
      <h1 className="logo">
        WORLD<span>LIFE</span>
      </h1>
      <p className="tagline">世界を巡り、富と名声と愛をつかめ</p>
      <p className="city-tag">PROTOTYPE · BANGKOK</p>
      <div className="title-buttons">
        <button className="btn gold" onClick={() => {
            fxBus.emit({ type: 'tap' });
            if (hasSave && !window.confirm('新しく始めると、保存中のゲームは上書きされます。よろしいですか？')) return;
            newGame();
            if (!tutorialDone()) useTutorial.getState().start();
          }}>
          新しく始める
        </button>
        {hasSave && (
          <button className="btn ghost" onClick={() => {
              fxBus.emit({ type: 'tap' });
              continueGame();
            }}>
            続きから
          </button>
        )}
        <button
          className="btn ghost"
          onClick={() => {
            fxBus.emit({ type: 'tap' });
            if (hasSave && !window.confirm('チュートリアル用の新しいゲームを始めます。保存中のゲームは上書きされます。よろしいですか？')) return;
            newGame();
            useTutorial.getState().start();
          }}
        >
          遊び方（チュートリアル）
        </button>
      </div>
      <p className="note">1人 + AI 3人 ／ 20ターン ／ 初期資金 $1,000,000</p>
    </div>
  );
}
