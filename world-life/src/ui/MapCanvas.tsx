import { useEffect, useRef, useState } from 'react';
import { CityMapView } from '../render/CityMapView';
import { fxBus } from '../fx/bus';
import { ctx, useGame } from '../store/gameStore';

const DEBUG = new URLSearchParams(window.location.search).has('debug');

/** PixiJS マップを React に埋め込む */
export function MapCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CityMapView | null>(null);
  const [coord, setCoord] = useState<string | null>(null);

  useEffect(() => {
    const view = new CityMapView(ctx);
    viewRef.current = view;
    view.onNodeTap = (id) => useGame.getState().pickBranch(id);
    if (DEBUG) view.onWorldTap = (x, y) => setCoord(`pos: { x: ${x}, y: ${y} }`);
    view.onStep = (playerId, nodeId, index) => {
      const human = !!useGame.getState().game?.players.find((p) => p.id === playerId)?.isHuman;
      fxBus.emit({ type: 'step', playerId, nodeId, index, human });
    };
    const offFx = fxBus.on((e) => {
      if (e.type === 'land') view.fxLand(e.nodeId);
      else if (e.type === 'purchase') view.fxPurchase(e.nodeId, e.color, e.price, e.monopoly);
      else if (e.type === 'income') view.fxIncome(e.playerId, e.amount);
      else if (e.type === 'eventResult') view.fxEffect(e.playerId, e.applied, e.good);
    });
    let alive = true;
    void view.init(host.current!).then(() => {
      if (!alive) return;
      const g = useGame.getState().game;
      if (g) view.sync(g);
      useGame.getState().registerView({
        animateMove: (pid, path, ms) => view.animateMove(pid, path, ms),
        focusNode: (id) => view.focusNode(id),
      });
    });
    const unsub = useGame.subscribe((s, prev) => {
      if (s.game && s.game !== prev.game) view.sync(s.game);
    });
    return () => {
      alive = false;
      unsub();
      offFx();
      useGame.getState().registerView(null);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  return (
    <div className="map-wrap">
      <div ref={host} className="map-host" />
      {DEBUG && <div className="debug-coord">{coord ?? 'タップで座標表示（?debug）'}</div>}
      <button className="map-fit" onClick={() => viewRef.current?.fit()} aria-label="全体表示">
        ⤢
      </button>
    </div>
  );
}
