/* 戦場の描画（Canvas 2D）。論理 960×540 の座標で描き、端末の解像度に合わせて拡大する。
 * 左：人間軍の拠点 ／ 右：魔王軍の封印の祠。ロジックからは battle（読むだけ）と battle.events（出来事）を受け取る。 */
import { drawUnit, spriteFor } from './shapes.js';

export const VIEW_W = 960;
export const VIEW_H = 540;
export const GROUND_Y = 388;      // 足元の基準（奥の列）
export const LANE_DEPTH = 26;     // 手前の列までのずれ（重なりすぎないように）
export const MINIMAP = { x: 250, y: 66, w: 460, h: 12 };
const UNIT_SCALE = 1.3;

// ステージの景色（時間帯・小物）
const THEMES = {
  watch: { time: 'day', props: ['windmill', 'houses'], base: 'tower' },
  wheat: { time: 'day', props: ['wheat', 'houses', 'windmill'], base: 'tower' },
  river: { time: 'day', props: ['river', 'houses'], base: 'tower' },
  gate: { time: 'sunset', props: ['houses', 'windmill'], base: 'gate' },
  plaza: { time: 'night', props: ['houses', 'fountain'], base: 'castle' },
};
const SKY = {
  day: { top: '#5fb4f0', mid: '#a6dcf7', low: '#e7f6ff', far: '#7fa6c9', hill: '#6fb15a', hill2: '#4f9a46', light: '#fff6c8' },
  sunset: { top: '#5a5fb0', mid: '#f08a5d', low: '#ffd08a', far: '#8a6a8f', hill: '#7b8a4a', hill2: '#5a6e3a', light: '#ffe3a0' },
  night: { top: '#121a3e', mid: '#2a3f74', low: '#4d6a9a', far: '#33406a', hill: '#2f5a4a', hill2: '#244a3e', light: '#f4f0ff' },
};

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
    this.stars = Array.from({ length: 60 }, (_, i) => ({ x: (i * 197) % 960, y: (i * 89) % 200 + 70, r: (i % 3) * 0.5 + 0.6 }));
    this.clouds = Array.from({ length: 7 }, (_, i) => ({ x: i * 420 + 60, y: 105 + (i % 3) * 26, s: 0.7 + (i % 4) * 0.15 }));
  }

  resize(cssW, cssH, dpr) {
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.scale = this.canvas.width / VIEW_W;
  }

  clampCam(b) { this.camX = Math.max(0, Math.min(b.stage.length - VIEW_W, this.camX)); }
  centerOn(b, worldX) { this.camX = worldX - VIEW_W / 2; this.clampCam(b); }
  theme(b) { return THEMES[b.stage.theme] || THEMES.watch; }

  // ---------- 出来事 → 演出 ----------
  consume(b, onEvent) {
    const byId = (id) => b.entities.find((e) => e.id === id);
    const laneY = (l) => GROUND_Y + (l ?? 0.5) * LANE_DEPTH;
    for (const ev of b.events.splice(0)) {
      if (onEvent) onEvent(ev);
      switch (ev.type) {
        case 'hit': {
          const y = laneY(ev.lane) - 44;
          // 数字は魔王軍が与えたダメージだけ（乱戦で画面が数字だらけにならないように）
          if (ev.side === 'human' && ev.dmg >= 20) this.add({ kind: 'num', x: ev.x + (Math.random() - 0.5) * 12, y, text: String(ev.dmg), color: ev.dmg >= 100 ? '#ff9b5a' : '#fff3a0', life: 0.6, small: ev.dmg < 30, big: ev.dmg >= 100 });
          this.add({ kind: 'spark', x: ev.x, y: y + 14, color: ev.side === 'human' ? '#fff3b0' : '#ff7ad9', life: 0.22 });
          break;
        }
        case 'death': {
          const y = laneY(ev.lane);
          this.add({ kind: 'puff', x: ev.x, y: y - 16, color: ev.side === 'human' ? '#ffe9a8' : '#b58cff', life: 0.6 });
          if (ev.side === 'demon') this.add({ kind: 'ghost', x: ev.x, y: y - 24, life: 1.0 });
          else this.add({ kind: 'stars', x: ev.x, y: y - 36, life: 0.7 });
          if (ev.hero) this.add({ kind: 'banner', text: '勇者が撤退した！', color: '#5b2a99', life: 1.8 });
          break;
        }
        case 'manaGain': this.add({ kind: 'num', x: ev.x, y: GROUND_Y - 84, text: '+' + ev.amount, color: '#e2c6ff', life: 0.9, small: true }); break;
        case 'heal': if (ev.amount > 0) this.add({ kind: 'num', x: ev.x, y: laneY(ev.lane) - 56, text: '+' + ev.amount, color: '#7ef0b0', life: 0.8, small: true }); break;
        case 'healCast': this.add({ kind: 'ring', x: ev.x, y: GROUND_Y + 10, color: '#7ef0b0', life: 0.7, w: ev.radius }); break;
        case 'shot': {
          const e = byId(ev.id);
          this.add({ kind: 'shot', shot: ev.kind, from: ev.from, to: ev.to, y: laneY(e ? e.lane : 0.5) - 32, side: ev.side, big: ev.big, life: ev.kind === 'arrow' ? 0.22 : 0.26 });
          break;
        }
        case 'strike': {
          const e = byId(ev.id);
          if (e && !e.def.projectile) this.add({ kind: 'slash', x: e.x + e.dir * 22, y: laneY(e.lane) - 30, dir: e.dir, area: ev.area, life: 0.18 });
          break;
        }
        case 'fizzle': this.add({ kind: 'fizzle', x: ev.x, y: laneY(ev.lane) - 60, life: 1.0 }); break;
        case 'bigMagic': this.add({ kind: 'boom', x: ev.x, y: GROUND_Y - 10, r: ev.radius, life: 0.6 }); this.shake = Math.max(this.shake, 6); break;
        case 'stun': this.add({ kind: 'flashRing', x: ev.x, y: laneY(ev.lane) - 30, life: 0.4 }); break;
        case 'skillStart': {
          const e = byId(ev.id);
          if (e) this.add({ kind: 'warn', id: ev.id, text: ev.name, life: 1.0 });
          break;
        }
        case 'skill':
          if (ev.skill === 'wave') this.add({ kind: 'wave', x: ev.x, dir: ev.dir, reach: ev.reach, life: 0.45 });
          else if (ev.skill === 'stun') this.add({ kind: 'lightBurst', x: ev.x, dir: ev.dir, reach: ev.reach, life: 0.6 });
          else if (ev.skill === 'heal') this.add({ kind: 'ring', x: ev.x, y: GROUND_Y + 10, color: '#a8ffcf', life: 0.9, w: 260 });
          else if (ev.skill === 'charge') this.add({ kind: 'wave', x: ev.x, dir: ev.dir, reach: ev.reach, life: 0.45, color: '#ffb070' });
          this.shake = Math.max(this.shake, 4);
          break;
        case 'baseHit': this.shake = Math.max(this.shake, 2.5); this.add({ kind: 'spark', x: ev.x + (ev.side === 'human' ? 40 : -40), y: GROUND_Y - 60 - Math.random() * 70, color: '#fff', life: 0.25 }); break;
        case 'spell':
          this.add({ kind: 'spell', x: ev.x, r: ev.radius, life: 1.2 });
          this.shake = 12; this.flashScreen = 0.5;
          break;
        case 'furnace': this.add({ kind: 'ring', x: b.shrine.x, y: GROUND_Y - 90, color: '#ffd36b', life: 0.8, w: 40 }); break;
        case 'spawn':
          if (ev.side === 'demon') this.add({ kind: 'ring', x: ev.x, y: GROUND_Y + 8, color: '#c084fc', life: 0.4, w: 16 });
          break;
        case 'alarm': this.add({ kind: 'banner', text: '人間軍の増援！', color: '#8a1c2c', life: 1.6 }); break;
        case 'heroAlarm': this.add({ kind: 'banner', text: ev.who === 'take' ? '勇者たけ 参上！' : '勇者サイ 参上！', sub: ev.line, color: '#1d4f9a', life: 2.6, hero: true }); this.shake = 6; break;
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

    const th = this.theme(b);
    const sky = SKY[th.time];
    this.drawSky(sky, th);
    ctx.save();
    ctx.translate(-Math.round(this.camX) + sx, sy);
    this.drawGround(b, sky, th);
    this.drawBase(b, th);
    this.drawShrine(b);

    const list = b.entities.slice().sort((a, c) => a.lane - c.lane);
    for (const e of list) this.drawEntity(e, alpha);
    this.drawFx(ctx, false, b);
    ctx.restore();
    this.drawFx(ctx, true, b);

    if (this.flashScreen > 0 && !this.reduced) { ctx.fillStyle = `rgba(230,160,255,${this.flashScreen * 0.55})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (b.entities.length || b.t > 0) this.drawMinimap(b);
  }

  drawSky(sky, th) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, sky.top); g.addColorStop(0.55, sky.mid); g.addColorStop(1, sky.low);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (th.time === 'night') {
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      for (const s of this.stars) { const x = ((s.x - this.camX * 0.05) % 960 + 960) % 960; ctx.fillRect(x, s.y - 20, s.r, s.r); }
      ctx.fillStyle = sky.light; ctx.beginPath(); ctx.arc(780 - this.camX * 0.03, 140, 26, 0, Math.PI * 2); ctx.fill();
    } else {
      const sunY = th.time === 'sunset' ? 250 : 130;
      ctx.fillStyle = th.time === 'sunset' ? 'rgba(255,200,120,.9)' : 'rgba(255,250,210,.95)';
      ctx.beginPath(); ctx.arc(200 - this.camX * 0.03, sunY, th.time === 'sunset' ? 40 : 30, 0, Math.PI * 2); ctx.fill();
      // 雲（ゆっくり流れる）
      for (const c of this.clouds) {
        const x = ((c.x - this.camX * 0.1 + this.time * 6) % 2900 + 2900) % 2900 - 200;
        if (x > VIEW_W + 100) continue;
        ctx.fillStyle = th.time === 'sunset' ? 'rgba(255,220,200,.75)' : 'rgba(255,255,255,.9)';
        ctx.beginPath(); ctx.ellipse(x, c.y, 46 * c.s, 14 * c.s, 0, 0, Math.PI * 2); ctx.ellipse(x + 26 * c.s, c.y - 10 * c.s, 28 * c.s, 14 * c.s, 0, 0, Math.PI * 2); ctx.ellipse(x - 24 * c.s, c.y - 4 * c.s, 22 * c.s, 10 * c.s, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 遠くの山（青み）と、近くの丘（緑）
    this.hills(0.15, sky.far, 280, 90, 160, true);
    this.hills(0.35, sky.hill, 330, 46, 120);
  }

  hills(par, color, base, amp, wave, peaks) {
    const ctx = this.ctx;
    const off = this.camX * par;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= VIEW_W + 20; x += 16) {
      const wx = x + off;
      const y = peaks
        ? base - Math.abs(Math.sin(wx / wave)) * amp - Math.abs(Math.sin(wx / (wave * 0.41))) * amp * 0.35
        : base - Math.sin(wx / wave) * amp * 0.5 - Math.sin(wx / (wave * 0.37)) * amp * 0.25;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(VIEW_W, GROUND_Y); ctx.closePath(); ctx.fill();
    if (peaks) { // 雪
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let x = 0; x <= VIEW_W; x += 16) {
        const wx = x + off; const h = Math.abs(Math.sin(wx / wave)) * amp + Math.abs(Math.sin(wx / (wave * 0.41))) * amp * 0.35;
        if (h > amp * 1.05) ctx.fillRect(x, base - h, 16, 6);
      }
    }
  }

  // 地面と、ステージごとの小物（世界座標）
  drawGround(b, sky, th) {
    const ctx = this.ctx; const L = b.stage.length;
    const v0 = this.camX - 40; const v1 = this.camX + VIEW_W + 40;
    // 中景：家・風車（少しだけ視差をつけるため、世界座標に固定せず camX*0.4 で置く）
    ctx.save(); ctx.translate(this.camX * 0.45, 0);
    if (th.props.includes('houses')) for (let x = 200; x < L; x += 520) this.house(x + (x % 3) * 40, GROUND_Y - 44, sky, th.time);
    if (th.props.includes('windmill')) this.windmill(L * 0.42, GROUND_Y - 40, th.time);
    if (th.props.includes('fountain')) this.fountain(L * 0.4, GROUND_Y - 30, th.time);
    ctx.restore();

    // 地面：左（人間側）は草、右（祠のまわり）は魔界に染まった紫
    const g = ctx.createLinearGradient(0, 0, L, 0);
    const dark = th.time === 'night';
    g.addColorStop(0, dark ? '#3e6a3a' : '#79b84d'); g.addColorStop(0.62, dark ? '#3a5e36' : '#6aa646');
    g.addColorStop(0.82, dark ? '#3a3050' : '#7a6a8a'); g.addColorStop(1, '#3a1f52');
    ctx.fillStyle = g; ctx.fillRect(v0, GROUND_Y - 14, v1 - v0, VIEW_H - GROUND_Y + 14);
    // 土の道
    ctx.fillStyle = dark ? 'rgba(120,100,80,.55)' : 'rgba(196,160,110,.75)';
    ctx.fillRect(v0, GROUND_Y + 2, v1 - v0, 30);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(v0, GROUND_Y + 30, v1 - v0, 3);
    // 草・石（決まった位置）
    const x0 = Math.floor(v0 / 36) * 36;
    for (let x = x0; x < v1; x += 36) {
      const r = Math.abs((Math.sin(x * 12.9898) * 43758.5453) % 1);
      const purple = x > L * 0.8;
      ctx.fillStyle = purple ? 'rgba(200,140,255,.45)' : (dark ? 'rgba(140,200,120,.4)' : 'rgba(40,110,40,.55)');
      ctx.fillRect(x + r * 30, GROUND_Y - 14 + r * 8, 3, 7); ctx.fillRect(x + r * 30 + 4, GROUND_Y - 12 + r * 8, 2, 5);
      if (r > 0.82) { ctx.fillStyle = 'rgba(120,110,100,.8)'; ctx.beginPath(); ctx.ellipse(x + 10, GROUND_Y + 40 + r * 40, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); }
      if (!purple && r < 0.12 && !dark) { ctx.fillStyle = '#ffe36b'; ctx.fillRect(x + 6, GROUND_Y + 50 + r * 200, 3, 3); }
    }
    if (th.props.includes('wheat')) {
      for (let x = Math.max(300, x0); x < Math.min(L * 0.7, v1); x += 10) {
        const sw = Math.sin(this.time * 2 + x * 0.05) * 2;
        ctx.strokeStyle = '#e2b84a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, GROUND_Y - 14); ctx.lineTo(x + sw, GROUND_Y - 34 - (x % 7)); ctx.stroke();
      }
      ctx.fillStyle = '#8a5a2a';
      for (let x = Math.max(260, x0); x < Math.min(L * 0.72, v1); x += 60) { ctx.fillRect(x, GROUND_Y - 30, 5, 22); }
      ctx.fillRect(Math.max(260, v0), GROUND_Y - 26, Math.min(L * 0.72, v1) - Math.max(260, v0), 3);
    }
    if (th.props.includes('river')) this.riverBridge(L * 0.5);
  }

  house(x, y, sky, time) {
    const ctx = this.ctx;
    ctx.fillStyle = time === 'night' ? '#b8a890' : '#f2e4c6'; ctx.fillRect(x - 26, y - 30, 52, 34);
    ctx.fillStyle = time === 'night' ? '#6a3a3a' : '#c8553d';
    ctx.beginPath(); ctx.moveTo(x - 32, y - 28); ctx.lineTo(x, y - 54); ctx.lineTo(x + 32, y - 28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = time === 'night' ? '#ffd76a' : '#5a7aa0'; ctx.fillRect(x - 16, y - 20, 10, 10); ctx.fillRect(x + 6, y - 20, 10, 10);
    ctx.fillStyle = '#7a5030'; ctx.fillRect(x - 4, y - 12, 8, 16);
  }

  windmill(x, y, time) {
    const ctx = this.ctx;
    ctx.fillStyle = time === 'night' ? '#9a8a78' : '#efe3cc';
    ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.lineTo(x - 10, y - 70); ctx.lineTo(x + 10, y - 70); ctx.lineTo(x + 16, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a0553a'; ctx.beginPath(); ctx.moveTo(x - 14, y - 68); ctx.lineTo(x, y - 84); ctx.lineTo(x + 14, y - 68); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(x, y - 70); ctx.rotate(this.time * 0.8);
    ctx.fillStyle = 'rgba(250,245,235,.95)'; ctx.strokeStyle = '#7a5030'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.fillRect(2, -4, 38, 8); ctx.strokeRect(2, -4, 38, 8); }
    ctx.restore();
  }

  fountain(x, y, time) {
    const ctx = this.ctx;
    ctx.fillStyle = '#b8b0a8'; ctx.beginPath(); ctx.ellipse(x, y, 46, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6ab0e0'; ctx.beginPath(); ctx.ellipse(x, y - 2, 38, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a8a098'; ctx.fillRect(x - 5, y - 34, 10, 32);
    ctx.fillStyle = 'rgba(160,220,255,.8)';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(x + i * 7, y - 34 - Math.abs(Math.sin(this.time * 3 + i)) * 10, 2.5, 0, Math.PI * 2); ctx.fill(); }
    if (time === 'night') { ctx.fillStyle = 'rgba(255,220,120,.25)'; ctx.beginPath(); ctx.arc(x, y - 20, 50, 0, Math.PI * 2); ctx.fill(); }
  }

  riverBridge(x) {
    const ctx = this.ctx;
    // 川（道の下を横切る）と石橋
    ctx.fillStyle = '#5aa8e0'; ctx.fillRect(x - 90, GROUND_Y - 14, 180, VIEW_H - GROUND_Y + 14);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 6; i++) ctx.fillRect(x - 80 + ((i * 37 + this.time * 30) % 160), GROUND_Y + 50 + i * 14, 14, 2);
    ctx.fillStyle = '#b9b2a6'; ctx.fillRect(x - 110, GROUND_Y - 16, 220, 22);
    ctx.fillStyle = '#9a9286'; ctx.beginPath(); ctx.moveTo(x - 110, GROUND_Y + 6); ctx.lineTo(x + 110, GROUND_Y + 6); ctx.lineTo(x + 80, GROUND_Y + 36); ctx.quadraticCurveTo(x, GROUND_Y - 4, x - 80, GROUND_Y + 36); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1;
    for (let i = -100; i < 110; i += 20) { ctx.beginPath(); ctx.moveTo(x + i, GROUND_Y - 16); ctx.lineTo(x + i, GROUND_Y + 6); ctx.stroke(); }
    ctx.fillStyle = '#d0c8bc'; ctx.fillRect(x - 112, GROUND_Y - 22, 224, 6);
  }

  // 人間軍の拠点（左）
  drawBase(b, th) {
    const ctx = this.ctx; const s = b.base; const x = s.x; const y = GROUND_Y + 8;
    const ratio = s.hp / s.maxHp;
    ctx.save(); ctx.translate(x, y);
    if (ratio < 0.33) ctx.rotate(0.04);
    const stone = '#d9c9a3'; const edge = '#6a5a3a';
    ctx.lineWidth = 3; ctx.strokeStyle = edge;
    if (th.base === 'tower') {
      ctx.fillStyle = '#9a6a3a';
      for (const sx of [-34, 34]) { ctx.beginPath(); ctx.moveTo(sx * 1.2, 0); ctx.lineTo(sx * 0.7, -110); ctx.lineTo(sx * 0.5, -110); ctx.lineTo(sx * 0.95, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-36, -30); ctx.lineTo(34, -72); ctx.moveTo(36, -30); ctx.lineTo(-34, -72); ctx.stroke();
      ctx.lineWidth = 3; ctx.fillStyle = '#c99a62'; ctx.fillRect(-40, -152, 80, 44); ctx.strokeRect(-40, -152, 80, 44);
      ctx.fillStyle = '#3a2614'; ctx.fillRect(-12, -142, 24, 18);
      ctx.fillStyle = '#3e6fc4'; ctx.beginPath(); ctx.moveTo(-50, -150); ctx.lineTo(0, -186); ctx.lineTo(50, -150); ctx.closePath(); ctx.fill(); ctx.stroke();
      this.flag(0, -186, 30);
    } else if (th.base === 'gate') {
      ctx.fillStyle = stone;
      ctx.fillRect(-60, -130, 34, 130); ctx.strokeRect(-60, -130, 34, 130); ctx.fillRect(26, -130, 34, 130); ctx.strokeRect(26, -130, 34, 130);
      ctx.fillRect(-60, -150, 120, 30); ctx.strokeRect(-60, -150, 120, 30);
      for (let i = -60; i < 60; i += 20) { ctx.fillRect(i, -162, 12, 12); ctx.strokeRect(i, -162, 12, 12); }
      ctx.fillStyle = '#7a4a24'; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-26, -90); ctx.quadraticCurveTo(0, -116, 26, -90); ctx.lineTo(26, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#4a2a14'; ctx.lineWidth = 2; for (let i = -18; i < 26; i += 10) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, -96); ctx.stroke(); }
      this.flag(-44, -162, 34); this.flag(44, -162, 34);
    } else { // castle
      ctx.fillStyle = stone;
      ctx.fillRect(-70, -120, 140, 120); ctx.strokeRect(-70, -120, 140, 120);
      for (const tx of [-70, 40]) { ctx.fillRect(tx, -170, 30, 170); ctx.strokeRect(tx, -170, 30, 170); for (let i = 0; i < 3; i++) { ctx.fillRect(tx + i * 11 - 1, -182, 8, 12); ctx.strokeRect(tx + i * 11 - 1, -182, 8, 12); } }
      for (let i = -40; i < 40; i += 16) { ctx.fillRect(i, -132, 10, 12); ctx.strokeRect(i, -132, 10, 12); }
      ctx.fillStyle = '#4a3020'; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-22, -54); ctx.quadraticCurveTo(0, -78, 22, -54); ctx.lineTo(22, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3e6fc4'; ctx.fillRect(-50, -100, 16, 34); ctx.fillRect(34, -100, 16, 34);
      ctx.fillStyle = '#ffd36b'; ctx.fillRect(-46, -92, 8, 8); ctx.fillRect(38, -92, 8, 8);
      this.flag(-55, -182, 34); this.flag(55, -182, 34);
    }
    if (ratio < 0.66) this.cracks(ctx, -24, -120, ratio < 0.33 ? 3 : 1);
    if (ratio < 0.33) this.smoke(ctx, 10, -150);
    ctx.restore();
  }

  flag(x, y, h) {
    const ctx = this.ctx;
    ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
    const w = Math.sin(this.time * 5 + x) * 3;
    ctx.fillStyle = '#3e6fc4'; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + 24, y - h + 6 + w); ctx.lineTo(x, y - h + 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(x + 8, y - h + 7, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // 魔王軍の封印の祠（右）：角の生えた門と紫の渦
  drawShrine(b) {
    const ctx = this.ctx; const s = b.shrine; const x = s.x; const y = GROUND_Y + 8;
    const ratio = s.hp / s.maxHp;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#2a1840'; ctx.strokeStyle = '#120820'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-68, 0); ctx.lineTo(-58, -20); ctx.lineTo(58, -20); ctx.lineTo(68, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 門
    ctx.fillStyle = '#3b2458';
    ctx.beginPath(); ctx.moveTo(-54, -20); ctx.lineTo(-54, -120); ctx.quadraticCurveTo(0, -190, 54, -120); ctx.lineTo(54, -20); ctx.lineTo(36, -20); ctx.lineTo(36, -112); ctx.quadraticCurveTo(0, -164, -36, -112); ctx.lineTo(-36, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 角
    ctx.fillStyle = '#e8dcc8';
    ctx.beginPath(); ctx.moveTo(-46, -140); ctx.quadraticCurveTo(-80, -170, -70, -200); ctx.quadraticCurveTo(-60, -168, -34, -152); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(46, -140); ctx.quadraticCurveTo(80, -170, 70, -200); ctx.quadraticCurveTo(60, -168, 34, -152); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 渦
    const p = 0.6 + Math.sin(this.time * 3) * 0.2;
    const g = ctx.createRadialGradient(0, -70, 4, 0, -70, 44);
    g.addColorStop(0, `rgba(255,190,255,${p})`); g.addColorStop(0.5, 'rgba(170,70,255,.85)'); g.addColorStop(1, 'rgba(60,10,110,.95)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-36, -20); ctx.lineTo(-36, -112); ctx.quadraticCurveTo(0, -164, 36, -112); ctx.lineTo(36, -20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(255,210,255,${p * 0.7})`; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, -70, 10 + i * 9, this.time * (2 + i) + i, this.time * (2 + i) + i + 3.6); ctx.stroke(); }
    // 紫の旗
    for (const fx of [-62, 62]) {
      ctx.fillStyle = '#5b2a99'; ctx.fillRect(fx - 7, -112, 14, 40);
      ctx.fillStyle = '#ffd36b'; ctx.fillRect(fx - 2, -100, 4, 4);
    }
    if (ratio < 0.66) this.cracks(ctx, -40, -100, ratio < 0.33 ? 3 : 1);
    if (ratio < 0.33) this.smoke(ctx, -20, -170);
    ctx.restore();
  }

  cracks(ctx, x, y, n) {
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.moveTo(x + i * 24, y); ctx.lineTo(x + i * 24 + 8, y + 12); ctx.lineTo(x + i * 24 + 2, y + 22); ctx.lineTo(x + i * 24 + 10, y + 34); ctx.stroke();
    }
  }

  smoke(ctx, x, y) {
    for (let i = 0; i < 4; i++) {
      const t = (this.time * 0.6 + i / 4) % 1;
      ctx.fillStyle = `rgba(80,80,90,${0.5 * (1 - t)})`;
      ctx.beginPath(); ctx.arc(x + Math.sin(i + t * 3) * 6, y - t * 50, 8 + t * 12, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawEntity(e, alpha) {
    const ctx = this.ctx;
    const x = e.px + (e.x - e.px) * alpha;
    const y = GROUND_Y + e.lane * LANE_DEPTH;
    if (x < this.camX - 90 || x > this.camX + VIEW_W + 90) return;
    const d = e.def;
    let pose = 'walk';
    let lean = 0; let push = 0; let a = 1; let rise = 0;
    if (e.state === 'attack') {
      if (e.timer < d.windup) { pose = 'windup'; lean = -0.12 * (e.timer / d.windup); push = -3 * (e.timer / d.windup); }
      else if (e.timer < d.windup + 0.15 + (d.hits > 1 ? d.hitGap : 0)) { pose = 'strike'; push = 7; lean = 0.1; }
      else pose = 'idle';
    } else if (e.state === 'skill') { pose = e.skill && e.timer < e.skill.windup ? 'windup' : 'strike'; lean = pose === 'windup' ? -0.2 : 0.15; }
    else if (e.state === 'kb') { pose = 'kb'; lean = -0.5 * (1 - e.timer / 0.45); rise = Math.sin(Math.min(1, e.timer / 0.45) * Math.PI) * 18; }
    else if (e.state === 'dead') { pose = 'dead'; a = Math.max(0, 1 - e.timer / 0.7); lean = -0.6; rise = e.timer * 30; }
    if (e.stun > 0) pose = 'idle';

    const sz = d.size * UNIT_SCALE;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(x, y, 16 * sz, 4.5, 0, 0, Math.PI * 2); ctx.fill();

    // 勇者は足元に光の輪
    if (d.hero && e.state !== 'dead') {
      ctx.strokeStyle = `rgba(255,230,120,${0.5 + Math.sin(this.time * 6) * 0.3})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, 26 * sz, 7, 0, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x + push * e.dir, y - rise);
    ctx.scale(e.dir * sz, sz);
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

    const top = y - 62 * sz - 6;
    // 気絶：頭の上で星が回る
    if (e.stun > 0 && e.state !== 'dead') {
      ctx.fillStyle = '#fff59a';
      for (let i = 0; i < 3; i++) { const t = this.time * 6 + i * 2.1; ctx.fillRect(x + Math.cos(t) * 12 - 2, top + 2 + Math.sin(t) * 3 - 2, 4, 4); }
    }
    // HPが減っているときだけ小さなバー（勇者は大きく）
    if (e.state !== 'dead' && (e.hp < e.maxHp || d.hero)) {
      const w = d.hero ? 64 : 22 * Math.max(0.8, d.size);
      const h = d.hero ? 6 : 3;
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - w / 2 - 1, top - 1, w + 2, h + 2);
      ctx.fillStyle = e.side === 'demon' ? '#c084fc' : (d.hero ? '#ff6b6b' : '#fbbf24');
      ctx.fillRect(x - w / 2, top, w * Math.max(0, e.hp / e.maxHp), h);
      if (d.hero) {
        ctx.font = '800 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#1a1030';
        ctx.strokeText(d.name, x, top - 5); ctx.fillStyle = '#fff3c4'; ctx.fillText(d.name, x, top - 5);
      }
    }
  }

  drawFx(ctx, screen, b) {
    for (const f of this.fx) {
      const p = f.age / f.life;
      if ((f.kind === 'banner') !== screen) continue;
      switch (f.kind) {
        case 'num': {
          ctx.globalAlpha = 1 - p * p;
          ctx.font = `800 ${f.big ? 20 : f.small ? 12 : 15}px system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#2a0a36';
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
          const a0 = f.dir > 0 ? -1.2 : Math.PI - 1.0; const a1 = f.dir > 0 ? 1.0 : Math.PI + 1.2;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.area ? 26 : 16, a0, a1); ctx.stroke();
          ctx.globalAlpha = 1; break;
        }
        case 'shot': {
          const x = f.from + (f.to - f.from) * p;
          const arc = Math.sin(p * Math.PI) * (f.shot === 'arrow' ? 22 : 10);
          if (f.shot === 'arrow') {
            ctx.strokeStyle = f.side === 'human' ? '#5a3a1a' : '#ffe9b0'; ctx.lineWidth = 2;
            const s = Math.sign(f.to - f.from);
            ctx.beginPath(); ctx.moveTo(x - 12 * s, f.y - arc); ctx.lineTo(x, f.y - arc); ctx.stroke();
          } else {
            const col = f.shot === 'magic' ? (f.big ? '#ff5ad1' : '#c27bff') : f.shot === 'bubble' ? '#8ef0d0' : '#fff3a0';
            ctx.fillStyle = col; ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.arc(x, f.y - arc, f.big ? 10 : 6, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x - Math.sign(f.to - f.from) * 8, f.y - arc, f.big ? 8 : 4, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          break;
        }
        case 'puff': {
          ctx.globalAlpha = 1 - p; ctx.fillStyle = f.color;
          for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * p * 22, f.y + Math.sin(a) * p * 14, 6 * (1 - p) + 2, 0, Math.PI * 2); ctx.fill(); }
          ctx.globalAlpha = 1; break;
        }
        case 'ghost': {
          ctx.globalAlpha = (1 - p) * 0.8; ctx.fillStyle = '#ede0ff';
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
          const w = f.w || 30;
          ctx.beginPath(); ctx.ellipse(f.x, f.y, w * (0.5 + p * 0.5), Math.max(5, w * 0.12) * (0.5 + p * 0.5), 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1; break;
        }
        case 'fizzle': {
          ctx.globalAlpha = 1 - p; ctx.fillStyle = 'rgba(150,150,160,.8)';
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(f.x + (i - 1) * 8, f.y + 14 - p * 20, 6 + p * 4, 0, Math.PI * 2); ctx.fill(); }
          ctx.font = '800 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#222';
          ctx.strokeText('しっぱい…', f.x, f.y - p * 14); ctx.fillStyle = '#dcdcff'; ctx.fillText('しっぱい…', f.x, f.y - p * 14);
          ctx.globalAlpha = 1; break;
        }
        case 'boom': {
          ctx.globalAlpha = 1 - p;
          const g = ctx.createRadialGradient(f.x, f.y - 30, 4, f.x, f.y - 30, f.r * (0.4 + p));
          g.addColorStop(0, 'rgba(255,240,255,.95)'); g.addColorStop(0.4, 'rgba(255,90,210,.8)'); g.addColorStop(1, 'rgba(120,20,200,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y - 30, f.r * (0.4 + p), 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1; break;
        }
        case 'flashRing': {
          ctx.strokeStyle = '#fffbd0'; ctx.globalAlpha = 1 - p; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(f.x, f.y, 8 + p * 16, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; break;
        }
        case 'warn': {
          const e = b.entities.find((o) => o.id === f.id);
          if (!e || e.state === 'dead') break;
          const y = GROUND_Y + e.lane * LANE_DEPTH - 62 * e.def.size * UNIT_SCALE - 36;
          const blink = Math.floor(f.age * 10) % 2 === 0;
          ctx.font = '900 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#3a0010';
          ctx.strokeText('！', e.x, y); ctx.fillStyle = blink ? '#ff4a5a' : '#ffd36b'; ctx.fillText('！', e.x, y);
          ctx.font = '800 12px system-ui, sans-serif'; ctx.lineWidth = 3;
          ctx.strokeText(f.text, e.x, y - 20); ctx.fillStyle = '#fff'; ctx.fillText(f.text, e.x, y - 20);
          break;
        }
        case 'wave': {
          const x = f.x + f.dir * f.reach * p;
          ctx.globalAlpha = 1 - p * 0.6; ctx.strokeStyle = f.color || '#cfefff'; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(x - f.dir * 30, GROUND_Y - 20, 40, f.dir > 0 ? -1.1 : Math.PI - 1.1 + 0.2, f.dir > 0 ? 1.1 : Math.PI + 1.1 - 0.2 + 0.2); ctx.stroke();
          ctx.lineWidth = 2; ctx.strokeStyle = '#fff';
          ctx.beginPath(); ctx.arc(x - f.dir * 34, GROUND_Y - 20, 30, f.dir > 0 ? -0.9 : Math.PI - 0.9, f.dir > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke();
          ctx.globalAlpha = 1; break;
        }
        case 'lightBurst': {
          ctx.globalAlpha = (1 - p) * 0.7;
          const g = ctx.createLinearGradient(f.x, 0, f.x + f.dir * f.reach, 0);
          g.addColorStop(0, 'rgba(255,255,220,.9)'); g.addColorStop(1, 'rgba(255,255,200,0)');
          ctx.fillStyle = g;
          const x0 = Math.min(f.x, f.x + f.dir * f.reach);
          ctx.fillRect(x0, GROUND_Y - 110, f.reach, 140);
          ctx.globalAlpha = 1; break;
        }
        case 'spell': {
          // 紫の雷が密集地点に何本も落ち、地面がはじける
          ctx.globalAlpha = Math.max(0, 1 - p);
          const g = ctx.createRadialGradient(f.x, GROUND_Y - 20, 10, f.x, GROUND_Y - 20, f.r * 1.2);
          g.addColorStop(0, 'rgba(255,200,255,.75)'); g.addColorStop(0.6, 'rgba(170,60,255,.45)'); g.addColorStop(1, 'rgba(90,0,160,0)');
          ctx.fillStyle = g; ctx.fillRect(f.x - f.r * 1.2, GROUND_Y - 200, f.r * 2.4, 260);
          ctx.strokeStyle = '#ffe6ff'; ctx.lineWidth = 4;
          for (let i = 0; i < 7; i++) {
            const bx = f.x - f.r + (i + 0.5) * (f.r * 2 / 7);
            if (p > 0.15 + i * 0.05 && p < 0.7 + i * 0.03) {
              ctx.beginPath(); let yy = 60; ctx.moveTo(bx, yy);
              while (yy < GROUND_Y) { yy += 22; ctx.lineTo(bx + Math.sin(yy * 0.31 + i * 7 + this.time * 40) * 12, yy); }
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1; break;
        }
        case 'banner': {
          ctx.globalAlpha = p < 0.12 ? p / 0.12 : p > 0.82 ? (1 - p) / 0.18 : 1;
          const h = f.sub ? 70 : 44;
          ctx.fillStyle = f.color || 'rgba(120,10,30,.8)'; ctx.globalAlpha *= 0.88; ctx.fillRect(0, 150, VIEW_W, h);
          ctx.globalAlpha = p < 0.12 ? p / 0.12 : p > 0.82 ? (1 - p) / 0.18 : 1;
          ctx.font = `900 ${f.hero ? 28 : 24}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff3d6';
          ctx.fillText(f.text, VIEW_W / 2, 181);
          if (f.sub) { ctx.font = '700 15px system-ui, sans-serif'; ctx.fillStyle = '#e6eeff'; ctx.fillText(`${f.sub.who}「${f.sub.text}」`, VIEW_W / 2, 207); }
          ctx.globalAlpha = 1; break;
        }
        default: break;
      }
    }
  }

  drawMinimap(b) {
    const ctx = this.ctx; const m = MINIMAP; const L = b.stage.length;
    ctx.fillStyle = 'rgba(20,8,40,.55)'; ctx.fillRect(m.x - 4, m.y - 3, m.w + 8, m.h + 6);
    const k = m.w / L;
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(m.x + this.camX * k, m.y - 1, VIEW_W * k, m.h + 2);
    ctx.fillStyle = '#5a8ef0'; ctx.fillRect(m.x + b.base.x * k - 3, m.y, 6, m.h);
    ctx.fillStyle = '#b26bff'; ctx.fillRect(m.x + b.shrine.x * k - 3, m.y, 6, m.h);
    for (const e of b.entities) {
      if (e.state === 'dead') continue;
      ctx.fillStyle = e.side === 'demon' ? '#e2c6ff' : (e.def.hero ? '#ff6b6b' : '#ffe08a');
      const s = e.def.hero ? 4 : 2;
      ctx.fillRect(m.x + e.x * k - s / 2, m.y + 2 + e.lane * (m.h - 6), s, e.def.hero ? 6 : 3);
    }
  }

  // ボタン・画面用の小さな絵
  static thumb(canvas, key, size, pose = 'idle') {
    const c = canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    const s = canvas.height / 72;
    c.translate(canvas.width / 2, canvas.height - 6 * s);
    const k = Math.min(1.2, 1 / Math.max(0.8, size)) * s;
    c.scale(-k, k); // 魔物は左向き（戦場と同じ）
    const sp = spriteFor(key);
    if (sp) { c.scale(-(sp.facing === 'left' ? -1 : 1) * (sp.scale || 0.5), sp.scale || 0.5); c.drawImage(sp.img, sp.frames.walk[0] * sp.frameW, 0, sp.frameW, sp.frameH, -sp.frameW / 2, -sp.footY, sp.frameW, sp.frameH); return; }
    drawUnit(c, key, { size, flash: false, t: 0.3, pose });
  }
}
