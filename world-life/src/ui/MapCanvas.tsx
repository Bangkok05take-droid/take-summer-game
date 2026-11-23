import { useEffect, useRef } from 'react';
import { CityMapView } from '../render/CityMapView';
import { ctx, useGame } from '../store/gameStore';

/** PixiJS マップを React に埋め込む */
export function MapCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<CityMapView | null>(null);

  useEffect(() => {
    const view = new CityMapView(ctx);
    viewRef.current = view;
    view.onNodeTap = (id) => useGame.getState().pickBranch(id);
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
      useGame.getState().registerView(null);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  return (
    <div className="map-wrap">
      <div ref={host} className="map-host" />
      <button className="map-fit" onClick={() => viewRef.current?.fit()} aria-label="全体表示">
        ⤢
      </button>
    </div>
  );
}
