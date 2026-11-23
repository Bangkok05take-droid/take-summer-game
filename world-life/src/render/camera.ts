// マップのスクロール・ピンチズーム・ホイールズーム・タップ判定
import type { Application, Container } from 'pixi.js';

const TAP_SLOP = 10;
const MAX_SCALE = 2.6;

export class Camera {
  private pointers = new Map<number, { x: number; y: number }>();
  private downAt: { x: number; y: number; t: number } | null = null;
  private moved = false;
  private pinchDist = 0;
  /** 自動追従の目標（ワールド座標の画面中心） */
  private target: { x: number; y: number } | null = null;
  private targetLerp = 0.15;
  private el: HTMLCanvasElement;

  constructor(
    private app: Application,
    private world: Container,
    private size: { width: number; height: number },
    private onTap: (wx: number, wy: number) => void,
  ) {
    this.el = app.canvas;
    this.el.style.touchAction = 'none';
    this.el.addEventListener('pointerdown', this.down);
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    this.el.addEventListener('wheel', this.wheel, { passive: false });
    app.renderer.on('resize', this.onResize);
  }

  destroy(): void {
    this.el.removeEventListener('pointerdown', this.down);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.up);
    this.el.removeEventListener('wheel', this.wheel);
  }

  private get screen() {
    return this.app.screen;
  }

  private fitScale(): number {
    const pad = 0.96;
    return Math.min(this.screen.width / this.size.width, this.screen.height / this.size.height) * pad;
  }

  fit(): void {
    const s = this.fitScale();
    this.world.scale.set(s);
    this.world.position.set(
      (this.screen.width - this.size.width * s) / 2,
      (this.screen.height - this.size.height * s) / 2,
    );
    this.target = null;
  }

  private onResize = () => {
    this.fit();
  };

  private clamp(): void {
    const s = Math.max(this.fitScale() * 0.8, Math.min(MAX_SCALE, this.world.scale.x));
    this.world.scale.set(s);
    const w = this.size.width * s;
    const h = this.size.height * s;
    const sw = this.screen.width;
    const sh = this.screen.height;
    const m = 80; // 端の余白
    const clampAxis = (pos: number, len: number, view: number) =>
      len <= view ? (view - len) / 2 : Math.min(m, Math.max(view - len - m, pos));
    this.world.x = clampAxis(this.world.x, w, sw);
    this.world.y = clampAxis(this.world.y, h, sh);
  }

  private zoomAt(sx: number, sy: number, factor: number): void {
    const s0 = this.world.scale.x;
    const s1 = Math.max(this.fitScale() * 0.8, Math.min(MAX_SCALE, s0 * factor));
    const wx = (sx - this.world.x) / s0;
    const wy = (sy - this.world.y) / s0;
    this.world.scale.set(s1);
    this.world.x = sx - wx * s1;
    this.world.y = sy - wy * s1;
    this.clamp();
  }

  private local(e: PointerEvent | WheelEvent) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down = (e: PointerEvent) => {
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    this.target = null;
    if (this.pointers.size === 1) {
      this.downAt = { ...p, t: performance.now() };
      this.moved = false;
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.moved = true;
    }
  };

  private move = (e: PointerEvent) => {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const p = this.local(e);
    if (this.pointers.size === 1) {
      if (this.downAt && Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) > TAP_SLOP) this.moved = true;
      if (this.moved) {
        this.world.x += p.x - prev.x;
        this.world.y += p.y - prev.y;
        this.clamp();
      }
      this.pointers.set(e.pointerId, p);
    } else if (this.pointers.size === 2) {
      this.pointers.set(e.pointerId, p);
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDist > 0) this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / this.pinchDist);
      this.pinchDist = d;
    }
  };

  private up = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0 && this.downAt && !this.moved) {
      const s = this.world.scale.x;
      this.onTap((p.x - this.world.x) / s, (p.y - this.world.y) / s);
    }
    if (this.pointers.size === 0) this.downAt = null;
    this.pinchDist = 0;
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = this.local(e);
    this.target = null;
    this.zoomAt(p.x, p.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  /** ワールド座標を画面中央へ滑らかに寄せる */
  panTo(wx: number, wy: number, lerp = 0.12): void {
    if (this.pointers.size > 0) return;
    this.target = { x: wx, y: wy };
    this.targetLerp = lerp;
  }

  /** 移動中の駒を追う（画面端に近づいたときだけ） */
  follow(wx: number, wy: number, lerp = 0.12): void {
    // 全体表示のときは追従しない（ズーム中のみ）
    if (this.pointers.size > 0 || this.world.scale.x <= this.fitScale() * 1.05) return;
    const s = this.world.scale.x;
    const sx = wx * s + this.world.x;
    const sy = wy * s + this.world.y;
    const mx = this.screen.width * 0.25;
    const my = this.screen.height * 0.25;
    if (sx < mx || sx > this.screen.width - mx || sy < my || sy > this.screen.height - my) this.panTo(wx, wy, lerp);
  }

  update(dt: number): void {
    if (!this.target) return;
    const s = this.world.scale.x;
    const goalX = this.screen.width / 2 - this.target.x * s;
    const goalY = this.screen.height / 2 - this.target.y * s;
    const k = 1 - Math.pow(1 - this.targetLerp, dt / 16.7);
    const bx = this.world.x;
    const by = this.world.y;
    this.world.x += (goalX - this.world.x) * k;
    this.world.y += (goalY - this.world.y) * k;
    this.clamp();
    const stuck = Math.abs(bx - this.world.x) < 0.1 && Math.abs(by - this.world.y) < 0.1;
    if (stuck || (Math.abs(goalX - this.world.x) < 0.5 && Math.abs(goalY - this.world.y) < 0.5)) this.target = null;
  }
}
