import { useGame } from '../store/gameStore';
import { GameScreen } from './GameScreen';
import { TitleScreen } from './TitleScreen';

export function App() {
  const screen = useGame((s) => s.screen);
  return <div className="app">{screen === 'title' ? <TitleScreen /> : <GameScreen />}</div>;
}
