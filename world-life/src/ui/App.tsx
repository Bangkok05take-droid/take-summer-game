import { useEffect } from 'react';
import { initSfx } from '../audio/sfx';
import { useGame } from '../store/gameStore';
import { AssetCheck } from './AssetCheck';
import { GameScreen } from './GameScreen';
import { TitleScreen } from './TitleScreen';

const params = new URLSearchParams(window.location.search);

export function App() {
  const screen = useGame((s) => s.screen);
  useEffect(() => initSfx(), []);
  if (params.has('assets')) return <AssetCheck />;
  return <div className="app">{screen === 'title' ? <TitleScreen /> : <GameScreen />}</div>;
}
