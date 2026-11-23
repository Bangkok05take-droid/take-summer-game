/* 戦闘以外の画面：ステージ選択・会話・戦利品・ユニット解放・強化 */
import { SKIN } from '../data/skin.js';
import { STAGES, CHAPTER1 } from '../data/stages.js';
import { UNITS, BOSSES, UNIT_ORDER } from '../data/units.js';
import { LOOT } from '../data/story.js';
import { UPGRADES, unitLevelCost, MAX_UNIT_LEVEL, resolveUnit, isStageOpen, nextStage, lordLevel } from '../data/progress.js';
import { Renderer } from '../render/renderer.js';
import { drawPortrait, drawUnit } from '../render/shapes.js';

const $ = (id) => document.getElementById(id);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------- ステージ選択 ----------
// 地図の上の位置（%）：左下の見張り小屋から、右上の村の広場へ
const NODE_POS = { '1-1': [12, 70], '1-2': [32, 38], '1-3': [52, 68], '1-4': [70, 36], '1-5': [88, 62] };

export function renderSelect(p, onPick) {
  $('selStones').textContent = p.stones;
  $('selLord').textContent = lordLevel(p);
  $('selLoot').textContent = p.loot.length;
  const map = $('stageMap');
  map.innerHTML = '';
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  const ids = CHAPTER1.stages;
  for (let i = 0; i < ids.length - 1; i++) {
    const [x1, y1] = NODE_POS[ids[i]]; const [x2, y2] = NODE_POS[ids[i + 1]];
    const line = document.createElementNS(ns, 'line');
    Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => line.setAttribute(k, v));
    const done = p.stages[ids[i]] && p.stages[ids[i]].cleared;
    line.setAttribute('stroke', done ? '#c084fc' : 'rgba(255,255,255,.25)');
    line.setAttribute('stroke-width', '0.8'); line.setAttribute('stroke-dasharray', done ? '0' : '2 1.5');
    line.setAttribute('vector-effect', 'non-scaling-stroke'); line.style.strokeWidth = '4px';
    svg.appendChild(line);
  }
  map.appendChild(svg);
  const next = nextStage(p);
  for (const id of ids) {
    const st = STAGES[id];
    const rec = p.stages[id];
    const open = isStageOpen(p, id);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'node' + (rec && rec.cleared ? ' cleared' : '') + (id === next ? ' next' : '') + (open ? '' : ' locked') + (st.boss ? ' boss' : '');
    b.dataset.stage = id;
    const [x, y] = NODE_POS[id];
    b.style.left = x + '%'; b.style.top = y + '%';
    const status = rec && rec.cleared ? `制圧ずみ　最速 ${fmtTime(rec.bestTime)}` : id === next ? 'つぎの侵略先' : '未解放';
    b.innerHTML = `<span class="id">${id}</span><span class="nm">${st.name}</span><span class="st">${status}</span>`;
    b.disabled = !open;
    b.setAttribute('aria-label', `${id} ${st.name}（${status}）`);
    b.addEventListener('click', () => onPick(id));
    map.appendChild(b);
  }
}

// ---------- 会話 ----------
const SIDE = { lord: 'left', aide: 'right', take: 'right', sai: 'right', tiw: 'left', mot: 'left', waan: 'left', koi: 'left', yanai: 'left' };
const HUMAN_SPEAKERS = ['take', 'sai', 'tiw', 'mot', 'waan', 'koi', 'yanai'];

export class TalkPlayer {
  constructor() {
    this.lines = []; this.i = 0; this.done = null;
    $('scTalk').addEventListener('click', (ev) => { if (ev.target.id !== 'btnSkip') this.next(); });
    $('btnSkip').addEventListener('click', (ev) => { ev.stopPropagation(); this.finish(); });
  }
  get active() { return !$('scTalk').hidden; }
  play(lines, bg, done) {
    if (!lines || !lines.length) { done(); return; }
    this.lines = lines; this.i = 0; this.done = done;
    this.shown = { left: null, right: null };
    $('talkBg').className = 'talkBg ' + (bg || 'field');
    for (const id of ['ptLeft', 'ptRight']) { const c = $(id); c.getContext('2d').clearRect(0, 0, c.width, c.height); c.hidden = true; }
    $('scTalk').hidden = false;
    this.show();
  }
  show() {
    const l = this.lines[this.i];
    const who = SKIN.speakers[l.who] ?? l.who;
    const box = $('talkBox');
    box.classList.toggle('narr', l.who === 'narr');
    $('talkWho').textContent = who;
    $('talkWho').classList.toggle('human', HUMAN_SPEAKERS.includes(l.who));
    $('talkText').textContent = l.text;
    if (l.who !== 'narr') {
      const side = SIDE[l.who] || 'left';
      const c = side === 'left' ? $('ptLeft') : $('ptRight');
      const key = l.who + ':' + (l.face || 'normal');
      if (this.shown[side] !== key) {
        const img = SKIN.portraits[l.who];
        drawPortrait(c.getContext('2d'), l.who, l.face, c.width, c.height);
        if (img) { /* 顔絵の素材が届いたら、ここで画像を描く（docs/ART_SPEC.md） */ }
        this.shown[side] = key;
      }
      c.hidden = false;
      $('ptLeft').classList.toggle('dim', side !== 'left');
      $('ptRight').classList.toggle('dim', side !== 'right');
    }
  }
  next() {
    if (!this.active) return;
    this.i++;
    if (this.i >= this.lines.length) this.finish(); else this.show();
  }
  finish() {
    if (!this.active) return;
    $('scTalk').hidden = true;
    const d = this.done; this.done = null;
    if (d) d();
  }
}

