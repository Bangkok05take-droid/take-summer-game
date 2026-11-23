import { useGame } from '../store/gameStore';
import { ActionPanel } from './ActionPanel';
import { EventCutin } from './EventCutin';
import { GameOver } from './GameOver';
import { Hud } from './Hud';
import { MapCanvas } from './MapCanvas';
import { TurnBanner } from './TurnBanner';

export function GameScreen() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  return (
    <div className="game">
      <Hud />
      <div className="map-area">
        <MapCanvas />
        <EventCutin />
        <TurnBanner />
      </div>
      <ActionPanel />
      {game.phase === 'gameOver' && <GameOver />}
    </div>
  );
}
