/* 仮の絵（図形）。素材が届くまでの代わり。役割ごとにシルエットを変えて、大量にいても見分けやすくする。
 * drawUnit(ctx, key, side, opts)：足元 (0, 0) を基準に、右向きで描く（呼び出し側で反転）。
 * opts: { size, flash, t（秒・アニメ用）, pose: 'walk'|'windup'|'strike'|'kb'|'dead' } */
import { SKIN } from '../data/skin.js';

const EYE = '#fff';

function col(key, i, flash) {
  if (flash) return i === 0 ? '#ffffff' : '#e9e0ff';
  const c = SKIN.colors[key] || ['#999', '#333'];
  return c[i];
}

function eyes(ctx, x, y, r, gap, flash, angry) {
  ctx.fillStyle = flash ? '#c9b8ff' : EYE;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.arc(x + gap, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#16051f';
  ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.1, r * 0.55, 0, Math.PI * 2); ctx.arc(x + gap + r * 0.35, y + r * 0.1, r * 0.55, 0, Math.PI * 2); ctx.fill();
  if (angry) {
    ctx.strokeStyle = '#16051f'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x - r, y - r * 1.4); ctx.lineTo(x + r, y - r * 0.8); ctx.moveTo(x + gap + r, y - r * 1.4); ctx.lineTo(x + gap - r, y - r * 0.8); ctx.stroke();
  }
}

