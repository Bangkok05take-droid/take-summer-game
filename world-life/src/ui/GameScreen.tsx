import { useGame } from '../store/gameStore';
import { ActionPanel } from './ActionPanel';
import { GameOver } from './GameOver';
import { Hud } from './Hud';
import { MapCanvas } from './MapCanvas';

export function GameScreen() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  return (
    <div className="game">
      <Hud />
      <MapCanvas />
      <ActionPanel />
      {game.phase === 'gameOver' && <GameOver />}
    </div>
  );
}
