/* 背景と建物の16bit風ドット絵（コードで描くオリジナルの仮素材）
 *
 * 背景は奥行きのある5層：空（固定）→ 遠景の山と城 → 丘と森 → 村（家・風車・柵・麦畑）→ 地面（道・草花・石）。
 * どれも半分の解像度（1ドット = 2論理ドット）で一度だけ描いてキャッシュし、視差をつけて最近傍で拡大する。
 * 左（人間側）は明るい村、右（祠のまわり）は魔力で紫に染まる。
 */
import { makeRng } from '../core/rng.js';

export const BG_PIX = 2;
export const VIEW_W = 960;
export const GROUND_Y = 388;
export const PARALLAX = { far: 0.12, hills: 0.3, village: 0.6 };

const TIME = {
  day: { sky: ['#3f8fe0', '#5aa8ec', '#7abcf0', '#9ccef4', '#c0e2f8'], mtn: '#5a72a8', mtn2: '#6f86b8', snow: '#eef4ff', hill: '#4f9a46', hill2: '#66b24e', tree: '#2f7a3a', tree2: '#46a04a', light: 1, cloud: '#ffffff', cloud2: '#dfeefa' },
  sunset: { sky: ['#4a4aa0', '#8a5aa8', '#e0787a', '#f4a070', '#ffd08a'], mtn: '#6a5a8a', mtn2: '#8a6a98', snow: '#ffd8c8', hill: '#5a7a3e', hill2: '#7a8a46', tree: '#3a5a32', tree2: '#5a7a3a', light: 0.8, cloud: '#ffd0b8', cloud2: '#f0a8a0' },
  night: { sky: ['#0e1236', '#161e4a', '#1e2c5e', '#2a3c72', '#3a5086'], mtn: '#2a3460', mtn2: '#36426e', snow: '#b8c4e8', hill: '#24483e', hill2: '#2e5a48', tree: '#18362e', tree2: '#22483a', light: 0.45, cloud: '#5a6898', cloud2: '#46527e' },
};
export const THEME_TIME = { watch: 'day', wheat: 'day', river: 'day', gate: 'sunset', plaza: 'night' };

function canvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
  const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c;
}
function T(ctx) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const E = (cx, cy, rx, ry, c) => { ctx.fillStyle = c; for (let y = -ry; y <= ry; y++) { const t = 1 - (y * y) / ((ry + 0.5) ** 2); if (t < 0) continue; const hw = Math.round(rx * Math.sqrt(t)); ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1); } };
  const P = (pts, c) => {
    ctx.fillStyle = c;
    const ys = pts.map((p) => p[1]); const y0 = Math.floor(Math.min(...ys)); const y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i]; const [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + (y + 0.5 - ay) * (bx - ax) / (by - ay)); }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) ctx.fillRect(Math.round(xs[i]), y, Math.max(1, Math.round(xs[i + 1]) - Math.round(xs[i])), 1);
    }
  };
  const L = (x0, y0, x1, y1, c, w = 1) => { ctx.fillStyle = c; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), w, w); };
  return { R, E, P, L };
}

