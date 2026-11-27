/* 戦闘以外の画面：ステージ選択・会話・戦利品・ユニット解放・強化 */
import { SKIN } from '../data/skin.js';
import { STAGES, CHAPTER1, CHAPTERS, CHAPTER_EX } from '../data/stages.js';
import { UNITS, BOSSES, UNIT_ORDER, BOSS_ORDER, ATTACK_TYPES, EVOLUTIONS, ALL_DEMONS } from '../data/units.js';
import { HUMANS } from '../data/humans.js';
import { enemiesOf, reconLine } from '../data/recon.js';
import {
  UPGRADES, UPGRADE_GROUPS, unitLevelCost, levelCostFor, MAX_UNIT_LEVEL, resolveUnit, isStageOpen, nextStage, lordLevel,
  slotsFor, slotUnlockLv, normalizeFormation, canForm, MAX_UNIT_SLOTS, MAX_BOSS_SLOTS, SLOTS,
  crystalDone, evolutionChoices, evolveTierCap, EVOLVE_NEED, branchSwitchTarget, BRANCH_SWITCH_COST,
} from '../data/progress.js';
import { Renderer } from '../render/renderer.js';
import { drawPortrait } from '../render/shapes.js';
import { getImage, preload } from '../render/images.js';

const $ = (id) => document.getElementById(id);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------- ステージ選択 ----------
// 地図の上の位置（%）：左下の見張り小屋から、右上の村の広場へ
// 地図の上の位置（%）。章ごとに3つ
const NODE_POS = { '1-1': [18, 66], '1-2': [50, 36], '1-3': [82, 62], '2-1': [18, 40], '2-2': [50, 66], '2-3': [82, 40], '3-1': [18, 66], '3-2': [50, 38], '3-3': [82, 62], 'ex-1': [50, 55], '4-1': [18, 40], '4-2': [50, 66], '4-3': [82, 40], '5-1': [14, 66], '5-2': [38, 36], '5-3': [62, 66], '5-4': [86, 36], '6-1': [18, 62], '6-2': [50, 38], '6-3': [82, 62], '7-1': [28, 55], '7-2': [72, 45], '8-1': [14, 66], '8-2': [38, 36], '8-3': [62, 66], '8-4': [86, 36], '9-1': [14, 66], '9-2': [38, 36], '9-3': [62, 66], '9-4': [86, 36], '10-1': [12, 62], '10-2': [31, 36], '10-3': [50, 62], '10-4': [69, 36], '10-5': [88, 58] };

// ch：表示する章（CHAPTERS の1つ）。onChapter(ch)：章のタブを押したとき
export function renderSelect(p, onPick, ch = CHAPTER1, onChapter = null) {
  $('selChap').textContent = ch.special ? '特別' : `第${ch.id}章`;
  $('selChapName').textContent = ch.name;
  const tabs = $('chapTabs'); tabs.innerHTML = '';
  // 「特別」（壊滅した町）はイベントのあとだけ出す
  const ruinDone = !!(p.events && p.events.ruin && p.events.ruin.done);
  for (const c of ruinDone ? [...CHAPTERS, CHAPTER_EX] : CHAPTERS) {
    const t = document.createElement('button'); t.type = 'button'; t.className = 'chapTab' + (c === ch ? ' on' : '') + (c.special ? ' special' : ''); t.dataset.chapter = c.id;
    const open = c.special || isStageOpen(p, c.stages[0]);
    t.textContent = c.special ? '特別' : open ? `第${c.id}章` : `第${c.id}章 🔒`; t.disabled = !open;
    if (onChapter) t.addEventListener('click', () => onChapter(c));
    tabs.appendChild(t);
  }
  $('selStones').textContent = p.stones;
  $('selLord').textContent = lordLevel(p);
  const map = $('stageMap');
  map.innerHTML = '';
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  const ids = ch.stages;
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
    const ruin = p.events && p.events.ruin;
    const status = id === 'ex-1' ? (ruin && ruin.recruited ? 'オルド加入ずみ' : '再戦できる') : rec && rec.cleared ? `制圧ずみ　最速 ${fmtTime(rec.bestTime)}` : id === next ? 'つぎの侵略先' : '未解放';
    b.innerHTML = `<span class="id">${id === 'ex-1' ? '特別' : id}</span><span class="nm">${st.name}</span><span class="st">${status}</span>`;
    b.disabled = !open;
    b.setAttribute('aria-label', `${id} ${st.name}（${status}）`);
    b.addEventListener('click', () => onPick(id));
    map.appendChild(b);
  }
}

