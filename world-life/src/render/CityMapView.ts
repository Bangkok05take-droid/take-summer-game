// 都市マップ描画（PixiJS）。GameState を読んで表示するだけで、ルールは持たない。
import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { tryLoadTexture } from '../assets/loader';
import type { AssetId } from '../assets/manifest';
import type { GameContext, GameState, MapNode } from '../core/types';
import { Camera } from './camera';
import { dashedLine, drawPlaceholderBackground, drawPlaceholderToken, NODE_GLYPH } from './placeholders';

const NODE_R = 46;
const TOKEN_OFFSETS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-20, 0], [20, 0]],
  3: [[-22, -12], [22, -12], [0, 18]],
  4: [[-22, -20], [22, -20], [-22, 20], [22, 20]],
};

interface NodeVisual {
  root: Container;
  ownerRing: Graphics;
  highlight: Graphics;
}

export class CityMapView {
  private app = new Application();
  private world = new Container();
  private nodeLayer = new Container();
  private tokenLayer = new Container();
  private fxLayer = new Container();
  private nodes = new Map<string, NodeVisual>();
  private tokens = new Map<string, Container>();
  private currentRing = new Graphics();
  private animating = new Set<string>();
  private highlighted: string[] = [];
  private camera!: Camera;
  private ready = false;
  private destroyed = false;
  private time = 0;
  private lastState: GameState | null = null;

  onNodeTap: ((nodeId: string) => void) | null = null;