// ---------------------------------------------------------------- 家・木・小物（村の層・地面の層で使う）
function tree(t, x, base, s, pal, rng) {
  const { R, E } = t;
  R(x - 1, base - 6 * s, 3, 6 * s, '#5a3a22');
  E(x, base - 8 * s, 5 * s, 4 * s, pal.tree); E(x - 2 * s, base - 10 * s, 4 * s, 3 * s, pal.tree2); E(x + 2 * s, base - 11 * s, 3 * s, 3 * s, pal.tree2);
  if (rng() < 0.4) R(x + s, base - 12 * s, 1, 1, '#ffffff');
}
function house(t, x, base, kind, pal, night) {
  const { R, P } = t;
  const w = 26; const h = 16;
  const wall = night ? '#a89a88' : '#f2e6cc'; const beam = '#6a4224';
  R(x, base - h, w, h, wall);
  R(x, base - h, w, 1, beam); R(x, base - 1, w, 1, beam); R(x, base - h, 1, h, beam); R(x + w - 1, base - h, 1, h, beam); R(x + 12, base - h, 1, h, beam);
  for (let i = 0; i < 3; i++) R(x + 2 + i * 4, base - h + 2 + i * 4, 1, 1, beam);
  const roof = kind === 'thatch' ? '#d8a84a' : kind === 'red' ? '#c0503a' : '#4a6ac8';
  const roof2 = kind === 'thatch' ? '#b8883a' : kind === 'red' ? '#9a3a2a' : '#3a50a0';
  P([[x - 3, base - h], [x + w / 2, base - h - 13], [x + w + 3, base - h]], roof);
  for (let i = 0; i < 4; i++) R(x - 2 + i * 2, base - h - 2 - i * 3, w + 4 - i * 4, 1, roof2);
  R(x + 18, base - h - 12, 4, 6, '#8a8078'); // 煙突
  const win = night ? '#ffd76a' : '#5a8ac8';
  R(x + 3, base - h + 4, 5, 4, win); R(x + 15, base - h + 4, 5, 4, win); R(x + 5, base - h + 4, 1, 4, beam); R(x + 17, base - h + 4, 1, 4, beam);
  R(x + 8, base - 8, 4, 7, '#7a4a24');
  R(x + 2, base - h + 9, 7, 2, '#c04a6a'); R(x + 3, base - h + 8, 1, 1, '#ffe36b'); R(x + 6, base - h + 8, 1, 1, '#ffe36b'); // 花の窓箱
}
function fence(t, x0, x1, base) {
  const { R } = t;
  R(x0, base - 6, x1 - x0, 1, '#8a5a2a'); R(x0, base - 3, x1 - x0, 1, '#8a5a2a');
  for (let x = x0; x < x1; x += 6) { R(x, base - 8, 2, 8, '#7a4a20'); R(x, base - 8, 2, 1, '#a87040'); }
}
function windmillBody(t, x, base) {
  const { R, P } = t;
  P([[x - 8, base], [x - 5, base - 34], [x + 5, base - 34], [x + 8, base]], '#ece0c8');
  R(x - 2, base - 8, 4, 8, '#6a4224'); R(x - 1, base - 24, 3, 3, '#5a8ac8');
  P([[x - 7, base - 33], [x, base - 42], [x + 7, base - 33]], '#c0503a');
}

// ---------------------------------------------------------------- 層の生成
const cache = new Map();