// ---------- 会話 ----------
// 大魔王は左、ほかは右（2026-11-25：人間の話し手も右に。右向きの絵は左右反転して大魔王のほうを向かせる）
const SIDE = { ord: 'right', lord: 'left', aide: 'right' };
const HUMAN_SPEAKERS = ['take', 'sai', 'tiw', 'mot', 'waan', 'koi', 'yanai', '門番', '商人', '警備隊長', '王国兵', '王国騎士', '国王', '港の警備兵', '港の守備隊長', '海兵', '兵器技師', '人間軍兵士', '人間軍技師', '重装兵団長', '要塞司令官', '古代王', '聖騎士', '聖騎士団長', '自警団', '自警団長', '守備兵', '王国軍', '人間軍魔法使い', '魔導士団長', '大魔導士', '人間軍指揮官', '王国軍指揮官', '人間軍総司令官', '天空の守護兵', '天空の指揮官', '聖竜', '天空の守護者', 'マスター・ヤナイ', 'たけ', 'サイ'];

export class TalkPlayer {
  constructor() {
    preload(Object.values(SKIN.portraits));
    preload(Object.entries(SKIN.ui || {}).filter(([k]) => k.startsWith('loot_')).map(([, v]) => v));
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
    const img = SKIN.images.talkBg[bg || 'field'];
    $('talkBg').style.backgroundImage = img ? `url("${img}")` : '';
    $('talkBg').style.backgroundSize = img ? 'cover' : '';
    $('talkBg').style.backgroundPosition = img ? 'center' : '';
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
    // 演出（台詞は変えない）：absorb＝発光と魔力の放出／quake＝画面の振動
    { const sc = $('scTalk'); sc.classList.remove('fx-absorb', 'fx-quake'); if (l.fx) { void sc.offsetWidth; sc.classList.add('fx-' + l.fx); } }
    if (l.revive) this.revived = true;
    if (l.who !== 'narr') {
      const side = SIDE[l.who] || (HUMAN_SPEAKERS.includes(l.who) ? 'right' : 'left');
      const c = side === 'left' ? $('ptLeft') : $('ptRight');
      // 完全復活（エンディング）：revive の付いた行から、大魔王の顔を復活後の絵に（this.revived は TalkPlayer の外から戻す）
      const revived = l.who === 'lord' && this.revived && SKIN.portraits.lord_revived;
      const key = l.who + ':' + (revived ? 'revived' : (l.face || 'normal'));
      if (this.shown[side] !== key) {
        const src = revived ? SKIN.portraits.lord_revived : SKIN.portraits[`${l.who}_${l.face || 'normal'}`] || SKIN.portraits[`${l.who}_normal`] || SKIN.portraits[l.who];
        const img = getImage(src);
        const g = c.getContext('2d');
        const flip = side === 'right' && HUMAN_SPEAKERS.includes(l.who); // 右向きの絵を右側に置くときは反転して内側を向かせる
        if (img) { g.clearRect(0, 0, c.width, c.height); g.save(); if (flip) { g.translate(c.width, 0); g.scale(-1, 1); } g.drawImage(img, 0, 0, c.width, c.height); g.restore(); this.shown[side] = key; }
        else { drawPortrait(g, l.who, l.face, c.width, c.height); this.shown[side] = src ? null : key; } // 読み込み中なら次の行で描き直す
      }
      c.hidden = false;
      // 表情（仮）：その表情の立ち絵が無いときは、通常の絵のまま動きと色で表す（絵は変えない）
      const face = l.face || 'normal';
      const hasFace = !!SKIN.portraits[`${l.who}_${face}`] || !!revived; // 復活後は表情の動きを付けない
      c.classList.remove('face-angry', 'face-happy', 'face-sad');
      if (face !== 'normal' && !hasFace) { void c.offsetWidth; c.classList.add('face-' + face); }
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
// 戦闘結果の報酬（2026-11-27：戦利品の画面を廃止して結果画面に統合）。魔界石を大きく、起きたことだけを目立つように
export function renderRewards(stageId, res, win, p) {
  $('resStones').innerHTML = `<span>獲得した魔界石</span><b>+${res.stones}</b>`;
  const g = [];
  if (win && res.firstClear) g.push(['mana', '大魔王の魔力が戻った', '最大魔力 +60・魔力回復 +1.5/秒']);
  if (res.slotsUp) g.push(['slot', '支配力が戻った', `編成枠が 通常${res.slotsUp.units}＋幹部${res.slotsUp.bosses} に！`]);
  for (const u of res.unlockedAll || []) g.push(['ally', `新しい${BOSSES[u] ? '幹部' : '仲間'}`, SKIN.names[u] || u]);
  if (win && res.firstClear && stageId === '6-3') g.push(['evo', '進化の解放', '上位モンスター進化が解放される！']);
  if (win && res.firstClear && stageId === '8-4') g.push(['evo', '進化の解放', '最上位モンスター進化が解放される！']);
  $('resGains').innerHTML = g.map(([c, h, t]) => `<li class="gain-${c}"><b>${h}</b><span>${t}</span></li>`).join('');
  $('resGains').hidden = !g.length;
}

// ---------- ユニット解放 ----------
export function renderUnlock(key) {
  const def = UNITS[key] || BOSSES[key];
  const boss = !!BOSSES[key];
  $('unlockEyebrow').textContent = boss ? '幹部を呼び戻せるようになった！' : '新しい魔物が仲間になった！';
  $('unlockName').textContent = SKIN.names[key];
  const at = ATTACK_TYPES[def.attackType];
  const typeNote = def.target === 'backline' ? '敵の後衛（回復役・弓兵など）と拠点だけを狙う。前衛は狙わない' : '';
  $('unlockRole').textContent = boss ? `${def.role}（編成の幹部枠に入れて出撃。魔力炉Lv${def.needFurnace}以上で召喚できる切り札。戦場の幹部は1体まで）`
    : `${def.role}${at ? `・${at.name}` : ''}${typeNote ? `（${typeNote}）` : ''}`;
  Renderer.thumb($('unlockArt'), key, def.size);
  const rows = [['魔力', def.cost], ...(boss ? [['魔力炉', 'Lv' + def.needFurnace + '〜']] : []), ['HP', def.hp], ['攻撃', def.atk], ['射程', def.range], ['再召喚', def.cooldown + '秒']];
  $('unlockStats').innerHTML = rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}

// ---------- 強化 ----------
export function renderUpgrade(p, onUnit, onGlobal, onEvolve = null, onBranch) {
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
      const cost = levelCostFor(p, k);
      info.innerHTML = `<div class="nm">${SKIN.names[u.formKey || k] || SKIN.names[k]}　Lv${u.level}</div><div class="ds">HP ${now.hp}・攻撃 ${now.atk}${max ? '' : `　→ 次 HP ${Math.round((ALL_DEMONS[u.formKey] || UNITS[k]).hp * (1 + UNITS[k].growth.hp * u.level))}`}</div>`;
      // 上位進化（古代の魔力結晶のあと）：進化先ごとのボタン。進化先のデザインが届いていなければ「準備中」
      if (crystalDone(p)) {
        const ev = document.createElement('div'); ev.className = 'evo';
        const ch = evolutionChoices(p, k).filter((t) => EVOLUTIONS[t].tier <= evolveTierCap(p));
        if (!ch.length && now.tier < 3) ev.textContent = now.tier === 2 && evolveTierCap(p) < 3 ? '最終進化：8-4 のあとに解放' : '進化：進化先は準備中';
        // 最終進化ずみ：分岐の入れかえ（魔界石600・レベルはそのまま）
        const sw = branchSwitchTarget(p, k);
        if (sw) {
          const b3 = document.createElement('button'); b3.type = 'button'; b3.dataset.branch = sw;
          b3.textContent = `分岐を入れかえ：${SKIN.names[sw] || sw} ${BRANCH_SWITCH_COST}`; b3.disabled = p.stones < BRANCH_SWITCH_COST;
          if (onBranch) b3.addEventListener('click', () => onBranch(k));
          ev.appendChild(b3);
        }
        for (const t of ch) {
          const b2 = document.createElement('button'); b2.type = 'button'; b2.dataset.evolve = t;
          const cost = EVOLVE_NEED.stones(EVOLUTIONS[t].tier);
          const ready = EVOLUTIONS[t].ready !== false;
          b2.textContent = ready ? `進化：${SKIN.names[t] || t} ${cost}` : `進化：${SKIN.names[t] || t}（デザイン待ち）`;
          b2.disabled = !ready || u.level < EVOLVE_NEED.level || p.stones < cost;
          if (ready && u.level < EVOLVE_NEED.level) { b2.title = `Lv${EVOLVE_NEED.level}から`; b2.textContent += `（Lv${EVOLVE_NEED.level}から）`; }
          if (onEvolve) b2.addEventListener('click', () => onEvolve(k, t));
          ev.appendChild(b2);
        }
        info.appendChild(ev);
      }
      btn.textContent = max ? 'MAX' : `Lv上げ ${cost}`;
      btn.disabled = max || p.stones < cost;
      btn.addEventListener('click', () => onUnit(k));
    }
    li.append(cv, info, btn);
    ul.appendChild(li);
    Renderer.thumb(cv, u.formKey || k, UNITS[k].size);
    if (!u.unlocked) { const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = '#1a1030'; c.fillRect(0, 0, cv.width, cv.height); }
  }
  const gl = $('upGlobal'); gl.innerHTML = '';
  const head = (t) => { const h = document.createElement('li'); h.className = 'group'; h.textContent = t; gl.appendChild(h); };
  // 支配力：大魔王Lvで自動（編成枠）
  head('支配力（大魔王Lvで自動）');
  const sl = slotsFor(p); const nx = SLOTS.find((x) => x.lv > lordLevel(p));
  const dom = document.createElement('li'); dom.className = 'noicon';
  dom.innerHTML = `<div><div class="nm">大魔王　Lv${lordLevel(p)}</div><div class="ds">編成枠：通常${sl.units}＋幹部${sl.bosses}${nx ? `　→ Lv${nx.lv}で 通常${nx.units}＋幹部${nx.bosses}` : ''}</div></div><span></span>`;
  gl.appendChild(dom);
  for (const [g, title] of Object.entries(UPGRADE_GROUPS)) {
    head(title);
    if (g === 'mana') {
      const lord = document.createElement('li'); lord.className = 'noicon';
      lord.innerHTML = `<div><div class="nm">封印のほころび</div><div class="ds">ステージを初めて制圧するたびに、最大魔力 +60・回復 +1.5/秒</div></div><span></span>`;
      gl.appendChild(lord);
    }
    for (const [id, def] of Object.entries(UPGRADES)) {
      if (def.group !== g) continue;
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
  }
}

// ---------- 偵察報告・敵軍情報 ----------
function enemyCards(ul, stageId) {
  ul.innerHTML = '';
  for (const e of enemiesOf(stageId)) {
    const li = document.createElement('li');
    li.className = 'enemy' + (e.hero ? ' hero' : '') + (e.isNew ? ' new' : '');
    li.dataset.enemy = e.key;
    const cv = document.createElement('canvas'); cv.width = 96; cv.height = 80;
    const tx = document.createElement('div');
    tx.innerHTML = `<div class="nm"><b>${e.name}</b><small>${e.role}・${e.when}</small>${e.isNew ? '<em>NEW</em>' : ''}</div><div class="nt">${e.note}</div><div class="ct">対策：${e.counter}</div>`;
    li.append(cv, tx);
    ul.appendChild(li);
    Renderer.thumb(cv, e.key, HUMANS[e.key].size, 'idle', 1);
  }
}
export function renderRecon(stageId) {
  const st = STAGES[stageId];
  $('reconTitle').textContent = `${st.id}　${st.name}`;
  $('reconWho').textContent = SKIN.speakers.aide;
  $('reconText').textContent = reconLine(stageId);
  const c = $('reconFace'); const g = c.getContext('2d');
  const img = getImage(SKIN.portraits.aide_normal || SKIN.portraits.aide);
  g.clearRect(0, 0, c.width, c.height);
  if (img) g.drawImage(img, 0, 0, c.width, c.height); else drawPortrait(g, 'aide', 'normal', c.width, c.height);
  enemyCards($('reconEnemies'), stageId);
}
export function renderEnemyInfo(stageId) {
  $('ovEnemyTitle').textContent = `敵軍情報　${stageId}　${STAGES[stageId].name}`;
  enemyCards($('ovEnemyList'), stageId);
}

// ---------- 編成 ----------
// onToggle(key)：控え・編成の魔物をタップしたとき
export function renderFormation(p, stageId, onToggle) {
  const st = STAGES[stageId];
  const f = normalizeFormation(p); const sl = slotsFor(p);
  $('formTitle').textContent = `${st.id}　${st.name}`;
  $('formLord').textContent = lordLevel(p);
  $('formUnitCount').textContent = `${f.units.length}/${sl.units}`;
  $('formBossCount').textContent = `${f.bosses.length}/${sl.bosses}`;
  const card = (key, cls) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fcard ' + cls; b.dataset.key = key;
    const d = resolveUnit(key, p); const boss = !!BOSSES[key];
    const cv = document.createElement('canvas'); cv.width = 112; cv.height = 92;
    b.innerHTML = '';
    b.append(cv);
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = SKIN.names[d.skin || key] || key;
    const cs = document.createElement('span'); cs.className = 'cs'; cs.textContent = d.cost;
    b.append(nm, cs);
    if (boss) { const fl = document.createElement('span'); fl.className = 'fl'; fl.textContent = `炉Lv${d.needFurnace}`; b.append(fl); }
    const at = ATTACK_TYPES[d.attackType];
    if (at) { const t = document.createElement('span'); t.className = 'at at-' + d.attackType; t.textContent = at.short; t.title = at.name; b.append(t); }
    b.setAttribute('aria-label', `${SKIN.names[d.skin || key]}（${at ? at.name + '・' : ''}魔力${d.cost}${boss ? `・魔力炉Lv${d.needFurnace}以上` : ''}）`);
    b.addEventListener('click', () => onToggle(key));
    Renderer.thumb(cv, d.skin || key, d.size);
    return b;
  };
  const slots = (wrap, list, max, total, kind) => {
    wrap.innerHTML = '';
    for (let i = 0; i < total; i++) {
      if (i < list.length) { wrap.appendChild(card(list[i], 'in')); continue; }
      const e = document.createElement('div');
      if (i < max) { e.className = 'fslot empty'; e.textContent = '空き'; }
      else { e.className = 'fslot locked'; e.innerHTML = `<span class="lock" aria-hidden="true">🔒</span><span>大魔王Lv${slotUnlockLv(kind, i)}で解放</span>`; }
      wrap.appendChild(e);
    }
  };
  slots($('formUnits'), f.units, sl.units, MAX_UNIT_SLOTS, 'units');
  slots($('formBosses'), f.bosses, sl.bosses, MAX_BOSS_SLOTS, 'bosses');
  const pool = $('formPool'); pool.innerHTML = '';
  const bench = [...UNIT_ORDER, ...BOSS_ORDER].filter((k) => canForm(p, k) && !f.units.includes(k) && !f.bosses.includes(k));
  for (const k of bench) pool.appendChild(card(k, 'out' + (BOSSES[k] ? ' boss' : '')));
  if (!bench.length) { const e = document.createElement('p'); e.className = 'poolEmpty'; e.textContent = '控えの魔物はいません（新しい魔物はステージをクリアすると仲間になります）'; pool.appendChild(e); }
  $('btnSortie').disabled = f.units.length === 0;
}

// 進化の確認（2026-11-25）：レベルが1に戻ることと、進化の前後の能力を見せる
export function renderEvolveConfirm(p, key, toKey) {
  const now = resolveUnit(key, p);
  const after = resolveUnit(key, { ...p, units: { ...p.units, [key]: { ...p.units[key], formKey: toKey, form: EVOLUTIONS[toKey].tier - 1, level: Math.max(1, p.units[key].level - (EVOLVE_NEED.level - 1)) } } });
  $('evoTitle').textContent = `${SKIN.names[now.skin] || key} → ${SKIN.names[toKey] || toKey}`;
  $('evoTable').innerHTML = [['レベル', `Lv${now.level}`, `Lv${after.level}`], ['HP', now.hp, after.hp], ['攻撃', now.atk, after.atk], ['召喚の魔力', now.cost, after.cost]]
    .map(([k, a, b]) => `<tr><th>${k}</th><td>${a}</td><td>→</td><td><b>${b}</b></td></tr>`).join('');
  $('evoCost').textContent = EVOLVE_NEED.stones(EVOLUTIONS[toKey].tier);
  $('evoBack').textContent = EVOLUTIONS[toKey].tier >= 3 ? `最終進化の分岐（A／B）は、あとで魔界石${BRANCH_SWITCH_COST}で入れかえられます。` : '元の姿には戻せません。';
  Renderer.thumb($('evoFrom'), now.skin, UNITS[key].size); Renderer.thumb($('evoTo'), toKey, UNITS[key].size);
}
