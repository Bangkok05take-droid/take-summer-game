/* 戦場の描画（Canvas 2D）。論理 960×540 の座標で描き、端末の解像度に合わせて拡大する。
 * ロジックからは battle（読むだけ）と、battle.events（出来事）を受け取る。 */
import { drawUnit, spriteFor } from './shapes.js';

export const VIEW_W = 960;
export const VIEW_H = 540;
export const GROUND_Y = 392;      // 足元の基準（奥の列）
export const LANE_DEPTH = 22;     // 手前の列までのずれ
export const MINIMAP = { x: 250, y: 58, w: 460, h: 12 };
const UNIT_SCALE = 1.3;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camX = 0;
    this.fx = [];
    this.shake = 0;
    this.flashScreen = 0;
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.time = 0;
    this.stars = Array.from({ length: 50 }, (_, i) => ({ x: (i * 197) % 960, y: (i * 89) % 220 + 70, r: (i % 3) * 0.5 + 0.6 }));
  }

  resize(cssW, cssH, dpr) {
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.scale = this.canvas.width / VIEW_W;
  }

  clampCam(b) { this.camX = Math.max(0, Math.min(b.stage.length - VIEW_W, this.camX)); }
  centerOn(b, worldX) { this.camX = worldX - VIEW_W / 2; this.clampCam(b); }

  // ---------- 出来事 → 演出 ----------
  consume(b) {
    const byId = (id) => b.entities.find((e) => e.id === id);
    for (const ev of b.events.splice(0)) {
      const laneY = (l) => GROUND_Y + (l ?? 0.5) * LANE_DEPTH;
      switch (ev.type) {
        case 'hit': {
          const y = laneY(ev.lane) - 40;
          // 数字は魔王軍が与えたダメージだけ（大量の乱戦で画面が数字だらけにならないように）
          if (ev.side === 'human') this.add({ kind: 'num', x: ev.x + (Math.random() - 0.5) * 10, y, text: String(Math.round(ev.dmg)), color: '#ffe38a', life: 0.6, small: ev.dmg < 30 });
          this.add({ kind: 'spark', x: ev.x, y: y + 6, color: ev.side === 'human' ? '#fff3b0' : '#ff7ad9', life: 0.25 });
          break;
        }
        case 'death': {
          const y = laneY(ev.lane);
          this.add({ kind: 'puff', x: ev.x, y: y - 14, color: ev.side === 'human' ? '#ffd36b' : '#a78bfa', life: 0.6 });
          if (ev.side === 'demon') this.add({ kind: 'ghost', x: ev.x, y: y - 20, life: 1.0 });
          else this.add({ kind: 'stars', x: ev.x, y: y - 30, life: 0.7 });
          break;
        }
        case 'manaGain': this.add({ kind: 'num', x: ev.x, y: GROUND_Y - 70, text: '+' + ev.amount, color: '#d8b4fe', life: 0.9, small: true }); break;
        case 'heal': this.add({ kind: 'num', x: ev.x, y: GROUND_Y - 60, text: '+' + ev.amount, color: '#7ef0b0', life: 0.8, small: true }); break;
        case 'shot': {
          const e = byId(ev.id);
          this.add({ kind: 'shot', shot: ev.kind, from: ev.from, to: ev.to, y: laneY(e ? e.lane : 0.5) - 26, side: ev.side, life: 0.18 });
          break;
        }
        case 'strike': {
          const e = byId(ev.id);
          if (e && !e.def.projectile) this.add({ kind: 'slash', x: e.x + e.dir * 18, y: laneY(e.lane) - 24, dir: e.dir, area: ev.area, life: 0.18 });
          break;
        }
        case 'baseHit': this.shake = Math.max(this.shake, 3); this.add({ kind: 'spark', x: ev.x + (ev.side === 'human' ? -40 : 40), y: GROUND_Y - 60 - Math.random() * 60, color: '#fff', life: 0.25 }); break;
        case 'spell':
          this.add({ kind: 'spell', x0: ev.x0, x1: ev.x1, life: 1.1 });
          this.shake = 10; this.flashScreen = 0.5;
          break;
        case 'furnace': this.add({ kind: 'ring', x: b.shrine.x, y: GROUND_Y - 80, color: '#ffd36b', life: 0.8 }); break;
        case 'spawn': if (ev.side === 'demon') this.add({ kind: 'ring', x: ev.x, y: GROUND_Y - 10, color: '#c084fc', life: 0.4, small: true }); break;
        case 'alarm': this.add({ kind: 'banner', text: '人間軍の増援！', life: 1.6 }); break;
        default: break;
      }
    }
  }

  add(f) { f.age = 0; if (this.fx.length < 400) this.fx.push(f); }

  // ---------- 描画 ----------
  render(b, alpha, dt) {
    const ctx = this.ctx;
    this.time += dt;
    for (const f of this.fx) f.age += dt;
    this.fx = this.fx.filter((f) => f.age < f.life);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flashScreen = Math.max(0, this.flashScreen - dt);

    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const sx = this.reduced ? 0 : (Math.random() - 0.5) * this.shake;
    const sy = this.reduced ? 0 : (Math.random() - 0.5) * this.shake;

    this.drawBackground(b);
    ctx.save();
    ctx.translate(-Math.round(this.camX) + sx, sy);
    this.drawGround(b);
    this.drawShrine(b);
    this.drawBase(b);

    // 奥の列から順に（手前ほど後で描く）
    const list = b.entities.slice().sort((a, c) => a.lane - c.lane);
    for (const e of list) this.drawEntity(e, alpha, b);
    this.drawFx(ctx, false);
    ctx.restore();
    this.drawFx(ctx, true);

    if (this.flashScreen > 0 && !this.reduced) { ctx.fillStyle = `rgba(255,190,255,${this.flashScreen * 0.6})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    this.drawMinimap(b);
  }

  drawBackground(b) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, '#120621'); g.addColorStop(0.55, '#341457'); g.addColorStop(1, '#6b2a5e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(255,240,255,.7)';
    for (const s of this.stars) { const x = ((s.x - this.camX * 0.05) % 960 + 960) % 960; ctx.fillRect(x, s.y - 40, s.r, s.r); }
    // 月
    const mx = 760 - this.camX * 0.04;
    ctx.fillStyle = '#ffe6f2'; ctx.beginPath(); ctx.arc(mx, 120, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#341457'; ctx.beginPath(); ctx.arc(mx - 12, 112, 28, 0, Math.PI * 2); ctx.fill();
    // 遠くの山（ゆっくり動く）
    this.hills(0.2, '#2a1046', 300, 60, 210);
    this.hills(0.45, '#3d1650', 340, 40, 140);
  }

  hills(par, color, base, amp, wave) {
    const ctx = this.ctx;
    const off = this.camX * par;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= VIEW_W + 20; x += 20) {
      const wx = x + off;
      const y = base - Math.abs(Math.sin(wx / wave)) * amp - Math.sin(wx / (wave * 0.37)) * amp * 0.25;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(VIEW_W, GROUND_Y); ctx.closePath(); ctx.fill();
  }

  drawGround(b) {
    const ctx = this.ctx;
    const L = b.stage.length;
    const g = ctx.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, '#2c1240'); g.addColorStop(0.5, '#3c2a3a'); g.addColorStop(1, '#4a5a32'); // 魔界側 → 人間側
    ctx.fillStyle = g; ctx.fillRect(-50, GROUND_Y - 12, L + 100, VIEW_H - GROUND_Y + 12);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-50, GROUND_Y - 12, L + 100, 4);
    // 草・石（決まった位置）
    const x0 = Math.floor(this.camX / 40) * 40;
    for (let x = x0; x < this.camX + VIEW_W + 40; x += 40) {
      const h = (Math.sin(x * 12.9898) * 43758.5453) % 1;
      const r = Math.abs(h);
      ctx.fillStyle = x < L * 0.45 ? 'rgba(170,110,255,.35)' : 'rgba(150,200,110,.35)';
      ctx.fillRect(x + r * 30, GROUND_Y - 14 + r * 30, 3, 6);
      ctx.fillRect(x + r * 30 + 4, GROUND_Y - 12 + r * 30, 2, 4);
    }
  }

  drawShrine(b) {
    const ctx = this.ctx; const s = b.shrine; const x = s.x; const y = GROUND_Y + 6;
    const ratio = s.hp / s.maxHp;
    ctx.save(); ctx.translate(x, y);
    // 台座
    ctx.fillStyle = '#2a1840'; ctx.strokeStyle = '#120820'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-62, 0); ctx.lineTo(-52, -26); ctx.lineTo(52, -26); ctx.lineTo(62, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 柱（角）
    for (const sx of [-40, 40]) {
      ctx.fillStyle = '#3b2458';
      ctx.beginPath(); ctx.moveTo(sx - 10, -26); ctx.lineTo(sx - 6, -120); ctx.quadraticCurveTo(sx + sx * 0.3, -150, sx + sx * 0.15, -160); ctx.lineTo(sx + 8, -118); ctx.lineTo(sx + 10, -26); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // 封印の紋（光る）
    const p = 0.6 + Math.sin(this.time * 3) * 0.25;
    ctx.strokeStyle = `rgba(216,140,255,${p})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -80, 26, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * (Math.PI * 4 / 5); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 24, -80 + Math.sin(a) * 24); }
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = `rgba(190,110,255,${p * 0.35})`; ctx.beginPath(); ctx.arc(0, -80, 34, 0, Math.PI * 2); ctx.fill();
    // ひび（HPが減るほど）
    if (ratio < 0.66) this.cracks(ctx, -30, -60, ratio < 0.33 ? 3 : 1);
    ctx.restore();
  }

  drawBase(b) {
    const ctx = this.ctx; const s = b.base; const x = s.x; const y = GROUND_Y + 6;
    const ratio = s.hp / s.maxHp;
    ctx.save(); ctx.translate(x, y);
    const tilt = ratio < 0.33 ? -0.06 : 0;
    ctx.rotate(tilt);
    ctx.fillStyle = '#8a5a32'; ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 3;
    // 脚
    ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(-30, -110); ctx.lineTo(-22, -110); ctx.lineTo(-34, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(44, 0); ctx.lineTo(30, -110); ctx.lineTo(22, -110); ctx.lineTo(34, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-38, -30); ctx.lineTo(36, -70); ctx.moveTo(38, -30); ctx.lineTo(-36, -70); ctx.stroke();
    // 小屋
    ctx.fillStyle = '#c08a52'; ctx.lineWidth = 3;
    ctx.fillRect(-40, -150, 80, 42); ctx.strokeRect(-40, -150, 80, 42);
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(-12, -140, 24, 18);
    ctx.fillStyle = '#b8483a'; ctx.beginPath(); ctx.moveTo(-50, -148); ctx.lineTo(0, -184); ctx.lineTo(50, -148); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 旗
    ctx.strokeStyle = '#3a2410'; ctx.beginPath(); ctx.moveTo(0, -184); ctx.lineTo(0, -214); ctx.stroke();
    const w = Math.sin(this.time * 5) * 3;
    ctx.fillStyle = '#4a8ef0'; ctx.beginPath(); ctx.moveTo(0, -214); ctx.lineTo(-26, -207 + w); ctx.lineTo(0, -198); ctx.closePath(); ctx.fill();
    if (ratio < 0.66) this.cracks(ctx, -20, -140, ratio < 0.33 ? 3 : 1);
    ctx.restore();
  }

  cracks(ctx, x, y, n) {
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.moveTo(x + i * 22, y); ctx.lineTo(x + i * 22 + 8, y + 12); ctx.lineTo(x + i * 22 + 2, y + 22); ctx.lineTo(x + i * 22 + 10, y + 34); ctx.stroke();
    }
  }

  drawEntity(e, alpha, b) {
    const ctx = this.ctx;
    const x = e.px + (e.x - e.px) * alpha;
    const y = GROUND_Y + e.lane * LANE_DEPTH;
    if (x < this.camX - 80 || x > this.camX + VIEW_W + 80) return;
    const d = e.def;
    let pose = 'walk';
    let lean = 0; let push = 0; let a = 1; let rise = 0;
    if (e.state === 'attack') {
      if (e.timer < d.windup) { pose = 'windup'; lean = -0.12 * (e.timer / d.windup); push = -3 * (e.timer / d.windup); }
      else if (e.timer < d.windup + 0.15) { pose = 'strike'; push = 7; lean = 0.1; }
      else pose = 'idle';
    } else if (e.state === 'kb') { pose = 'kb'; lean = -0.5 * (1 - e.timer / 0.45); rise = Math.sin(Math.min(1, e.timer / 0.45) * Math.PI) * 18; }
    else if (e.state === 'dead') { pose = 'dead'; a = Math.max(0, 1 - e.timer / 0.7); lean = -0.6; rise = e.timer * 30; }

    // 影
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(x, y, 20 * d.size, 5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x + push * e.dir, y - rise);
    ctx.scale(e.dir * d.size * UNIT_SCALE, d.size * UNIT_SCALE);
    ctx.rotate(lean);
    const sp = spriteFor(e.key);
    if (sp) {
      const fr = sp.frames;
      const idx = pose === 'windup' ? fr.windup : pose === 'strike' ? fr.attack : fr.walk[Math.floor((this.time + e.id) / 0.2) % fr.walk.length];
      const flip = sp.facing === 'left' ? -1 : 1;
      ctx.scale(flip * (sp.scale || 0.5), sp.scale || 0.5);
      ctx.drawImage(sp.img, idx * sp.frameW, 0, sp.frameW, sp.frameH, -sp.frameW / 2, -sp.footY, sp.frameW, sp.frameH);
    } else {
      drawUnit(ctx, e.key, { size: d.size, flash: e.flash > 0, t: this.time + e.id * 0.37, pose });
    }
    ctx.restore();

    // HPが減っているときだけ小さなバー
    if (e.state !== 'dead' && e.hp < e.maxHp) {
      const w = 26 * Math.max(0.8, d.size);
      const top = y - 70 * d.size * UNIT_SCALE - 4;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - w / 2, top, w, 4);
      ctx.fillStyle = e.side === 'demon' ? '#c084fc' : '#fbbf24';
      ctx.fillRect(x - w / 2, top, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  drawFx(ctx, screen) {
    for (const f of this.fx) {
      const p = f.age / f.life;
      if ((f.kind === 'banner') !== screen) continue;
      switch (f.kind) {
        case 'num': {
          ctx.globalAlpha = 1 - p * p;
          ctx.font = `800 ${f.small ? 13 : 16}px system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#1a0526';
          const yy = f.y - p * 26;
          ctx.strokeText(f.text, f.x, yy); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, yy);
          ctx.globalAlpha = 1; break;
        }
        case 'spark': {
          ctx.strokeStyle = f.color; ctx.lineWidth = 2.5; ctx.globalAlpha = 1 - p;
          const r = 6 + p * 12;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + f.x; ctx.moveTo(f.x + Math.cos(a) * r * 0.4, f.y + Math.sin(a) * r * 0.4); ctx.lineTo(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r); }
          ctx.stroke(); ctx.globalAlpha = 1; break;
        }
        case 'slash': {
          ctx.strokeStyle = f.area ? '#ffb070' : '#ffffff'; ctx.lineWidth = f.area ? 5 : 3; ctx.globalAlpha = 1 - p;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.area ? 26 : 16, f.dir > 0 ? -1.2 : Math.PI - 1.2 + 0.0, f.dir > 0 ? 1.0 : Math.PI + 1.0); ctx.stroke();
          ctx.globalAlpha = 1; break;
        }
        case 'shot': {
          const x = f.from + (f.to - f.from) * p;
          if (f.shot === 'arrow') {
            ctx.strokeStyle = '#ffe9b0'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x - 10 * Math.sign(f.to - f.from), f.y - Math.sin(p * Math.PI) * 20); ctx.lineTo(x, f.y - Math.sin(p * Math.PI) * 20); ctx.stroke();
          } else {
            ctx.fillStyle = f.shot === 'fire' ? '#ff8a3a' : '#fff3a0';
            ctx.beginPath(); ctx.arc(x, f.y, 6, 0, Math.PI * 2); ctx.fill();
          }
          break;
        }
        case 'puff': {
          ctx.globalAlpha = 1 - p; ctx.fillStyle = f.color;
          for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * p * 22, f.y + Math.sin(a) * p * 14, 6 * (1 - p) + 2, 0, Math.PI * 2); ctx.fill(); }
          ctx.globalAlpha = 1; break;
        }
        case 'ghost': {
          ctx.globalAlpha = (1 - p) * 0.8; ctx.fillStyle = '#e9d5ff';
          const yy = f.y - p * 40;
          ctx.beginPath(); ctx.arc(f.x, yy, 7, Math.PI, 0); ctx.lineTo(f.x + 7, yy + 8); ctx.lineTo(f.x, yy + 5); ctx.lineTo(f.x - 7, yy + 8); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1; break;
        }
        case 'stars': {
          ctx.globalAlpha = 1 - p; ctx.fillStyle = '#ffe680';
          for (let i = 0; i < 3; i++) { const a = this.time * 6 + i * 2.1; ctx.fillRect(f.x + Math.cos(a) * 12 - 2, f.y + Math.sin(a) * 4 - 2, 4, 4); }
          ctx.globalAlpha = 1; break;
        }
        case 'ring': {
          ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - p; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(f.x, f.y, (f.small ? 14 : 30) + p * 30, (f.small ? 5 : 12) + p * 10, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1; break;
        }
        case 'spell': {
          // 紫の雷が祠から前方へ走り、地面がはじける
          const front = f.x0 + (f.x1 - f.x0) * Math.min(1, p * 2.2);
          ctx.globalAlpha = Math.max(0, 1 - p);
          const g = ctx.createLinearGradient(f.x0, 0, front, 0);
          g.addColorStop(0, 'rgba(160,60,255,0)'); g.addColorStop(1, 'rgba(255,120,230,.55)');
          ctx.fillStyle = g; ctx.fillRect(f.x0, GROUND_Y - 160, front - f.x0, 190);
          ctx.strokeStyle = '#ffd6ff'; ctx.lineWidth = 3;
          for (let i = 0; i < 9; i++) {
            const bx = f.x0 + (i + 0.5) * (f.x1 - f.x0) / 9;
            if (bx > front) break;
            ctx.beginPath(); let yy = 70; ctx.moveTo(bx, yy);
            while (yy < GROUND_Y) { yy += 24; ctx.lineTo(bx + Math.sin(yy * 0.3 + i + this.time * 30) * 10, yy); }
            ctx.stroke();
          }
          ctx.globalAlpha = 1; break;
        }
        case 'banner': {
          ctx.globalAlpha = p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1;
          ctx.fillStyle = 'rgba(120,10,30,.75)'; ctx.fillRect(0, 160, VIEW_W, 44);
          ctx.font = '800 24px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe1e5';
          ctx.fillText(f.text, VIEW_W / 2, 190); ctx.globalAlpha = 1; break;
        }
        default: break;
      }
    }
  }

  drawMinimap(b) {
    const ctx = this.ctx; const m = MINIMAP; const L = b.stage.length;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(m.x - 4, m.y - 3, m.w + 8, m.h + 6);
    const k = m.w / L;
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(m.x + this.camX * k, m.y - 1, VIEW_W * k, m.h + 2);
    ctx.fillStyle = '#a855f7'; ctx.fillRect(m.x + b.shrine.x * k - 3, m.y, 6, m.h);
    ctx.fillStyle = '#f2b84b'; ctx.fillRect(m.x + b.base.x * k - 3, m.y, 6, m.h);
    for (const e of b.entities) {
      if (e.state === 'dead') continue;
      ctx.fillStyle = e.side === 'demon' ? '#d8b4fe' : '#ffe08a';
      ctx.fillRect(m.x + e.x * k - 1, m.y + 2 + e.lane * (m.h - 6), 2, 3);
    }
  }

  // 一覧ボタン用の小さな絵
  static thumb(canvas, key, size) {
    const c = canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    const s = canvas.height / 72;
    c.translate(canvas.width / 2, canvas.height - 6 * s);
    const k = Math.min(1.15, 1 / Math.max(0.8, size)) * s;
    c.scale(k, k);
    drawUnit(c, key, { size, flash: false, t: 0.3, pose: 'idle' });
  }
}
