import { useEffect, useState } from 'react';
import { computeIncome } from '../core/economy';
import { personalityOf } from '../data/aiPersonalities';
import { fxBus } from '../fx/bus';
import { ctx, useGame } from '../store/gameStore';
import { Avatar } from './Avatar';
import { money } from './format';

interface Celebrate {
  id: number;
  title: string;
  name: string;
  lines: string[];
  badge?: string;
}
interface Talk {
  id: number;
  playerId: string;
  text: string;
}

let seq = 0;

/** 物件獲得の祝福・AIのセリフ吹き出し */
export function Popups() {
  const [cel, setCel] = useState<Celebrate | null>(null);
  const [talks, setTalks] = useState<Talk[]>([]);
  const game = useGame((s) => s.game);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const off = fxBus.on((e) => {
      const g = useGame.getState().game;
      if (!g) return;
      const human = g.players.find((p) => p.isHuman)!;
      if ((e.type === 'purchase' && e.playerId === human.id) || (e.type === 'buyout' && e.buyerId === human.id)) {
        const nodeId = e.nodeId;
        const pid = ctx.map.nodes[nodeId].propertyId!;
        const prop = ctx.properties[pid];
        const income = computeIncome(g, ctx, human.id);
        const remaining = g.maxTurns - g.turn + (g.lastSettledTurn >= g.turn ? 0 : 1);
        const isBuyout = e.type === 'buyout';
        const victim = isBuyout ? g.players.find((p) => p.id === e.ownerId)?.name : '';
        setCel({
          id: ++seq,
          title: isBuyout ? '買収成功！' : '物件GET！',
          name: prop.name,
          lines: [
            `収益 合計 +${money(income)} / ターン`,
            remaining > 0 ? `残り${remaining}ターンで +${money(income * remaining)} 見込み` : '',
            isBuyout ? `${victim} から奪取` : '',
          ].filter(Boolean),
          badge: e.type === 'purchase' && e.monopoly ? `${ctx.map.areas[prop.area].name} 独占！ 収益+20%` : undefined,
        });
        timers.push(setTimeout(() => setCel(null), useGame.getState().fastForward ? 900 : 2300));
      } else if (e.type === 'aiTalk') {
        const t = { id: ++seq, playerId: e.playerId, text: e.text };
        setTalks((list) => [...list.slice(-1), t]);
        timers.push(setTimeout(() => setTalks((list) => list.filter((x) => x.id !== t.id)), 2400));
      }
    });
    return () => {
      off();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <>
      {cel && (
        <div className="celebrate" key={cel.id} onClick={() => setCel(null)}>
          <div className="cel-burst" />
          <div className="cel-card">
            <div className="cel-title">{cel.title}</div>
            <div className="cel-name">{cel.name}</div>
            {cel.lines.map((l, i) => (
              <div className="cel-line" key={i}>
                {l}
              </div>
            ))}
            {cel.badge && <div className="cel-badge">{cel.badge}</div>}
          </div>
        </div>
      )}
      <div className="talks">
        {talks.map((t) => {
          const p = game?.players.find((x) => x.id === t.playerId);
          if (!p) return null;
          return (
            <div className="talk" key={t.id}>
              <Avatar player={p} size={30} />
              <div className="talk-body">
                <div className="talk-name">
                  {p.name.replace('AI・', '')}
                  <small>{personalityOf(p.id)?.title}</small>
                </div>
                {t.text}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
