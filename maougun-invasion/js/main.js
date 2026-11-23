/* 入口：戦闘・時計・描画・画面をつなぐ */
import { createBattle, STEP } from './core/battle.js';
import { createClock } from './core/clock.js';
import { ALL_DEMONS } from './data/units.js';
import { HUMANS } from './data/humans.js';
import { STAGES, CONFIG } from './data/stages.js';
import { SKIN } from './data/skin.js';
import { Renderer, VIEW_W, VIEW_H, MINIMAP } from './render/renderer.js';
import { Hud, reasonText } from './ui/hud.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const stageId = params.get('stage') || '1-1';
const stage = STAGES[stageId] || STAGES['1-1'];

const game = $('game');
const canvas = $('field');
const renderer = new Renderer(canvas);
const clock = createClock(STEP);
let battle = null;
let started = false;
let resultShown = false;

const hud = new Hud({
  summon(key) {
    if (!battle || !started) return;
    const chk = battle.canSummon(key);
    if (chk.ok) battle.queue({ type: 'summon', key });
    else { hud.deny(key); hud.toast(reasonText(chk, battle.config.demonCap)); }
  },
  furnace() {
    if (!battle || !started) return;
    const chk = battle.canUpgradeFurnace();
    if (chk.ok) { battle.queue({ type: 'furnace' }); hud.toast(`魔力炉 Lv${battle.furnaceLv + 1}！ 魔力の上限と回復が上がった`, true); }
    else hud.toast(reasonText(chk));
  },
  spell() {
    if (!battle || !started) return;
    const chk = battle.canCastSpell();
    if (chk.ok) battle.queue({ type: 'spell' });
    else hud.toast(reasonText(chk));
  },
  speed() { clock.speed = clock.speed === 1 ? 2 : 1; hud.setSpeed(clock.speed); },
  pause() { if (started && battle && !battle.result) setPaused(!clock.paused); },
});

function newBattle() {
  const seed = Number(params.get('seed')) || ((Date.now() % 100000) + 1);
  battle = createBattle({ stage, unitDefs: ALL_DEMONS, humanDefs: HUMANS, config: CONFIG, seed });
  renderer.camX = 0;
  renderer.fx = [];
  clock.reset();
  resultShown = false;
  hud.build(battle);
  window.__game = { battle, clock, renderer, stage, SKIN };
}

function setPaused(p) {
  clock.paused = p;
  $('ovPause').classList.toggle('show', p);
  $('btnPause').classList.toggle('on', p);
}

function start() {
  started = true;
  $('ovStart').classList.remove('show');
  setPaused(false);
}

function retry() {
  $('ovResult').classList.remove('show');
  $('ovPause').classList.remove('show');
  newBattle();
  started = true;
  setPaused(false);
}

function showResult() {
  resultShown = true;
  const win = battle.result === 'win';
  const t = Math.floor(battle.t);
  $('resTitle').textContent = win ? '侵略成功！' : '祠が破られた…';
  $('resTitle').className = win ? 'win' : 'lose';
  $('resText').textContent = win ? `見張り小屋を制圧した！ 報酬：魔界石 ${stage.reward.stones}（育成は今後追加）` : '魔物の組み合わせを変えて、もう一度挑もう。';
  $('resStats').innerHTML = [
    ['時間', `${Math.floor(t / 60)}分${String(t % 60).padStart(2, '0')}秒`],
    ['召喚した魔物', battle.stats.summoned + ' 体'],
    ['倒した人間', battle.stats.kills + ' 人'],
    ['魔王の呪文', battle.stats.spells + ' 回'],
    ['魔力炉', 'Lv' + battle.furnaceLv],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  setTimeout(() => $('ovResult').classList.add('show'), 700);
}

// ---------- 画面の大きさ ----------
function fit() {
  const w = window.innerWidth; const h = window.innerHeight;
  const portrait = h > w && Math.min(w, h) < 900;
  document.body.classList.toggle('portrait', portrait);
  const u = Math.min(w / VIEW_W, h / VIEW_H);
  document.documentElement.style.setProperty('--u', u + 'px');
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  renderer.resize(VIEW_W * u, VIEW_H * u, dpr);
  if (portrait && started && battle && !battle.result && !clock.paused) setPaused(true);
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 200));

