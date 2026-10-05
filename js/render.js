/*
 * render.js — 絵はすべてキャンバスの図形で描いています(外部画像なし)
 */
(function (root) {
  'use strict';
  const T = Engine.TILE;

  // ===== テーマ(色) =====
  const THEMES = {
    asakusa: {
      sky: ['#4aaff0', '#cdeeff'], sun: 'sun', clouds: true, far: '#9cc3d8', near: '#b9c7cf', props: 'asakusa', landmark: 'pagoda',
      grass: '#c9c1b3', grassHi: '#e6dfd2', soil: '#a89f92', soilDark: '#8d857a', stone: true, block: 'crate', plank: '#b5653d', water: '#5cb7e0', spike: 'burr',
    },
    fuji: {
      sky: ['#3fa6ee', '#d6f1ff'], sun: 'sun', clouds: true, far: '#8fb8d6', near: '#86c56a', props: 'flowers', landmark: 'fuji', lake: '#5aa7d8',
      grass: '#79cc4f', grassHi: '#aee77a', soil: '#b07d4f', soilDark: '#8f6139', block: 'crate', plank: '#a8703f', water: '#4f9fd6', spike: 'burr',
    },
    arashiyama: {
      sky: ['#5bb3e6', '#e3f6e6'], sun: 'sun', clouds: true, far: '#7fae8f', near: '#5d9a5c', props: 'bamboo', landmark: 'togetsukyo', lake: '#6fb3c9',
      grass: '#6dbb48', grassHi: '#9edc6c', soil: '#a37548', soilDark: '#82593a', block: 'stone', plank: '#9a6a3f', water: '#5aaed0', spike: 'burr',
    },
    dotonbori: {
      sky: ['#5a4b9c', '#ffb98a'], sun: null, clouds: true, cloudTint: '#ffd8c0', far: '#7c6f9f', near: '#6c5a8a', props: 'citylights', landmark: 'canal', lake: '#4a6fa8', stars: 0.3,
      grass: '#b9b2c4', grassHi: '#dad4e4', soil: '#8f879c', soilDark: '#756e82', stone: true, block: 'crate', plank: '#c4844b', water: '#4f78b8', spike: 'burr', rim: true,
    },
    nara: {
      sky: ['#56b4ea', '#dff4ff'], sun: 'sun', clouds: true, far: '#9ac3b4', near: '#6fb36a', props: 'deer', landmark: 'temple',
      grass: '#68c04a', grassHi: '#9ee070', soil: '#a77a4c', soilDark: '#865d36', block: 'crate', plank: '#a8703f', water: '#4aa9de', spike: 'burr',
    },
    kamikochi: {
      sky: ['#3d9ee8', '#d8f0ff'], sun: 'sun', clouds: true, far: '#8aa4bb', near: '#4f9a6a', props: 'larch', landmark: 'alps', lake: '#78d0e0',
      grass: '#62b85a', grassHi: '#95d98a', soil: '#9a8166', soilDark: '#7c6650', block: 'stone', plank: '#8f6a45', water: '#6ccde0', spike: 'burr',
    },
    dreampark: {
      sky: ['#9a8cf0', '#ffd6ec'], sun: null, clouds: true, cloudTint: '#fff4fb', far: '#c9b6ee', near: '#f2c4df', props: 'parade', landmark: 'castle', stars: 0.5,
      grass: '#ffb7d5', grassHi: '#ffe0ee', soil: '#c9a8e6', soilDark: '#b08fd0', stone: true, block: 'gift', plank: '#ffcf5a', water: '#7ab8ff', spike: 'konpeito',
    },
    okinawa: {
      sky: ['#27a3f0', '#c8f3ff'], sun: 'sun', clouds: true, far: '#2fc0d8', near: '#36d0d0', props: 'palms', landmark: 'sea',
      grass: '#f5e9c8', grassHi: '#fffaf0', soil: '#ecd9a8', soilDark: '#d8c08a', block: 'coral', plank: '#c79a5e', water: '#22b8d8', spike: 'urchin', sand: true,
    },
    hokkaido: {
      sky: ['#8cc4ee', '#f2f8ff'], sun: 'sun', clouds: false, far: '#c4d6e8', near: '#e8f0f8', props: 'snowy', landmark: 'snowhills', snow: true,
      grass: '#ffffff', grassHi: '#ffffff', soil: '#b8c4d4', soilDark: '#a0aec2', block: 'ice', plank: '#a8784a', water: '#6aa8d8', spike: 'ice',
    },
    finale: {
      sky: ['#0e1236', '#3b2d6c'], sun: null, clouds: false, far: '#2a2a5e', near: '#232a50', props: 'festival', landmark: 'fujinight', stars: 1, fireworks: true, lanterns: true,
      grass: '#6db36a', grassHi: '#9fdc95', soil: '#a07f60', soilDark: '#80644b', block: 'crate', plank: '#c4844b', water: '#3d64ad', spike: 'konpeito', rim: true,
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
    }
    if (fw) drawFireworks(ctx, fw, 0.85);
    if (th.clouds) drawClouds(ctx, camX, vw, vh, time, th.cloudTint);

    drawLandmark(ctx, th, camX, vw, vh, time);

    // 近くの丘(テーマ色)
    ctx.fillStyle = th.near;
    ctx.beginPath();
    ctx.moveTo(0, vh);
    for (let x = 0; x <= vw + 16; x += 16) {
      const wx = x + camX * 0.3;
      const y = vh * 0.7 + Math.sin(wx * 0.006 + 2) * 16 + Math.sin(wx * 0.017) * 6;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(vw, vh); ctx.closePath(); ctx.fill();

    drawProps(ctx, th, camX, vw, vh, time);
    if (th.snow) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 50; i++) {
        const x = (((hash(i, 1) * 1600 + Math.sin(time + i) * 20 - camX * 0.5) % vw) + vw) % vw;
        const y = (hash(i, 2) * vh + time * (20 + hash(i, 4) * 25)) % vh;
        circle(ctx, x, y, 1.5 + hash(i, 5) * 1.5);
      }
    }
  }

  function mountainRange(ctx, col, camX, par, vw, base, amp, f1, f2) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, base + 200);
    for (let x = 0; x <= vw + 16; x += 16) {
      const wx = x + camX * par;
      ctx.lineTo(x, base - Math.abs(Math.sin(wx * f1)) * amp - Math.sin(wx * f2 + 1) * amp * 0.25);
    }
    ctx.lineTo(vw, base + 200); ctx.closePath(); ctx.fill();
  }

  function fuji(ctx, x, base, s, night) {
    ctx.save(); ctx.translate(x, base); ctx.scale(s, s);
    ctx.fillStyle = night ? '#2c2f62' : '#6f8fc0';
    ctx.beginPath(); ctx.moveTo(-260, 0); ctx.lineTo(-48, -170); ctx.quadraticCurveTo(0, -182, 48, -170); ctx.lineTo(260, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = night ? '#c9cbe8' : '#ffffff';
    ctx.beginPath(); ctx.moveTo(-48, -170); ctx.quadraticCurveTo(0, -182, 48, -170); ctx.lineTo(92, -128);
    for (let k = 0; k <= 8; k++) ctx.lineTo(92 - k * 23, -128 + (k % 2 ? 14 : 0));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawLandmark(ctx, th, camX, vw, vh, time) {
    const lm = th.landmark;
    if (lm === 'fuji' || lm === 'fujinight') {
      fuji(ctx, vw * 0.62 - (camX * 0.03) % 200, vh * 0.68, 1.3, lm === 'fujinight');
    }
    if (lm === 'alps') {
      mountainRange(ctx, '#7d8fa8', camX, 0.06, vw, vh * 0.66, 170, 0.006, 0.02);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let x = 0; x <= vw; x += 16) {
        const wx = x + camX * 0.06;
        const top = vh * 0.66 - Math.abs(Math.sin(wx * 0.006)) * 170 - Math.sin(wx * 0.02 + 1) * 42;
        if (top < vh * 0.4) ctx.fillRect(x, top, 16, 14);
      }
    } else if (lm === 'snowhills') {
      mountainRange(ctx, '#d6e2ef', camX, 0.08, vw, vh * 0.66, 110, 0.005, 0.018);
    } else if (lm === 'sea') {
      ctx.fillStyle = th.far; ctx.fillRect(0, vh * 0.5, vw, vh * 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 18; i++) {
        const x = (((hash(i, 8) * 1500 - camX * 0.2 + time * 8) % vw) + vw) % vw;
        ctx.fillRect(x, vh * 0.52 + hash(i, 9) * vh * 0.15, 18 + hash(i, 3) * 20, 2);
      }
    } else if (lm !== 'fuji' && lm !== 'fujinight') {
      mountainRange(ctx, th.far, camX, 0.12, vw, vh * 0.62, 60, 0.004, 0.011);
    }
    if (th.lake) {
      ctx.fillStyle = th.lake; ctx.fillRect(0, vh * 0.62, vw, vh * 0.12);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (let i = 0; i < 12; i++) {
        const x = (((hash(i, 5) * 1300 - camX * 0.25) % vw) + vw) % vw;
        ctx.fillRect(x, vh * 0.64 + hash(i, 6) * vh * 0.08, 24, 2);
      }
    }
    // 大きな目印(ゆっくり流れる)
    const par = 0.18, span = 1400;
    const first = Math.floor((camX * par - 400) / span), last = Math.ceil((camX * par + vw + 400) / span);
    for (let i = first; i <= last; i++) {
      const x = i * span + 500 - camX * par;
      ctx.save(); ctx.translate(x, vh * 0.66);
      if (lm === 'pagoda') pagoda(ctx);
      else if (lm === 'togetsukyo') longBridge(ctx, 0);
      else if (lm === 'canal') canalBridge(ctx);
      else if (lm === 'temple') temple(ctx);
      else if (lm === 'alps') kappaBridge(ctx);
      else if (lm === 'castle') castle(ctx, time);
      ctx.restore();
    }
  }

  function drawClouds(ctx, camX, vw, vh, time, tint) {
    const span = 1600;
    for (let i = 0; i < 4; i++) {
      const base = i * 420 + 120 - camX * 0.06 - time * 4;
      const x = ((base % span) + span) % span - 200;
      if (x > vw + 200) continue;
      const big = i % 2 === 0;
      const y = vh * (big ? 0.36 : 0.18) + (i * 13) % 30;
      const s = big ? 1.1 : 0.7;
      ctx.fillStyle = tint || '#ffffff';
      const puffs = big
        ? [[0, 0, 46], [40, -30, 42], [80, -6, 40], [20, -64, 36], [58, -80, 34], [96, -40, 32], [-36, 4, 30], [120, 6, 28]]
        : [[0, 0, 26], [28, -14, 24], [56, 0, 22], [-22, 4, 18]];
      for (const p of puffs) circle(ctx, x + p[0] * s, y + p[1] * s, p[2] * s);
      ctx.fillStyle = 'rgba(170,195,230,0.3)';
      for (const p of puffs) if (p[1] >= -10) { ctx.beginPath(); ctx.ellipse(x + p[0] * s, y + (p[1] + p[2] * 0.55) * s, p[2] * 0.8 * s, p[2] * 0.35 * s, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function drawProps(ctx, th, camX, vw, vh, time) {
    const par = 0.42;
    const base = vh * 0.72;
    const spacing = { bamboo: 70, citylights: 120, parade: 240, palms: 200, snowy: 170, festival: 210 }[th.props] || 230;
    const first = Math.floor((camX * par - 200) / spacing);
    const last = Math.ceil((camX * par + vw + 200) / spacing);
    for (let i = first; i <= last; i++) {
      const x = i * spacing - camX * par;
      const r = hash(i, 11);
      ctx.save();
      ctx.translate(x, base);
      switch (th.props) {
        case 'asakusa': if (i % 5 === 0) kaminarimon(ctx, time); else shopFront(ctx, r, i); break;
        case 'flowers': flowerField(ctx, r); break;
        case 'bamboo': bamboo(ctx, r, time); break;
        case 'citylights': cityBuilding(ctx, r, i, time); break;
        case 'deer': if (r < 0.5) deer(ctx, r, time, i); else tree(ctx, '#4f9a45', r); break;
        case 'larch': cedar(ctx, r < 0.5 ? '#3f7d4f' : '#4f8f5a', r); break;
        case 'parade': if (i % 3 === 0) ferris(ctx, time); else paradeFloat(ctx, r, time, i); break;
        case 'palms': palm(ctx, r, time); break;
        case 'snowy': if (r < 0.35) snowman(ctx, r); else snowTree(ctx, r); break;
        case 'festival': stall(ctx, r, time); break;
      }
      ctx.restore();
    }
    if (th.props === 'parade') {
      // ふわふわ上がる風船
      for (let i = 0; i < 9; i++) {
        const bx = (((hash(i, 21) * 1800 - camX * 0.3) % (vw + 100)) + vw + 100) % (vw + 100) - 50;
        const by = vh - ((time * (14 + hash(i, 22) * 10) + hash(i, 23) * vh) % (vh + 80));
        balloon(ctx, bx, by, ['#ff7aa8', '#7ac8ff', '#ffd75a', '#a8f07a', '#c49aff'][i % 5]);
      }
    }
    if (th.lanterns) {
      const lpar = 0.6, sp = 70;
      const f = Math.floor((camX * lpar - 100) / sp), l = Math.ceil((camX * lpar + vw + 100) / sp);
      ctx.strokeStyle = 'rgba(40,30,30,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = f; i <= l; i++) {
        const x = i * sp - camX * lpar;
        ctx.moveTo(x, 80); ctx.quadraticCurveTo(x + sp / 2, 96, x + sp, 80);
      }
      ctx.stroke();
      for (let i = f; i <= l; i++) lantern(ctx, i * sp - camX * lpar + sp / 2, 90, time + i, 0.7);
    }
  }

  // --- 背景の部品 ---
  function pagoda(ctx) {
    ctx.fillStyle = '#7b6a78';
    for (let k = 0; k < 5; k++) {
      const w = 70 - k * 9, y = -30 - k * 34;
      ctx.fillRect(-w / 3, y, (w * 2) / 3, 30);
      ctx.beginPath(); ctx.moveTo(-w, y + 2); ctx.lineTo(0, y - 10); ctx.lineTo(w, y + 2); ctx.closePath(); ctx.fill();
    }
    ctx.fillRect(-2, -230, 4, 50);
    ctx.fillRect(-30, -30, 60, 40);
  }
  function kaminarimon(ctx, time) {
    // 赤い門と大きな提灯(オリジナルの絵)
    ctx.fillStyle = '#c9352c';
    ctx.fillRect(-70, -110, 14, 110); ctx.fillRect(56, -110, 14, 110);
    ctx.fillStyle = '#3a3138';
    ctx.beginPath(); ctx.moveTo(-100, -108); ctx.lineTo(-76, -140); ctx.lineTo(76, -140); ctx.lineTo(100, -108); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9352c'; ctx.fillRect(-80, -112, 160, 10);
    ctx.save(); ctx.translate(0, -96); ctx.rotate(Math.sin(time) * 0.02);
    ctx.fillStyle = 'rgba(255,190,120,0.3)'; circle(ctx, 0, 30, 46);
    ctx.fillStyle = '#e0392f'; ctx.beginPath(); ctx.ellipse(0, 30, 30, 38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(120,20,20,0.5)'; ctx.lineWidth = 1.5;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(0, 30, Math.abs(k) * 12, 38, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#2b2020'; ctx.fillRect(-20, -10, 40, 6); ctx.fillRect(-20, 64, 40, 6);
    ctx.restore();
  }
  function shopFront(ctx, r, i) {
    const cols = ['#e2574c', '#4c8de2', '#e2a64c', '#58b36a', '#b06ad0'];
    ctx.fillStyle = '#f2e6cf'; ctx.fillRect(-100, -66, 200, 66);
    ctx.fillStyle = '#5a3e2c'; ctx.fillRect(-104, -80, 208, 14);
    ctx.fillStyle = cols[i % 5];
    for (let k = 0; k < 8; k++) ctx.fillRect(-100 + k * 25, -66, 12, 12);
    ctx.fillStyle = '#c99a6a'; ctx.fillRect(-90, -40, 180, 40);
    ctx.fillStyle = '#e04a3a'; circle(ctx, -70, -50, 7); circle(ctx, 70, -50, 7);
  }
  function flowerField(ctx, r) {
    const cols = ['#ff8fc8', '#c48aff', '#ffe066', '#ff9a7a'];
    for (let row = 0; row < 3; row++) {
      ctx.fillStyle = cols[(Math.floor(r * 4) + row) % 4];
      ctx.beginPath(); ctx.ellipse(0, -6 + row * 8, 120, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  function bamboo(ctx, r, time) {
    const h = 260 + r * 80, sway = Math.sin(time * 0.8 + r * 6) * 4;
    for (let k = 0; k < 2; k++) {
      const x = k * 30 - 10;
      ctx.strokeStyle = k ? '#5fae52' : '#4b9a45'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(x, 10); ctx.quadraticCurveTo(x, -h / 2, x + sway, -h); ctx.stroke();
      ctx.strokeStyle = '#3b7f36'; ctx.lineWidth = 9;
      for (let y = -30; y > -h; y -= 40) { ctx.beginPath(); ctx.moveTo(x - 4.5, y); ctx.lineTo(x + 4.5, y); ctx.stroke(); }
      ctx.fillStyle = '#6cc25a';
      for (let y = -h + 20; y < -h / 2; y += 30) { ctx.beginPath(); ctx.ellipse(x + 14 + sway, y, 14, 4, -0.4, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  function longBridge(ctx) {
    ctx.fillStyle = '#7a5a40'; ctx.fillRect(-500, -34, 1000, 8);
    for (let x = -480; x <= 480; x += 40) ctx.fillRect(x, -30, 5, 34);
    ctx.fillRect(-500, -48, 1000, 3);
    for (let x = -480; x <= 480; x += 20) ctx.fillRect(x, -48, 2, 14);
  }
  function canalBridge(ctx) {
    ctx.fillStyle = '#9a8ab0';
    ctx.beginPath(); ctx.moveTo(-160, 0); ctx.quadraticCurveTo(0, -60, 160, 0); ctx.lineTo(160, -10); ctx.quadraticCurveTo(0, -72, -160, -10); ctx.closePath(); ctx.fill();
  }
  function cityBuilding(ctx, r, i, time) {
    const cols = ['#ff6b8a', '#ffcf4a', '#4ad0ff', '#9b7bff', '#5ee08a', '#ff8a3d'];
    const h = 90 + r * 120;
    ctx.fillStyle = '#4b3f6b'; ctx.fillRect(-54, -h, 108, h);
    ctx.fillStyle = 'rgba(255,230,160,0.7)';
    for (let y = -h + 12; y < -20; y += 18) for (let x = -44; x < 44; x += 18) if (hash(i * 7 + x, y) < 0.55) ctx.fillRect(x, y, 8, 8);
    // 色とりどりの看板(文字なし)
    const glow = 0.75 + 0.25 * Math.sin(time * 3 + i);
    ctx.globalAlpha = glow;
    ctx.fillStyle = cols[i % 6]; ctx.fillRect(-46, -h + 18, 26, 70);
    ctx.fillStyle = cols[(i + 2) % 6]; circle(ctx, 30, -h + 40, 16);
    ctx.fillStyle = cols[(i + 4) % 6]; ctx.fillRect(-10, -h - 18, 50, 18);
    ctx.globalAlpha = 1;
  }
  function temple(ctx) {
    ctx.fillStyle = '#8a6f5a'; ctx.fillRect(-120, -70, 240, 70);
    ctx.fillStyle = '#4a4050';
    ctx.beginPath(); ctx.moveTo(-170, -66); ctx.quadraticCurveTo(0, -150, 170, -66); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d8b04a'; ctx.fillRect(-150, -76, 10, 10); ctx.fillRect(140, -76, 10, 10);
    ctx.fillStyle = '#c94a3a'; for (let x = -100; x <= 100; x += 40) ctx.fillRect(x - 4, -70, 8, 70);
  }
  function deer(ctx, r, time, i) {
    // なかよしのシカ(背景の仲間)
    const graze = (Math.sin(time * 0.7 + i) > 0.3);
    ctx.save(); if (r < 0.25) ctx.scale(-1, 1);
    ctx.fillStyle = '#c08a58';
    ctx.beginPath(); ctx.ellipse(0, -30, 26, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-20, -22, 5, 22); ctx.fillRect(-10, -22, 5, 22); ctx.fillRect(8, -22, 5, 22); ctx.fillRect(16, -22, 5, 22);
    ctx.fillStyle = '#fff4e0'; for (let k = 0; k < 4; k++) circle(ctx, -12 + k * 8, -34, 2);
    const hx = 26, hy = graze ? -14 : -54;
    ctx.strokeStyle = '#c08a58'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(18, -36); ctx.lineTo(hx, hy + 6); ctx.stroke();
    ctx.fillStyle = '#c08a58'; ctx.beginPath(); ctx.ellipse(hx + 4, hy, 10, 8, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1e1a'; circle(ctx, hx + 6, hy - 2, 1.8);
    ctx.fillStyle = '#e8b08a'; ctx.beginPath(); ctx.ellipse(hx - 4, hy - 8, 5, 3, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function kappaBridge(ctx) {
    ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-180, -60); ctx.quadraticCurveTo(0, -20, 180, -60); ctx.stroke();
    ctx.fillStyle = '#6a5a4a'; ctx.fillRect(-184, -64, 8, 64); ctx.fillRect(176, -64, 8, 64);
    ctx.fillRect(-180, -24, 360, 5);
    ctx.lineWidth = 1; for (let x = -160; x <= 160; x += 20) { ctx.beginPath(); ctx.moveTo(x, -24); ctx.lineTo(x, -60 + 40 * (1 - (x / 180) ** 2)); ctx.stroke(); }
  }
  function castle(ctx, time) {
    // オリジナルの夢のお城
    const tower = (x, w, h, roof) => {
      ctx.fillStyle = '#fff4fb'; ctx.fillRect(x - w / 2, -h, w, h);
      ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - w / 2 - 6, -h); ctx.lineTo(x, -h - w * 1.4); ctx.lineTo(x + w / 2 + 6, -h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd75a'; ctx.beginPath(); ctx.moveTo(x, -h - w * 1.4); ctx.lineTo(x + 14, -h - w * 1.4 + 5); ctx.lineTo(x, -h - w * 1.4 + 10); ctx.fill();
      ctx.fillStyle = '#9ac8ff'; ctx.fillRect(x - 4, -h + 16, 8, 12);
    };
    ctx.fillStyle = '#fbe8f4'; ctx.fillRect(-110, -90, 220, 90);
    tower(-100, 34, 130, '#9a7bff'); tower(100, 34, 130, '#9a7bff');
    tower(-50, 40, 170, '#ff86b6'); tower(50, 40, 170, '#ff86b6');
    tower(0, 54, 220, '#6aa8ff');
    ctx.fillStyle = '#d9a8ff'; ctx.beginPath(); ctx.arc(0, 0, 26, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * Math.sin(time * 3)) + ')';
    circle(ctx, -70, -200, 3); circle(ctx, 80, -230, 3); circle(ctx, 20, -280, 2.5);
  }
  function ferris(ctx, time) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(0, -110); ctx.lineTo(40, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -110, 80, 0, Math.PI * 2); ctx.stroke();
    const cols = ['#ff7aa8', '#7ac8ff', '#ffd75a', '#a8f07a', '#c49aff', '#ff9a5a'];
    for (let k = 0; k < 12; k++) {
      const a = time * 0.2 + (k / 12) * Math.PI * 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -110); ctx.lineTo(Math.cos(a) * 80, -110 + Math.sin(a) * 80); ctx.stroke();
      ctx.fillStyle = cols[k % 6]; rrect(ctx, Math.cos(a) * 80 - 7, -110 + Math.sin(a) * 80, 14, 12, 3); ctx.fill();
    }
  }
  function paradeFloat(ctx, r, time, i) {
    const cols = ['#ff86b6', '#6aa8ff', '#ffd75a', '#8be07a'];
    const bob = Math.sin(time * 2 + i) * 2;
    ctx.translate(0, bob);
    ctx.fillStyle = cols[i % 4]; rrect(ctx, -70, -40, 140, 34, 10); ctx.fill();
    ctx.fillStyle = '#ffffff'; for (let k = -2; k <= 2; k++) drawStarShape(ctx, k * 26, -22, 7);
    ctx.fillStyle = '#7a5a8a'; circle(ctx, -46, -4, 9); circle(ctx, 46, -4, 9);
    ctx.fillStyle = cols[(i + 1) % 4]; ctx.beginPath(); ctx.moveTo(-40, -40); ctx.quadraticCurveTo(0, -100, 40, -40); ctx.fill();
    ctx.fillStyle = '#fff4fb'; circle(ctx, 0, -72, 12);
  }
  function balloon(ctx, x, y, col) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.quadraticCurveTo(x + 4, y + 30, x, y + 44); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, 11, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; circle(ctx, x - 4, y - 5, 3);
  }
  function drawStarShape(ctx, x, y, r) {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
  function palm(ctx, r, time) {
    const lean = 10 + r * 20;
    ctx.strokeStyle = '#a8784a'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(lean * 0.3, -60, lean, -130); ctx.stroke();
    ctx.fillStyle = '#2fa860';
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.55 + Math.sin(time + k) * 0.05;
      ctx.save(); ctx.translate(lean, -130); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(28, 0, 30, 7, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (r < 0.5) { ctx.fillStyle = '#ff6a6a'; circle(ctx, -40, -6, 5); ctx.fillStyle = '#ffd75a'; circle(ctx, -30, -4, 5); }
  }
  function snowman(ctx, r) {
    ctx.fillStyle = '#ffffff'; circle(ctx, 0, -18, 20); circle(ctx, 0, -48, 14);
    ctx.fillStyle = '#2a2a3a'; circle(ctx, -5, -51, 2); circle(ctx, 5, -51, 2);
    ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.moveTo(0, -47); ctx.lineTo(12, -45); ctx.lineTo(0, -43); ctx.fill();
    ctx.fillStyle = r < 0.2 ? '#4a7ad8' : '#d84a4a'; ctx.fillRect(-12, -38, 24, 5);
    ctx.fillStyle = '#5a6a8a'; ctx.fillRect(-10, -70, 20, 10);
  }
  function snowTree(ctx, r) {
    const s = 0.9 + r * 0.6;
    ctx.fillStyle = '#2f6a50';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.moveTo(0, (-150 + k * 40) * s); ctx.lineTo(40 * s - k * 0, (-90 + k * 40) * s); ctx.lineTo(-40 * s, (-90 + k * 40) * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(0, (-150 + k * 40) * s); ctx.lineTo(16 * s, (-126 + k * 40) * s); ctx.lineTo(-16 * s, (-126 + k * 40) * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2f6a50';
    }
    ctx.fillStyle = '#6a4a3a'; ctx.fillRect(-5 * s, -10 * s, 10 * s, 12 * s);
  }
  function tree(ctx, col, r) {
    ctx.fillStyle = '#7a5a3c'; ctx.fillRect(-6, -50, 12, 50);
    ctx.fillStyle = col;
    const s = 0.8 + r * 0.5;
    circle(ctx, 0, -70 * s, 34 * s); circle(ctx, -26 * s, -52 * s, 26 * s); circle(ctx, 26 * s, -52 * s, 26 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; circle(ctx, -10 * s, -82 * s, 14 * s);
  }
  function cedar(ctx, col, r) {
    const s = 0.9 + r * 0.6;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -170 * s); ctx.lineTo(34 * s, -60 * s); ctx.lineTo(48 * s, 0); ctx.lineTo(-48 * s, 0); ctx.lineTo(-34 * s, -60 * s);
    ctx.closePath(); ctx.fill();
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
            ctx.fillRect(x, y, T + 0.5, th.snow ? 11 : 8);
            ctx.beginPath();
            for (let k = 0; k < 4; k++) ctx.arc(x + 4 + k * 8, y + 8, 4, 0, Math.PI);
            ctx.fill();
            ctx.fillStyle = th.grassHi;
            ctx.fillRect(x, y, T + 0.5, 3);
            if (!th.stone && !th.snow && !th.sand && hash(tx, 99) < 0.25 && !Engine.HAZARD[Engine.tileAt(level, tx, ty - 1)]) {
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
          drawSpike(ctx, th.spike, x + 16, y + 21, time);
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
    } else if (th.block === 'gift') {
      ctx.fillStyle = (tx + ty) % 2 ? '#8ac8ff' : '#ffa8d0'; rrect(ctx, x + 1, y + 1, T - 2, T - 2, 4); ctx.fill();
      ctx.fillStyle = '#fff4a0'; ctx.fillRect(x + 13, y + 1, 6, T - 2); ctx.fillRect(x + 1, y + 13, T - 2, 6);
    } else if (th.block === 'coral') {
      ctx.fillStyle = '#e8d6b0'; rrect(ctx, x + 0.5, y + 1, T - 1, T - 1, 8); ctx.fill();
      ctx.fillStyle = '#d4bc8a'; circle(ctx, x + 9, y + 12, 3); circle(ctx, x + 22, y + 20, 3.5); circle(ctx, x + 14, y + 25, 2);
      ctx.fillStyle = '#ff9a9a'; circle(ctx, x + 24, y + 7, 3);
    } else if (th.block === 'ice') {
      ctx.fillStyle = '#cfeeff'; rrect(ctx, x + 0.5, y + 0.5, T - 1, T - 1, 4); ctx.fill();
      ctx.strokeStyle = '#8ac4ea'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 2.5, y + 2.5, T - 5, T - 5);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x + 6, y + 5, 10, 3);
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

  function drawSpike(ctx, kind, x, y, time) {
    ctx.save(); ctx.translate(x, y);
    if (kind === 'urchin') { // ウニ
      ctx.strokeStyle = '#3a2a5a'; ctx.lineWidth = 2;
      for (let k = 0; k < 16; k++) { const a = Math.PI + (k / 15) * Math.PI; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(Math.cos(a) * 15, 4 + Math.sin(a) * 15); ctx.stroke(); }
      ctx.fillStyle = '#5a3a7a'; ctx.beginPath(); ctx.arc(0, 6, 9, Math.PI, 0); ctx.fill();
    } else if (kind === 'ice') { // つらら(氷のトゲ)
      ctx.fillStyle = '#bfe8ff'; ctx.strokeStyle = '#5a9ad0'; ctx.lineWidth = 1.5;
      for (const [dx, h] of [[-9, 16], [0, 22], [9, 15]]) { ctx.beginPath(); ctx.moveTo(dx - 5, 11); ctx.lineTo(dx, 11 - h); ctx.lineTo(dx + 5, 11); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    } else if (kind === 'konpeito') { // トゲトゲこんぺいとう
      ctx.fillStyle = '#ff8ac0'; ctx.strokeStyle = '#c04a80'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2, r = k % 2 ? 7 : 13; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; circle(ctx, -3, -3, 2.5);
    } else { // いが栗
      ctx.strokeStyle = '#6b7a2a'; ctx.lineWidth = 2;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); ctx.stroke();
      }
      ctx.fillStyle = '#8fa23a'; circle(ctx, 0, 0, 9);
      ctx.fillStyle = '#7a4a26'; circle(ctx, 0, 1, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; circle(ctx, -3, -3, 2);
    }
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

  // ===== 主人公: たけ(少年 / 大人) =====
  // anim: { state: 'idle'|'walk'|'jump'|'fall'|'dead'|'win', t, walk, blink, adult }
  function drawPlayer(ctx, x, y, face, anim) {
    const OUT = '#4a3428';
    const SKIN = '#f8cfa4';
    const adult = !!anim.adult;
    const L = adult ? 7 : 0;  // 大人は足が長い
    const U = adult ? 3 : 0;  // 大人は胴も少し長い
    ctx.save();
    ctx.translate(x, y);
    const sc = adult ? 1.2 : 1.18;
    ctx.scale(face * sc, sc);
    const st = anim.state;
    let bob = 0, legA = 0, armA = 0;
    if (st === 'idle') { bob = Math.sin(anim.t * 3) * 0.8; armA = 0.15; }
    else if (st === 'walk') { legA = Math.sin(anim.walk) * 0.8; armA = -Math.sin(anim.walk) * 0.9; bob = -Math.abs(Math.sin(anim.walk)) * 2; }
    else if (st === 'jump') { legA = 0.6; armA = 2.4; }
    else if (st === 'fall') { legA = -0.3; armA = 1.9; }
    else if (st === 'dead') { armA = 2.8; }
    else if (st === 'win') { armA = 2.9 + Math.sin(anim.t * 12) * 0.15; bob = -Math.abs(Math.sin(anim.t * 6)) * 4; }
    ctx.translate(0, bob);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    const leg = (ang, dx, front) => {
      ctx.save(); ctx.translate(dx, -10 - L); ctx.rotate(ang);
      ctx.strokeStyle = OUT; ctx.lineWidth = 6.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 8 + L); ctx.stroke();
      ctx.strokeStyle = adult ? '#5a6f9a' : SKIN; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 8 + L); ctx.stroke();
      ctx.fillStyle = front ? '#f5f5f0' : '#e2e2da'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
      rrect(ctx, -3, 7 + L, 9, 4, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = adult ? '#3f9a5a' : '#e0503c'; ctx.fillRect(-1, 8 + L, 5, 1.5);
      ctx.restore();
    };
    if (st === 'jump') { leg(-0.9, -3, false); leg(0.5, 3, true); }
    else { leg(-legA, -3, false); leg(legA, 3, true); }

    ctx.translate(0, -L - U);
    const arm = (ang, dx) => {
      ctx.save(); ctx.translate(dx, -22); ctx.rotate(ang);
      ctx.strokeStyle = OUT; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 10 + U); ctx.stroke();
      ctx.strokeStyle = SKIN; ctx.lineWidth = 3.6;
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 10 + U); ctx.stroke();
      ctx.restore();
    };
    arm(st === 'walk' ? -armA : -armA * 0.9 - 0.1, -7);

    // ズボン(大人は長ズボン風の色) / 短パン
    ctx.fillStyle = adult ? '#5a6f9a' : '#3f63b0'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
    rrect(ctx, -8, -14, 16, 7 + U, 2); ctx.fill(); ctx.stroke();
    // Tシャツ(大人はオレンジのシャツ)
    const shirt = adult ? '#ffab4a' : '#fbfbf4';
    ctx.fillStyle = shirt;
    rrect(ctx, -9, -26, 18, 14 + U, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = adult ? '#ffffff' : '#ff5a5a'; ctx.fillRect(-8.3, -18, 16.6, 2.5);
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.ellipse(6, -23, 4, 3.4, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    arm(armA, 6);

    // 頭 (坊主頭)
    const hy = -36;
    ctx.fillStyle = SKIN; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(-9, hy + 2, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // 耳
    const hw = adult ? 11 : 12, hh = adult ? 12 : 11.5; // 大人は少し面長
    ctx.beginPath(); ctx.ellipse(0, hy, hw, hh, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, hy, hw, hh, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = adult ? 'rgba(50,58,85,0.6)' : 'rgba(70,80,110,0.55)';
    ctx.beginPath(); ctx.ellipse(-2, hy - 6, 14, 9, -0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SKIN;
    ctx.beginPath(); ctx.ellipse(6, hy + 3, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; circle(ctx, -3, hy - 8, 2.5);
    ctx.restore();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, hy, hw, hh, 0, 0, Math.PI * 2); ctx.stroke();
    // 顔
    ctx.fillStyle = '#2a1e1a'; ctx.strokeStyle = '#2a1e1a'; ctx.lineWidth = 1.6;
    if (st === 'dead') {
      ctx.beginPath();
      ctx.moveTo(2, hy - 1); ctx.lineTo(5, hy + 1); ctx.lineTo(2, hy + 3);
      ctx.moveTo(10, hy - 1); ctx.lineTo(7, hy + 1); ctx.lineTo(10, hy + 3);
      ctx.stroke();
      ctx.beginPath(); ctx.ellipse(6, hy + 6, 2, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      if (adult) { // 大人はきりっとした眉
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(1.5, hy - 4); ctx.lineTo(5.5, hy - 4.6); ctx.moveTo(7.5, hy - 4.6); ctx.lineTo(11, hy - 4); ctx.stroke();
        ctx.lineWidth = 1.6;
      }
      if (anim.blink || st === 'win') {
        ctx.beginPath(); ctx.arc(3.5, hy + 1, 2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(9, hy + 1, 2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.ellipse(3.5, hy + 0.5, 1.7, adult ? 2 : 2.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(9, hy + 0.5, 1.7, adult ? 2 : 2.4, 0, 0, Math.PI * 2); ctx.fill();
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

  // ===== サイちゃん =====
  // anim: { state: 'wait'|'happy', t }
  function drawSai(ctx, x, y, face, anim) {
    const OUT = '#4a3428', SKIN = '#f3c49a', HAIR = '#1e1a22';
    const st = anim.state, t = anim.t;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face * 1.18, 1.18);
    const bob = st === 'happy' ? -Math.abs(Math.sin(t * 7)) * 6 : Math.sin(t * 2.5) * 0.7;
    ctx.translate(0, bob);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // 長い黒髪(うしろ)
    ctx.fillStyle = HAIR;
    ctx.beginPath(); ctx.moveTo(-11, -40); ctx.quadraticCurveTo(-15, -20, -11, -12 + Math.sin(t * 3) * 1);
    ctx.lineTo(4, -12); ctx.quadraticCurveTo(10, -24, 9, -38); ctx.closePath(); ctx.fill();
    // 足
    for (const dx of [-3, 3]) {
      ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(dx, -10); ctx.lineTo(dx, -1); ctx.stroke();
      ctx.strokeStyle = SKIN; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(dx, -10); ctx.lineTo(dx, -1); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; rrect(ctx, dx - 3, -3, 8, 4, 2); ctx.fill(); ctx.stroke();
    }
    // スカート(デニム)
    ctx.fillStyle = '#6f9ad6'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-8, -17); ctx.lineTo(8, -17); ctx.lineTo(11, -8); ctx.lineTo(-11, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Tシャツ(パステルピンク)
    ctx.fillStyle = '#ffc1d6';
    rrect(ctx, -8, -28, 16, 12, 4); ctx.fill(); ctx.stroke();
    // ななめがけのポシェット
    ctx.strokeStyle = '#c98a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, -27); ctx.lineTo(6, -16); ctx.stroke();
    ctx.fillStyle = '#ffd75a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1; rrect(ctx, 4, -18, 7, 6, 2); ctx.fill(); ctx.stroke();
    // 腕
    const wave = st === 'happy' ? 2.8 + Math.sin(t * 14) * 0.2 : 2.6 + Math.sin(t * 6) * 0.35;
    for (const [dx, a] of [[-7, st === 'happy' ? -2.8 : -0.2], [7, wave]]) {
      ctx.save(); ctx.translate(dx, -25); ctx.rotate(a);
      ctx.strokeStyle = OUT; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 9); ctx.stroke();
      ctx.strokeStyle = SKIN; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 9); ctx.stroke();
      ctx.restore();
    }
    // 頭
    const hy = -38;
    ctx.fillStyle = SKIN; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, hy, 11, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 前髪
    ctx.fillStyle = HAIR;
    ctx.beginPath(); ctx.moveTo(-12, hy + 2); ctx.quadraticCurveTo(-12, hy - 13, 0, hy - 12.5); ctx.quadraticCurveTo(12, hy - 13, 12, hy - 1);
    ctx.quadraticCurveTo(6, hy - 6, 2, hy - 4); ctx.quadraticCurveTo(-3, hy - 7, -6, hy - 3); ctx.quadraticCurveTo(-9, hy - 3, -12, hy + 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-3, hy - 9, 4, 1.5, -0.2, 0, Math.PI * 2); ctx.fill();
    // ヘアピン
    ctx.fillStyle = '#ff7aa8'; circle(ctx, 8, hy - 7, 2.2);
    // 顔
    ctx.fillStyle = '#2a1e1a'; ctx.strokeStyle = '#2a1e1a'; ctx.lineWidth = 1.5;
    if (st === 'happy') {
      ctx.beginPath(); ctx.arc(2.5, hy + 1, 2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(8, hy + 1, 2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.fillStyle = '#d0505a'; ctx.beginPath(); ctx.arc(5.5, hy + 5, 2.4, 0, Math.PI); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(2.5, hy + 1, 1.7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(8, hy + 1, 1.7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; circle(ctx, 3, hy, 0.7); circle(ctx, 8.5, hy, 0.7);
      ctx.strokeStyle = '#a04a4a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(5.5, hy + 5, 1.6, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,120,130,0.5)'; circle(ctx, -1, hy + 4, 2.4); circle(ctx, 10, hy + 4, 2);
    ctx.restore();
  }

  // ===== ゴール: サイちゃんが待っている =====
  function drawGoal(ctx, g, reached, time) {
    const x = g.x, by = g.y;
    // 小さな看板(文字なしの矢印とハート)
    ctx.fillStyle = '#8a6a48'; ctx.fillRect(x + 44, by - 46, 4, 46);
    ctx.fillStyle = '#fff4e0'; ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 2;
    rrect(ctx, x + 30, by - 64, 32, 22, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff6a8a'; drawHeart(ctx, x + 46, by - 53, 6);
    if (!reached) {
      drawSai(ctx, x + 22, by, -1, { state: 'wait', t: time });
      // ふきだし
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      rrect(ctx, x + 2, by - 92 + Math.sin(time * 3) * 2, 40, 22, 8); ctx.fill();
      ctx.fillStyle = '#ff6a8a'; drawHeart(ctx, x + 22, by - 81 + Math.sin(time * 3) * 2, 5);
    }
  }

  function drawHeart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.8, y - s * 1.5, x, y - s * 0.5);
    ctx.bezierCurveTo(x + s * 0.8, y - s * 1.5, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
    ctx.fill();
  }

  // 無敵中のキラキラ
  function drawStarAura(ctx, x, y, t, remain) {
    const blink = remain < 2 ? (Math.floor(t * 10) % 2 === 0 ? 0.3 : 1) : 1;
    ctx.save();
    ctx.globalAlpha = 0.35 * blink;
    const hue = (t * 300) % 360;
    ctx.fillStyle = `hsl(${hue},100%,70%)`;
    ctx.beginPath(); ctx.ellipse(x, y - 22, 22, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = blink;
    for (let k = 0; k < 5; k++) {
      const a = t * 4 + (k / 5) * Math.PI * 2;
      ctx.fillStyle = `hsl(${(hue + k * 60) % 360},100%,75%)`;
      drawStarShape(ctx, x + Math.cos(a) * 22, y - 22 + Math.sin(a) * 28, 4);
    }
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

  // ===== エンディングの一枚絵: ふたりで花火を見る =====
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
    fuji(ctx, vw * 0.7, vh * 0.8, 1.2, true);
    ctx.fillStyle = '#1b1d42';
    ctx.beginPath(); ctx.moveTo(0, vh);
    for (let x = 0; x <= vw + 20; x += 20) ctx.lineTo(x, vh * 0.78 + Math.sin(x * 0.01) * 8);
    ctx.lineTo(vw, vh); ctx.fill();
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = hash(i, 9) < 0.7 ? '#ffd27a' : '#8a8ad0';
      ctx.fillRect(hash(i, 4) * vw, vh * 0.81 + hash(i, 5) * vh * 0.05, 3, 3);
    }
    ctx.fillStyle = '#2e4a3a';
    ctx.beginPath(); ctx.moveTo(0, vh); ctx.lineTo(0, vh * 0.86);
    ctx.quadraticCurveTo(vw * 0.35, vh * 0.76, vw * 0.7, vh * 0.88); ctx.lineTo(vw, vh * 0.9); ctx.lineTo(vw, vh); ctx.fill();
    const sx = vw * 0.34, sy = vh * 0.82;
    // たけ(うしろ姿)
    ctx.save(); ctx.translate(sx, sy);
    ctx.fillStyle = '#3f63b0'; rrect(ctx, -12, -6, 24, 10, 4); ctx.fill();
    ctx.fillStyle = '#e8e8e0'; rrect(ctx, -12, -28, 24, 24, 6); ctx.fill();
    ctx.fillStyle = '#f0a090'; ctx.fillRect(-12, -16, 24, 3);
    ctx.fillStyle = '#e8b890'; ctx.beginPath(); ctx.ellipse(0, -40, 13, 12.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(70,80,110,0.55)'; ctx.beginPath(); ctx.ellipse(0, -43, 13, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b890'; circle(ctx, -13, -39, 3); circle(ctx, 13, -39, 3);
    ctx.restore();
    // サイちゃん(うしろ姿・長い黒髪)
    ctx.save(); ctx.translate(sx + 36, sy + 1);
    ctx.fillStyle = '#6f9ad6'; rrect(ctx, -12, -6, 24, 10, 4); ctx.fill();
    ctx.fillStyle = '#ffc1d6'; rrect(ctx, -11, -26, 22, 22, 6); ctx.fill();
    ctx.fillStyle = '#1e1a22';
    ctx.beginPath(); ctx.ellipse(0, -38, 12, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-12, -38); ctx.quadraticCurveTo(-13, -16, -9, -8); ctx.lineTo(9, -8); ctx.quadraticCurveTo(13, -16, 12, -38); ctx.fill();
    ctx.fillStyle = '#ff7aa8'; circle(ctx, 8, -46, 2.5);
    ctx.restore();
    // ハート
    ctx.fillStyle = 'rgba(255,120,160,' + (0.6 + 0.4 * Math.sin(time * 3)) + ')';
    drawHeart(ctx, sx + 18, sy - 70 - Math.sin(time * 2) * 4, 7);
  }

  root.Render = {
    THEMES, drawBackground, drawLevel, drawMover, drawMoverPath, drawYoyo, drawEnemy, drawMelon,
    drawCheckpoint, drawGoal, drawPlayer, makeFireworks, updateFireworks, drawFireworks, drawEndingScene, circle, drawSai, drawHeart, drawStarAura, drawStarShape,
  };
})(window);