export function backdrop(stage) {
  const key = stage.id + ':' + stage.length;
  if (cache.has(key)) return cache.get(key);
  const time = THEME_TIME[stage.theme] || 'day';
  const pal = TIME[time];
  const L = stage.length;
  const rng = makeRng(stage.id.charCodeAt(2) * 97 + 13);
  const W = (par) => Math.ceil((VIEW_W + (L - VIEW_W) * par) / BG_PIX) + 4;
  const H = Math.ceil(GROUND_Y / BG_PIX) + 10;
  const night = time === 'night';
  const gy = Math.round(GROUND_Y / BG_PIX); // 地面の線（半解像度）

  // 空（画面に固定）
  const sky = canvas(VIEW_W / BG_PIX, H); {
    const t = T(sky.getContext('2d'));
    const n = pal.sky.length;
    for (let i = 0; i < n; i++) t.R(0, Math.round(i * H / n), VIEW_W, Math.ceil(H / n) + 1, pal.sky[i]);
    // ディザ（帯の境目を2段のしま模様に）
    for (let i = 1; i < n; i++) { const y = Math.round(i * H / n); for (let x = 0; x < VIEW_W / BG_PIX; x += 2) { t.R(x, y - 1, 1, 1, pal.sky[i]); t.R(x + 1, y, 1, 1, pal.sky[i - 1]); } }
    if (night) {
      for (let i = 0; i < 70; i++) t.R(Math.floor(rng() * 480), Math.floor(rng() * 120), 1, 1, rng() < 0.3 ? '#fff6c8' : '#ffffff');
      t.E(380, 50, 12, 12, '#f4f0ff'); t.E(384, 47, 3, 2, '#d8d4f0'); t.E(376, 54, 2, 2, '#d8d4f0');
    } else if (time === 'sunset') {
      t.E(110, 118, 22, 22, '#ffe0a0'); t.E(110, 118, 17, 17, '#fff0c8');
    } else {
      t.E(90, 48, 15, 15, '#fff6c8'); t.E(90, 48, 11, 11, '#ffffff');
      for (let i = 0; i < 5; i++) t.R(70 + i * 30, 20 + (i % 2) * 6, 1, 1, '#ffffff');
    }
  }

  // 遠景：雪の山と、丘の上の城・雲
  const far = canvas(W(PARALLAX.far), H); {
    const t = T(far.getContext('2d'));
    const w = far.width;
    for (let i = 0; i < 9; i++) { const cx = rng() * w; const cy = 20 + rng() * 40; const s = 0.6 + rng() * 0.8; t.E(cx, cy, 16 * s, 5 * s, pal.cloud2); t.E(cx + 6 * s, cy - 3 * s, 10 * s, 5 * s, pal.cloud); t.E(cx - 8 * s, cy - 1, 8 * s, 4 * s, pal.cloud); }
    let x = -20;
    while (x < w + 40) {
      const hw = 34 + rng() * 40; const hh = 28 + rng() * 36; const peak = gy - 62 - hh;
      t.P([[x - hw, gy - 40], [x, peak], [x + hw, gy - 40]], pal.mtn);
      t.P([[x, peak], [x + hw, gy - 40], [x + hw * 0.4, gy - 40]], pal.mtn2);
      t.P([[x - hw * 0.28, peak + hh * 0.28], [x, peak], [x + hw * 0.28, peak + hh * 0.28], [x + hw * 0.1, peak + hh * 0.22], [x - hw * 0.05, peak + hh * 0.3]], pal.snow);
      x += hw * (0.9 + rng() * 0.6);
    }
    // 丘の上の城（人間の王国）
    const cx = Math.round(w * 0.35); const cb = gy - 62;
    t.P([[cx - 40, gy - 40], [cx - 22, cb], [cx + 26, cb], [cx + 44, gy - 40]], pal.mtn2);
    const stone = night ? '#7a80a0' : '#d8dce8';
    t.R(cx - 16, cb - 18, 34, 18, stone);
    for (const tx of [-18, -4, 10, 18]) { t.R(cx + tx, cb - 26 - (tx === -4 ? 8 : 0), 6, 26 + (tx === -4 ? 8 : 0), stone); t.P([[cx + tx - 1, cb - 26 - (tx === -4 ? 8 : 0)], [cx + tx + 3, cb - 34 - (tx === -4 ? 8 : 0)], [cx + tx + 7, cb - 26 - (tx === -4 ? 8 : 0)]], '#4a6ac8'); }
    if (night) for (let i = 0; i < 5; i++) t.R(cx - 12 + i * 6, cb - 10, 1, 2, '#ffd76a');
  }

  // 丘と森
  const hills = canvas(W(PARALLAX.hills), H); {
    const t = T(hills.getContext('2d'));
    const w = hills.width;
    const top = (x) => gy - 34 - Math.sin(x / 47) * 9 - Math.sin(x / 19 + 1) * 4;
    for (let x = 0; x < w; x++) { const y = Math.round(top(x)); t.R(x, y, 1, gy - y + 4, pal.hill); t.R(x, y, 1, 2, pal.hill2); }
    for (let x = 4; x < w; x += 5 + Math.floor(rng() * 7)) tree(t, x, Math.round(top(x)) + 6, 1, pal, rng);
  }

  // 村：家・風車・木・柵・麦畑（ステージで並びが変わる）
  let windX = null;
  const vil = canvas(W(PARALLAX.village), H); {
    const t = T(vil.getContext('2d'));
    const w = vil.width;
    const base = gy - 10;
    t.R(0, base - 6, w, 20, pal.hill2); t.R(0, base - 6, w, 1, pal.hill);
    const kinds = ['blue', 'thatch', 'red'];
    const xs = [];
    for (let x = 18; x < w * 0.7; x += 70 + Math.floor(rng() * 50)) xs.push(x);
    xs.forEach((x, i) => house(t, x, base, kinds[i % 3], pal, night));
    for (let x = 6; x < w * 0.75; x += 30 + Math.floor(rng() * 30)) if (!xs.some((h) => x > h - 6 && x < h + 32)) tree(t, x, base + 2, 1.3, pal, rng);
    if (stage.theme === 'wheat') { for (let x = Math.round(w * 0.2); x < w * 0.62; x++) { t.R(x, base - 4, 1, 6, x % 3 ? '#e8c050' : '#c89a30'); if (x % 4 === 0) t.R(x, base - 6, 1, 2, '#f0d878'); } }
    fence(t, Math.round(w * 0.05), Math.round(w * 0.66), base + 4);
    if (stage.theme !== 'gate' && stage.theme !== 'plaza') { windX = Math.round(w * 0.45); windmillBody(t, windX, base + 2); }
    // 魔力に染まった枯れ木（右側）
    for (let x = Math.round(w * 0.8); x < w; x += 26) { t.R(x, base - 14, 2, 16, '#4a3050'); t.R(x - 4, base - 12, 4, 1, '#4a3050'); t.R(x + 2, base - 9, 4, 1, '#4a3050'); }
  }

  const out = { time, pal, sky, far, hills, village: vil, ground: groundLayer(stage, pal, night, rng), windmill: windX == null ? null : { x: windX, y: gy - 10 + 2 - 34 } };
  cache.set(key, out);
  return out;
}