// ---------- 戦利品 ----------
export function renderLoot(stageId, res, firstClear) {
  const loot = LOOT[stageId];
  const c = $('lootIcon').getContext('2d');
  c.clearRect(0, 0, 96, 96);
  // 巻いた古い地図（仮の絵）
  c.fillStyle = '#e8d4a0'; c.strokeStyle = '#7a5a2a'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(14, 22); c.lineTo(82, 16); c.lineTo(86, 76); c.lineTo(16, 82); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#b0452a'; c.lineWidth = 2; c.setLineDash([4, 3]);
  c.beginPath(); c.moveTo(26, 66); c.quadraticCurveTo(44, 30, 70, 40); c.stroke(); c.setLineDash([]);
  c.strokeStyle = '#b0452a'; c.lineWidth = 3; c.beginPath(); c.moveTo(64, 34); c.lineTo(76, 46); c.moveTo(76, 34); c.lineTo(64, 46); c.stroke();
  $('lootName').textContent = firstClear ? loot.name : '戦利品の魔界石';
  $('lootDesc').textContent = firstClear ? loot.desc : 'すでに制圧した場所から、魔界石を回収した。';
  const gains = [`魔界石 <b>+${res.stones}</b>`];
  if (firstClear) gains.push('封印がゆるみ、大魔王の魔力が戻った：最大魔力 <b>+60</b>・魔力回復 <b>+1.5/秒</b>');
  if (res.unlocked) gains.push(`新しい魔物：<b>${SKIN.names[res.unlocked]}</b>`);
  $('lootGains').innerHTML = gains.map((g) => `<li>${g}</li>`).join('');
}

// ---------- ユニット解放 ----------
export function renderUnlock(key) {
  const def = UNITS[key] || BOSSES[key];
  const boss = !!BOSSES[key];
  $('unlockEyebrow').textContent = boss ? '幹部を呼び戻せるようになった！' : '新しい魔物が仲間になった！';
  $('unlockName').textContent = SKIN.names[key];
  $('unlockRole').textContent = boss ? `${def.role}（第2章から召喚できます。同じ幹部は同時に1体まで）` : def.role;
  Renderer.thumb($('unlockArt'), key, def.size);
  const rows = [['魔力', def.cost], ['HP', def.hp], ['攻撃', def.atk], ['射程', def.range], ['再召喚', def.cooldown + '秒']];
  $('unlockStats').innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}

// ---------- 強化 ----------
export function renderUpgrade(p, onUnit, onGlobal) {
  $('upStones').textContent = p.stones;
  const ul = $('upUnits'); ul.innerHTML = '';
  for (const k of UNIT_ORDER) {
    const u = p.units[k];
    const li = document.createElement('li');
    const cv = document.createElement('canvas'); cv.width = 88; cv.height = 74;
    const info = document.createElement('div');
    const btn = document.createElement('button'); btn.type = 'button'; btn.dataset.unit = k;
    if (!u.unlocked) {
      li.className = 'locked';
      info.innerHTML = `<div class="nm">？？？</div><div class="ds">${UNITS[k].role}（ステージをクリアで解放）</div>`;
      btn.textContent = '未解放'; btn.disabled = true;
    } else {
      const now = resolveUnit(k, p);
      const max = u.level >= MAX_UNIT_LEVEL;
      const cost = unitLevelCost(u.level);
      info.innerHTML = `<div class="nm">${SKIN.names[k]}　Lv${u.level}</div><div class="ds">HP ${now.hp}・攻撃 ${now.atk}${max ? '' : `　→ 次 HP ${Math.round(UNITS[k].hp * (1 + UNITS[k].growth.hp * u.level))}`}</div>`;
      btn.textContent = max ? 'MAX' : `Lv上げ ${cost}`;
      btn.disabled = max || p.stones < cost;
      btn.addEventListener('click', () => onUnit(k));
    }
    li.append(cv, info, btn);
    ul.appendChild(li);
    Renderer.thumb(cv, k, UNITS[k].size);
    if (!u.unlocked) { const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = '#1a1030'; c.fillRect(0, 0, cv.width, cv.height); }
  }
  const gl = $('upGlobal'); gl.innerHTML = '';
  for (const [id, def] of Object.entries(UPGRADES)) {
    const lv = p.upgrades[id] || 0;
    const li = document.createElement('li'); li.className = 'noicon';
    const max = lv >= def.max;
    const cost = def.cost(lv);
    li.innerHTML = `<div><div class="nm">${def.name}　Lv${lv}</div><div class="ds">${def.desc}（最大 Lv${def.max}）</div></div>`;
    const btn = document.createElement('button'); btn.type = 'button'; btn.dataset.up = id;
    btn.textContent = max ? 'MAX' : `強化 ${cost}`;
    btn.disabled = max || p.stones < cost;
    btn.addEventListener('click', () => onGlobal(id));
    li.appendChild(btn);
    gl.appendChild(li);
  }
  const lord = document.createElement('li'); lord.className = 'noicon';
  lord.innerHTML = `<div><div class="nm">大魔王の魔力　Lv${lordLevel(p)}</div><div class="ds">ステージを初めて制圧するたびに、最大魔力 +60・回復 +1.5/秒</div></div><span></span>`;
  gl.appendChild(lord);
}
