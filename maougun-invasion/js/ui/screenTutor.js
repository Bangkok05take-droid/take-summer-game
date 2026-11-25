/* 戦闘以外の画面の手順つき説明（編成・強化）。手順は js/data/tutorial.js の FORM_GUIDE・UPGRADE_GUIDE。
 * 説明中は、案内しているボタン（target）と説明の枠のほかは押せない。「説明をとばす」でいつでも終われる */
import { SKIN } from '../data/skin.js';
import { getImage } from '../render/images.js';
import { drawPortrait } from '../render/shapes.js';

const $ = (id) => document.getElementById(id);

export class ScreenTutor {
  constructor() {
    this.steps = null; this.i = 0; this.done = null; this.focusEl = null;
    // 押す場所の制限（キャプチャで先に受ける）
    document.addEventListener('click', (ev) => {
      if (!this.steps) return;
      if (ev.target.closest('#btnSTutorSkip')) return;
      const s = this.steps[this.i];
      if (ev.target.closest('#stutor')) { if (s && s.wait === 'tap') { ev.preventDefault(); ev.stopPropagation(); this.next(); } return; }
      if (s && s.wait === 'click' && ev.target.closest(s.target)) { setTimeout(() => this.next(), 0); return; }
      ev.preventDefault(); ev.stopPropagation(); // ほかの場所は押せない
    }, true);
    $('btnSTutorSkip').addEventListener('click', (ev) => { ev.stopPropagation(); this.finish(); });
    this.timer = setInterval(() => this.refocus(), 250); // 画面の描き直しで消えた光を付け直す
  }
  get active() { return !!this.steps; }
  start(steps, done) { this.steps = steps; this.i = 0; this.done = done; this.show(); }
  next() { if (!this.steps) return; this.i++; this.show(); }
  show() {
    let s = this.steps && this.steps[this.i];
    while (s && s.skipIf && s.skipIf()) { this.i++; s = this.steps[this.i]; }
    if (!s) { this.finish(); return; }
    const box = $('stutor');
    box.hidden = false;
    box.className = 'at-' + (s.at || 'bottom') + (s.wait === 'tap' ? ' tap' : '');
    $('stutorWho').textContent = SKIN.speakers.aide;
    $('stutorText').textContent = s.text;
    $('stutorNext').textContent = s.wait === 'tap' ? 'タップで次へ ▼' : '';
    const c = $('stutorFace'); const g = c.getContext('2d');
    const img = getImage(SKIN.portraits.aide_normal || SKIN.portraits.aide);
    g.clearRect(0, 0, c.width, c.height);
    if (img) g.drawImage(img, 0, 0, c.width, c.height); else drawPortrait(g, 'aide', 'normal', c.width, c.height);
    this.refocus();
  }
  refocus() {
    const s = this.steps && this.steps[this.i];
    const el = s ? document.querySelector(s.focus || s.target || '__none__') : null;
    if (el === this.focusEl) return;
    if (this.focusEl) this.focusEl.classList.remove('tutor-focus');
    this.focusEl = el; if (el) el.classList.add('tutor-focus');
  }
  finish() {
    if (!this.steps) return;
    this.steps = null; $('stutor').hidden = true;
    if (this.focusEl) this.focusEl.classList.remove('tutor-focus'); this.focusEl = null;
    const d = this.done; this.done = null; if (d) d();
  }
}
