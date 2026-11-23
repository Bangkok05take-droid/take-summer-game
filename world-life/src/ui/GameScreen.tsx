import { useGame } from '../store/gameStore';
import { ActionPanel } from './ActionPanel';
import { EventCutin } from './EventCutin';
import { GameOver } from './GameOver';
import { GuideBar } from './GuideBar';
import { Popups } from './Popups';
import { Hud } from './Hud';
import { MapCanvas } from './MapCanvas';
import { TurnBanner } from './TurnBanner';
import { Tutorial } from './Tutorial';

export function GameScreen() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  return (
    <div className="game">
      <Hud />
      <div className="map-area">
        <MapCanvas />
        <GuideBar />
        <Popups />
        <EventCutin />
        <TurnBanner />
        <Tutorial />
      </div>
      <ActionPanel />
      {game.phase === 'gameOver' && <GameOver />}
    </div>
  );
}
