import { useEffect, useState } from 'react';
import { fxBus } from '../fx/bus';
import { useGame } from '../store/gameStore';

interface Banner {
  id: number;
  kind: 'turn' | 'you' | 'final';
  title: string;
  sub?: string;
}

let seq = 0;

/** ターン開始・自分の番の帯演出 */
export function TurnBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [rank, setRank] = useState<{ text: string; kind: string; id: number } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const show = (b: Omit<Banner, 'id'>, ms: number) => {
      if (timer) clearTimeout(timer);
      setBanner({ ...b, id: ++seq });
      timer = setTimeout(() => setBanner(null), ms);
    };
    const off = fxBus.on((e) => {
      const fast = useGame.getState().fastForward;
      if (e.type === 'turnStart') {
        const last = e.turn === e.maxTurns;
        show({ kind: last ? 'final' : 'turn', title: last ? 'FINAL TURN' : `TURN ${e.turn}`, sub: last ? '最終ターン' : `残り ${e.maxTurns - e.turn + 1} ターン` }, fast ? 500 : 1300);
      } else if (e.type === 'rank') {
        const t = e.change > 0 ? `資産順位 ${e.rank}位 ▲${e.change} UP!` : e.change < 0 ? `資産順位 ${e.rank}位 ▼${-e.change}` : `資産順位 ${e.rank}位 キープ`;
        setRank({ text: t, kind: e.change > 0 ? 'up' : e.change < 0 ? 'down' : 'keep', id: ++seq });
        setTimeout(() => setRank(null), fast ? 700 : 1800);
      } else if (e.type === 'yourTurn') {
        show({ kind: 'you', title: 'YOUR TURN', sub: 'サイコロを振ろう' }, 1100);
      }
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <>
      {banner && (
        <div className={`turn-banner ${banner.kind}`} key={banner.id}>
          <div className="tb-band">
            <div className="tb-title">{banner.title}</div>
            {banner.sub && <div className="tb-sub">{banner.sub}</div>}
          </div>
        </div>
      )}
      {rank && (
        <div className={`rank-toast ${rank.kind}`} key={rank.id}>
          {rank.text}
        </div>
      )}
    </>
  );
}