function blob(ctx, w, h, fill, edge) {
  ctx.fillStyle = fill; ctx.strokeStyle = edge; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.bezierCurveTo(-w / 2, -h * 0.9, -w * 0.2, -h, 0, -h);
  ctx.bezierCurveTo(w * 0.25, -h, w / 2, -h * 0.85, w / 2, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

const DRAW = {
  // 量産型：角の小さなぷるぷるの塊
  mass(ctx, o) {
    const sq = o.pose === 'walk' ? Math.sin(o.t * 10) * 0.08 : o.pose === 'windup' ? 0.15 : 0;
    ctx.save(); ctx.scale(1 + sq, 1 - sq);
    blob(ctx, 34, 28, col('mass', 0, o.flash), col('mass', 1, o.flash));
    ctx.fillStyle = col('mass', 1, o.flash);
    ctx.beginPath(); ctx.moveTo(-9, -25); ctx.lineTo(-6, -34); ctx.lineTo(-3, -26); ctx.moveTo(5, -26); ctx.lineTo(9, -34); ctx.lineTo(11, -24); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-8, -18, 4, 6, -0.4, 0, Math.PI * 2); ctx.fill();
    eyes(ctx, -1, -15, 3.6, 9, o.flash);
    ctx.restore();
  },
  // 前衛：兜と大きな剣のよろい
  vanguard(ctx, o) {
    const sw = o.pose === 'windup' ? -1.6 : o.pose === 'strike' ? 0.9 : -0.3 + Math.sin(o.t * 8) * 0.1;
    ctx.fillStyle = col('vanguard', 0, o.flash); ctx.strokeStyle = col('vanguard', 1, o.flash); ctx.lineWidth = 2.5;
    rrect(ctx, -14, -38, 28, 30, 6); ctx.fill(); ctx.stroke();
    ctx.fillRect(-11, -9, 8, 9); ctx.fillRect(3, -9, 8, 9); ctx.strokeRect(-11, -9, 8, 9); ctx.strokeRect(3, -9, 8, 9);
    rrect(ctx, -12, -56, 24, 20, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff4fd8'; ctx.fillRect(-2, -49, 12, 3); // 兜のすき間から光る目
    ctx.fillStyle = col('vanguard', 1, o.flash); ctx.beginPath(); ctx.moveTo(-4, -56); ctx.lineTo(0, -64); ctx.lineTo(4, -56); ctx.fill();
    ctx.save(); ctx.translate(12, -28); ctx.rotate(sw);
    ctx.fillStyle = o.flash ? '#fff' : '#d9dff0'; ctx.strokeStyle = '#2b2e44'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-3, -34); ctx.lineTo(0, -40); ctx.lineTo(3, -34); ctx.lineTo(3, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a5a2a'; ctx.fillRect(-7, -2, 14, 4); ctx.restore();
  },
  // タンク：大きな岩の体
  tank(ctx, o) {
    const b = o.pose === 'walk' ? Math.abs(Math.sin(o.t * 4)) * 2 : 0;
    ctx.translate(0, -b);
    ctx.fillStyle = col('tank', 0, o.flash); ctx.strokeStyle = col('tank', 1, o.flash); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-30, -26); ctx.lineTo(-18, -46); ctx.lineTo(8, -50); ctx.lineTo(28, -36); ctx.lineTo(30, -6); ctx.lineTo(24, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-16, -40); ctx.lineTo(-10, -30); ctx.lineTo(-16, -22); ctx.moveTo(18, -14); ctx.lineTo(10, -8); ctx.stroke();
    ctx.fillStyle = '#7ee0a6'; ctx.beginPath(); ctx.arc(-6, -46, 3, 0, Math.PI * 2); ctx.arc(-1, -48, 2.5, 0, Math.PI * 2); ctx.fill(); // 苔
    eyes(ctx, 6, -30, 3.4, 10, o.flash);
    if (o.pose === 'strike') { ctx.fillStyle = col('tank', 0, o.flash); ctx.fillRect(26, -20, 10, 10); }
  },
  // 遠距離：小柄で大きな弓
  ranged(ctx, o) {
    const pull = o.pose === 'windup' ? 6 : 0;
    blob(ctx, 24, 30, col('ranged', 0, o.flash), col('ranged', 1, o.flash));
    ctx.fillStyle = col('ranged', 1, o.flash);
    ctx.beginPath(); ctx.moveTo(-6, -28); ctx.lineTo(-2, -38); ctx.lineTo(1, -29); ctx.fill();
    eyes(ctx, -1, -18, 3, 7, o.flash, true);
    ctx.strokeStyle = o.flash ? '#fff' : '#f5d08a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(10, -16, 16, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(10 + 16 * Math.cos(-1.2), -16 + 16 * Math.sin(-1.2)); ctx.lineTo(10 - pull, -16); ctx.lineTo(10 + 16 * Math.cos(1.2), -16 + 16 * Math.sin(1.2)); ctx.stroke();
  },
  // 高速型：はばたく小さな影（浮いている）
  fast(ctx, o) {
    const f = Math.sin(o.t * 22);
    ctx.translate(0, -22 + Math.sin(o.t * 6) * 3);
    ctx.fillStyle = col('fast', 1, o.flash);
    ctx.beginPath(); ctx.moveTo(-4, -10); ctx.quadraticCurveTo(-22, -26 - f * 10, -28, -6 + f * 6); ctx.lineTo(-14, -10); ctx.lineTo(-8, -2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4, -10); ctx.quadraticCurveTo(22, -26 - f * 10, 28, -6 + f * 6); ctx.lineTo(14, -10); ctx.lineTo(8, -2); ctx.fill();
    ctx.fillStyle = col('fast', 0, o.flash); ctx.strokeStyle = col('fast', 1, o.flash); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -10, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    eyes(ctx, -3, -11, 3, 7, o.flash);
  },
  // 範囲攻撃：とんがり帽子とローブ
  area(ctx, o) {
    ctx.fillStyle = col('area', 1, o.flash);
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(0, -34); ctx.lineTo(14, 0); ctx.fill();
    ctx.fillStyle = '#ffe0c2'; ctx.beginPath(); ctx.arc(0, -36, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col('area', 0, o.flash); ctx.beginPath(); ctx.moveTo(-14, -40); ctx.lineTo(6, -68); ctx.lineTo(14, -40); ctx.fill();
    eyes(ctx, -2, -36, 2.4, 6, o.flash);
    const g = o.pose === 'windup' ? 1 : 0.4;
    ctx.fillStyle = `rgba(255,140,40,${g})`; ctx.beginPath(); ctx.arc(16, -26, 5 + g * 3, 0, Math.PI * 2); ctx.fill();
  },
  // 回復支援：ふわふわ浮く傘と足
  healer(ctx, o) {
    ctx.translate(0, -12 + Math.sin(o.t * 4) * 3);
    ctx.strokeStyle = col('healer', 0, o.flash); ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 5, -12); ctx.quadraticCurveTo(i * 5 + Math.sin(o.t * 6 + i) * 4, 0, i * 5, 10); ctx.stroke(); }
    ctx.fillStyle = col('healer', 0, o.flash); ctx.beginPath(); ctx.arc(0, -14, 15, Math.PI, 0); ctx.closePath(); ctx.fill();
    eyes(ctx, -3, -20, 2.8, 7, o.flash);
  },
  // 特殊魔法型：しっぽと小さな三叉の杖
  special(ctx, o) {
    blob(ctx, 26, 30, col('special', 0, o.flash), col('special', 1, o.flash));
    ctx.strokeStyle = col('special', 1, o.flash); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-12, -6); ctx.quadraticCurveTo(-24, -10, -22, -22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(14, -38); ctx.moveTo(9, -38); ctx.lineTo(19, -38); ctx.moveTo(9, -38); ctx.lineTo(9, -44); ctx.moveTo(19, -38); ctx.lineTo(19, -44); ctx.moveTo(14, -38); ctx.lineTo(14, -46); ctx.stroke();
    eyes(ctx, -3, -18, 3, 7, o.flash, true);
  },
  // 幹部・突進：大きな角の重戦士と大斧（仮）
  charger(ctx, o) {
    const sw = o.pose === 'windup' ? -1.4 : o.pose === 'strike' ? 0.9 : -0.4;
    ctx.fillStyle = col('charger', 0, o.flash); ctx.strokeStyle = col('charger', 1, o.flash); ctx.lineWidth = 3;
    rrect(ctx, -20, -48, 40, 42, 12); ctx.fill(); ctx.stroke();
    ctx.fillRect(-16, -10, 12, 10); ctx.fillRect(4, -10, 12, 10);
    ctx.beginPath(); ctx.arc(2, -58, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = o.flash ? '#fff' : '#f0e2c0';
    ctx.beginPath(); ctx.moveTo(-8, -66); ctx.quadraticCurveTo(-22, -76, -18, -88); ctx.quadraticCurveTo(-12, -76, -2, -70); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, -66); ctx.quadraticCurveTo(24, -76, 20, -88); ctx.quadraticCurveTo(14, -76, 6, -70); ctx.fill();
    eyes(ctx, 0, -58, 3, 9, o.flash, true);
    ctx.save(); ctx.translate(18, -34); ctx.rotate(sw);
    ctx.strokeStyle = '#6a4220'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -40); ctx.stroke();
    ctx.fillStyle = o.flash ? '#fff' : '#c9d2dc'; ctx.strokeStyle = '#3a3a4a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.quadraticCurveTo(22, -46, 20, -22); ctx.lineTo(0, -28); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  },
  // ---- 人間軍 ----
  militia(ctx, o) { human(ctx, o, 'militia', 'fork'); },
  swordsman(ctx, o) { human(ctx, o, 'swordsman', 'sword'); },
  archer(ctx, o) { human(ctx, o, 'archer', 'bow'); },
  shield(ctx, o) { human(ctx, o, 'shield', 'shield'); },
  priest(ctx, o) { human(ctx, o, 'priest', 'staff'); },
  rider(ctx, o) { human(ctx, o, 'rider', 'sword'); },
  take(ctx, o) { human(ctx, o, 'take', 'sword'); },
  sai(ctx, o) { human(ctx, o, 'sai', 'staff'); },
};

