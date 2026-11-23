import { computeIncome, propertiesOwnedBy } from '../core/economy';
import { ctx, useGame } from '../store/gameStore';
import { hex, money } from './format';

export function Hud() {
  const game = useGame((s) => s.game)!;
  const backToTitle = useGame((s) => s.backToTitle);
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
              <div className="pmoney">{money(p.money)}</div>
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