// ---------- 戦場のドラッグ・地図のタップ ----------
let drag = null;
const toLogical = (ev) => {
  const r = canvas.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width * VIEW_W, y: (ev.clientY - r.top) / r.height * VIEW_H };
};
canvas.addEventListener('pointerdown', (ev) => {
  if (!battle) return;
  const p = toLogical(ev);
  const m = MINIMAP;
  if (p.y >= m.y - 10 && p.y <= m.y + m.h + 10 && p.x >= m.x - 10 && p.x <= m.x + m.w + 10) {
    renderer.centerOn(battle, (p.x - m.x) / m.w * battle.stage.length);
    drag = { mini: true };
  } else {
    drag = { x: p.x, cam: renderer.camX };
  }
  canvas.setPointerCapture(ev.pointerId);
});
canvas.addEventListener('pointermove', (ev) => {
  if (!drag || !battle) return;
  const p = toLogical(ev);
  if (drag.mini) renderer.centerOn(battle, (p.x - MINIMAP.x) / MINIMAP.w * battle.stage.length);
  else { renderer.camX = drag.cam - (p.x - drag.x); renderer.clampCam(battle); }
});
const endDrag = () => { drag = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (ev) => { if (!battle) return; ev.preventDefault(); renderer.camX += (ev.deltaX || ev.deltaY); renderer.clampCam(battle); }, { passive: false });

// ---------- キーボード（PC） ----------
const keysDown = new Set();
window.addEventListener('keydown', (ev) => {
  if (ev.repeat && !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
  keysDown.add(ev.key);
  if (!started && (ev.key === 'Enter' || ev.key === ' ')) { start(); ev.preventDefault(); return; }
  if (!battle) return;
  const n = Number(ev.key);
  if (n >= 1 && n <= battle.deck.length) { hud.h.summon(battle.deck[n - 1].key); hud.slots[n - 1].el.classList.add('press'); setTimeout(() => hud.slots[n - 1] && hud.slots[n - 1].el.classList.remove('press'), 90); }
  else if (ev.key === 'q' || ev.key === 'Q') hud.h.furnace();
  else if (ev.key === ' ') { hud.h.spell(); ev.preventDefault(); }
  else if (ev.key === 's' || ev.key === 'S') hud.h.speed();
  else if (ev.key === 'p' || ev.key === 'P' || ev.key === 'Escape') hud.h.pause();
  else if ((ev.key === 'r' || ev.key === 'R') && battle.result) retry();
});
window.addEventListener('keyup', (ev) => keysDown.delete(ev.key));

// ---------- ループ ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (battle) {
    if (started && !battle.result) {
      const n = clock.advance(dt);
      for (let i = 0; i < n; i++) battle.step();
    }
    if (keysDown.has('ArrowLeft')) { renderer.camX -= 700 * dt; renderer.clampCam(battle); }
    if (keysDown.has('ArrowRight')) { renderer.camX += 700 * dt; renderer.clampCam(battle); }
    for (const ev of battle.events) if (ev.type === 'denied') { hud.deny(ev.key); }
    renderer.consume(battle);
    renderer.render(battle, clock.paused || battle.result ? 1 : clock.alpha(), clock.paused ? 0 : dt * clock.speed);
    hud.update(battle);
    if (battle.result && !resultShown) showResult();
  }
  requestAnimationFrame(frame);
}

// ---------- 開始 ----------
$('startChap').textContent = `第${stage.chapter}章「${stage.chapterName}」 ステージ ${stage.id}`;
$('startTitle').textContent = stage.name;
const talk = (stage.talk && stage.talk.start && stage.talk.start[0]);
$('startTalk').innerHTML = talk ? `<b>${talk.who}</b>${talk.text}` : '';
$('btnStart').addEventListener('click', start);
$('btnResume').addEventListener('click', () => setPaused(false));
$('btnRetry').addEventListener('click', retry);
$('btnRetryP').addEventListener('click', retry);
document.addEventListener('visibilitychange', () => { if (document.hidden && started && battle && !battle.result) setPaused(true); });
// ダブルタップでの拡大を防ぐ（iOS）
document.addEventListener('dblclick', (ev) => ev.preventDefault());

newBattle();
fit();
requestAnimationFrame(frame);
