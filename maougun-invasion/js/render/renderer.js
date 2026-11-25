/* 戦場の描画（Canvas 2D）。論理 960×540 の座標で描き、端末の解像度に合わせて拡大する。
 * 左：人間軍の拠点 ／ 右：魔王軍の封印の祠。ロジックからは battle（読むだけ）と battle.events（出来事）を受け取る。 */
import { drawUnit, spriteFor, whenSpriteReady } from './shapes.js';
import { unitSprite, PIX, FLOATING, BOUNCY } from './pixelart.js';
import { backdrop, shrineArt, baseArt, BASE_KIND, BG_PIX, PARALLAX } from './backdrop.js';
import { getImage, preload } from './images.js';
import { SKIN } from '../data/skin.js';

// 魔法使いの火球の画像は先に読み込んでおく（最初の1発から出るように）
if (SKIN.mageFire) preload([SKIN.mageFire.charge.src, SKIN.mageFire.shot.src, SKIN.mageFire.impact.src]);
if (SKIN.goblinArrow) preload([SKIN.goblinArrow.src]);
if (SKIN.malletThrow) preload([SKIN.malletThrow.shot.src, SKIN.malletThrow.impact.src]);
if (SKIN.spellPhoenix) preload([SKIN.spellPhoenix.charge.src, SKIN.spellPhoenix.flight.src, SKIN.spellPhoenix.impact.src]);
const phoenixReady = () => { const s = SKIN.spellPhoenix; return !!(s && getImage(s.charge.src) && getImage(s.flight.src) && getImage(s.impact.src)); };
if (SKIN.unitFx) preload(Object.values(SKIN.unitFx).flatMap((u) => Object.values(u).filter((v) => v && v.src).map((v) => v.src)));
// ユニット別エフェクトの設定（画像が読めていれば返す）
const ufx = (key, on) => { const d = SKIN.unitFx && SKIN.unitFx[key] && SKIN.unitFx[key][on]; return d && getImage(d.src) ? d : null; };

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
    preload(Object.values(SKIN.fx || {}).map((d) => d.src)); // 承認済みのエフェクトは最初に読んでおく（初回だけ仮の演出になるのを防ぐ）
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
          this.add({ kind: 'puff', x: ev.x, side: ev.side, y: y - 16, color: ev.side === 'human' ? '#ffe9a8' : '#b58cff', life: 0.6 });
          if (ev.side === 'demon') { this.add({ kind: 'ghost', x: ev.x, side: ev.side, y: y - 24, life: 1.0 }); this.add({ kind: 'motes', x: ev.x, side: ev.side, y: y - 20, color: '#c58cff', life: 0.8 }); }
          else { this.add({ kind: 'motes', x: ev.x, side: ev.side, y: y - 20, color: '#ffe9a8', life: 0.7 }); this.add({ kind: 'stars', x: ev.x, side: ev.side, y: y - 36, life: 0.7 }); }
          if (ev.hero) this.add({ kind: 'banner', text: '勇者が撤退した！', color: '#5b2a99', life: 1.8 });
          break;
        }
        case 'immune': this.add({ kind: 'num', x: ev.x, y: laneY(ev.lane) - 70, text: '効かない！', color: '#ff9aa8', life: 1.0, big: true }); break;
        case 'manaGain': this.add({ kind: 'num', x: ev.x, y: GROUND_Y - 84, text: '+' + ev.amount, color: '#e2c6ff', life: 0.9, small: true }); break;
        case 'heal': if (ev.amount > 0 && ev.srcKey && ufx(ev.srcKey, 'heal')) { const d = ufx(ev.srcKey, 'heal'); this.add({ kind: 'ufx', d, x: ev.x, y: laneY(ev.lane) + 2, flip: 1, life: d.life }); }
          if (ev.amount > 0) this.add({ kind: 'num', x: ev.x, y: laneY(ev.lane) - 56, text: '+' + ev.amount, color: '#7ef0b0', life: 0.8, small: true }); break;
        case 'healCast': this.add({ kind: 'ring', heal: true, x: ev.x, y: GROUND_Y + 10, color: '#7ef0b0', life: 0.7, w: ev.radius }); break;
        case 'shot': {
          const e = byId(ev.id);
          // 魔法使いの火球：頭上から敵の足元へ斜めに飛び、着いた瞬間に足元へ炎の輪
          const mf = SKIN.mageFire;
          if (e && mf && mf.keys.includes(e.key) && getImage(mf.shot.src)) {
            const hy = this.headY(e);
            const gy = laneY(ev.toLane ?? e.lane) + 2;
            const fl = ev.delay || mf.shot.life; // 届くまでの時間（ダメージもこの時に入る）
            this.add({ kind: 'fireball', from: e.x + e.dir * 10, fromY: hy, to: ev.to, toY: gy - 6, life: fl });
            if (!ev.miss) this.add({ kind: 'fireRing', x: ev.to, y: gy, delay: fl, life: fl + mf.impact.life });
            break;
          }
          // 特殊魔法の大当たり：弾は重ねず、着弾側に金紫の閃光
          if (e && ev.big && ufx(e.key, 'jackpot')) { const d = ufx(e.key, 'jackpot'); this.add({ kind: 'ufx', d, x: ev.to, y: laneY(ev.toLane ?? e.lane) - 30, flip: 1, life: d.life }); break; }
          // 森のお化けの種・悪魔くんの小弾：まっすぐ飛ぶ専用の弾
          if (e && ufx(e.key, 'shot')) { const d = ufx(e.key, 'shot'); const y0 = laneY(e.lane) - 32; this.add({ kind: 'ufxShot', d, from: e.x + e.dir * 10, to: ev.to, y: y0, ty: ev.toLane != null ? laneY(ev.toLane) - 30 : y0, life: ev.delay || 0.26 }); break; }
          // 木槌小鬼の木槌：手元からゆるい弧で約1回転して飛び、届いたら閃光と木くず・土煙
          const mt = SKIN.malletThrow;
          if (e && mt && mt.keys.includes(e.key) && getImage(mt.shot.src)) {
            const sx = e.x + e.dir * 10; const sy = laneY(e.lane) - this.headDrop(e) * 0.65;
            const ex = ev.to; const ey = ev.miss ? laneY(e.lane) - 6 : ev.toLane != null ? laneY(ev.toLane) - 22 : GROUND_Y - 50;
            const fl = ev.delay || 0.45;
            this.add({ kind: 'mThrow', sx, sy, ex, ey, lift: ev.over ? 70 : null, life: fl }); // 空振りは前線の頭上を越える高い弧
            if (getImage(mt.impact.src)) this.add({ kind: 'ufx', d: { ...mt.impact, anim: 'ground' }, x: ex, y: ey + 14, flip: 1, delay: fl, life: fl + mt.impact.life });
            break;
          }
          // 弓ゴブリンの矢：弓の位置から放物線で飛び、届いたら黄緑の火花
          const ga = SKIN.goblinArrow;
          if (e && ga && ga.keys.includes(e.key) && getImage(ga.src)) {
            const sx = e.x + e.dir * 12; const sy = laneY(e.lane) - this.headDrop(e) * 0.55;
            const ex = ev.to; const ey = ev.toLane != null ? laneY(ev.toLane) - 26 : GROUND_Y - 60;
            const lift = Math.max(ga.liftMin, Math.min(ga.liftMax, Math.abs(ex - sx) * ga.liftRate));
            const fl = ev.delay || 0.28;
            this.add({ kind: 'gArrow', sx, sy, ex, ey, lift, life: fl });
            this.add({ kind: 'gGlow', x: sx, y: sy, r: 7, life: 0.12 });
            if (!ev.miss) this.add({ kind: 'gGlow', x: ex, y: ey, r: 10, spark: true, delay: fl, life: fl + 0.2 });
            break;
          }
          this.add({ kind: 'shot', shot: ev.kind, from: ev.from, to: ev.to, y: laneY(e ? e.lane : 0.5) - 32, side: ev.side, big: ev.big, life: ev.kind === 'arrow' ? 0.22 : ev.kind === 'hammer' ? 0.5 : 0.26 });
          break;
        }
        case 'strike': {
          const e = byId(ev.id);
          const d = e && ufx(e.key, 'strike');
          if (d) { this.add({ kind: 'ufx', d, x: e.x + e.dir * d.ahead, y: laneY(e.lane) - d.up, flip: -e.dir, life: d.life }); break; } // 闇の騎士の三日月・こうもりの翼の残像
          if (e && !e.def.projectile && !ufx(e.key, 'impact')) this.add({ kind: 'slash', x: e.x + e.dir * 22, y: laneY(e.lane) - 30, dir: e.dir, area: ev.area, life: 0.18 });
          break;
        }
        case 'impact': { // 近接の命中地点（攻撃した本人の ID つき）：グミのしぶき・岩男のひび
          const d = ufx(ev.key, 'impact');
          if (d) this.add({ kind: 'ufx', d, x: ev.x, y: d.anim === 'ground' ? laneY(ev.lane) + 2 : laneY(ev.lane) - 22, flip: ev.side === 'demon' ? 1 : -1, life: d.life });
          break;
        }
        case 'fizzle': {
          const e = byId(ev.id); const d = e && ufx(e.key, 'fizzle');
          if (d) { this.add({ kind: 'ufx', d, x: ev.x + e.dir * 12, y: laneY(ev.lane) - 26, flip: 1, life: d.life }); break; } // 手元に小さな煙
          this.add({ kind: 'fizzle', x: ev.x, y: laneY(ev.lane) - 60, life: 1.0 }); break;
        }
        case 'bigMagic': if (byId(ev.id) && ufx(byId(ev.id).key, 'jackpot')) { this.shake = Math.max(this.shake, 4); break; } this.add({ kind: 'boom', x: ev.x, y: GROUND_Y - 10, r: ev.radius, life: 0.6 }); this.shake = Math.max(this.shake, 6); break;
        case 'stun': this.add({ kind: 'flashRing', x: ev.x, y: laneY(ev.lane) - 30, life: 0.4 }); break;
        case 'skillStart': {
          const e = byId(ev.id);
          if (e) this.add({ kind: 'warn', id: ev.id, text: ev.name, life: 1.0 });
          break;
        }
        case 'skill':
          if (ev.skill === 'wave') this.add({ kind: 'wave', x: ev.x, dir: ev.dir, reach: ev.reach, life: 0.45 });
          else if (ev.skill === 'stun') this.add({ kind: 'lightBurst', x: ev.x, dir: ev.dir, reach: ev.reach, life: 0.6 });
          else if (ev.skill === 'heal') this.add({ kind: 'ring', heal: true, x: ev.x, y: GROUND_Y + 10, color: '#a8ffcf', life: 0.9, w: 260 });
          else if (ev.skill === 'charge') this.add({ kind: 'wave', x: ev.x, dir: ev.dir, reach: ev.reach, life: 0.45, color: '#ffb070' });
          this.shake = Math.max(this.shake, 4);
          break;
        case 'baseHit': this.baseShake = this.baseShake || { human: 0, demon: 0 }; this.baseShake[ev.side] = 0.15; this.shake = Math.max(this.shake, 2.5); this.add({ kind: 'spark', x: ev.x + (ev.side === 'human' ? 40 : -40), y: GROUND_Y - 60 - Math.random() * 70, color: '#fff', life: 0.25 }); break;
        case 'spell':
          // 不死鳥：祠の上でため → 狙った地点へ飛ぶ。フラッシュ・揺れ・ダメージは着弾（spellHit）で
          if (phoenixReady()) { this.add({ kind: 'phx', sx: b.shrine.x - 20, sy: GROUND_Y - 175, tx: ev.x, ty: GROUND_Y + 6, charge: ev.charge, flight: ev.flight, life: ev.charge + ev.flight }); break; }
          this.add({ kind: 'spell', x: ev.x, r: ev.radius, life: 1.2 });
          break;
        case 'spellHit':
          if (phoenixReady()) this.add({ kind: 'phxRing', x: ev.x, y: GROUND_Y + 12, w: Math.max(260, ev.radius * 1.9), life: SKIN.spellPhoenix.impact.life + 0.25 });
          this.shake = 12; this.flashScreen = 0.5;
          break;
        case 'furnace': this.add({ kind: 'ring', x: b.shrine.x, y: GROUND_Y - 90, color: '#ffd36b', life: 0.8, w: 40 }); break;
        case 'spawn':
          break;
        case 'alarm': this.add({ kind: 'banner', text: '人間軍の増援！', color: '#8a1c2c', life: 1.6 }); break;
        case 'heroAlarm': this.add({ kind: 'banner', text: `${(b.humanDefs[ev.who] || {}).name || '強敵'} 参上！`, sub: ev.line, color: '#1d4f9a', life: 2.6, hero: true }); this.shake = 6; break;
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
    if (this.baseShake) for (const k in this.baseShake) this.baseShake[k] = Math.max(0, this.baseShake[k] - dt);
    this.flashScreen = Math.max(0, this.flashScreen - dt);

    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const sx = this.reduced ? 0 : (Math.random() - 0.5) * this.shake;
    const sy = this.reduced ? 0 : (Math.random() - 0.5) * this.shake;

    // 背景：承認済み画像があればそれを、無ければ仮の背景
    const bgDef = SKIN.images.stageBg[b.stage.id] || SKIN.images.stageBg['chapter' + b.stage.chapter];
    const bgImg = bgDef && getImage(bgDef.src);
    const bd = bgImg ? null : backdrop(b.stage);
    if (bgImg) this.drawStageImage(b, bgImg, bgDef); else this.drawLayers(bd);
    ctx.save();
    ctx.translate(-Math.round(this.camX) + sx, sy);
    if (bd) ctx.drawImage(bd.ground, 0, GROUND_Y - 12, bd.ground.width * BG_PIX, bd.ground.height * BG_PIX);
    this.drawBaseArt(b);
    this.drawShrineArt(b);

    const list = b.entities.slice().sort((a, c) => a.lane - c.lane);
    for (const e of list) this.drawEntity(e, alpha);
    this.drawFx(ctx, false, b);
    ctx.restore();
    this.drawFx(ctx, true, b);

    if (this.flashScreen > 0 && !this.reduced) { ctx.fillStyle = `rgba(230,160,255,${this.flashScreen * 0.55})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (b.entities.length || b.t > 0) this.drawMinimap(b);
  }

  // 承認済みの背景画像（1枚）。見た目は変えず、拡大縮小と位置だけ。
  // parallax があれば「カメラの移動量 × parallax」で動かす（パノラマ）。無ければ横に余る分だけ、カメラに合わせてゆっくり動かす
  drawStageImage(b, img, def) {
    const ctx = this.ctx;
    const w = img.naturalWidth * def.scale; const h = img.naturalHeight * def.scale;
    const range = Math.max(0, b.stage.length - VIEW_W);
    const extra = Math.max(0, w - VIEW_W);
    let x;
    if (def.parallax != null) {
      // パノラマ：カメラの移動量 × parallax だけ背景を動かす。動く幅の中心を画像の focus（0〜1）に合わせ、画像の端で止める（黒帯を出さない）
      const travel = range * def.parallax;
      const start = (extra - travel) * (def.focus ?? 0.5);
      x = -Math.max(0, Math.min(extra, start + this.camX * def.parallax));
    } else x = range ? -extra * (this.camX / range) : -extra / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, x, def.offsetY || 0, w, h);
    if (def.tint) { ctx.fillStyle = def.tint; ctx.fillRect(0, 0, VIEW_W, VIEW_H); } // 暗くする（壊滅した町の仮の背景など）
    ctx.imageSmoothingEnabled = false;
    if (h + (def.offsetY || 0) < VIEW_H) { ctx.fillStyle = '#1a0d29'; ctx.fillRect(0, h + (def.offsetY || 0), VIEW_W, VIEW_H); }
  }

  // 空・遠景・丘・村（視差つき）
  drawLayers(bd) {
    const ctx = this.ctx;
    ctx.drawImage(bd.sky, 0, 0, bd.sky.width * BG_PIX, bd.sky.height * BG_PIX);
    for (const [name, par] of [['far', PARALLAX.far], ['hills', PARALLAX.hills], ['village', PARALLAX.village]]) {
      const img = bd[name];
      const x = -Math.round(this.camX * par);
      ctx.drawImage(img, x, 0, img.width * BG_PIX, img.height * BG_PIX);
    }
    if (bd.windmill) { // 風車の羽（村の層の上で回す）
      const cx = -this.camX * PARALLAX.village + bd.windmill.x * BG_PIX; const cy = bd.windmill.y * BG_PIX;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.time * 0.9);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#5a3a1a'; ctx.fillRect(0, -2, 34, 4);
        ctx.fillStyle = '#f4ecd8'; ctx.fillRect(10, -7, 24, 6);
        ctx.fillStyle = '#c8b898'; for (let k = 12; k < 34; k += 6) ctx.fillRect(k, -7, 1, 6);
      }
      ctx.restore();
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(cx - 3, cy - 3, 6, 6);
    }
    if (bd.time === 'night') { ctx.fillStyle = 'rgba(20,20,60,.18)'; ctx.fillRect(0, 0, VIEW_W, GROUND_Y); }
  }

  // 人間軍の拠点（ドット絵）。被弾で揺れ、HPが減るとひび・煙・火
  drawBaseArt(b) {
    const ctx = this.ctx; const s = b.base;
    const kind = BASE_KIND[b.stage.theme] || 'tower';
    if (this.drawApproved(SKIN.images.base[kind], s, 'human')) return;
    const art = baseArt(BASE_KIND[b.stage.theme] || 'tower');
    const ratio = s.hp / s.maxHp;
    const hit = this.baseShake && this.baseShake.human > 0 ? Math.sin(this.time * 80) * 2 : 0;
    const w = art.w * BG_PIX; const h = art.h * BG_PIX;
    const x = s.x - w / 2 + hit; const y = GROUND_Y + 10 - h;
    ctx.drawImage(art.img, x, y, w, h);
    this.damageMarks(ctx, s.x, y, w, h, ratio, '#ff9a3a');
  }

  // 封印の祠（ドット絵）＋ 動く紫の渦・足元の魔法陣
  drawShrineArt(b) {
    const ctx = this.ctx; const s = b.shrine;
    if (this.drawApproved(SKIN.images.shrine, s, 'demon')) return;
    const art = shrineArt();
    const ratio = s.hp / s.maxHp;
    const hit = this.baseShake && this.baseShake.demon > 0 ? Math.sin(this.time * 80) * 2 : 0;
    const w = art.w * BG_PIX; const h = art.h * BG_PIX;
    const x = s.x - w / 2 + hit; const y = GROUND_Y + 12 - h;
    // 足元の魔法陣（祠の前）
    this.magicCircle(ctx, s.x - 30, GROUND_Y + 14, 120, 0.55 + Math.sin(this.time * 2) * 0.15);
    ctx.drawImage(art.img, x, y, w, h);
    // 渦
    const p = art.portal;
    const px = x + (p.x + 1) * BG_PIX; const py = y + (p.y + 1) * BG_PIX; const pw = p.w * BG_PIX; const ph = p.h * BG_PIX;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(px, py + ph); ctx.lineTo(px, py + 10); ctx.quadraticCurveTo(px + pw / 2, py - 26, px + pw, py + 10); ctx.lineTo(px + pw, py + ph); ctx.closePath(); ctx.clip();
    const cx = px + pw / 2; const cy = py + ph * 0.45;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, ph * 0.7);
    g.addColorStop(0, '#ffe0ff'); g.addColorStop(0.25, '#d07bff'); g.addColorStop(0.6, '#7a2ad8'); g.addColorStop(1, '#2a0a4a');
    ctx.fillStyle = g; ctx.fillRect(px, py - 30, pw, ph + 30);
    ctx.strokeStyle = 'rgba(255,220,255,.55)'; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, 8 + i * 12, this.time * (1.5 + i * 0.4) + i, this.time * (1.5 + i * 0.4) + i + 3.8); ctx.stroke(); }
    for (let i = 0; i < 6; i++) { const t = (this.time * 0.5 + i / 6) % 1; ctx.fillStyle = `rgba(255,230,255,${1 - t})`; ctx.fillRect(cx + Math.sin(i * 2.4) * pw * 0.35, py + ph - t * ph, 3, 3); }
    ctx.restore();
    this.damageMarks(ctx, s.x, y, w, h, ratio, '#c26bff');
  }

  // 承認済みの建物画像（{ src, width, footY }）。足元の中央を拠点の位置にそろえる
  drawApproved(def, s, side) {
    if (!def) return false;
    const ratio = s.hp / s.maxHp;
    const st = def.stages || [];
    const src = (ratio < 0.33 && st[2]) || (ratio < 0.66 && st[1]) || st[0] || def.src;
    const img = getImage(src) || getImage(def.src);
    if (!img) return false;
    const ctx = this.ctx;
    const k = def.width / img.naturalWidth; const w = def.width; const h = img.naturalHeight * k;
    const hit = this.baseShake && this.baseShake[side] > 0 ? Math.sin(this.time * 80) * 2 : 0;
    const foot = (def.footY ?? img.naturalHeight) * k;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, s.x - w / 2 + hit, GROUND_Y + 12 - foot, w, h);
    ctx.imageSmoothingEnabled = false;
    if (!(st[1] && st[2])) this.damageMarks(ctx, s.x, GROUND_Y + 12 - foot, w, foot, ratio, side === 'demon' ? '#c26bff' : '#ff9a3a'); // 壊れ方の絵が無いときだけ
    return true;
  }

  magicCircle(ctx, x, y, r, a) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.28);
    ctx.globalAlpha = a; ctx.strokeStyle = '#d58cff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); ctx.stroke();
    ctx.rotate(this.time * 0.6);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const t = i * Math.PI * 2 / 6; const t2 = t + Math.PI * 2 / 3; ctx.moveTo(Math.cos(t) * r * 0.78, Math.sin(t) * r * 0.78); ctx.lineTo(Math.cos(t2) * r * 0.78, Math.sin(t2) * r * 0.78); }
    ctx.stroke();
    ctx.fillStyle = '#ffe08a';
    for (let i = 0; i < 12; i++) { const t = i * Math.PI / 6; ctx.fillRect(Math.cos(t) * r * 0.89 - 2, Math.sin(t) * r * 0.89 - 2, 4, 4); }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  damageMarks(ctx, cx, top, w, h, ratio, fire) {
    if (ratio < 0.66) {
      ctx.fillStyle = 'rgba(30,10,20,.7)';
      const n = ratio < 0.33 ? 5 : 2;
      for (let i = 0; i < n; i++) { const x = cx - w * 0.3 + (i * 37 % (w * 0.6)); const y = top + h * 0.3 + (i * 23 % (h * 0.4)); for (let k = 0; k < 5; k++) ctx.fillRect(x + (k % 2) * 3, y + k * 4, 3, 4); }
    }
    if (ratio < 0.33) {
      for (let i = 0; i < 3; i++) {
        const t = (this.time * 0.7 + i / 3) % 1;
        ctx.fillStyle = `rgba(70,70,80,${0.55 * (1 - t)})`;
        ctx.beginPath(); ctx.arc(cx + (i - 1) * 18 + Math.sin(t * 6 + i) * 5, top + 10 - t * 60, 8 + t * 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = fire; ctx.globalAlpha = 0.8 - t * 0.6;
        ctx.fillRect(cx + (i - 1) * 18 - 3, top + h * 0.35 - (Math.sin(this.time * 12 + i) + 1) * 4, 6, 8);
        ctx.globalAlpha = 1;
      }
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
    // こうもり：攻撃の瞬間だけ描画で少し低く（急降下の見た目）
    const dip = SKIN.unitFx && SKIN.unitFx[e.key] && SKIN.unitFx[e.key].dip;
    if (dip && pose === 'strike') rise -= dip;

    const px = unitSprite(e.key);
    const sz = d.size * UNIT_SCALE;
    const apr = spriteFor(e.key); // 承認済みの絵（あれば優先）
    const sw = apr ? apr.frameW * apr.scale * 0.6 : px ? px.w * PIX : 32 * sz; // 影・バーの幅の目安
    const sh = apr ? apr.footY * apr.scale : px ? px.h * PIX : 62 * sz;
    const age = this.time - (e.seen ?? (e.seen = this.time));
    // 待機・移動の動き（見た目だけ）
    const t = this.time * 1 + e.id * 0.37;
    let bob = 0; let squash = 0;
    if (pose === 'walk' && e.def.speed > 0 && e.stun <= 0) {
      if (BOUNCY[e.key]) { const ph = Math.abs(Math.sin(t * 7)); bob = ph * 5; squash = (1 - ph) * 0.12; }
      else { bob = Math.abs(Math.sin(t * 9)) * 2; }
    } else if (pose !== 'dead' && pose !== 'kb') bob = (Math.sin(t * 3) + 1) * 1; // 待機：小さく上下
    // 浮いている魔物：承認済みの絵は skin の hover（論理ドット）、仮のドット絵は FLOATING。ゆっくり上下する
    const hover = apr ? (apr.hover || 0) : (FLOATING[e.key] || 0) * PIX;
    const float = hover ? hover + Math.sin(t * 4) * 3 : 0;
    // 召喚：魔法陣から下からせり上がる（0.35秒）
    const summon = e.side === 'demon' ? Math.min(1, age / 0.35) : 1;

    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(12, sw * 0.38), 4.5, 0, 0, Math.PI * 2); ctx.fill();
    if (summon < 1) {
      const sfx = this.fxImage('summon');
      if (sfx) this.drawFxFrame(ctx, sfx, summon, x, y, 96, 96 * sfx.def.frameH / sfx.def.frameW);
      else this.magicCircle(ctx, x, y + 2, 26 + 10 * summon, 1 - summon * 0.6);
    }

    // 勇者は足元に光の輪
    if (d.hero && e.state !== 'dead') {
      ctx.strokeStyle = `rgba(255,230,120,${0.5 + Math.sin(this.time * 6) * 0.3})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, sw * 0.6, 7, 0, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.save();
    ctx.globalAlpha = a;
    if (summon < 1) { ctx.beginPath(); ctx.rect(x - 200, 0, 400, y + 2); ctx.clip(); }
    ctx.translate(x + push * e.dir, y - rise - bob - float + (1 - summon) * sh);
    const sp = spriteFor(e.key);
    if (sp) {
      ctx.scale(e.dir * (1 + squash), 1 - squash); ctx.rotate(lean * 0.6);
      const fr = sp.frames;
      const idx = pose === 'windup' ? fr.windup : pose === 'strike' ? fr.attack : fr.walk[Math.floor((this.time + e.id) / 0.2) % fr.walk.length];
      const flip = sp.facing === 'left' ? -1 : 1;
      ctx.scale(flip * (sp.scale || 0.5), sp.scale || 0.5);
      if (fr.walk.length === 1 && fr.windup === fr.attack) { // 1コマだけの絵：構えで縮み、攻撃で伸びる（見た目だけ）
        if (pose === 'windup') ctx.scale(1.06, 0.92);
        else if (pose === 'strike') ctx.scale(0.94, 1.08);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(sp.img, idx * sp.frameW, 0, sp.frameW, sp.frameH, -sp.frameW / 2, -sp.footY, sp.frameW, sp.frameH);
      if (e.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.6; ctx.drawImage(sp.img, idx * sp.frameW, 0, sp.frameW, sp.frameH, -sp.frameW / 2, -sp.footY, sp.frameW, sp.frameH); ctx.globalCompositeOperation = 'source-over'; }
      ctx.imageSmoothingEnabled = false;
    } else if (px) {
      ctx.scale(e.dir * (1 + squash), 1 - squash); ctx.rotate(lean * 0.6);
      if (pose === 'windup') ctx.scale(0.94, 1.06);
      ctx.drawImage(px.img, -px.w * PIX / 2, -px.footY * PIX, px.w * PIX, px.h * PIX);
      if (e.flash > 0 || (pose === 'dead' && e.timer < 0.15)) { ctx.globalAlpha = a * 0.85; ctx.drawImage(px.white, -px.w * PIX / 2, -px.footY * PIX, px.w * PIX, px.h * PIX); }
      if (e.stun > 0) { ctx.globalAlpha = 0.35; ctx.drawImage(px.white, -px.w * PIX / 2, -px.footY * PIX, px.w * PIX, px.h * PIX); }
    } else {
      ctx.scale(e.dir * sz, sz); ctx.rotate(lean);
      drawUnit(ctx, e.key, { size: d.size, flash: e.flash > 0, t: this.time + e.id * 0.37, pose });
    }
    ctx.restore();

    // 魔法使いの火球の溜め：攻撃の準備のあいだ頭上で膨らみ、最後に小さく脈打つ（攻撃が止まれば消える）
    const mf = SKIN.mageFire;
    if (mf && mf.keys.includes(e.key) && e.state === 'attack' && e.timer < d.windup && e.stun <= 0) {
      const img = getImage(mf.charge.src);
      if (img) {
        const q = e.timer / d.windup;
        const grow = q < 0.75 ? 0.25 + 0.75 * (q / 0.75) : 1 + Math.sin((q - 0.75) / 0.25 * Math.PI * 2) * 0.08;
        const k = mf.charge.w * grow / img.naturalWidth;
        const cx = x + e.dir * 10; const cy = this.headY(e, sh, float);
        ctx.drawImage(img, cx - mf.charge.ax * k, cy - mf.charge.ay * k, img.naturalWidth * k, img.naturalHeight * k);
        ctx.fillStyle = `rgba(200,120,255,${0.35 * (1 - q)})`; ctx.beginPath(); ctx.arc(x - e.dir * 14, y - sh * 0.75, 7, 0, Math.PI * 2); ctx.fill(); // 杖の宝玉の紫の光
      }
    }
    const top = y - sh - float - 8;
    // 気絶：頭の上で星が回る
    if (e.stun > 0 && e.state !== 'dead') {
      ctx.fillStyle = '#fff59a';
      for (let i = 0; i < 3; i++) { const t = this.time * 6 + i * 2.1; ctx.fillRect(x + Math.cos(t) * 12 - 2, top + 2 + Math.sin(t) * 3 - 2, 4, 4); }
    }
    // HPが減っているときだけ小さなバー（勇者は大きく）
    if (e.state !== 'dead' && (e.hp < e.maxHp || d.hero)) {
      const w = d.hero ? 64 : Math.max(20, Math.min(34, sw * 0.6));
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
      let p = f.age / f.life;
      if ((f.kind === 'banner') !== screen) continue;
      if (this.approvedFx(ctx, f, p)) continue; // 承認済みのエフェクト画像があれば、そちらで描く
      switch (f.kind) {
        case 'fireball': { // 先端（基準点）を軌道上に置き、尾は進む向きの反対へ
          const d = SKIN.mageFire.shot; const img = getImage(d.src); if (!img) break;
          const x = f.from + (f.to - f.from) * p; const y = f.fromY + (f.toY - f.fromY) * p;
          const k = d.w / img.naturalWidth;
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(f.toY - f.fromY, f.to - f.from) - d.angle);
          ctx.drawImage(img, -d.ax * k, -d.ay * k, img.naturalWidth * k, img.naturalHeight * k); ctx.restore();
          break;
        }
        case 'mThrow': { // ゆるい弧＋約1回転。同じ絵を薄く短く重ねて残像
          const d = SKIN.malletThrow.shot; const img = getImage(d.src); if (!img) break;
          const lift = f.lift || d.lift;
          const pos = (u) => [f.sx + (f.ex - f.sx) * u, f.sy + (f.ey - f.sy) * u - 4 * lift * u * (1 - u)];
          const k = d.w / img.naturalWidth;
          for (const [lag, al] of [[0.1, 0.18], [0.05, 0.32], [0, 1]]) {
            const u = Math.max(0, p - lag); const [x, y] = pos(u);
            ctx.save(); ctx.globalAlpha = al; ctx.translate(x, y); ctx.rotate(-u * Math.PI * 2); ctx.scale(k, k);
            ctx.drawImage(img, -d.ax, -d.ay); ctx.restore();
          }
          break;
        }
        case 'phx': { // ため（祠の上で小さく出て広がる）→ 飛翔（左下へ。尾の方向に短い残像）
          const S = SKIN.spellPhoenix;
          if (f.age < f.charge) {
            const img = getImage(S.charge.src); const q = f.age / f.charge;
            const k = S.charge.w * (0.35 + 0.65 * q) / img.naturalWidth;
            ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * q; ctx.translate(f.sx, f.sy); ctx.scale(k, k); ctx.drawImage(img, -S.charge.ax, -S.charge.ay); ctx.restore();
          } else {
            const img = getImage(S.flight.src); const q = (f.age - f.charge) / f.flight;
            const ease = q * q * (3 - 2 * q);
            const k = S.flight.w / img.naturalWidth;
            const ang = Math.atan2(f.ty - f.sy, f.tx - f.sx) - S.flight.angle;
            for (const [lag, al] of [[0.16, 0.2], [0.08, 0.4], [0, 1]]) {
              const u = Math.max(0, ease - lag);
              ctx.save(); ctx.globalAlpha = al; ctx.translate(f.sx + (f.tx - f.sx) * u, f.sy + (f.ty - f.sy) * u); ctx.rotate(ang); ctx.scale(k, k);
              ctx.drawImage(img, -S.flight.ax, -S.flight.ay); ctx.restore();
            }
          }
          break;
        }
        case 'phxRing': { // 着弾：炎の輪が横へ広がり、火の粉を残して消える
          const S = SKIN.spellPhoenix.impact; const img = getImage(S.src); if (!img) break;
          const k = f.w / img.naturalWidth; const sx = 0.55 + 0.55 * Math.min(1, p * 1.6); const sy = 0.75 + 0.25 * Math.min(1, p * 1.6);
          ctx.save(); ctx.globalAlpha = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45; ctx.translate(f.x, f.y); ctx.scale(k * sx, k * sy);
          ctx.drawImage(img, -S.ax, -S.ay); ctx.restore();
          break;
        }
        case 'ufx': { // ユニット別エフェクト（1コマ）。動きは anim で付ける
          if (f.delay && f.age < f.delay) break;
          const d = f.d; const img = getImage(d.src); if (!img) break;
          if (f.delay) p = (f.age - f.delay) / (f.life - f.delay);
          let sx = 1; let sy = 1; let dy = 0; let a = 1;
          if (d.anim === 'pop') { sx = sy = 0.7 + 0.45 * Math.min(1, p * 2); a = p < 0.5 ? 1 : 1 - (p - 0.5) * 2; }
          else if (d.anim === 'ground') { sx = 0.6 + 0.6 * p; sy = 0.6 + 0.3 * p; a = p < 0.5 ? 1 : 1 - (p - 0.5) * 2; }
          else if (d.anim === 'rise') { sx = sy = 0.85 + 0.2 * p; dy = -14 * p; a = 1 - p * p; }
          else if (d.anim === 'streak') { sx = sy = 0.9 + 0.2 * p; dy = 6 * p; a = 1 - p; }
          const k = d.w / img.naturalWidth;
          ctx.save(); ctx.globalAlpha = a; ctx.translate(f.x, f.y + dy); ctx.scale(f.flip * sx * k, sy * k);
          ctx.drawImage(img, -d.ax, -d.ay); ctx.restore();
          break;
        }
        case 'ufxShot': { // まっすぐ飛ぶ専用の弾（画像は左向き。進む向きに回す）
          const d = f.d; const img = getImage(d.src); if (!img) break;
          const x = f.from + (f.to - f.from) * p; const y = f.y + (f.ty - f.y) * p;
          const k = d.w / img.naturalWidth;
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(f.ty - f.y, f.to - f.from) - Math.PI); ctx.scale(k, k);
          ctx.drawImage(img, -d.ax, -d.ay); ctx.restore();
          break;
        }
        case 'gArrow': { // 放物線の矢：接線の向きに回す（画像は左向きなので −π）。直近だけ薄い黄緑の残光
          const d = SKIN.goblinArrow; const img = getImage(d.src); if (!img) break;
          const pos = (u) => [f.sx + (f.ex - f.sx) * u, f.sy + (f.ey - f.sy) * u - 4 * f.lift * u * (1 - u)];
          const [x, y] = pos(p);
          ctx.strokeStyle = d.glow; ctx.lineCap = 'round';
          for (let k = 1; k <= 3; k++) {
            const [ax, ay] = pos(Math.max(0, p - k * 0.05)); const [bx, by] = pos(Math.max(0, p - (k - 1) * 0.05));
            ctx.globalAlpha = 0.35 * (1 - k / 4); ctx.lineWidth = 3 - k * 0.6;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          }
          ctx.globalAlpha = 1;
          const dx = f.ex - f.sx; const dy = (f.ey - f.sy) - 4 * f.lift * (1 - 2 * p); // 接線
          const k = d.w / img.naturalWidth;
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(dy, dx) - Math.PI);
          ctx.drawImage(img, -d.ax * k, -d.ay * k, img.naturalWidth * k, img.naturalHeight * k); ctx.restore();
          break;
        }
        case 'gGlow': { // 弦を放つ瞬間の小さな光／着弾の小さな火花（黄緑）
          if (f.delay && f.age < f.delay) break;
          const q = f.delay ? (f.age - f.delay) / (f.life - f.delay) : p;
          ctx.globalAlpha = 1 - q; ctx.fillStyle = SKIN.goblinArrow.glow;
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.5 + q * 0.6), 0, Math.PI * 2); ctx.fill();
          if (f.spark) { ctx.strokeStyle = '#efffc0'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * 4, f.y + Math.sin(a) * 4); ctx.lineTo(f.x + Math.cos(a) * (6 + q * 10), f.y + Math.sin(a) * (6 + q * 10)); ctx.stroke(); } }
          ctx.globalAlpha = 1; break;
        }
        case 'fireRing': { // 低い炎の輪：横に広がりながら消える（敵を覆う高さにはしない）
          if (f.age < f.delay) break;
          const d = SKIN.mageFire.impact; const img = getImage(d.src); if (!img) break;
          const q = (f.age - f.delay) / (f.life - f.delay);
          const sx = (0.55 + 0.6 * q) * d.w / img.naturalWidth; const sy = (0.7 + 0.25 * q) * d.w / img.naturalWidth;
          ctx.globalAlpha = q < 0.6 ? 1 : 1 - (q - 0.6) / 0.4;
          ctx.drawImage(img, f.x - d.ax * sx, f.y - d.ay * sy, img.naturalWidth * sx, img.naturalHeight * sy);
          ctx.globalAlpha = 1; break;
        }
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
          if (f.shot === 'hammer') { // 投げた木槌（仮の絵）：回りながら山なりに飛ぶ
            const hy = f.y - Math.sin(p * Math.PI) * 46;
            ctx.save(); ctx.translate(x, hy); ctx.rotate(p * Math.PI * 4 * Math.sign(f.to - f.from));
            ctx.fillStyle = '#7a4a22'; ctx.fillRect(-2, -2, 16, 4);
            ctx.fillStyle = '#a8703a'; ctx.fillRect(-10, -8, 12, 16);
            ctx.fillStyle = '#5a5a66'; ctx.fillRect(-10, -6, 12, 2); ctx.fillRect(-10, 4, 12, 2);
            ctx.restore();
          } else if (f.shot === 'arrow') {
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
        case 'motes': {
          ctx.fillStyle = f.color; ctx.globalAlpha = 1 - p;
          for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.3; const r = 6 + p * 26; ctx.fillRect(f.x + Math.cos(a) * r - 2, f.y + Math.sin(a) * r * 0.6 - p * 18 - 2, 4, 4); }
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
          const spx = unitSprite(e.key); const y = GROUND_Y + e.lane * LANE_DEPTH - (spx ? spx.h * PIX : 62 * e.def.size * UNIT_SCALE) - (FLOATING[e.key] || 0) * PIX - 30;
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

  // ---------- 承認済みのエフェクト画像（SKIN.fx）。無ければ false を返し、仮の演出を描く ----------
  // ユニットの足元から頭までの高さ
  headDrop(e) { const apr = spriteFor(e.key); const px = unitSprite(e.key); return apr ? apr.footY * apr.scale : px ? px.h * PIX : 60; }
  // ユニットの頭上の高さ（火球の溜め・発射の位置）
  headY(e, sh, float = 0) {
    if (sh == null) { const apr = spriteFor(e.key); const px = unitSprite(e.key); sh = apr ? apr.footY * apr.scale : px ? px.h * PIX : 60; }
    return GROUND_Y + e.lane * LANE_DEPTH - sh - float - 12;
  }

  fxImage(name) {
    const def = SKIN.fx && SKIN.fx[name];
    const img = def && getImage(def.src);
    return img ? { def, img } : null;
  }

  // 中心 (cx, cy)、大きさ w×h で、進み具合 p（0〜1）のコマを描く
  drawFxFrame(ctx, fx, p, cx, cy, w, h, flip = 1, alpha = 1) {
    const { def, img } = fx;
    const i = Math.min(def.frames - 1, Math.floor(p * def.frames));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy); ctx.scale(flip, 1);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, i * def.frameW, 0, def.frameW, def.frameH, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  approvedFx(ctx, f, p) {
    const sized = (fx, h) => [h * fx.def.frameW / fx.def.frameH, h];
    let fx;
    switch (f.kind) {
      case 'spark': if ((fx = this.fxImage('hit'))) { this.drawFxFrame(ctx, fx, p, f.x, f.y, 56, 56); return true; } return false;
      case 'slash': if ((fx = this.fxImage('slash'))) { this.drawFxFrame(ctx, fx, p, f.x, f.y, f.area ? 96 : 72, f.area ? 96 : 72, f.dir < 0 ? -1 : 1); return true; } return false;
      case 'puff': if ((fx = this.fxImage(f.side === 'demon' ? 'defeat_demon' : 'defeat_human'))) { this.drawFxFrame(ctx, fx, p, f.x, f.y - 10, 88, 88); return true; } return false;
      case 'ghost': case 'motes': case 'stars': return !!this.fxImage(f.side === 'demon' ? 'defeat_demon' : 'defeat_human'); // 撃破の画像があれば、仮の粒は出さない
      case 'spell': if ((fx = this.fxImage('spell'))) { const [w, h] = sized(fx, 440); this.drawFxFrame(ctx, fx, p, f.x, GROUND_Y + 20 - h / 2, Math.max(w, f.r * 2.2), h); return true; } return false;
      case 'boom': if ((fx = this.fxImage('big_magic'))) { this.drawFxFrame(ctx, fx, p, f.x, f.y - 30, f.r * 2.4, f.r * 2.4); return true; } return false;
      case 'fizzle': if ((fx = this.fxImage('fizzle'))) { this.drawFxFrame(ctx, fx, p, f.x, f.y + 10, 64, 64); return true; } return false;
      case 'wave': if ((fx = this.fxImage('wave'))) { const [w, h] = sized(fx, 100); this.drawFxFrame(ctx, fx, p, f.x + f.dir * f.reach * p, GROUND_Y - 30, w, h, f.dir < 0 ? -1 : 1); return true; } return false;
      case 'lightBurst': if ((fx = this.fxImage('stun'))) { this.drawFxFrame(ctx, fx, p, f.x + f.dir * f.reach / 2, GROUND_Y - 40, f.reach, f.reach, f.dir < 0 ? -1 : 1); return true; } return false;
      case 'ring': if (f.heal && (fx = this.fxImage('heal'))) { const w = (f.w || 160) * 1.6; this.drawFxFrame(ctx, fx, p, f.x, f.y - w * 0.2, w, w * fx.def.frameH / fx.def.frameW); return true; } return false;
      default: return false;
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
  static thumb(canvas, key, size, pose = 'idle', face = -1) {
    const c = canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.imageSmoothingEnabled = false;
    const sp = spriteFor(key);
    const px = unitSprite(key);
    if (!sp) whenSpriteReady(key, () => Renderer.thumb(canvas, key, size, pose, face)); // 承認済みの絵が届いたら描き直す
    if (sp) { // 承認済みの絵：歩きAのコマを、枠に収まる大きさで（向きは素材のまま＝魔王軍は左・人間軍は右）
      c.imageSmoothingEnabled = true;
      const k = Math.min((canvas.width - 4) / sp.frameW, (canvas.height - 2) / sp.footY);
      c.translate(canvas.width / 2, canvas.height - 2);
      c.drawImage(sp.img, sp.frames.walk[0] * sp.frameW, 0, sp.frameW, sp.frameH, -sp.frameW * k / 2, -sp.footY * k, sp.frameW * k, sp.frameH * k);
      return;
    }
    if (!sp && px) {
      // ドット絵：枠に収まる最大の整数倍で、足元をそろえて描く（魔物は左向き）
      const k = Math.max(1, Math.floor(Math.min((canvas.width - 4) / px.w, (canvas.height - 4) / px.h)));
      c.translate(Math.round(canvas.width / 2), canvas.height - 2);
      c.scale(face, 1);
      c.drawImage(px.img, -Math.round(px.w * k / 2), -px.h * k, px.w * k, px.h * k);
      return;
    }
    const s = canvas.height / 72;
    c.translate(canvas.width / 2, canvas.height - 6 * s);
    const k = Math.min(1.2, 1 / Math.max(0.8, size)) * s;
    c.scale(face * k, k);
    if (sp) { c.scale((sp.facing === 'left' ? -1 : 1) * (sp.scale || 0.5), sp.scale || 0.5); c.drawImage(sp.img, sp.frames.walk[0] * sp.frameW, 0, sp.frameW, sp.frameH, -sp.frameW / 2, -sp.footY, sp.frameW, sp.frameH); return; }
    drawUnit(c, key, { size, flash: false, t: 0.3, pose });
  }

}
