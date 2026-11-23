// 素材未提供時の仮描画。本番素材が届いたら manifest 経由で自動的に置き換わる。
import { Container, FillGradient, Graphics, Text } from 'pixi.js';
import type { CityMap, NodeType } from '../core/types';
import { nextRandom } from '../core/rng';

export const NODE_GLYPH: Record<NodeType, string> = {
  start: '✈️',
  property: '🏢',
  social: '🍸',
  romance: '💘',
  fate: '🔮',
  vip: '👑',
  business: '💼',
  scandal: '📰',
  party: '🥂',
  bigfate: '🎲',
};

/** 背景（夜の都市を図形で表現） */
export function drawPlaceholderBackground(map: CityMap): Container {
  const c = new Container();
  const { width: W, height: H } = map.size;
  const grad = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: 0x120a24 },
      { offset: 0.5, color: 0x0a0814 },
      { offset: 1, color: 0x05040a },
    ],
    textureSpace: 'local',
  });
  const base = new Graphics().rect(-200, -200, W + 400, H + 400).fill(grad);
  c.addChild(base);

  // チャオプラヤー川（左下）
  const river = new Graphics();
  river.moveTo(-200, 760);
  for (let y = 760; y <= H + 200; y += 40) river.lineTo(40 + Math.sin(y / 90) * 30, y);
  river.lineTo(-200, H + 200).closePath().fill({ color: 0x0b3a5a, alpha: 0.55 });
  c.addChild(river);

  // エリアの光（ぼかし代わりに同心円を重ねる）
  const centers: Record<string, { x: number; y: number }> = {};
  for (const n of Object.values(map.nodes)) {
    const a = (centers[n.area] ??= { x: 0, y: 0 });
    a.x += n.pos.x / 4;
    a.y += n.pos.y / 4;
  }
  for (const [areaId, p] of Object.entries(centers)) {
    const color = map.areas[areaId as keyof typeof map.areas].color;
    const glow = new Graphics();
    for (let i = 6; i >= 1; i--) glow.circle(p.x, p.y, 60 * i).fill({ color, alpha: 0.025 });
    c.addChild(glow);
  }

  // ビル群のシルエット
  const city = new Graphics();
  let rng = 12345;
  for (let i = 0; i < 140; i++) {
    const r1 = nextRandom(rng);
    const r2 = nextRandom(r1.state);
    const r3 = nextRandom(r2.state);
    rng = r3.state;
    const x = r1.value * W;
    const y = r2.value * H;
    const w = 18 + r3.value * 40;
    const h = 30 + r3.value * 90;
    city.rect(x, y - h, w, h).fill({ color: 0x1a1530, alpha: 0.7 });
    // 窓明かり
    for (let wy = y - h + 8; wy < y - 6; wy += 14) {
      if ((wy + x) % 3 < 1.4) city.rect(x + 5, wy, w - 10, 3).fill({ color: 0xffd36b, alpha: 0.18 });
    }
  }
  c.addChild(city);

  // ネオングリッド
  const grid = new Graphics();
  for (let x = 0; x <= W; x += 100) grid.moveTo(x, 0).lineTo(x, H);
  for (let y = 0; y <= H; y += 100) grid.moveTo(0, y).lineTo(W, y);
  grid.stroke({ width: 1, color: 0x6b3dff, alpha: 0.08 });
  c.addChild(grid);

  // エリア名
  for (const [areaId, p] of Object.entries(centers)) {
    const area = map.areas[areaId as keyof typeof map.areas];
    const t = new Text({
      text: area.name,
      style: { fontFamily: 'sans-serif', fontSize: 34, fontWeight: '800', fill: area.color, letterSpacing: 4 },
    });
    t.alpha = 0.35;
    t.anchor.set(0.5);
    t.position.set(p.x, p.y);
    c.addChild(t);
  }
  return c;
}

/** 破線 */
export function dashedLine(g: Graphics, x1: number, y1: number, x2: number, y2: number, dash = 18, gap = 12): void {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const dx = (x2 - x1) / len;
  const dy = (y2 - y1) / len;
  for (let d = 0; d < len; d += dash + gap) {
    const e = Math.min(d + dash, len);
    g.moveTo(x1 + dx * d, y1 + dy * d).lineTo(x1 + dx * e, y1 + dy * e);
  }
}

/** 仮の駒 */
export function drawPlaceholderToken(color: number, label: string): Container {
  const c = new Container();
  const g = new Graphics();
  g.ellipse(0, 20, 20, 7).fill({ color: 0x000000, alpha: 0.5 });
  g.circle(0, 0, 22).fill(color).stroke({ width: 4, color: 0xffffff });
  g.circle(0, 0, 15).stroke({ width: 2, color: 0x000000, alpha: 0.25 });
  c.addChild(g);
  const t = new Text({ text: label, style: { fontFamily: 'sans-serif', fontSize: 20, fontWeight: '900', fill: 0x111111 } });
  t.anchor.set(0.5);
  c.addChild(t);
  return c;
}