  constructor(private ctx: GameContext) {}

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      background: 0x07060b,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      preference: 'webgl',
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    await this.buildScene();
    if (this.destroyed) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.camera = new Camera(this.app, this.world, this.ctx.map.size, (wx, wy) => this.handleTap(wx, wy));
    this.camera.fit();
    this.app.ticker.add((t) => this.tick(t.deltaMS));
    this.ready = true;
    if (this.lastState) this.sync(this.lastState);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.ready) {
      this.camera.destroy();
      this.app.destroy(true, { children: true });
    }
  }

  private async buildScene(): Promise<void> {
    const { map } = this.ctx;
    // 背景
    const bgTex = await tryLoadTexture(`city.${map.id}.bg` as AssetId);
    if (bgTex) {
      const s = new Sprite(bgTex);
      s.width = map.size.width;
      s.height = map.size.height;
      this.world.addChild(s);
    } else {
      this.world.addChild(drawPlaceholderBackground(map));
    }

    // 道（通常ルート＝金、近道＝紫の破線）
    const roads = new Graphics();
    const shortcuts = new Graphics();
    for (const n of Object.values(map.nodes)) {
      n.next.forEach((toId, i) => {
        const to = map.nodes[toId];
        const isShortcut = n.next.length > 1 && i > 0;
        if (isShortcut) dashedLine(shortcuts, n.pos.x, n.pos.y, to.pos.x, to.pos.y);
        else roads.moveTo(n.pos.x, n.pos.y).lineTo(to.pos.x, to.pos.y);
        this.drawArrow(isShortcut ? shortcuts : roads, n, to);
      });
    }
    // 光彩の代わりに太線を下に重ねる
    const roadGlow = roads.clone();
    roadGlow.stroke({ width: 26, color: 0xd4af37, alpha: 0.12 });
    roads.stroke({ width: 8, color: 0xd4af37, alpha: 0.85 });
    const scGlow = shortcuts.clone();
    scGlow.stroke({ width: 22, color: 0xb04dff, alpha: 0.15 });
    shortcuts.stroke({ width: 7, color: 0xc77dff, alpha: 0.95 });
    this.world.addChild(roadGlow, scGlow, roads, shortcuts);

    // マス
    this.world.addChild(this.nodeLayer);
    for (const n of Object.values(map.nodes)) await this.buildNode(n);

    this.world.addChild(this.fxLayer);
    this.fxLayer.addChild(this.currentRing);
    this.world.addChild(this.tokenLayer);
  }

  private drawArrow(g: Graphics, from: MapNode, to: MapNode): void {
    const mx = (from.pos.x + to.pos.x) / 2;
    const my = (from.pos.y + to.pos.y) / 2;
    const a = Math.atan2(to.pos.y - from.pos.y, to.pos.x - from.pos.x);
    const s = 14;
    g.moveTo(mx + Math.cos(a - 2.5) * s, my + Math.sin(a - 2.5) * s)
      .lineTo(mx + Math.cos(a) * s, my + Math.sin(a) * s)
      .lineTo(mx + Math.cos(a + 2.5) * s, my + Math.sin(a + 2.5) * s);
  }

  private async buildNode(n: MapNode): Promise<void> {
    const area = this.ctx.map.areas[n.area];
    const root = new Container();
    root.position.set(n.pos.x, n.pos.y);

    const highlight = new Graphics();
    highlight.circle(0, 0, NODE_R + 22).stroke({ width: 8, color: 0x00e5ff });
    highlight.circle(0, 0, NODE_R + 34).stroke({ width: 3, color: 0x00e5ff, alpha: 0.5 });
    highlight.visible = false;
    root.addChild(highlight);

    const ownerRing = new Graphics();
    root.addChild(ownerRing);

    const base = new Graphics();
    base.circle(0, 0, NODE_R + 6).fill({ color: area.color, alpha: 0.25 });
    base.circle(0, 0, NODE_R).fill(0x0d0b16).stroke({ width: 5, color: area.color });
    if (n.next.length > 1) base.circle(0, 0, NODE_R - 9).stroke({ width: 2, color: 0xc77dff });
    root.addChild(base);

    const building = n.propertyId ? await tryLoadTexture(`city.${this.ctx.map.id}.building.${n.id}` as AssetId) : null;
    if (building) {
      const s = new Sprite(building);
      s.anchor.set(0.5, 1);
      s.width = s.height = 110;
      s.position.set(0, 18);
      root.addChild(s);
    } else {
      const glyph = new Text({ text: NODE_GLYPH[n.type], style: { fontSize: n.type === 'start' ? 34 : 38, fontFamily: 'sans-serif' } });
      glyph.anchor.set(0.5);
      glyph.position.set(0, -4);
      root.addChild(glyph);
    }

    const label = new Text({
      text: n.label,
      style: {
        fontFamily: 'sans-serif',
        fontSize: 22,
        fontWeight: '800',
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 5 },
      },
    });
    label.anchor.set(0.5, 0);
    label.position.set(0, NODE_R + 6);
    root.addChild(label);

    const prop = n.propertyId ? this.ctx.properties[n.propertyId] : undefined;
    if (prop) {
      const price = new Text({
        text: `$${Math.round(prop.price / 1000)}K`,
        style: { fontFamily: 'sans-serif', fontSize: 18, fontWeight: '700', fill: 0xf5d77a, stroke: { color: 0x000000, width: 4 } },
      });
      price.anchor.set(0.5, 0);
      price.position.set(0, NODE_R + 32);
      root.addChild(price);
    }

    const num = new Text({ text: n.id.slice(-2), style: { fontFamily: 'monospace', fontSize: 15, fill: 0x9c94b8 } });
    num.anchor.set(0.5);
    num.position.set(0, -NODE_R + 12);
    root.addChild(num);

    this.nodeLayer.addChild(root);
    this.nodes.set(n.id, { root, ownerRing, highlight });
  }

  private async ensureTokens(state: GameState): Promise<void> {
    for (const p of state.players) {
      if (this.tokens.has(p.id)) continue;
      const tex = await tryLoadTexture(`token.${p.id}` as AssetId);
      let token: Container;
      if (tex) {
        const s = new Sprite(tex);
        s.anchor.set(0.5, 0.85);
        s.width = s.height = 64;
        token = new Container();
        token.addChild(s);
      } else {
        token = drawPlaceholderToken(p.color, p.isHuman ? 'P1' : p.name.replace('AI・', '').slice(0, 1));
      }
      this.tokens.set(p.id, token);
      this.tokenLayer.addChild(token);
    }
  }

  /** 状態を画面に反映 */
  sync(state: GameState): void {
    this.lastState = state;
    if (!this.ready) return;
    void this.ensureTokens(state).then(() => this.syncNow(state));
  }

  private syncNow(state: GameState): void {
    // 所有状態
    for (const n of Object.values(this.ctx.map.nodes)) {
      const v = this.nodes.get(n.id)!;
      v.ownerRing.clear();
      const owner = n.propertyId ? state.ownership[n.propertyId] : undefined;
      if (owner) {
        const color = state.players.find((p) => p.id === owner)?.color ?? 0xffffff;
        v.ownerRing.circle(0, 0, NODE_R + 12).stroke({ width: 8, color });
        v.ownerRing.rect(NODE_R - 6, -NODE_R - 4, 22, 16).fill(color).stroke({ width: 2, color: 0x000000 });
      }
    }
    // 駒の位置（アニメ中の駒は除く）
    const byNode = new Map<string, string[]>();
    for (const p of state.players) {
      const list = byNode.get(p.position) ?? [];
      list.push(p.id);
      byNode.set(p.position, list);
    }
    for (const [nodeId, ids] of byNode) {
      const node = this.ctx.map.nodes[nodeId];
      const offsets = TOKEN_OFFSETS[Math.min(ids.length, 4)];
      ids.forEach((pid, i) => {
        if (this.animating.has(pid)) return;
        const t = this.tokens.get(pid);
        if (!t) return;
        const [ox, oy] = ids.length > 1 ? offsets[i] : [0, 0];
        t.position.set(node.pos.x + ox, node.pos.y + oy - 6);
      });
    }
    // 手番プレイヤーを最前面に
    const cur = state.players[state.currentPlayerIndex];
    const curToken = this.tokens.get(cur.id);
    if (curToken) this.tokenLayer.setChildIndex(curToken, this.tokenLayer.children.length - 1);
    this.setHighlights(state.phase === 'awaitBranch' && cur.isHuman ? state.branchOptions : []);
  }

  private setHighlights(ids: string[]): void {
    for (const id of this.highlighted) this.nodes.get(id)!.highlight.visible = false;
    this.highlighted = ids;
    for (const id of ids) this.nodes.get(id)!.highlight.visible = true;
  }

  /** 経路に沿って1マスずつ移動 */
  async animateMove(playerId: string, path: string[], stepMs: number): Promise<void> {
    const token = this.tokens.get(playerId);
    if (!this.ready || !token || path.length === 0) return;
    this.animating.add(playerId);
    this.tokenLayer.setChildIndex(token, this.tokenLayer.children.length - 1);
    for (const nodeId of path) {
      const to = this.ctx.map.nodes[nodeId].pos;
      const from = { x: token.x, y: token.y };
      await this.tween(stepMs, (k) => {
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        token.x = from.x + (to.x - from.x) * e;
        token.y = from.y + (to.y - 6 - from.y) * e - Math.sin(Math.PI * k) * 46;
        token.scale.set(1 + Math.sin(Math.PI * k) * 0.15);
        this.camera.follow(token.x, token.y, 0.12);
      });
      token.scale.set(1);
    }
    this.animating.delete(playerId);
    if (this.lastState) this.syncNow(this.lastState);
  }

  focusNode(nodeId: string): void {
    if (!this.ready) return;
    const p = this.ctx.map.nodes[nodeId].pos;
    this.camera.panTo(p.x, p.y);
  }

  fit(): void {
    if (this.ready) this.camera.fit();
  }

  private tween(ms: number, fn: (k: number) => void): Promise<void> {
    return new Promise((resolve) => {
      let elapsed = 0;
      const step = (t: { deltaMS: number }) => {
        elapsed += t.deltaMS;
        const k = Math.min(1, elapsed / ms);
        fn(k);
        if (k >= 1) {
          this.app.ticker.remove(step);
          resolve();
        }
      };
      this.app.ticker.add(step);
    });
  }

  private tick(dt: number): void {
    this.time += dt;
    const pulse = 0.5 + 0.5 * Math.sin(this.time / 180);
    for (const id of this.highlighted) {
      const h = this.nodes.get(id)!.highlight;
      h.alpha = 0.45 + pulse * 0.55;
      h.scale.set(1 + pulse * 0.06);
    }
    // 手番プレイヤーの足元リング
    const st = this.lastState;
    this.currentRing.clear();
    if (st && st.phase !== 'gameOver') {
      const cur = st.players[st.currentPlayerIndex];
      const t = this.tokens.get(cur.id);
      if (t) {
        this.currentRing
          .ellipse(t.x, t.y + 22, 30 + pulse * 6, 10 + pulse * 2)
          .stroke({ width: 3, color: cur.color, alpha: 0.6 + pulse * 0.4 });
      }
    }
    this.camera.update(dt);
  }

  private handleTap(wx: number, wy: number): void {
    for (const n of Object.values(this.ctx.map.nodes)) {
      if (Math.hypot(n.pos.x - wx, n.pos.y - wy) <= NODE_R + 24) {
        this.onNodeTap?.(n.id);
        return;
      }
    }
  }
}
