// 都市マップ描画（PixiJS）。GameState を読んで表示するだけで、ルールは持たない。
import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { tryLoadTexture } from '../assets/loader';
import type { AssetId } from '../assets/manifest';
import type { GameContext, GameState, MapNode } from '../core/types';
import { Camera } from './camera';
import { FxLayer } from './fx';
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
  glow: Graphics;
  owner: string | undefined;
  ringAnim: number;
}

interface FlowDot {
  g: Graphics;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  t: number;
  speed: number;
}

interface Twinkle {
  g: Graphics;
  phase: number;
  speed: number;
}

export class CityMapView {
  private app = new Application();
  private world = new Container();
  private nodeLayer = new Container();
  private tokenLayer = new Container();
  private underLayer = new Container();
  private fx = new FxLayer();
  private nodes = new Map<string, NodeVisual>();
  private tokens = new Map<string, Container>();
  private tokenBodies = new Map<string, Container>();
  private currentRing = new Graphics();
  private animating = new Set<string>();
  private highlighted: string[] = [];
  private flow: FlowDot[] = [];
  private twinkles: Twinkle[] = [];
  private camera!: Camera;
  private ready = false;
  private destroyed = false;
  private time = 0;
  private lastState: GameState | null = null;

  onNodeTap: ((nodeId: string) => void) | null = null;
  onStep: ((playerId: string, nodeId: string, index: number) => void) | null = null;
  /** 座標合わせ用（?debug） */
  onWorldTap: ((x: number, y: number) => void) | null = null;

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
    const bgTex = await tryLoadTexture(`city.${map.id}.bg` as AssetId);
    if (bgTex) {
      const s = new Sprite(bgTex);
      s.width = map.size.width;
      s.height = map.size.height;
      this.world.addChild(s);
    } else {
      this.world.addChild(drawPlaceholderBackground(map));
    }
    this.buildTwinkles();

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
        this.addFlow(n, to, isShortcut);
      });
    }
    const roadGlow = roads.clone();
    roadGlow.stroke({ width: 30, color: 0xd4af37, alpha: 0.1 });
    const roadMid = roads.clone();
    roadMid.stroke({ width: 14, color: 0x6b4f10, alpha: 0.9 });
    roads.stroke({ width: 6, color: 0xf5d77a, alpha: 0.95 });
    const scGlow = shortcuts.clone();
    scGlow.stroke({ width: 24, color: 0xb04dff, alpha: 0.16 });
    shortcuts.stroke({ width: 7, color: 0xd6a3ff, alpha: 0.95 });
    this.world.addChild(roadGlow, scGlow, roadMid, roads, shortcuts);
    for (const f of this.flow) this.world.addChild(f.g);

    this.world.addChild(this.underLayer);
    this.underLayer.addChild(this.currentRing);
    this.world.addChild(this.nodeLayer);
    for (const n of Object.values(map.nodes)) await this.buildNode(n);
    this.world.addChild(this.tokenLayer);
    this.world.addChild(this.fx);
  }

  /** 夜景のきらめき */
  private buildTwinkles(): void {
    const { width: W, height: H } = this.ctx.map.size;
    for (let i = 0; i < 36; i++) {
      const g = new Graphics();
      const big = i % 6 === 0;
      if (big) g.star(0, 0, 4, 7, 1.5).fill(0xfff1c2);
      else g.circle(0, 0, 2.2).fill(i % 3 === 0 ? 0x9ad8ff : 0xffe7a0);
      g.blendMode = 'add';
      g.position.set(Math.random() * W, Math.random() * H);
      this.world.addChild(g);
      this.twinkles.push({ g, phase: Math.random() * Math.PI * 2, speed: 0.6 + Math.random() * 1.6 });
    }
  }

  /** 道の上を流れる光 */
  private addFlow(from: MapNode, to: MapNode, shortcut: boolean): void {
    const count = shortcut ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const color = shortcut ? 0xe7c6ff : 0xfff4c8;
      g.circle(0, 0, 10).fill({ color, alpha: 0.18 });
      g.circle(0, 0, 4.5).fill({ color, alpha: 0.95 });
      g.blendMode = 'add';
      const len = Math.hypot(to.pos.x - from.pos.x, to.pos.y - from.pos.y);
      this.flow.push({
        g,
        ax: from.pos.x,
        ay: from.pos.y,
        bx: to.pos.x,
        by: to.pos.y,
        t: i / count + Math.random() * 0.2,
        speed: 90 / len,
      });
    }
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

    const glow = new Graphics();
    for (let i = 4; i >= 1; i--) glow.circle(0, 0, NODE_R + i * 9).fill({ color: area.color, alpha: 0.05 });
    glow.blendMode = 'add';
    root.addChild(glow);

    const highlight = new Graphics();
    highlight.circle(0, 0, NODE_R + 22).stroke({ width: 8, color: 0x00e5ff });
    highlight.circle(0, 0, NODE_R + 34).stroke({ width: 3, color: 0x00e5ff, alpha: 0.5 });
    highlight.blendMode = 'add';
    highlight.visible = false;
    root.addChild(highlight);

    const ownerRing = new Graphics();
    root.addChild(ownerRing);

    const base = new Graphics();
    base.circle(0, 4, NODE_R + 2).fill({ color: 0x000000, alpha: 0.6 });
    base.circle(0, 0, NODE_R).fill(0x0d0b16).stroke({ width: 5, color: area.color });
    base.circle(0, 0, NODE_R - 6).stroke({ width: 1.5, color: 0xf5d77a, alpha: 0.35 });
    // 上半分のハイライト（ガラス感）
    base.ellipse(0, -NODE_R * 0.45, NODE_R * 0.7, NODE_R * 0.32).fill({ color: 0xffffff, alpha: 0.06 });
    if (n.next.length > 1) base.circle(0, 0, NODE_R - 12).stroke({ width: 2, color: 0xc77dff });
    root.addChild(base);

    const building = n.propertyId ? await tryLoadTexture(`city.${this.ctx.map.id}.building.${n.id}` as AssetId) : null;
    if (building) {
      const s = new Sprite(building);
      s.anchor.set(0.5, 1);
      s.width = s.height = 110;
      s.position.set(0, 18);
      root.addChild(s);
    } else {
      const icon = await tryLoadTexture(`icon.node.${n.type}` as AssetId);
      if (icon) {
        const s = new Sprite(icon);
        s.anchor.set(0.5);
        s.width = s.height = 64;
        root.addChild(s);
      } else {
        const glyph = new Text({ text: NODE_GLYPH[n.type], style: { fontSize: n.type === 'start' ? 34 : 38, fontFamily: 'sans-serif' } });
        glyph.anchor.set(0.5);
        glyph.position.set(0, -2);
        root.addChild(glyph);
      }
    }

    const label = new Text({
      text: n.label,
      style: { fontFamily: 'sans-serif', fontSize: 22, fontWeight: '800', fill: 0xffffff, stroke: { color: 0x000000, width: 5 } },
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

    this.nodeLayer.addChild(root);
    this.nodes.set(n.id, { root, ownerRing, highlight, glow, owner: undefined, ringAnim: 0 });
  }

  private tokensReady: Promise<void> | null = null;

  /** 駒の生成は一度だけ（同時呼び出しでの重複生成を防ぐ） */
  private ensureTokens(state: GameState): Promise<void> {
    this.tokensReady ??= this.createTokens(state);
    return this.tokensReady;
  }

  private async createTokens(state: GameState): Promise<void> {
    for (const p of state.players) {
      if (this.tokens.has(p.id)) continue;
      const tex = await tryLoadTexture(`token.${p.id}` as AssetId);
      const token = new Container();
      let body: Container;
      if (tex) {
        const s = new Sprite(tex);
        s.anchor.set(0.5, 0.85);
        s.width = s.height = 64;
        body = new Container();
        body.addChild(s);
      } else {
        body = drawPlaceholderToken(p.color, p.isHuman ? 'P1' : p.name.replace('AI・', '').slice(0, 1));
      }
      token.addChild(body);
      this.tokens.set(p.id, token);
      this.tokenBodies.set(p.id, body);
      this.tokenLayer.addChild(token);
    }
  }

  sync(state: GameState): void {
    this.lastState = state;
    if (!this.ready) return;
    void this.ensureTokens(state).then(() => this.syncNow(state));
  }

  private syncNow(state: GameState): void {
    for (const n of Object.values(this.ctx.map.nodes)) {
      const v = this.nodes.get(n.id)!;
      const owner = n.propertyId ? state.ownership[n.propertyId] : undefined;
      if (owner === v.owner) continue;
      v.owner = owner;
      v.ownerRing.clear();
      if (owner) {
        const color = state.players.find((p) => p.id === owner)?.color ?? 0xffffff;
        v.ownerRing.circle(0, 0, NODE_R + 12).stroke({ width: 8, color });
        v.ownerRing.circle(0, 0, NODE_R + 18).stroke({ width: 2, color, alpha: 0.5 });
        v.ownerRing.moveTo(NODE_R - 2, -NODE_R - 30).lineTo(NODE_R - 2, -NODE_R + 4).stroke({ width: 3, color: 0xf5d77a });
        v.ownerRing.poly([NODE_R - 1, -NODE_R - 30, NODE_R + 24, -NODE_R - 22, NODE_R - 1, -NODE_R - 14]).fill(color).stroke({ width: 2, color: 0x000000 });
      }
    }
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

  /** 経路に沿って1マスずつ移動（ジャンプ・着地のつぶれ・光の軌跡） */
  async animateMove(playerId: string, path: string[], stepMs: number): Promise<void> {
    const token = this.tokens.get(playerId);
    const body = this.tokenBodies.get(playerId);
    if (!this.ready || !token || !body || path.length === 0) return;
    this.animating.add(playerId);
    this.tokenLayer.setChildIndex(token, this.tokenLayer.children.length - 1);
    const color = this.lastState?.players.find((p) => p.id === playerId)?.color ?? 0xffffff;
    for (let i = 0; i < path.length; i++) {
      const nodeId = path[i];
      const to = this.ctx.map.nodes[nodeId].pos;
      const from = { x: token.x, y: token.y };
      const hop = Math.min(56, 26 + stepMs / 8);
      await this.tween(stepMs, (k) => {
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        token.x = from.x + (to.x - from.x) * e;
        token.y = from.y + (to.y - 6 - from.y) * e;
        const h = Math.sin(Math.PI * k);
        body.y = -h * hop;
        // 踏み切りで伸び、空中で縦長に
        body.scale.set(1 - h * 0.08, 1 + h * 0.12);
        this.camera.follow(token.x, token.y, 0.12);
      });
      body.y = 0;
      this.onStep?.(playerId, nodeId, i);
      const isLast = i === path.length - 1;
      this.fx.ripple(to.x, to.y, color, NODE_R * 0.6, NODE_R * (isLast ? 2.2 : 1.4), isLast ? 7 : 4, isLast ? 700 : 380);
      if (stepMs >= 120 || isLast) await this.squash(body, isLast ? 160 : 70);
    }
    body.scale.set(1);
    this.animating.delete(playerId);
    if (this.lastState) this.syncNow(this.lastState);
  }

  private squash(body: Container, ms: number): Promise<void> {
    return this.tween(ms, (k) => {
      const s = Math.sin(Math.PI * k) * (1 - k * 0.3);
      body.scale.set(1 + s * 0.22, 1 - s * 0.2);
    }).then(() => {
      body.scale.set(1);
    });
  }

  /** 着地演出 */
  fxLand(nodeId: string): void {
    if (!this.ready) return;
    const n = this.ctx.map.nodes[nodeId];
    const color = this.ctx.map.areas[n.area].color;
    this.fx.burst(n.pos.x, n.pos.y, color, 14, { speed: 5 });
  }

  /** 物件購入演出 */
  fxPurchase(nodeId: string, color: number, price: number, monopoly: boolean): void {
    if (!this.ready) return;
    const n = this.ctx.map.nodes[nodeId];
    const v = this.nodes.get(nodeId);
    if (v) v.ringAnim = 1;
    this.fx.ripple(n.pos.x, n.pos.y, 0xf5d77a, NODE_R, NODE_R * 3.2, 10, 900);
    this.fx.ripple(n.pos.x, n.pos.y, color, NODE_R, NODE_R * 2.4, 6, 700);
    this.fx.burst(n.pos.x, n.pos.y, 0xf5d77a, 34, { speed: 9, gravity: 0.35, coin: true });
    this.fx.floatText(n.pos.x, n.pos.y - 70, `-$${Math.round(price / 1000)}K`, 0xf5d77a);
    if (monopoly) {
      const area = this.ctx.map.areas[n.area];
      for (const other of Object.values(this.ctx.map.nodes)) {
        if (other.area === n.area && other.propertyId) this.fx.ripple(other.pos.x, other.pos.y, area.color, NODE_R, NODE_R * 2.6, 8, 1100);
      }
      this.fx.floatText(n.pos.x, n.pos.y - 120, 'AREA MONOPOLY!', 0x00e5ff, 30, 1800);
    }
  }

  /** 収益演出（駒の上に +$） */
  fxIncome(playerId: string, amount: number): void {
    const t = this.tokens.get(playerId);
    if (!this.ready || !t) return;
    this.fx.floatText(t.x, t.y - 50, `+$${Math.round(amount / 1000)}K`, 0x7dffb0, 28, 1500);
    this.fx.burst(t.x, t.y - 20, 0xf5d77a, 10, { speed: 4, gravity: 0.2, coin: true });
  }

  /** イベント結果（金額・ステータス変化）を駒の上に表示 */
  fxEffect(playerId: string, applied: { money: number; debt: number; fame: number; network: number; happiness: number }, good: boolean): void {
    const t = this.tokens.get(playerId);
    if (!this.ready || !t) return;
    const items: [string, number][] = [];
    const k = (v: number) => `${v > 0 ? '+' : '-'}$${Math.round(Math.abs(v) / 1000)}K`;
    const sign = (v: number) => `${v > 0 ? '+' : ''}${v}`;
    if (applied.money) items.push([k(applied.money), applied.money > 0 ? 0x7dffb0 : 0xff8a8a]);
    if (applied.debt) items.push([`負債${k(applied.debt)}`, applied.debt > 0 ? 0xff8a8a : 0x7dffb0]);
    if (applied.fame) items.push([`★${sign(applied.fame)}`, applied.fame > 0 ? 0xffd36b : 0xff8a8a]);
    if (applied.network) items.push([`⚭${sign(applied.network)}`, applied.network > 0 ? 0x9ad8ff : 0xff8a8a]);
    if (applied.happiness) items.push([`♥${sign(applied.happiness)}`, applied.happiness > 0 ? 0xff9ccf : 0xff8a8a]);
    items.forEach(([text, color], i) => this.fx.floatText(t.x, t.y - 50 - i * 34, text, color, 26, 1700));
    if (good) this.fx.burst(t.x, t.y - 10, 0xfff1c2, 16, { speed: 6 });
    else this.fx.ripple(t.x, t.y, 0xff4d6d, 20, 90, 6, 600);
  }

  /** 支払い不能：売却された物件に赤い波紋、駒に警告 */
  fxInsolvency(playerId: string, soldNodeIds: string[]): void {
    if (!this.ready) return;
    soldNodeIds.forEach((id, i) => {
      const n = this.ctx.map.nodes[id];
      setTimeout(() => {
        this.fx.ripple(n.pos.x, n.pos.y, 0xff3355, NODE_R, NODE_R * 2.8, 10, 900);
        this.fx.floatText(n.pos.x, n.pos.y - 70, 'SOLD', 0xff6b80, 30, 1600);
      }, i * 260);
    });
    const t = this.tokens.get(playerId);
    if (t) {
      this.fx.ripple(t.x, t.y, 0xff3355, 20, 140, 8, 900);
      this.fx.floatText(t.x, t.y - 90, '支払い不能', 0xff3355, 32, 1800);
    }
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
      if (ms <= 0) {
        fn(1);
        resolve();
        return;
      }
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
    const sec = this.time / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(this.time / 180);
    for (const id of this.highlighted) {
      const h = this.nodes.get(id)!.highlight;
      h.alpha = 0.45 + pulse * 0.55;
      h.scale.set(1 + pulse * 0.06);
    }
    // マスのほのかな呼吸
    let i = 0;
    for (const v of this.nodes.values()) {
      v.glow.alpha = 0.6 + 0.4 * Math.sin(sec * 1.4 + i * 0.7);
      if (v.ringAnim > 0) {
        v.ringAnim = Math.max(0, v.ringAnim - dt / 500);
        const e = v.ringAnim ** 2;
        v.ownerRing.scale.set(1 + e * 0.8);
        v.ownerRing.alpha = 1 - e * 0.6;
      }
      i++;
    }
    for (const f of this.flow) {
      f.t = (f.t + (f.speed * dt) / 1000) % 1;
      f.g.x = f.ax + (f.bx - f.ax) * f.t;
      f.g.y = f.ay + (f.by - f.ay) * f.t;
      f.g.alpha = Math.sin(Math.PI * f.t);
    }
    for (const tw of this.twinkles) tw.g.alpha = Math.max(0, Math.sin(sec * tw.speed + tw.phase)) ** 3;

    const st = this.lastState;
    this.currentRing.clear();
    if (st && st.phase !== 'gameOver') {
      const cur = st.players[st.currentPlayerIndex];
      const t = this.tokens.get(cur.id);
      if (t) {
        this.currentRing
          .ellipse(t.x, t.y + 22, 30 + pulse * 6, 10 + pulse * 2)
          .stroke({ width: 3, color: cur.color, alpha: 0.6 + pulse * 0.4 })
          .ellipse(t.x, t.y + 22, 22, 7)
          .fill({ color: cur.color, alpha: 0.25 });
      }
    }
    this.fx.update(dt);
    this.camera.update(dt);
  }

  private handleTap(wx: number, wy: number): void {
    this.onWorldTap?.(Math.round(wx), Math.round(wy));
    for (const n of Object.values(this.ctx.map.nodes)) {
      if (Math.hypot(n.pos.x - wx, n.pos.y - wy) <= NODE_R + 24) {
        this.onNodeTap?.(n.id);
        return;
      }
    }
  }
}
