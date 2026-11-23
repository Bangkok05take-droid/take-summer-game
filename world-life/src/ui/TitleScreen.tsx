import { useGame } from '../store/gameStore';

export function TitleScreen() {
  const hasSave = useGame((s) => s.hasSave);
  const newGame = useGame((s) => s.newGame);
  const continueGame = useGame((s) => s.continueGame);
  return (
    <div className="title">
      <div className="title-glow" />
      <h1 className="logo">
        WORLD<span>LIFE</span>
      </h1>
      <p className="tagline">世界を巡り、富と名声と愛をつかめ</p>
      <p className="city-tag">PROTOTYPE · BANGKOK</p>
      <div className="title-buttons">
        <button className="btn gold" onClick={newGame}>
          新しく始める
        </button>
        {hasSave && (
          <button className="btn ghost" onClick={continueGame}>
            続きから
          </button>
        )}
      </div>
      <p className="note">1人 + AI 3人 ／ 20ターン ／ 初期資金 $1,000,000</p>
    </div>
  );
}
