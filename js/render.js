/*
 * render.js — 絵はすべてキャンバスの図形で描いています(外部画像なし)
 */
(function (root) {
  'use strict';
  const T = Engine.TILE;

  // ===== テーマ(色) =====
  const THEMES = {
    home: {
      sky: ['#46aef0', '#c4ecff'], sun: 'sun', clouds: true, far: '#8fc3dc', near: '#7cc077', props: 'houses',
      grass: '#74c64b', grassHi: '#a3e36f', soil: '#c58a55', soilDark: '#a56d40', block: 'crate', plank: '#b77b45', water: '#5cb7e0',
    },
    paddy: {
      sky: ['#3fa9ee', '#d2f1ff'], sun: 'sun', clouds: true, far: '#95c7d8', near: '#8fcf5f', props: 'paddy',
      grass: '#7ccc4f', grassHi: '#aee77a', soil: '#b07d4f', soilDark: '#8f6139', block: 'hay', plank: '#b77b45', water: '#7cbfc9',
    },
    river: {
      sky: ['#47aeea', '#d0f0ff'], sun: 'sun', clouds: true, far: '#86bcd6', near: '#6db866', props: 'trees',
      grass: '#6fc24c', grassHi: '#9fe06c', soil: '#b9875a', soilDark: '#977046', block: 'stone', plank: '#9c6a3c', water: '#4aa9de',
    },
    hill: {
      sky: ['#5aa7dd', '#f6e2ae'], sun: 'sun', clouds: true, far: '#93b6c4', near: '#5fa75a', props: 'trees',
      grass: '#68b843', grassHi: '#97d867', soil: '#ad7444', soilDark: '#8c5a31', block: 'crate', plank: '#a8703f', water: '#4aa9de',
    },
    forest: {
      sky: ['#79c39a', '#e2f2c4'], sun: null, clouds: false, far: '#6aa77a', near: '#3f8a4f', props: 'forest',
      grass: '#5bb03f', grassHi: '#8fd463', soil: '#9a6640', soilDark: '#7a4d2e', block: 'crate', plank: '#a8703f', water: '#4aa9de',
    },
    dusk: {
      sky: ['#7a62b0', '#ffc27a'], sun: 'sunset', clouds: true, cloudTint: '#ffd9b3', far: '#a8708a', near: '#7d6a7a', props: 'riverside',
      grass: '#86a84c', grassHi: '#b9d06e', soil: '#a46a44', soilDark: '#7f4f31', block: 'crate', plank: '#b8743f', water: '#e8946a',
    },
    shrine: {
      sky: ['#463f80', '#f19d7c'], sun: null, clouds: false, far: '#6e5683', near: '#4b4a6e', props: 'shrine', stars: 0.4,
      grass: '#c9c2b5', grassHi: '#e7e1d4', soil: '#9c958a', soilDark: '#7f786e', block: 'stone', plank: '#a8703f', water: '#4aa9de', stone: true,
    },
    festival: {
      sky: ['#151a45', '#3f3474'], sun: 'moon', clouds: false, far: '#2b2b5a', near: '#3a3366', props: 'festival', stars: 1,
      grass: '#79b061', grassHi: '#a5d785', soil: '#b88a5c', soilDark: '#946a43', block: 'crate', plank: '#c4844b', water: '#4a6fbe', lanterns: true,
    },
    mountain: {
      sky: ['#10153a', '#2f4180'], sun: 'moon', clouds: false, far: '#283a6a', near: '#1f3256', props: 'pines', stars: 1,
      grass: '#6aac6c', grassHi: '#97d496', soil: '#9c8164', soilDark: '#7c6550', block: 'stone', plank: '#b07a48', water: '#3d64ad', rim: true,
    },
    hilltop: {
      sky: ['#0e1236', '#3b2d6c'], sun: null, clouds: false, far: '#2a2a5e', near: '#232a50', props: 'town', stars: 1, fireworks: true,
      grass: '#6db36a', grassHi: '#9fdc95', soil: '#a07f60', soilDark: '#80644b', block: 'stone', plank: '#b07a48', water: '#3d64ad', rim: true,
    },
  };

  function hash(a, b) {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
  }

  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ===== 背景 =====
  function drawBackground(ctx, themeName, camX, camY, vw, vh, time, fw) {
    const th = THEMES[themeName];
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, th.sky[0]);
    g.addColorStop(1, th.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    if (th.stars) {
      for (let i = 0; i < 70; i++) {
        const sx = (hash(i, 7) * 2000 - camX * 0.02) % 2000;
        const x = ((sx % vw) + vw) % vw;
        const y = hash(i, 3) * vh * 0.6;
        const tw = 0.5 + 0.5 * Math.sin(time * 2 + i);
        ctx.globalAlpha = th.stars * (0.35 + 0.5 * tw);
        ctx.fillStyle = '#fffbe0';
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    if (th.sun === 'sun') {
      ctx.fillStyle = 'rgba(255,250,210,0.35)'; circle(ctx, vw * 0.82, 70, 52);
      ctx.fillStyle = '#fff6c4'; circle(ctx, vw * 0.82, 70, 34);
    } else if (th.sun === 'sunset') {
      ctx.fillStyle = 'rgba(255,200,120,0.4)'; circle(ctx, vw * 0.75, vh * 0.62, 90);
      ctx.fillStyle = '#ff9b4a'; circle(ctx, vw * 0.75, vh * 0.62, 50);
    } else if (th.sun === 'moon') {
      ctx.fillStyle = 'rgba(255,250,220,0.15)'; circle(ctx, vw * 0.8, 70, 46);
      ctx.fillStyle = '#fff6d0'; circle(ctx, vw * 0.8, 70, 26);
      ctx.fillStyle = th.sky[0]; circle(ctx, vw * 0.8 + 11, 63, 22);
    }
    if (fw) drawFireworks(ctx, fw, 0.85);
    if (th.clouds) drawClouds(ctx, camX, vw, vh, time, th.cloudTint);

    // 遠くの山
    ctx.fillStyle = th.far;
    ctx.beginPath();
    ctx.moveTo(0, vh);
    for (let x = 0; x <= vw + 16; x += 16) {
      const wx = x + camX * 0.15;
      const y = vh * 0.5 + Math.sin(wx * 0.004) * 40 + Math.sin(wx * 0.011 + 1) * 18 - camY * 0.1;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(vw, vh); ctx.closePath(); ctx.fill();

    // 近くの丘
    ctx.fillStyle = th.near;
    ctx.beginPath();
    ctx.moveTo(0, vh);
    for (let x = 0; x <= vw + 16; x += 16) {
      const wx = x + camX * 0.3;
      const y = vh * 0.66 + Math.sin(wx * 0.006 + 2) * 22 + Math.sin(wx * 0.017) * 8 - camY * 0.2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(vw, vh); ctx.closePath(); ctx.fill();

    drawProps(ctx, th, camX, vw, vh, time);
  }

  function drawClouds(ctx, camX, vw, vh, time, tint) {
    const span = 1600;
    for (let i = 0; i < 4; i++) {
      const base = i * 420 + 120 - camX * 0.06 - time * 4;
      const x = ((base % span) + span) % span - 200;
      if (x > vw + 200) continue;
      const big = i % 2 === 0;
      const y = vh * (big ? 0.42 : 0.2) + (i * 13) % 30;
      const s = big ? 1.25 : 0.7;
      // 入道雲
      ctx.fillStyle = tint || '#ffffff';
      const puffs = big
        ? [[0, 0, 46], [40, -30, 42], [80, -6, 40], [20, -64, 36], [58, -80, 34], [96, -40, 32], [-36, 4, 30], [120, 6, 28]]
        : [[0, 0, 26], [28, -14, 24], [56, 0, 22], [-22, 4, 18]];
      for (const p of puffs) circle(ctx, x + p[0] * s, y + p[1] * s, p[2] * s);
      ctx.fillStyle = 'rgba(170,195,230,0.35)';
      for (const p of puffs) if (p[1] >= -10) { ctx.beginPath(); ctx.ellipse(x + p[0] * s, y + (p[1] + p[2] * 0.55) * s, p[2] * 0.8 * s, p[2] * 0.35 * s, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function drawProps(ctx, th, camX, vw, vh, time) {
    const par = 0.42;
    const base = vh * 0.7;
    const spacing = th.props === 'paddy' ? 260 : th.props === 'festival' ? 210 : 230;
    const first = Math.floor((camX * par - 200) / spacing);
    const last = Math.ceil((camX * par + vw + 200) / spacing);
    for (let i = first; i <= last; i++) {
      const x = i * spacing - camX * par;
      const r = hash(i, 11);
      ctx.save();
      ctx.translate(x, base);
      switch (th.props) {
        case 'houses': if (r < 0.55) house(ctx, r); else if (r < 0.8) tree(ctx, '#4f9a45', r); else pole(ctx); break;
        case 'paddy': paddy(ctx, r); break;
        case 'trees': tree(ctx, r < 0.5 ? '#4f9a45' : '#5aa54d', r); break;
        case 'forest': bigTree(ctx, r, i); break;
        case 'riverside': if (r < 0.4) silhouetteTree(ctx, '#6a5068', r); else if (r < 0.6) pole(ctx, '#5f4560'); break;
        case 'shrine': if (i % 4 === 0) torii(ctx); else cedar(ctx, '#3d3a5e', r); break;
        case 'festival': stall(ctx, r, time); break;
        case 'pines': cedar(ctx, '#1a2a48', r); break;
        case 'town': townLights(ctx, r, time); break;
      }
      ctx.restore();
    }
    if (th.lanterns) {
      // 提灯の列
      const lpar = 0.6;
      const sp = 70;
      const f = Math.floor((camX * lpar - 100) / sp), l = Math.ceil((camX * lpar + vw + 100) / sp);
      ctx.strokeStyle = 'rgba(40,30,30,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = f; i <= l; i++) {
        const x = i * sp - camX * lpar;
        ctx.moveTo(x, 60); ctx.quadraticCurveTo(x + sp / 2, 76, x + sp, 60);
      }
      ctx.stroke();
      for (let i = f; i <= l; i++) {
        const x = i * sp - camX * lpar + sp / 2;
        lantern(ctx, x, 70, time + i, 0.75);
      }
    }
  }

  function house(ctx, r) {
    const w = 120 + r * 40;
    ctx.fillStyle = '#efe6d2'; ctx.fillRect(-w / 2, -60, w, 60);
    ctx.fillStyle = '#7a5a3c'; ctx.fillRect(-w / 2 + 12, -40, 22, 40);
    ctx.fillStyle = '#cde4ef'; ctx.fillRect(w / 2 - 44, -46, 30, 22);
    ctx.strokeStyle = '#7a5a3c'; ctx.lineWidth = 2; ctx.strokeRect(w / 2 - 44, -46, 30, 22);
    ctx.fillStyle = '#4f5f7a';
    ctx.beginPath(); ctx.moveTo(-w / 2 - 14, -58); ctx.lineTo(-w / 2 + 16, -92); ctx.lineTo(w / 2 - 16, -92); ctx.lineTo(w / 2 + 14, -58); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
    for (let y = -86; y < -60; y += 7) { ctx.beginPath(); ctx.moveTo(-w / 2 + 10, y); ctx.lineTo(w / 2 - 10, y); ctx.stroke(); }
  }
  function pole(ctx, col) {
    ctx.fillStyle = col || '#8a7766'; ctx.fillRect(-3, -150, 6, 150); ctx.fillRect(-18, -136, 36, 4);
    ctx.strokeStyle = col || 'rgba(60,60,60,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-18, -134); ctx.quadraticCurveTo(-120, -110, -240, -134); ctx.moveTo(18, -134); ctx.quadraticCurveTo(120, -110, 240, -134); ctx.stroke();
  }
  function tree(ctx, col, r) {
    ctx.fillStyle = '#7a5a3c'; ctx.fillRect(-6, -50, 12, 50);
    ctx.fillStyle = col;
    const s = 0.8 + r * 0.5;
    circle(ctx, 0, -70 * s, 34 * s); circle(ctx, -26 * s, -52 * s, 26 * s); circle(ctx, 26 * s, -52 * s, 26 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; circle(ctx, -10 * s, -82 * s, 14 * s);
  }
  function silhouetteTree(ctx, col, r) {
    ctx.fillStyle = col;
    ctx.fillRect(-5, -50, 10, 50);
    const s = 0.8 + r * 0.6;
    circle(ctx, 0, -70 * s, 32 * s); circle(ctx, -24 * s, -50 * s, 24 * s); circle(ctx, 24 * s, -52 * s, 24 * s);
  }
  function bigTree(ctx, r, i) {
    ctx.fillStyle = '#5f4630'; ctx.fillRect(-14, -260, 28, 260);
    ctx.fillStyle = '#2f7a42';
    circle(ctx, 0, -260, 80); circle(ctx, -60, -220, 60); circle(ctx, 60, -225, 60);
    if (i % 3 === 0) {
      // 秘密基地(ツリーハウス)
      ctx.fillStyle = '#a8703f'; ctx.fillRect(-46, -150, 92, 8);
      ctx.fillStyle = '#c48a52'; ctx.fillRect(-36, -196, 72, 46);
      ctx.fillStyle = '#d65a4a';
      ctx.beginPath(); ctx.moveTo(-46, -194); ctx.lineTo(0, -226); ctx.lineTo(46, -194); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a3a24'; ctx.fillRect(-10, -180, 20, 30);
      ctx.strokeStyle = '#d9c08a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(30, -142); ctx.lineTo(30, -40); ctx.moveTo(42, -142); ctx.lineTo(42, -40);
      for (let y = -130; y < -40; y += 14) { ctx.moveTo(30, y); ctx.lineTo(42, y); }
      ctx.stroke();
    }
  }
  function paddy(ctx, r) {
    ctx.fillStyle = '#9ad86a'; ctx.fillRect(-130, -26, 260, 26);
    ctx.strokeStyle = '#78bb4c'; ctx.lineWidth = 2;
    for (let x = -126; x < 130; x += 9) { ctx.beginPath(); ctx.moveTo(x, -2); ctx.lineTo(x + 2, -22); ctx.stroke(); }
    if (r < 0.35) {
      // かかし
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -64); ctx.moveTo(-22, -46); ctx.lineTo(22, -46); ctx.stroke();
      ctx.fillStyle = '#f2e6c8'; circle(ctx, 0, -66, 9);
      ctx.fillStyle = '#d9b04a'; ctx.beginPath(); ctx.ellipse(0, -72, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5f8fd0'; ctx.fillRect(-10, -50, 20, 18);
    }
  }
  function cedar(ctx, col, r) {
    const s = 0.9 + r * 0.6;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -170 * s); ctx.lineTo(34 * s, -60 * s); ctx.lineTo(48 * s, 0); ctx.lineTo(-48 * s, 0); ctx.lineTo(-34 * s, -60 * s);
    ctx.closePath(); ctx.fill();
  }
  function torii(ctx) {
    ctx.fillStyle = '#d24a3a';
    ctx.fillRect(-56, -120, 10, 120); ctx.fillRect(46, -120, 10, 120);
    ctx.fillRect(-64, -104, 128, 8);
    ctx.fillStyle = '#2b2430'; ctx.fillRect(-80, -128, 160, 10);
    ctx.fillStyle = '#d24a3a'; ctx.fillRect(-74, -120, 148, 7);
  }
  function stall(ctx, r, time) {
    const cols = ['#e2574c', '#4c8de2', '#e2a64c', '#58b36a'];
    const c = cols[Math.floor(r * 4)];
    ctx.fillStyle = '#5a3e2c'; ctx.fillRect(-60, -70, 6, 70); ctx.fillRect(54, -70, 6, 70);
    ctx.fillStyle = '#f5e9d0'; ctx.fillRect(-60, -30, 120, 30);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? '#ffffff' : c;
      ctx.fillRect(-66 + k * 22, -86, 22, 18);
    }
    ctx.fillStyle = 'rgba(255,220,140,0.25)'; circle(ctx, 0, -40, 50);
    lantern(ctx, -40, -60, time + r * 6, 0.7);
    lantern(ctx, 40, -60, time + r * 3, 0.7);
  }
  function townLights(ctx, r, time) {
    // 遠くの町の家々
    for (let k = 0; k < 4; k++) {
      const hh = 26 + hash(k, Math.floor(r * 1000)) * 34;
      const bx = -100 + k * 50;
      ctx.fillStyle = '#1d2148';
      ctx.fillRect(bx, -hh, 44, hh + 20);
      ctx.beginPath(); ctx.moveTo(bx - 4, -hh); ctx.lineTo(bx + 22, -hh - 14); ctx.lineTo(bx + 48, -hh); ctx.fill();
      for (let wy = -hh + 8; wy < 4; wy += 12) {
        for (let wx = 6; wx < 40; wx += 12) {
          if (hash(k * 31 + wx, wy * 7 + Math.floor(r * 50)) < 0.45) { ctx.fillStyle = '#ffd27a'; ctx.fillRect(bx + wx, wy, 5, 5); }
        }
      }
    }
  }
  function lantern(ctx, x, y, t, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.rotate(Math.sin(t * 1.5) * 0.05);
    ctx.fillStyle = 'rgba(255,190,90,0.25)'; circle(ctx, 0, 10, 22);
    ctx.fillStyle = '#ee5b3b';
    ctx.beginPath(); ctx.ellipse(0, 10, 11, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(120,30,20,0.6)'; ctx.lineWidth = 1;
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.ellipse(0, 10, 11 * Math.abs(k * 0.5), 14, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#2b2020'; ctx.fillRect(-6, -5, 12, 3); ctx.fillRect(-6, 23, 12, 3);
    ctx.fillStyle = 'rgba(255,240,180,0.55)'; ctx.beginPath(); ctx.ellipse(-3, 6, 3, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ===== タイル =====
  function drawLevel(ctx, level, camX, camY, vw, vh, time) {
    const th = THEMES[level.theme];
    const x0 = Math.max(0, Math.floor(camX / T)), x1 = Math.min(level.w - 1, Math.floor((camX + vw) / T));
    const y0 = Math.max(0, Math.floor(camY / T)), y1 = Math.min(level.h - 1, Math.floor((camY + vh) / T));
    const solid = (tx, ty) => Engine.isSolid(level, tx, ty) && Engine.tileAt(level, tx, ty) === '#';
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const c = level.grid[ty][tx];
        const x = tx * T, y = ty * T;
        if (c === '#') {
          const top = !solid(tx, ty - 1);
          ctx.fillStyle = th.soil;
          ctx.fillRect(x, y, T + 0.5, T + 0.5);
          if (th.stone) {
            // 石段
            ctx.strokeStyle = th.soilDark; ctx.lineWidth = 1.5;
            const off = (ty % 2) * 16;
            ctx.beginPath(); ctx.moveTo(x, y + 16); ctx.lineTo(x + T, y + 16);
            ctx.moveTo(x + off + 0.5, y); ctx.lineTo(x + off + 0.5, y + 16);
            ctx.moveTo(x + ((off + 16) % 32) + 0.5, y + 16); ctx.lineTo(x + ((off + 16) % 32) + 0.5, y + 32);
            ctx.stroke();
          } else {
            const h1 = hash(tx, ty);
            ctx.fillStyle = th.soilDark;
            if (h1 < 0.5) circle(ctx, x + 6 + h1 * 30, y + 14 + h1 * 22 % 12, 2.5);
            if (h1 > 0.3) circle(ctx, x + 26 - h1 * 14, y + 24, 2);
          }
          if (top) {
            ctx.fillStyle = th.grass;
            ctx.fillRect(x, y, T + 0.5, 8);
            ctx.beginPath();
            for (let k = 0; k < 4; k++) ctx.arc(x + 4 + k * 8, y + 8, 4, 0, Math.PI);
            ctx.fill();
            ctx.fillStyle = th.grassHi;
            ctx.fillRect(x, y, T + 0.5, 3);
            if (!th.stone && hash(tx, 99) < 0.25 && !Engine.HAZARD[Engine.tileAt(level, tx, ty - 1)]) {
              // 草花
              ctx.strokeStyle = th.grass; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + 8, y - 7); ctx.moveTo(x + 13, y); ctx.lineTo(x + 15, y - 8); ctx.stroke();
              if (hash(tx, 5) < 0.5) { ctx.fillStyle = hash(tx, 6) < 0.5 ? '#fff3a0' : '#ffb3c6'; circle(ctx, x + 15, y - 9, 2.5); }
            }
          }
          if (!solid(tx - 1, ty) && tx > 0) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x, y, 3, T); }
          if (!solid(tx + 1, ty) && tx < level.w - 1) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + T - 3, y, 3, T); }
          if (top && th.rim) { ctx.fillStyle = 'rgba(255,255,230,0.35)'; ctx.fillRect(x, y, T, 1.5); }
        } else if (c === 'B') {
          drawBlock(ctx, th, x, y, level, tx, ty);
        } else if (c === '-') {
          ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + 4, y + 10, 4, 10); ctx.fillRect(x + T - 8, y + 10, 4, 10);
          ctx.fillStyle = th.plank; ctx.fillRect(x - 0.5, y, T + 1, 10);
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, T, 2);
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + T - 1, y + 1, 1, 8);
          ctx.fillStyle = 'rgba(60,30,10,0.6)'; circle(ctx, x + 5, y + 5, 1.2); circle(ctx, x + T - 5, y + 5, 1.2);
        } else if (c === '~') {
          const surf = Engine.tileAt(level, tx, ty - 1) !== '~';
          ctx.fillStyle = th.water;
          ctx.globalAlpha = 0.9;
          if (surf) {
            ctx.beginPath();
            ctx.moveTo(x, y + T + 0.5);
            for (let k = 0; k <= 4; k++) {
              const wx = x + k * 8;
              ctx.lineTo(wx, y + 10 + Math.sin(time * 3 + wx * 0.12) * 2.5);
            }
            ctx.lineTo(x + T, y + T + 0.5); ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffffff';
            ctx.fillRect(x + ((time * 20 + tx * 13) % 28), y + 13 + Math.sin(time * 3 + tx) * 2, 6, 2);
          } else {
            ctx.fillRect(x, y, T + 0.5, T + 0.5);
          }
          ctx.globalAlpha = 1;
        } else if (c === '^') {
          drawBurr(ctx, x + 16, y + 21, time);
        }
      }
    }
  }

  function drawBlock(ctx, th, x, y, level, tx, ty) {
    if (th.block === 'stone') {
      const top = Engine.tileAt(level, tx, ty - 1) !== 'B';
      ctx.fillStyle = '#9fa0a0';
      rrect(ctx, x + 0.5, y + (top ? 1 : 0), T - 1, T - (top ? 1 : 0), top ? 7 : 2); ctx.fill();
      ctx.fillStyle = '#b9bab7'; if (top) { rrect(ctx, x + 3, y + 2, T - 6, 8, 4); ctx.fill(); }
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + 2, y + T - 6, T - 4, 5);
      if (top) { ctx.fillStyle = '#7cb05a'; ctx.fillRect(x + 6, y + 1, 8, 3); }
    } else if (th.block === 'hay') {
      ctx.fillStyle = '#e2c062'; rrect(ctx, x + 1, y + 1, T - 2, T - 2, 4); ctx.fill();
      ctx.strokeStyle = '#b8933a'; ctx.lineWidth = 1.5;
      for (let k = 6; k < T; k += 6) { ctx.beginPath(); ctx.moveTo(x + 2, y + k); ctx.lineTo(x + T - 2, y + k); ctx.stroke(); }
      ctx.fillStyle = '#9b4b2a'; ctx.fillRect(x + 9, y + 1, 3, T - 2); ctx.fillRect(x + 21, y + 1, 3, T - 2);
    } else {
      ctx.fillStyle = '#c98c4f'; ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
      ctx.strokeStyle = '#8a5530'; ctx.lineWidth = 3; ctx.strokeRect(x + 2.5, y + 2.5, T - 5, T - 5);
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + T - 4, y + T - 4); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x + 4, y + 4, T - 8, 2);
    }
  }

  function drawBurr(ctx, x, y, time) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = '#6b7a2a'; ctx.lineWidth = 2;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); ctx.stroke();
    }
    ctx.fillStyle = '#8fa23a'; circle(ctx, 0, 0, 9);
    ctx.fillStyle = '#7a4a26'; circle(ctx, 0, 1, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; circle(ctx, -3, -3, 2);
    ctx.restore();
  }

  // ===== 動く足場 =====
  function drawMover(ctx, m, th) {
    const x = m.x, y = m.y;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 4, y + 12, m.w - 8, 5);
    ctx.fillStyle = '#e8b04a'; rrect(ctx, x, y, m.w, 14, 4); ctx.fill();
    ctx.fillStyle = '#c4862e';
    for (let k = 8; k < m.w - 4; k += 16) ctx.fillRect(x + k, y + 3, 8, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 3, y + 2, m.w - 6, 2);
    ctx.strokeStyle = '#7a4f1e'; ctx.lineWidth = 1.5; rrect(ctx, x + 0.5, y + 0.5, m.w - 1, 13, 4); ctx.stroke();
  }
  function drawMoverPath(ctx, m) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(m.x0 + m.w / 2, m.y0 + 7); ctx.lineTo(m.x0 + m.dx + m.w / 2, m.y0 + m.dy + 7); ctx.stroke();
    ctx.setLineDash([]);
  }

  // ===== ヨーヨー =====
  const YOYO_COLS = ['#ff6f91', '#58b8ff', '#ffd75a', '#8be07a'];
  function drawYoyo(ctx, y, i, time) {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(y.ax, y.ay + 6); ctx.lineTo(y.bx, y.by - y.r); ctx.stroke();
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(y.ax - 10, y.ay, 20, 6);
    ctx.fillStyle = YOYO_COLS[i % 4];
    circle(ctx, y.bx, y.by, y.r);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(y.bx, y.by, y.r * 0.65, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(y.bx, y.by, y.r * 0.65, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(ctx, y.bx - 4, y.by - 5, 3);
  }

  // ===== 敵 =====
  function drawEnemy(ctx, e, time) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    if (!e.alive) {
      const k = Math.min(1, e.deadT / 0.4);
      ctx.globalAlpha = 1 - k;
      ctx.translate(cx, by);
      ctx.scale(1 + k * 0.4, Math.max(0.2, 0.35 - k * 0.1));
      ctx.translate(-cx, -by);
    }
    if (e.type === 'walker') {
      // ころもち: まるいおもちのいきもの
      const step = Math.sin(time * 10 + e.x0) * 1.5;
      ctx.fillStyle = '#c99a7a'; circle(ctx, cx - 7, by - 2 + Math.max(0, step), 4); circle(ctx, cx + 7, by - 2 + Math.max(0, -step), 4);
      ctx.fillStyle = '#fff1e0'; ctx.strokeStyle = '#8a5a44'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx, by - 11, 14, 11 + Math.sin(time * 6 + e.x0) * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5fb848';
      ctx.beginPath(); ctx.ellipse(cx + 2, by - 24, 6, 3, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4a8a3a'; ctx.beginPath(); ctx.moveTo(cx, by - 22); ctx.lineTo(cx - 1, by - 19); ctx.stroke();
      const f = e.face || -1;
      ctx.strokeStyle = '#3a2a24'; ctx.lineWidth = 1.8;
      if (e.alive) {
        ctx.beginPath(); ctx.arc(cx + f * 3 - 4, by - 12, 2.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + f * 3 + 4, by - 12, 2.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(cx - 7, by - 14); ctx.lineTo(cx - 3, by - 10); ctx.moveTo(cx - 7, by - 10); ctx.lineTo(cx - 3, by - 14);
        ctx.moveTo(cx + 3, by - 14); ctx.lineTo(cx + 7, by - 10); ctx.moveTo(cx + 3, by - 10); ctx.lineTo(cx + 7, by - 14); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,140,140,0.6)'; circle(ctx, cx + f * 3 - 9, by - 8, 2.5); circle(ctx, cx + f * 3 + 9, by - 8, 2.5);
    } else {
      // けだま: ふわふわの毛玉
      const cy = e.y + e.h / 2;
      const flap = Math.sin(time * 18) * 0.5;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.save(); ctx.translate(cx - 10, cy - 4); ctx.rotate(-0.5 + flap); ctx.beginPath(); ctx.ellipse(-6, 0, 8, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(cx + 10, cy - 4); ctx.rotate(0.5 - flap); ctx.beginPath(); ctx.ellipse(6, 0, 8, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#b79ae8';
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + time;
        circle(ctx, cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 4.5);
      }
      circle(ctx, cx, cy, 10);
      const f = e.face || -1;
      ctx.fillStyle = '#ffffff'; circle(ctx, cx + f * 2 - 4, cy - 1, 4); circle(ctx, cx + f * 2 + 4, cy - 1, 4);
      ctx.fillStyle = '#2a2040'; circle(ctx, cx + f * 3 - 4, cy, 2); circle(ctx, cx + f * 3 + 4, cy, 2);
      ctx.fillStyle = 'rgba(255,150,170,0.7)'; circle(ctx, cx - 8, cy + 4, 2); circle(ctx, cx + 8, cy + 4, 2);
    }
    ctx.restore();
  }

  // ===== スイカ =====
  function drawMelon(ctx, x, y, time, scale) {
    ctx.save();
    ctx.translate(x, y + Math.sin(time * 3 + x * 0.05) * 2);
    ctx.scale(scale || 1, scale || 1);
    ctx.rotate(Math.sin(time * 2 + x) * 0.08);
    ctx.fillStyle = 'rgba(255,245,170,0.32)'; circle(ctx, 0, 0, 15);
    ctx.fillStyle = '#2f8a3a';
    ctx.beginPath(); ctx.moveTo(-12, -6); ctx.arc(0, -6, 12, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8f5c8';
    ctx.beginPath(); ctx.moveTo(-10, -6); ctx.arc(0, -6, 10, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff4f5e';
    ctx.beginPath(); ctx.moveTo(-9, -6); ctx.arc(0, -6, 9, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a1a1a';
    [[-4, -3], [0, 0], [4, -3], [-1, -4]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.ellipse(sx, sy, 1, 1.6, 0, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-8, -7, 6, 1.5);
    ctx.restore();
  }

  // ===== チェックポイント(風鈴) =====
  function drawCheckpoint(ctx, c, active, time) {
    const x = c.x + 10, by = c.y + T;
    ctx.fillStyle = '#6aa04a'; ctx.fillRect(x - 2, by - 78, 4, 78);
    ctx.fillStyle = '#4f8a36';
    for (let k = 1; k < 4; k++) ctx.fillRect(x - 3, by - k * 22, 6, 2);
    ctx.fillRect(x, by - 78, 18, 3);
    const sw = active ? Math.sin(time * 4) * 0.35 : Math.sin(time * 1.2) * 0.05;
    ctx.save(); ctx.translate(x + 16, by - 75); ctx.rotate(sw);
    if (active) { ctx.fillStyle = 'rgba(180,230,255,0.35)'; circle(ctx, 0, 10, 20); }
    ctx.fillStyle = 'rgba(200,235,255,0.9)';
    ctx.beginPath(); ctx.arc(0, 10, 9, Math.PI, 0); ctx.lineTo(9, 13); ctx.lineTo(-9, 13); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#4a90c0'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#e04a4a'; ctx.fillRect(-7, 7, 14, 2);
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 13); ctx.lineTo(0, 22); ctx.stroke();
    ctx.fillStyle = active ? '#ff6a6a' : '#e7e2d6';
    ctx.fillRect(-4, 22, 8, 20);
    ctx.restore();
  }

  // ===== ゴール(旗) =====
  function drawGoal(ctx, g, reached, time) {
    const x = g.x, by = g.y;
    ctx.fillStyle = '#8a6a48'; ctx.fillRect(x - 3, by - 128, 6, 128);
    ctx.fillStyle = '#ffd04a'; circle(ctx, x, by - 130, 6);
    const flagY = by - 122 + (reached ? 0 : 0);
    const wave = Math.sin(time * (reached ? 10 : 4));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(x + 3, flagY);
    ctx.quadraticCurveTo(x + 26, flagY - 4 + wave * 3, x + 50, flagY + 2 + wave * 2);
    ctx.lineTo(x + 50, flagY + 34 + wave * 2);
    ctx.quadraticCurveTo(x + 26, flagY + 30 + wave * 3, x + 3, flagY + 34);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d0c2a0'; ctx.lineWidth = 1.5; ctx.stroke();
    drawMelon(ctx, x + 27, flagY + 21, 0, 1.1);
    ctx.fillStyle = '#7a5a3c'; ctx.fillRect(x - 14, by - 6, 28, 6);
  }

  // ===== 主人公: たけ少年 =====
  // anim: { state: 'idle'|'walk'|'jump'|'fall'|'dead'|'win', t, walk, blink }
  function drawPlayer(ctx, x, y, face, anim) {
    const OUT = '#4a3428';
    const SKIN = '#f8cfa4';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face * 1.18, 1.18);
    const st = anim.state;
    let bob = 0, legA = 0, armA = 0;
    if (st === 'idle') { bob = Math.sin(anim.t * 3) * 0.8; armA = 0.15; }
    else if (st === 'walk') { legA = Math.sin(anim.walk) * 0.7; armA = -Math.sin(anim.walk) * 0.8; bob = -Math.abs(Math.sin(anim.walk)) * 2; }
    else if (st === 'jump') { legA = 0.6; armA = 2.4; }
    else if (st === 'fall') { legA = -0.3; armA = 1.9; }
    else if (st === 'dead') { armA = 2.8; }
    else if (st === 'win') { armA = 2.9 + Math.sin(anim.t * 12) * 0.15; bob = -Math.abs(Math.sin(anim.t * 6)) * 4; }
    ctx.translate(0, bob);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // 足
    const leg = (ang, dx, front) => {
      ctx.save(); ctx.translate(dx, -10); ctx.rotate(ang);
      ctx.strokeStyle = OUT; ctx.lineWidth = 6.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 8); ctx.stroke();
      ctx.strokeStyle = SKIN; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 8); ctx.stroke();
      ctx.fillStyle = front ? '#f5f5f0' : '#e2e2da'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
      rrect(ctx, -3, 7, 9, 4, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e0503c'; ctx.fillRect(-1, 8, 5, 1.5);
      ctx.restore();
    };
    if (st === 'jump') { leg(-0.9, -3, false); leg(0.5, 3, true); }
    else { leg(-legA, -3, false); leg(legA, 3, true); }

    // 腕(後ろ)
    const arm = (ang, dx) => {
      ctx.save(); ctx.translate(dx, -22); ctx.rotate(ang);
      ctx.strokeStyle = OUT; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 10); ctx.stroke();
      ctx.strokeStyle = SKIN; ctx.lineWidth = 3.6;
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 10); ctx.stroke();
      ctx.restore();
    };
    arm(st === 'walk' ? -armA : -armA * 0.9 - 0.1, -7);

    // 短パン
    ctx.fillStyle = '#3f63b0'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
    rrect(ctx, -8, -14, 16, 7, 2); ctx.fill(); ctx.stroke();
    // Tシャツ
    ctx.fillStyle = '#fbfbf4';
    rrect(ctx, -9, -26, 18, 14, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff5a5a'; ctx.fillRect(-8.3, -18, 16.6, 2.5);
    // 袖
    ctx.fillStyle = '#fbfbf4';
    ctx.beginPath(); ctx.ellipse(6, -23, 4, 3.4, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 腕(前)
    arm(st === 'walk' ? armA : armA, 6);

    // 頭 (坊主頭)
    const hy = -36;
    ctx.fillStyle = SKIN; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
    circle(ctx, -9, hy + 2, 3); ctx.beginPath(); ctx.arc(-9, hy + 2, 3, 0, Math.PI * 2); ctx.stroke(); // 耳
    ctx.beginPath(); ctx.ellipse(0, hy, 12, 11.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 坊主の髪(青みがかった短い毛)
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, hy, 12, 11.5, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(70,80,110,0.55)';
    ctx.beginPath(); ctx.ellipse(-2, hy - 6, 14, 9, -0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.ellipse(6, hy + 3, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; circle(ctx, -3, hy - 8, 2.5);
    ctx.restore();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, hy, 12, 11.5, 0, 0, Math.PI * 2); ctx.stroke();
    // 顔
    ctx.fillStyle = '#2a1e1a'; ctx.strokeStyle = '#2a1e1a'; ctx.lineWidth = 1.6;
    if (st === 'dead') {
      ctx.beginPath();
      ctx.moveTo(2, hy - 1); ctx.lineTo(5, hy + 1); ctx.lineTo(2, hy + 3);
      ctx.moveTo(10, hy - 1); ctx.lineTo(7, hy + 1); ctx.lineTo(10, hy + 3);
      ctx.stroke();
      ctx.beginPath(); ctx.ellipse(6, hy + 6, 2, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      if (anim.blink || st === 'win') {
        ctx.beginPath(); ctx.arc(3.5, hy + 1, 2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(9, hy + 1, 2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.ellipse(3.5, hy + 0.5, 1.7, 2.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(9, hy + 0.5, 1.7, 2.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; circle(ctx, 4, hy - 0.5, 0.7); circle(ctx, 9.5, hy - 0.5, 0.7);
      }
      ctx.strokeStyle = '#7a3a2a'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (st === 'jump' || st === 'win') { ctx.fillStyle = '#c0504a'; ctx.arc(6.5, hy + 5, 2.4, 0, Math.PI); ctx.fill(); }
      else { ctx.arc(6.5, hy + 4.5, 2, 0.2, Math.PI - 0.2); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(255,120,110,0.45)'; circle(ctx, 0, hy + 4, 2.6); circle(ctx, 11, hy + 4, 2.2);
    ctx.restore();
  }

  // ===== 花火 =====
  const FW_COLS = ['#ff6b6b', '#ffd93b', '#6bd5ff', '#b48bff', '#7dff9a', '#ff9de0', '#ffffff'];
  function makeFireworks() { return { rockets: [], sparks: [], timer: 0.5 }; }
  function updateFireworks(fw, dt, vw, vh, rate, onBoom) {
    fw.timer -= dt;
    if (fw.timer <= 0) {
      fw.timer = rate * (0.6 + Math.random() * 0.8);
      fw.rockets.push({ x: vw * (0.15 + Math.random() * 0.7), y: vh, vy: -(vh * 0.9 + Math.random() * vh * 0.4), ty: vh * (0.12 + Math.random() * 0.3), col: FW_COLS[Math.floor(Math.random() * FW_COLS.length)] });
    }
    for (let i = fw.rockets.length - 1; i >= 0; i--) {
      const r = fw.rockets[i];
      r.y += r.vy * dt; r.vy *= 0.985;
      if (r.y <= r.ty) {
        const n = 36 + Math.floor(Math.random() * 20);
        const sp = 90 + Math.random() * 70;
        const col2 = Math.random() < 0.5 ? r.col : FW_COLS[Math.floor(Math.random() * FW_COLS.length)];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          fw.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.4 + Math.random() * 0.4, max: 1.6, col: k % 2 ? r.col : col2 });
        }
        fw.rockets.splice(i, 1);
        if (onBoom) onBoom();
      }
    }
    for (let i = fw.sparks.length - 1; i >= 0; i--) {
      const s = fw.sparks[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.97; s.vy = s.vy * 0.97 + 40 * dt; s.life -= dt;
      if (s.life <= 0) fw.sparks.splice(i, 1);
    }
  }
  function drawFireworks(ctx, fw, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of fw.rockets) { ctx.globalAlpha = alpha; ctx.fillStyle = '#ffe7a0'; ctx.fillRect(r.x - 1, r.y, 2, 8); }
    for (const s of fw.sparks) {
      ctx.globalAlpha = alpha * Math.max(0, Math.min(1, s.life / 0.8));
      ctx.fillStyle = s.col;
      ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
    ctx.restore();
  }

  // ===== エンディングの一枚絵 =====
  function drawEndingScene(ctx, vw, vh, time, fw) {
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, '#0b0f30'); g.addColorStop(1, '#3a2c6a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    for (let i = 0; i < 90; i++) {
      ctx.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(time * 2 + i));
      ctx.fillStyle = '#fffbe0';
      ctx.fillRect(hash(i, 1) * vw, hash(i, 2) * vh * 0.6, 2, 2);
    }
    ctx.globalAlpha = 1;
    drawFireworks(ctx, fw, 1);
    // 遠くの町
    ctx.fillStyle = '#1b1d42';
    ctx.beginPath(); ctx.moveTo(0, vh);
    for (let x = 0; x <= vw + 20; x += 20) ctx.lineTo(x, vh * 0.74 + Math.sin(x * 0.01) * 10);
    ctx.lineTo(vw, vh); ctx.fill();
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = hash(i, 9) < 0.7 ? '#ffd27a' : '#8a8ad0';
      ctx.fillRect(hash(i, 4) * vw, vh * 0.78 + hash(i, 5) * vh * 0.06, 3, 3);
    }
    // 丘
    ctx.fillStyle = '#2e4a3a';
    ctx.beginPath(); ctx.moveTo(0, vh); ctx.lineTo(0, vh * 0.86);
    ctx.quadraticCurveTo(vw * 0.35, vh * 0.74, vw * 0.7, vh * 0.86); ctx.lineTo(vw, vh * 0.9); ctx.lineTo(vw, vh); ctx.fill();
    // 少年のうしろ姿(すわっている)
    const sx = vw * 0.36, sy = vh * 0.8;
    ctx.save(); ctx.translate(sx, sy);
    ctx.fillStyle = '#3f63b0'; rrect(ctx, -12, -6, 24, 10, 4); ctx.fill();
    ctx.fillStyle = '#e8e8e0'; rrect(ctx, -12, -28, 24, 24, 6); ctx.fill();
    ctx.fillStyle = '#f0a090'; ctx.fillRect(-12, -16, 24, 3);
    ctx.fillStyle = '#e8b890'; ctx.beginPath(); ctx.ellipse(0, -40, 13, 12.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(70,80,110,0.55)'; ctx.beginPath(); ctx.ellipse(0, -43, 13, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b890'; circle(ctx, -13, -39, 3); circle(ctx, 13, -39, 3);
    ctx.restore();
    // となりにスイカ
    ctx.save(); ctx.translate(sx + 34, sy + 2); drawMelon(ctx, 0, 0, 0, 1.2); ctx.restore();
  }

  root.Render = {
    THEMES, drawBackground, drawLevel, drawMover, drawMoverPath, drawYoyo, drawEnemy, drawMelon,
    drawCheckpoint, drawGoal, drawPlayer, makeFireworks, updateFireworks, drawFireworks, drawEndingScene, circle,
  };
})(window);