// 人間：丸い頭と体、手に持つ物で見分ける（右向きで描く）
function human(ctx, o, key, item) {
  const step = o.pose === 'walk' ? Math.sin(o.t * 10) * 3 : 0;
  ctx.fillStyle = '#3a2a1c';
  ctx.fillRect(-7 + step, -8, 5, 8); ctx.fillRect(2 - step, -8, 5, 8);
  ctx.fillStyle = col(key, 0, o.flash); ctx.strokeStyle = col(key, 1, o.flash); ctx.lineWidth = 2.5;
  rrect(ctx, -11, -30, 22, 24, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = o.flash ? '#fff' : '#ffd9b3'; ctx.beginPath(); ctx.arc(0, -38, 10, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 2; ctx.stroke();
  if (key === 'swordsman' || key === 'shield' || key === 'take') { ctx.fillStyle = col(key, 0, o.flash); ctx.beginPath(); ctx.arc(0, -40, 10.5, Math.PI, 0); ctx.fill(); }
  if (key === 'militia') { ctx.fillStyle = '#c99a4a'; ctx.beginPath(); ctx.ellipse(0, -47, 13, 4, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(4, -38, 1.8, 0, Math.PI * 2); ctx.arc(-3, -38, 1.8, 0, Math.PI * 2); ctx.fill();
  const sw = o.pose === 'windup' ? -1.3 : o.pose === 'strike' ? 0.8 : -0.2;
  ctx.save(); ctx.translate(10, -20); ctx.rotate(sw);
  ctx.strokeStyle = o.flash ? '#fff' : '#cfd6e4'; ctx.lineWidth = 3;
  if (item === 'fork') {
    ctx.strokeStyle = '#8a5a2a'; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -26); ctx.stroke();
    ctx.strokeStyle = '#cfd6e4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, -26); ctx.lineTo(4, -26); ctx.moveTo(-4, -26); ctx.lineTo(-4, -32); ctx.moveTo(0, -26); ctx.lineTo(0, -33); ctx.moveTo(4, -26); ctx.lineTo(4, -32); ctx.stroke();
  } else if (item === 'sword') {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -24); ctx.stroke(); ctx.fillStyle = '#e0b040'; ctx.fillRect(-5, -1, 10, 3);
  } else if (item === 'staff') {
    ctx.strokeStyle = '#a07040'; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -24); ctx.stroke(); ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(0, -26, 4, 0, Math.PI * 2); ctx.fill();
  } else if (item === 'bow') {
    ctx.strokeStyle = '#8a5a2a'; ctx.beginPath(); ctx.arc(0, -8, 12, -1.3, 1.3); ctx.stroke();
  }
  ctx.restore();
  if (item === 'sword' || item === 'shield') {
    ctx.fillStyle = o.flash ? '#fff' : (item === 'shield' ? '#9aa6b8' : '#a87a3a'); ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(-10, -20, item === 'shield' ? 9 : 6, item === 'shield' ? 13 : 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

export function drawUnit(ctx, key, opts) {
  const f = DRAW[key];
  ctx.save();
  if (f) f(ctx, opts);
  else { ctx.fillStyle = '#888'; ctx.fillRect(-12, -30, 24, 30); }
  ctx.restore();
}

/* 絵（スプライト）があればそれで描く。無ければ null を返す。
 * 大きな原画（例：1330×1182 を 0.045 倍で表示）は、読み込み時に表示に必要な大きさ（画面の高精細分を見込んで3倍）まで
 * 段階的に縮小したコピーを作って使う。原画の絵柄・色は変えない（スマホで毎フレーム巨大画像を縮小する負荷とギザギザを防ぐ） */
const images = {};
const SPRITE_HEADROOM = 3;
function downscale(img, s) {
  const k = (s.scale || 0.5) * SPRITE_HEADROOM;
  if (k >= 0.75 || typeof document === 'undefined') return { img, k: 1 };
  let src = img; let w = img.width; let h = img.height;
  const tw = Math.max(1, Math.round(img.width * k)); const th = Math.max(1, Math.round(img.height * k));
  while (w / 2 > tw) { // 半分ずつ縮める（1回で大きく縮めると細部がつぶれる）
    const c = document.createElement('canvas'); c.width = Math.round(w / 2); c.height = Math.round(h / 2);
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, c.width, c.height); src = c; w = c.width; h = c.height;
  }
  const c = document.createElement('canvas'); c.width = tw; c.height = th;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(src, 0, 0, tw, th);
  return { img: c, k: tw / img.width };
}
export function spriteFor(key) {
  const s = SKIN.sprites[key];
  if (!s) return null;
  if (!images[key] || images[key].src !== s.src) {
    const img = new Image();
    const rec = images[key] = { img, ok: false, src: s.src, waiters: [] };
    img.onload = () => {
      try { const d = downscale(img, s); rec.view = { ...s, img: d.img, frameW: s.frameW * d.k, frameH: s.frameH * d.k, footY: s.footY * d.k, scale: (s.scale || 0.5) / d.k }; }
      catch { rec.view = { ...s, img }; }
      rec.ok = true; const w = rec.waiters; rec.waiters = []; w.forEach((f) => f());
    };
    img.src = s.src;
  }
  return images[key].ok ? images[key].view : null;
}
/* 絵の読み込みが終わったら fn を呼ぶ（召喚カードなど、一度だけ描く場所の描き直し用）。登録の無い枠では呼ばない */
export function whenSpriteReady(key, fn) {
  if (!SKIN.sprites[key]) return;
  if (spriteFor(key)) { fn(); return; }
  images[key].waiters.push(fn);
}

/* 会話の顔（仮）。w×h の枠の中に、胸から上を描く。face：'normal' | 'angry' | 'happy' | 'sad' */
export function drawPortrait(ctx, who, face, w, h) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.translate(w / 2, h);
  const k = h / 120;
  ctx.scale(k, k);
  const P = PORTRAIT[who] || PORTRAIT.villager;
  P(ctx, face || 'normal', who);
  ctx.restore();
}

function faceEyes(ctx, x, y, gap, face, color = '#1a0f20') {
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, 5, 6, 0, 0, Math.PI * 2); ctx.ellipse(x + gap, y, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x + 1, y + 1, 3, 0, Math.PI * 2); ctx.arc(x + gap + 1, y + 1, 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a2a2a'; ctx.lineWidth = 2.5; ctx.beginPath();
  if (face === 'angry') { ctx.moveTo(x - 7, y - 11); ctx.lineTo(x + 5, y - 6); ctx.moveTo(x + gap + 7, y - 11); ctx.lineTo(x + gap - 5, y - 6); }
  else if (face === 'sad') { ctx.moveTo(x - 6, y - 7); ctx.lineTo(x + 5, y - 11); ctx.moveTo(x + gap + 6, y - 7); ctx.lineTo(x + gap - 5, y - 11); }
  else { ctx.moveTo(x - 6, y - 10); ctx.lineTo(x + 5, y - 10); ctx.moveTo(x + gap + 6, y - 10); ctx.lineTo(x + gap - 5, y - 10); }
  ctx.stroke();
}

const PORTRAIT = {
  // 大魔王（仮）：紫の衣と金の冠、白いひげのおじいちゃん
  lord(ctx, face) {
    ctx.fillStyle = '#4a1f7a'; ctx.beginPath(); ctx.moveTo(-58, 0); ctx.quadraticCurveTo(-50, -52, 0, -56); ctx.quadraticCurveTo(50, -52, 58, 0); ctx.fill();
    ctx.fillStyle = '#d4a93a'; ctx.fillRect(-4, -54, 8, 54);
    ctx.fillStyle = '#ffd9b8'; ctx.beginPath(); ctx.ellipse(0, -78, 26, 28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4f0ec'; ctx.beginPath(); ctx.moveTo(-26, -76); ctx.quadraticCurveTo(-30, -30, 0, -22); ctx.quadraticCurveTo(30, -30, 26, -76); ctx.quadraticCurveTo(0, -60, -26, -76); ctx.fill();
    faceEyes(ctx, -11, -84, 22, face);
    ctx.fillStyle = '#3a1a10'; ctx.beginPath();
    if (face === 'angry') { ctx.ellipse(0, -60, 7, 5, 0, 0, Math.PI * 2); } else if (face === 'happy') { ctx.arc(0, -64, 6, 0, Math.PI); } else { ctx.ellipse(0, -62, 5, 2, 0, 0, Math.PI * 2); }
    ctx.fill();
    ctx.fillStyle = '#e0b84a'; ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-26, -100); ctx.lineTo(-22, -118); ctx.lineTo(-11, -106); ctx.lineTo(0, -122); ctx.lineTo(11, -106); ctx.lineTo(22, -118); ctx.lineTo(26, -100); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b26bff'; ctx.beginPath(); ctx.arc(0, -108, 4, 0, Math.PI * 2); ctx.fill();
  },
  // 側近（仮）：濃紺のフードと銀の仮面
  aide(ctx) {
    ctx.fillStyle = '#26304a'; ctx.beginPath(); ctx.moveTo(-54, 0); ctx.quadraticCurveTo(-48, -60, 0, -62); ctx.quadraticCurveTo(48, -60, 54, 0); ctx.fill();
    ctx.fillStyle = '#334068'; ctx.beginPath(); ctx.moveTo(-34, -50); ctx.quadraticCurveTo(-36, -118, 0, -120); ctx.quadraticCurveTo(36, -118, 34, -50); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9cfdc'; ctx.beginPath(); ctx.ellipse(0, -80, 18, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a3048'; ctx.fillRect(-12, -86, 9, 4); ctx.fillRect(3, -86, 9, 4);
    ctx.fillStyle = '#8fd0ff'; ctx.fillRect(-10, -85, 5, 2); ctx.fillRect(5, -85, 5, 2);
    ctx.fillStyle = '#9aa6c8'; ctx.fillRect(-1, -76, 2, 10);
  },
  take(ctx, face) { hero(ctx, face, '#3e6fc4', '#2a1a10', true); },
  sai(ctx, face) { hero(ctx, face, '#f5f0ff', '#e8c070', false); },
  villager(ctx, face, who) {
    const c = { tiw: '#6fbf73', mot: '#c98a3a', waan: '#e0708a', koi: '#7a8aa0' }[who] || '#a0a0a0';
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-44, 0); ctx.quadraticCurveTo(-40, -50, 0, -52); ctx.quadraticCurveTo(40, -50, 44, 0); ctx.fill();
    ctx.fillStyle = '#ffd9b8'; ctx.beginPath(); ctx.arc(0, -76, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a2a14'; ctx.beginPath(); ctx.arc(0, -84, 25, Math.PI, 0); ctx.fill();
    faceEyes(ctx, -10, -76, 20, face);
  },
};

function hero(ctx, face, cloth, hair, spiky) {
  ctx.fillStyle = cloth; ctx.beginPath(); ctx.moveTo(-46, 0); ctx.quadraticCurveTo(-42, -50, 0, -52); ctx.quadraticCurveTo(42, -50, 46, 0); ctx.fill();
  ctx.fillStyle = '#ffd9b8'; ctx.beginPath(); ctx.arc(0, -78, 25, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hair;
  if (spiky) { ctx.beginPath(); ctx.moveTo(-28, -80); for (let i = 0; i < 7; i++) ctx.lineTo(-28 + i * 9 + 4, -112 + (i % 2) * 10); ctx.lineTo(28, -80); ctx.quadraticCurveTo(0, -96, -28, -80); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(0, -86, 27, Math.PI, 0); ctx.fill(); ctx.fillRect(-27, -86, 10, 40); ctx.fillRect(17, -86, 10, 40); }
  faceEyes(ctx, -10, -78, 20, face, '#2a3a6a');
}
