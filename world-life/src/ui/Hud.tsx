import { assetRanking } from '../core/advisor';
import { computeIncome, debtLimit, propertiesOwnedBy } from '../core/economy';
import { ctx, useGame } from '../store/gameStore';
import { useState } from 'react';
import { isMuted, setMuted } from '../audio/sfx';
import { AnimatedMoney } from './AnimatedMoney';
import { Avatar } from './Avatar';
import { hex, money } from './format';

/** 純資産の推移（小さな折れ線） */
function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="spark" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${18 - ((v - min) / span) * 16}`).join(' ');
  const up = values[values.length - 1] >= values[values.length - 2];
  return (
    <svg className="spark" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx="100" cy={18 - ((values[values.length - 1] - min) / span) * 16} r="2.5" fill={up ? '#7dffb0' : '#ff8a8a'} />
    </svg>
  );
}

export function Hud() {
  const game = useGame((s) => s.game)!;
  const ranks = assetRanking(game, ctx);
  const backToTitle = useGame((s) => s.backToTitle);
  const [muted, setM] = useState(isMuted());
  return (
    <header className="hud">
      <div className="hud-top">
        <button
          className="hud-menu"
          onClick={() => {
            if (game.phase === 'gameOver' || window.confirm('タイトルに戻りますか？（進行状況は自動保存されています）')) backToTitle();
          }}
          aria-label="タイトルへ"
        >
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
          const rk = ranks[i];
          return (
            <div key={p.id} className={`pcard${active ? ' active' : ''}`} style={{ ['--pc' as string]: hex(p.color) }}>
              <div className={`prank r${rk.rank}`}>
                {rk.rank}位
                {rk.change > 0 && <em className="up">▲{rk.change}</em>}
                {rk.change < 0 && <em className="down">▼{-rk.change}</em>}
              </div>
              <div className="pname">
                <Avatar player={p} size={18} />
                {p.name.replace('AI・', '')}
              </div>
              <AnimatedMoney value={p.money} />
              <div className="pstats">
                <span title="名声">★{p.fame}</span>
                <span title="人脈">⚭{p.network}</span>
                <span title="幸福度">♥{p.happiness}</span>
              </div>
              <Spark values={[...(game.history ?? []).map((h) => h[i]), rk.netWorth]} color={hex(p.color)} />
              <div className="pprops">
                🏢{owned} <small>+{money(computeIncome(game, ctx, p.id))}/T</small>
                {p.debt > 0 && (
                  <span className="pdebt">
                    負債{money(p.debt)}
                    <small>/{money(debtLimit(game, ctx, p.id))}</small>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </header>
  );
}
