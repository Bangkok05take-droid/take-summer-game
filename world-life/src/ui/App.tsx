import { useEffect } from 'react';
import { initSfx } from '../audio/sfx';
import { useGame } from '../store/gameStore';
import { GameScreen } from './GameScreen';
import { TitleScreen } from './TitleScreen';

export function App() {
  const screen = useGame((s) => s.screen);
  useEffect(() => initSfx(), []);
  return <div className="app">{screen === 'title' ? <TitleScreen /> : <GameScreen />}</div>;
}
