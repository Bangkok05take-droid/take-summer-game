// 軽量パーティクル・浮遊テキスト・波紋。オブジェクト数を抑えてスマホでも軽く保つ。
import { Container, Graphics, Text } from 'pixi.js';

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  max: number;
  gravity: number;
  spin: number;
}

interface Floater {
  t: Text;
  life: number;
  max: number;
  y0: number;
}

interface Ripple {
  g: Graphics;
  life: number;
  max: number;
  color: number;
  r0: number;
  r1: number;
  width: number;
}

const MAX_PARTICLES = 160;

export class FxLayer extends Container {
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private ripples: Ripple[] = [];

  /** 金貨・光の粒がはじける */
  burst(x: number, y: number, color: number, count = 26, opts: { speed?: number; gravity?: number; coin?: boolean } = {}): void {
    const speed = opts.speed ?? 7;
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const g = new Graphics();
      const coin = opts.coin && i % 2 === 0;
      if (coin) {
        g.ellipse(0, 0, 9, 9).fill(0xf5d77a).stroke({ width: 2, color: 0x9c7a1c });
        g.rect(-1.5, -5, 3, 10).fill({ color: 0x9c7a1c, alpha: 0.8 });
      } else {
        g.star(0, 0, 4, 7, 2.5).fill(color);
      }
      g.blendMode = coin ? 'normal' : 'add';
      g.position.set(x, y);
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      const max = 700 + Math.random() * 500;
      this.particles.push({
        g,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (opts.gravity ? 6 : 0),
        life: max,
        max,
        gravity: opts.gravity ?? 0,
        spin: (Math.random() - 0.5) * 0.3,
      });
      this.addChild(g);
    }
  }

  ripple(x: number, y: number, color: number, r0 = 40, r1 = 120, width = 6, max = 600): void {
    const g = new Graphics();
    g.position.set(x, y);
    g.blendMode = 'add';
    this.ripples.push({ g, life: max, max, color, r0, r1, width });
    this.addChild(g);
  }

  floatText(x: number, y: number, text: string, color: number, size = 34, max = 1400): void {
    const t = new Text({
      text,
      style: {
        fontFamily: 'sans-serif',
        fontSize: size,
        fontWeight: '900',
        fill: color,
        stroke: { color: 0x000000, width: 6 },
        dropShadow: { color, blur: 10, distance: 0, alpha: 0.8 },
      },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.floaters.push({ t, life: max, max, y0: y });
    this.addChild(t);
  }

  update(dt: number): void {
    const k = dt / 16.7;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vy += p.gravity * k;
      p.vx *= 0.96;
      p.vy *= p.gravity ? 0.99 : 0.96;
      p.g.x += p.vx * k;
      p.g.y += p.vy * k;
      p.g.rotation += p.spin * k;
      const r = p.life / p.max;
      p.g.alpha = Math.min(1, r * 1.6);
      p.g.scale.set(0.5 + r * 0.7);
      if (p.life <= 0) {
        p.g.destroy();
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.life -= dt;
      const t = 1 - Math.max(0, r.life) / r.max;
      const e = 1 - (1 - t) ** 3;
      r.g.clear();
      r.g.circle(0, 0, r.r0 + (r.r1 - r.r0) * e).stroke({ width: r.width * (1 - t) + 1, color: r.color, alpha: 1 - t });
      if (r.life <= 0) {
        r.g.destroy();
        this.ripples.splice(i, 1);
      }
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      const t = 1 - Math.max(0, f.life) / f.max;
      // ポンと出て、ふわっと上がって消える
      const pop = t < 0.12 ? 0.6 + (t / 0.12) * 0.55 : t < 0.2 ? 1.15 - ((t - 0.12) / 0.08) * 0.15 : 1;
      f.t.scale.set(pop);
      f.t.y = f.y0 - 70 * (1 - (1 - t) ** 2);
      f.t.alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      if (f.life <= 0) {
        f.t.destroy();
        this.floaters.splice(i, 1);
      }
    }
  }
}
