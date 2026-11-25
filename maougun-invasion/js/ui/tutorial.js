/* チュートリアルの表示と進行（第1章）。
 *  Guide：1-1 の手順つき説明（js/data/tutorial.js の GUIDE）。tap の手順ではゲームを止める
 *  Hints：1-2 の、止めないヒント（新しい敵が出た・魔力炉が Lv1 のまま・呪文がたまった） */
import { SKIN } from '../data/skin.js';
import { GUIDE, HINTS } from '../data/tutorial.js';
import { getImage } from '../render/images.js';
import { drawPortrait } from '../render/shapes.js';

const $ = (id) => document.getElementById(id);

function face() {
  const c = $('tutorFace'); const g = c.getContext('2d');
  const img = getImage(SKIN.portraits.aide_normal || SKIN.portraits.aide);
  g.clearRect(0, 0, c.width, c.height);
  if (img) g.drawImage(img, 0, 0, c.width, c.height); else drawPortrait(g, 'aide', 'normal', c.width, c.height);
}

export class Tutor {
  // clock：ゲームの時計（tap の手順で止める）
  constructor(clock) {
    this.clock = clock;
    this.mode = null; this.i = 0; this.b = null;
    $('tutor').addEventListener('pointerdown', (ev) => {
      if (this.mode !== 'guide' || !this.step || this.step.wait !== 'tap') return;
      ev.preventDefault(); this.next();
    });
    $('btnTutorSkip').addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); this.skipGuide(); });
  }
  get step() { return this.mode === 'guide' ? GUIDE[this.i] : null; }
  get pausing() { return !!(this.step && this.step.wait === 'tap'); }

  // 戦闘の始めに呼ぶ。mode：'guide'｜'hints'｜null
  start(b, mode) {
    this.stop();
    this.b = b; this.mode = mode; this.i = 0;
    this.seen = new Set(); this.hintQueue = []; this.hintUntil = 0; this.saidFurnace = false; this.saidSpell = false;
    if (mode === 'guide') { b.spawnerOff = true; this.enter(); }
  }
  stop() {
    this.unfocus();
    if (this.pausedByMe) { this.clock.paused = false; this.pausedByMe = false; }
    this.mode = null; this.b = null;
    $('tutor').hidden = true; $('tutorHint').hidden = true;
  }

  // ---------- 手順（1-1） ----------
  enter() {
    const s = this.step; const b = this.b;
    if (!s) { this.finishGuide(); return; }
    if (s.prep && s.prep.mana) { b.manaMax = Math.max(b.manaMax, s.prep.mana); b.mana = Math.max(b.mana, s.prep.mana); }
    if (s.prep && s.prep.spell) b.spellCharge = b.config.spell.charge;
    for (const who of s.enemy || []) b.spawnHuman(who);
    if (s.spawner) b.spawnerOff = false;
    this.t0 = b.t;
    this.unfocus();
    if (s.focus) { this.focusEl = document.querySelector(s.focus); if (this.focusEl) this.focusEl.classList.add('tutor-focus'); }
    $('tutor').hidden = false;
    $('tutor').classList.toggle('tap', s.wait === 'tap');
    $('tutorWho').textContent = SKIN.speakers.aide;
    $('tutorText').textContent = s.text;
    $('tutorNext').textContent = s.wait === 'tap' ? 'タップで次へ ▼' : '';
    face();
    if (s.wait === 'tap') { this.clock.paused = true; this.pausedByMe = true; }
    else if (this.pausedByMe) { this.clock.paused = false; this.pausedByMe = false; }
  }
  next() { if (this.mode !== 'guide') return; this.i++; this.enter(); }
  unfocus() { if (this.focusEl) this.focusEl.classList.remove('tutor-focus'); this.focusEl = null; }
  finishGuide() {
    this.unfocus();
    if (this.pausedByMe) { this.clock.paused = false; this.pausedByMe = false; }
    if (this.b) this.b.spawnerOff = false;
    this.mode = null; $('tutor').hidden = true;
  }
  skipGuide() { if (this.mode === 'guide') { this.i = GUIDE.length; this.finishGuide(); } }

  // 操作があったとき（main.js から）。type：'summon'｜'furnace'｜'spell'
  notify(type, key) {
    const s = this.step;
    if (s && s.wait === type && (!s.key || s.key === key)) this.next();
  }

  // 毎フレーム（main.js から）
  tick(b, now) {
    if (this.b !== b) return;
    const s = this.step;
    if (s) {
      if (s.wait === 'time' && b.t - this.t0 >= s.sec) this.next();
      // 手順で使う分の魔力は待っている間ずっと足しておく（直前の召喚の支払いで足りなくならないように）
      if (s.prep && s.prep.mana && b.mana < s.prep.mana) { b.manaMax = Math.max(b.manaMax, s.prep.mana); b.mana = s.prep.mana; }
      if (s.prep && s.prep.spell) b.spellCharge = b.config.spell.charge;
      // 呪文の手順で当てる相手がいなくなったら、もう1人出す
      if (s.wait === 'spell' && !b.entities.some((e) => e.side === 'human' && e.state !== 'dead')) b.spawnHuman('militia');
    }
    if (this.mode === 'hints') {
      for (const e of b.entities) if (e.side === 'human' && !this.seen.has(e.key)) { this.seen.add(e.key); if (HINTS.enemy[e.key]) this.hintQueue.push(HINTS.enemy[e.key]); }
      if (!this.saidFurnace && b.t >= HINTS.furnace.at && b.furnaceLv === 1) { this.saidFurnace = true; this.hintQueue.push(HINTS.furnace.text); }
      if (!this.saidSpell && b.spellCharge >= b.config.spell.charge) { this.saidSpell = true; this.hintQueue.push(HINTS.spell); }
      if (now > this.hintUntil) {
        const t = this.hintQueue.shift();
        if (t) { $('tutorHintText').textContent = t; $('tutorHintWho').textContent = SKIN.speakers.aide; $('tutorHint').hidden = false; this.hintUntil = now + 5000; }
        else $('tutorHint').hidden = true;
      }
    }
  }
}