// 地面（世界座標、視差なし）：草・土の道・石畳・草花・石。右の祠のまわりは紫に染まる
function groundLayer(stage, pal, night, rng) {
  const L = stage.length;
  const w = Math.ceil(L / BG_PIX) + 4; const h = Math.ceil((540 - GROUND_Y) / BG_PIX) + 12;
  const c = canvas(w, h);
  const t = T(c.getContext('2d'));
  const top = 6; // 地面の上端（半解像度、GROUND_Y - 12 論理ドット）
  const grass = night ? ['#2e5a3a', '#3a6e44', '#24482e'] : ['#5aa83e', '#76c450', '#468a32'];
  const dirt = night ? ['#6a5a48', '#7a6a54', '#54463a'] : ['#c8a068', '#d8b47a', '#a8804e'];
  t.R(0, top, w, h, grass[0]);
  t.R(0, top, w, 2, grass[1]);
  // 土の道
  const roadY = top + 7; const roadH = 16;
  t.R(0, roadY, w, roadH, dirt[0]);
  t.R(0, roadY, w, 1, dirt[2]); t.R(0, roadY + roadH - 1, w, 1, dirt[2]);
  for (let i = 0; i < w * 0.6; i++) { const x = rng() * w; const y = roadY + 1 + rng() * (roadH - 2); t.R(x, y, 1 + (rng() < 0.3), 1, rng() < 0.5 ? dirt[1] : dirt[2]); }
  for (let i = 0; i < w * 0.05; i++) { const x = rng() * w; const y = roadY + 2 + rng() * (roadH - 4); t.R(x, y, 2, 1, '#9a9086'); t.R(x, y - 1, 2, 1, '#c8c0b4'); }
  // 石畳（村の広場・門の前）
  if (stage.theme === 'plaza' || stage.theme === 'gate') {
    for (let x = 0; x < w * 0.45; x += 5) for (let y = roadY + 1; y < roadY + roadH - 1; y += 3) { t.R(x + (y % 2) * 2, y, 4, 2, night ? '#8a8478' : '#bab0a0'); }
  }
  // 手前の草と花
  const front = roadY + roadH;
  t.R(0, front, w, h - front, grass[0]); t.R(0, front, w, 1, grass[2]);
  for (let x = 0; x < w; x += 2) { const r = rng(); t.R(x, top - 1 - (r < 0.3 ? 1 : 0), 1, 2 + (r < 0.3), grass[1]); if (r > 0.6) t.R(x, front + 1, 1, 2, grass[1]); }
  const flowers = ['#ff7aa8', '#ffe36b', '#9a7aff', '#ffffff', '#ff9a4a'];
  for (let i = 0; i < w * 0.08; i++) { const x = rng() * w * 0.78; const y = rng() < 0.5 ? top + 2 + rng() * 3 : front + 3 + rng() * (h - front - 6); t.R(x, y, 1, 1, flowers[Math.floor(rng() * flowers.length)]); t.R(x, y + 1, 1, 1, grass[2]); }
  for (let i = 0; i < w * 0.02; i++) { const x = rng() * w; const y = front + 4 + rng() * (h - front - 8); t.E(x, y, 3, 2, '#8a8478'); t.R(x - 2, y - 1, 3, 1, '#b8b0a4'); }
  // 川と石橋（1-3）
  if (stage.theme === 'river') {
    const cx = Math.round(w * 0.5);
    t.R(cx - 30, top, 60, h, night ? '#2a4a8a' : '#4a9ae0');
    for (let i = 0; i < 40; i++) t.R(cx - 28 + rng() * 56, top + rng() * h, 4, 1, '#a8dcff');
    t.R(cx - 38, roadY - 3, 76, roadH + 4, '#a8a094'); t.R(cx - 38, roadY - 3, 76, 2, '#d0c8bc');
    for (let x = cx - 36; x < cx + 38; x += 6) t.R(x, roadY - 1, 1, roadH + 2, '#8a8478');
    t.R(cx - 40, roadY - 7, 3, 6, '#8a8478'); t.R(cx + 37, roadY - 7, 3, 6, '#8a8478');
  }
  // 右側（祠のまわり）を紫に染める
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(w * 0.62, 0, w, 0);
  g.addColorStop(0, 'rgba(70,20,110,0)'); g.addColorStop(0.6, 'rgba(70,20,110,.45)'); g.addColorStop(1, 'rgba(50,10,90,.75)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) { const x = w * (0.78 + rng() * 0.22); const y = top + 2 + rng() * (h - 6); t.R(x, y, 2 + rng() * 6, 1, '#c26bff'); }
  return c;
}

// ---------------------------------------------------------------- 建物（ドット絵。足元の中央が基準）
const bcache = new Map();
function outlined(w, h, draw) {
  const c = canvas(w + 2, h + 2);
  const ctx = c.getContext('2d'); ctx.translate(1, 1);
  draw(T(ctx), ctx);
  const img = ctx.getImageData(0, 0, c.width, c.height); const d = img.data; const W = c.width; const H = c.height;
  const add = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; if (d[i + 3]) continue;
    const s = (xx, yy) => xx >= 0 && yy >= 0 && xx < W && yy < H && d[(yy * W + xx) * 4 + 3];
    if (s(x - 1, y) || s(x + 1, y) || s(x, y - 1) || s(x, y + 1)) add.push(i);
  }
  for (const i of add) { d[i] = 26; d[i + 1] = 14; d[i + 2] = 38; d[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return { img: c, w: w + 2, h: h + 2 };
}

// 封印の祠：古代の石造りの門、金の飾り、紫の宝石。中の渦と魔法陣は描画側で動かす
export function shrineArt() {
  if (bcache.has('shrine')) return bcache.get('shrine');
  const a = outlined(84, 104, ({ R, P, E }) => {
    const st = '#6a6080'; const st2 = '#8a80a0'; const st3 = '#4a4060'; const gold = '#d4a838'; const gold2 = '#ffe08a';
    // 階段
    R(2, 96, 80, 8, st3); R(6, 92, 72, 5, st); R(10, 88, 64, 5, st2);
    for (let x = 4; x < 80; x += 8) R(x, 97, 1, 6, '#3a3050');
    // 柱
    for (const x of [12, 62]) {
      R(x, 34, 12, 54, st); R(x + 2, 34, 3, 54, st2); R(x + 9, 34, 2, 54, st3);
      R(x - 2, 30, 16, 5, gold); R(x - 2, 30, 16, 1, gold2); R(x - 2, 84, 16, 4, gold);
      for (let y = 42; y < 82; y += 10) R(x + 1, y, 10, 1, st3);
      R(x + 4, 50, 4, 6, '#9a4ad8'); R(x + 5, 51, 2, 2, '#e0b8ff');
    }
    // アーチ
    P([[10, 34], [10, 22], [26, 6], [42, 2], [58, 6], [74, 22], [74, 34], [64, 34], [64, 26], [54, 16], [42, 13], [30, 16], [22, 26], [22, 34]], st);
    P([[12, 30], [12, 22], [27, 8], [42, 4], [57, 8], [72, 22], [72, 25], [56, 11], [42, 8], [28, 11], [14, 25]], st2);
    P([[22, 34], [22, 26], [30, 16], [42, 13], [54, 16], [64, 26], [64, 34], [62, 34], [62, 27], [53, 18], [42, 15], [31, 18], [24, 27], [24, 34]], gold);
    // 頂上の宝石と角
    E(42, 6, 6, 6, gold); E(42, 6, 4, 4, '#8a2ad8'); R(40, 3, 2, 2, '#f0d0ff');
    P([[18, 16], [8, 2], [4, 6], [12, 18]], '#e8dcc0'); P([[66, 16], [76, 2], [80, 6], [72, 18]], '#e8dcc0');
    // 旗
    for (const x of [0, 76]) { R(x, 38, 8, 30, '#5b2a99'); R(x, 38, 8, 2, gold); P([[x, 68], [x + 4, 64], [x + 8, 68], [x + 8, 72], [x, 72]], '#5b2a99'); R(x + 3, 46, 2, 6, gold); R(x + 1, 48, 6, 2, gold); }
    // 鎖
    for (let i = 0; i < 6; i++) { R(24 + i * 3, 40 + i * 5, 2, 2, '#9a96a8'); R(58 - i * 3, 40 + i * 5, 2, 2, '#9a96a8'); }
  });
  a.portal = { x: 24, y: 34, w: 40, h: 54, archTop: 15 }; // 渦を描く場所（ドット座標）
  bcache.set('shrine', a);
  return a;
}

// 人間軍の拠点：見張り小屋（1-1〜1-3）→ 村の門（1-4）→ 城（1-5）
export function baseArt(kind) {
  const key = 'base:' + kind;
  if (bcache.has(key)) return bcache.get(key);
  let a;
  if (kind === 'gate') {
    a = outlined(92, 92, ({ R, P }) => {
      const wood = '#8a5a2a'; const wood2 = '#a8743a'; const dark = '#5a3a1a';
      for (let x = 0; x < 92; x += 6) { const h = x < 24 || x > 66 ? 70 : 58; R(x, 92 - h, 5, h, x % 12 ? wood : wood2); P([[x, 92 - h], [x + 2.5, 88 - h], [x + 5, 92 - h]], wood2); }
      for (const tx of [0, 66]) { R(tx, 6, 26, 26, '#c8b890'); R(tx, 6, 26, 2, '#e8d8b0'); for (let i = 0; i < 5; i++) R(tx + i * 6, 0, 4, 6, '#c8b890'); R(tx + 10, 14, 6, 10, '#2a1a10'); }
      R(28, 40, 36, 52, dark); P([[28, 40], [46, 28], [64, 40]], dark);
      for (let x = 30; x < 64; x += 5) R(x, 40, 4, 52, wood);
      R(28, 54, 36, 3, '#3a3a3a'); R(28, 76, 36, 3, '#3a3a3a'); R(44, 62, 4, 4, '#d4a838');
      R(36, 20, 20, 10, '#3e6fc4'); R(44, 22, 4, 6, '#ffd36b');
    });
  } else if (kind === 'castle') {
    a = outlined(100, 118, ({ R, P }) => {
      const st = '#cfc8b4'; const st2 = '#e8e0cc'; const st3 = '#a8a090';
      R(10, 50, 80, 68, st); R(10, 50, 80, 3, st2);
      for (let x = 10; x < 90; x += 10) R(x, 44, 6, 7, st);
      for (let y = 58; y < 118; y += 8) for (let x = 10 + (y % 16 ? 0 : 5); x < 90; x += 10) R(x, y, 9, 1, st3);
      for (const tx of [0, 74]) { R(tx, 20, 26, 98, st); R(tx + 2, 20, 4, 98, st2); P([[tx - 3, 22], [tx + 13, -2], [tx + 29, 22]], '#3e5ab8'); P([[tx + 13, -2], [tx + 29, 22], [tx + 18, 22]], '#2e4a98'); R(tx + 10, 40, 6, 10, '#2a1a40'); R(tx + 10, 70, 6, 10, '#ffd76a'); }
      R(38, 80, 24, 38, '#3a2414'); P([[38, 80], [50, 70], [62, 80]], '#3a2414'); for (let x = 40; x < 62; x += 4) R(x, 80, 1, 38, '#5a3a20');
      R(42, 56, 16, 14, '#3e6fc4'); R(48, 58, 4, 10, '#ffd36b'); R(45, 61, 10, 3, '#ffd36b');
    });
  } else {
    a = outlined(64, 118, ({ R, P, L }, ctx) => {
      ctx.translate(0, 14); // 旗の分だけ下げる
      const wood = '#8a5a2a'; const wood2 = '#b07a40'; const dark = '#5a3a1a';
      // 脚と筋かい
      for (const [x0, x1] of [[4, 14], [60, 50]]) { L(x0, 104, x1, 40, wood, 4); }
      L(10, 90, 54, 62, dark, 2); L(54, 90, 10, 62, dark, 2); L(14, 64, 50, 46, dark, 2); L(50, 64, 14, 46, dark, 2);
      // はしご
      for (let y = 46; y < 104; y += 6) R(28, y, 8, 1, wood2); L(28, 44, 28, 104, wood, 1); L(36, 44, 36, 104, wood, 1);
      // 見張り台
      R(4, 36, 56, 6, wood2); R(4, 41, 56, 2, dark);
      R(8, 16, 48, 20, '#d8b07a'); for (let x = 8; x < 56; x += 6) R(x, 16, 1, 20, '#a8804a');
      R(20, 22, 10, 8, '#2a1a10'); R(36, 22, 10, 8, '#2a1a10'); R(24, 26, 2, 3, '#ffe36b');
      // わら屋根
      P([[2, 18], [32, 0], [62, 18]], '#e0b050'); for (let i = 0; i < 6; i++) R(6 + i * 2, 15 - i * 3, 52 - i * 4, 1, '#c09038');
      // 旗
      L(32, 0, 32, -14, '#5a3a1a', 1); P([[33, -14], [44, -11], [33, -7]], '#3e6fc4');
      // 樽
      R(0, 94, 8, 10, '#8a5a2a'); R(0, 97, 8, 1, '#5a3a1a'); R(0, 101, 8, 1, '#5a3a1a');
    });
  }
  bcache.set(key, a);
  return a;
}

export const BASE_KIND = { watch: 'tower', wheat: 'tower', river: 'tower', gate: 'gate', plaza: 'castle', harbor: 'gate', ruin: 'castle', market: 'gate', fortress: 'castle', desert: 'castle', holy: 'castle', magic: 'castle', capital: 'castle', sky: 'castle' };
