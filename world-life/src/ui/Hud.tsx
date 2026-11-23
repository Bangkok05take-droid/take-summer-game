import { computeIncome, propertiesOwnedBy } from '../core/economy';
import { ctx, useGame } from '../store/gameStore';
import { useState } from 'react';
import { isMuted, setMuted } from '../audio/sfx';
import { AnimatedMoney } from './AnimatedMoney';
import { hex, money } from './format';

export function Hud() {
  const game = useGame((s) => s.game)!;
  const backToTitle = useGame((s) => s.backToTitle);
  const [muted, setM] = useState(isMuted());
  return (
    <header className="hud">
      <div className="hud-top">
        <button className="hud-menu" onClick={backToTitle} aria-label="タイトルへ">
          ≡
        </button>
        <div className="turn">
          TURN <b>{game.turn}</b>
          <small>/{game.maxTurns}</small>
        </div>
        <div className="city">{ctx.map.name}</div>
        <button
          className={`hud-sound${muted ? ' off' : ''}`}
          onClick={() => {
            setMuted(!muted);
            setM(!muted);
          }}
          aria-label="サウンド"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
      <div className="players">
        {game.players.map((p, i) => {
          const active = i === game.currentPlayerIndex && game.phase !== 'gameOver';
          const owned = propertiesOwnedBy(game, p.id).length;
          return (
            <div key={p.id} className={`pcard${active ? ' active' : ''}`} style={{ ['--pc' as string]: hex(p.color) }}>
              <div className="pname">
                <i />
                {p.name}
              </div>
              <AnimatedMoney value={p.money} />
              <div className="pstats">
                <span title="名声">★{p.fame}</span>
                <span title="人脈">⚭{p.network}</span>
                <span title="幸福度">♥{p.happiness}</span>
              </div>
              <div className="pprops">
                🏢{owned} <small>+{money(computeIncome(game, ctx, p.id))}/T</small>
              </div>
            </div>
          );
        })}
      </div>
    </header>
  );
}
