/* 入口：画面の流れ（タイトル → ステージ選択 → 会話 → 戦闘 → 結果 → 報告・戦利品 → 解放 → ステージ選択）と、
 * 戦闘・時計・描画・操作をつなぐ */
import { createBattle, STEP } from './core/battle.js';
import { createClock } from './core/clock.js';
import { HUMANS } from './data/humans.js';
import { STAGES, CONFIG } from './data/stages.js';
import { STORY } from './data/story.js';
import { SKIN } from './data/skin.js';
import {
  loadProfile, saveProfile, resetProfile, buildDeck, resolveMana, applyResult, isStageOpen, nextStage,
  levelUpUnit, buyUpgrade, SAVE_KEY,
} from './data/progress.js';
import { Renderer, VIEW_W, VIEW_H, MINIMAP } from './render/renderer.js';
import { Hud, reasonText } from './ui/hud.js';
import { TalkPlayer, renderSelect, renderLoot, renderUnlock, renderUpgrade } from './ui/screens.js';
import { applyUiSkin } from './ui/uiskin.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const canvas = $('field');
const renderer = new Renderer(canvas);
const clock = createClock(STEP);
const talk = new TalkPlayer();

const app = {
  screen: 'title',
  profile: loadProfile(),
  stageId: '1-1',
  battle: null,      // 戦闘中の Battle
  scene: null,       // 背景に描くだけの Battle（タイトル・選択・会話の背景）
  lastResult: null,
};

const SCREENS = ['scTitle', 'scSelect', 'scResult', 'scLoot', 'scUnlock', 'scUpgrade'];
function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  $('battleUi').hidden = id !== 'battle';
  $('ovPause').hidden = true;
  app.screen = id;
}
const save = () => saveProfile(app.profile);
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }

function makeScene(stageId) {
  const st = STAGES[stageId];
  app.scene = createBattle({ stage: st, deck: [], humanDefs: HUMANS, config: CONFIG, seed: 1, mana: st.mana });
}

// ---------- タイトル ----------
function toTitle() {
  makeScene('1-1');
  renderer.camX = 0;
  $('btnContinue').hidden = !hasSave();
  $('btnNew').textContent = hasSave() ? 'はじめから' : 'はじめる';
  show('scTitle');
}
$('btnContinue').addEventListener('click', () => toSelect());
$('btnNew').addEventListener('click', () => {
  if (hasSave()) { app.confirmFor = 'new'; $('ovConfirm').hidden = false; return; }
  startNew();
});
function startNew() {
  app.profile = resetProfile();
  save();
  playOpening(() => startStage('1-1'));
}
function playOpening(done) {
  show(null);
  talk.play(STORY.opening.lines, 'shrine', () => { app.profile.story.opening = true; save(); done(); });
}
$('btnReset').addEventListener('click', () => { app.confirmFor = 'reset'; $('ovConfirm').hidden = false; });
$('btnResetNo').addEventListener('click', () => { $('ovConfirm').hidden = true; });
$('btnResetYes').addEventListener('click', () => {
  $('ovConfirm').hidden = true;
  if (app.confirmFor === 'new') { startNew(); return; }
  app.profile = resetProfile();
  toTitle();
});

// ---------- ステージ選択 ----------
function toSelect() {
  const id = nextStage(app.profile) || '1-5';
  makeScene(id);
  renderer.centerOn(app.scene, app.scene.stage.length / 2);
  renderSelect(app.profile, pickStage);
  show('scSelect');
}
function pickStage(id) {
  if (!isStageOpen(app.profile, id)) return;
  const key = 'before:' + id;
  const lines = [...(STORY.before[id] || [])];
  if (!app.profile.story[key] && lines.length) {
    // 偵察の報告 → 村の様子 → 侵略の命令
    const st = STAGES[id];
    if (st.talk) lines.splice(1, 0, { who: 'narr', text: `――そのころ、${st.name}では……` }, ...st.talk.map((t) => ({ who: speakerKey(t.who), text: t.text })), { who: 'narr', text: '――封印の祠。' });
    makeScene(id); renderer.camX = 0;
    show(null);
    talk.play(lines, 'field', () => { app.profile.story[key] = true; save(); startStage(id); });
  } else startStage(id);
}
const speakerKey = (name) => ({ ティウ: 'tiw', モッ: 'mot', ワーン: 'waan', コイ: 'koi' }[name] || name);
$('btnToTitle').addEventListener('click', toTitle);
$('btnReplayOpening').addEventListener('click', () => playOpening(toSelect));
$('btnUpgrade').addEventListener('click', toUpgrade);

// ---------- 強化 ----------
function toUpgrade() {
  const redraw = () => renderUpgrade(app.profile, (k) => { if (levelUpUnit(app.profile, k).ok) { save(); redraw(); } }, (id) => { if (buyUpgrade(app.profile, id).ok) { save(); redraw(); } });
  redraw();
  show('scUpgrade');
}
$('btnUpBack').addEventListener('click', toSelect);

// ---------- 戦闘 ----------
const hud = new Hud({
  summon(key) {
    const b = app.battle; if (!b || app.screen !== 'battle') return;
    const chk = b.canSummon(key);
    if (chk.ok) b.queue({ type: 'summon', key });
    else { hud.deny(key); hud.toast(reasonText(chk, b.config.demonCap)); }
  },
  furnace() {
    const b = app.battle; if (!b || app.screen !== 'battle') return;
    const chk = b.canUpgradeFurnace();
    if (chk.ok) { b.queue({ type: 'furnace' }); hud.toast(`魔力炉 Lv${b.furnaceLv + 1}！ 魔力の上限と回復が上がった`, true); }
    else hud.toast(reasonText(chk));
  },
  spell() {
    const b = app.battle; if (!b || app.screen !== 'battle') return;
    const chk = b.canCastSpell();
    if (chk.ok) b.queue({ type: 'spell' });
    else hud.toast(reasonText(chk));
  },
  speed(v) { clock.speed = v; hud.setSpeed(v); },
  pause() { if (app.screen === 'battle' && app.battle && !app.battle.result) setPaused(!clock.paused); },
});

function startStage(id) {
  app.stageId = id;
  const st = STAGES[id];
  const seed = Number(params.get('seed')) || ((Date.now() % 100000) + 1);
  app.battle = createBattle({ stage: st, deck: buildDeck(app.profile), humanDefs: HUMANS, config: CONFIG, seed, mana: resolveMana(st.mana, app.profile) });
  app.resultShown = false;
  renderer.fx = [];
  renderer.centerOn(app.battle, app.battle.shrine.x); // 祠（右）から始める
  clock.reset();
  hud.build(app.battle, st);
  hud.setSpeed(clock.speed);
  show('battle');
  setPaused(false);
}

function setPaused(p) {
  clock.paused = p;
  $('ovPause').hidden = !p;
  hud.setPaused(p);
}
$('btnResume').addEventListener('click', () => setPaused(false));
$('btnRetryP').addEventListener('click', () => startStage(app.stageId));
$('btnQuit').addEventListener('click', () => { app.battle = null; toSelect(); });

function onBattleEvent(ev) {
  if (ev.type === 'denied') hud.deny(ev.key);
  if (ev.type === 'heroAlarm' && STORY.heroLines[ev.who]) {
    const l = STORY.heroLines[ev.who];
    ev.line = { who: SKIN.speakers[l.who], text: l.text };
  }
}

function showResult() {
  app.resultShown = true;
  const b = app.battle;
  const win = b.result === 'win';
  const t = Math.floor(b.t);
  const res = applyResult(app.profile, app.stageId, b.result, t);
  save();
  app.lastResult = res;
  $('resTitle').textContent = win ? '侵略成功！' : '祠が破られた…';
  $('resTitle').className = win ? 'win' : 'lose';
  $('resText').textContent = win ? `${STAGES[app.stageId].name}を制圧した！` : '魔物の組み合わせや強化を見直して、もう一度挑もう。';
  $('resStats').innerHTML = [
    ['時間', `${Math.floor(t / 60)}分${String(t % 60).padStart(2, '0')}秒`],
    ['召喚した魔物', b.stats.summoned + ' 体'],
    ['倒した人間', b.stats.kills + ' 人'],
    ['魔王の呪文', b.stats.spells + ' 回'],
    ['獲得した魔界石', res.stones],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const btns = $('resButtons'); btns.innerHTML = '';
  const mk = (label, cls, fn, id) => { const x = document.createElement('button'); x.type = 'button'; x.className = cls; x.textContent = label; if (id) x.id = id; x.addEventListener('click', fn); btns.appendChild(x); };
  if (win) mk('報告を聞く', 'big', afterWin, 'btnReport');
  else { mk('もう一度', 'big', () => startStage(app.stageId), 'btnRetry'); mk('ステージ選択へ', 'big sub', toSelect, 'btnBackSelect'); }
  setTimeout(() => { if (app.screen === 'battle' || app.screen === 'scResult') { show('scResult'); } }, 800);
}

// 勝利のあと：側近の報告（初回のみ）→ 戦利品 → 解放 → ステージ選択
function afterWin() {
  const res = app.lastResult;
  const key = 'after:' + app.stageId;
  const lines = res.firstClear && !app.profile.story[key] ? STORY.after[app.stageId] : null;
  show(null);
  talk.play(lines, 'shrine', () => {
    if (lines) { app.profile.story[key] = true; save(); }
    renderLoot(app.stageId, res, res.firstClear);
    show('scLoot');
  });
}
$('btnLootNext').addEventListener('click', () => {
  const u = app.lastResult && app.lastResult.unlocked;
  if (u) { renderUnlock(u); app.profile.seen[u] = true; save(); show('scUnlock'); }
  else toSelect();
});
$('btnUnlockNext').addEventListener('click', toSelect);

// ---------- 画面の大きさ ----------
function fit() {
  const w = window.innerWidth; const h = window.innerHeight;
  const portrait = h > w && Math.min(w, h) < 900;
  document.body.classList.toggle('portrait', portrait);
  const u = Math.min(w / VIEW_W, h / VIEW_H);
  document.documentElement.style.setProperty('--u', u + 'px');
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  renderer.resize(VIEW_W * u, VIEW_H * u, dpr);
  if (portrait && app.screen === 'battle' && app.battle && !app.battle.result && !clock.paused) setPaused(true);
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
  const b = app.battle; if (!b || app.screen !== 'battle') return;
  const p = toLogical(ev); const m = MINIMAP;
  if (p.y >= m.y - 10 && p.y <= m.y + m.h + 10 && p.x >= m.x - 10 && p.x <= m.x + m.w + 10) {
    renderer.centerOn(b, (p.x - m.x) / m.w * b.stage.length); drag = { mini: true };
  } else drag = { x: p.x, cam: renderer.camX };
  canvas.setPointerCapture(ev.pointerId);
});
canvas.addEventListener('pointermove', (ev) => {
  const b = app.battle; if (!drag || !b) return;
  const p = toLogical(ev);
  if (drag.mini) renderer.centerOn(b, (p.x - MINIMAP.x) / MINIMAP.w * b.stage.length);
  else { renderer.camX = drag.cam - (p.x - drag.x); renderer.clampCam(b); }
});
const endDrag = () => { drag = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (ev) => { const b = app.battle; if (!b || app.screen !== 'battle') return; ev.preventDefault(); renderer.camX += (ev.deltaX || ev.deltaY); renderer.clampCam(b); }, { passive: false });

// ---------- キーボード（PC） ----------
const keysDown = new Set();
window.addEventListener('keydown', (ev) => {
  if (talk.active) {
    if (ev.key === 'Enter' || ev.key === ' ') { talk.next(); ev.preventDefault(); }
    else if (ev.key === 'Escape') talk.finish();
    return;
  }
  if (app.screen !== 'battle' || !app.battle) return;
  if (ev.repeat && !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
  keysDown.add(ev.key);
  const b = app.battle;
  const n = ev.key === '0' ? 10 : Number(ev.key);
  if (n >= 1 && n <= b.deck.length) { hud.press(n - 1); hud.h.summon(b.deck[n - 1].key); }
  else if (ev.key === 'q' || ev.key === 'Q') hud.h.furnace();
  else if (ev.key === ' ') { hud.h.spell(); ev.preventDefault(); }
  else if (ev.key === 's' || ev.key === 'S') hud.h.speed(clock.speed === 1 ? 2 : 1);
  else if (ev.key === 'p' || ev.key === 'P' || ev.key === 'Escape') hud.h.pause();
});
window.addEventListener('keyup', (ev) => keysDown.delete(ev.key));

// ---------- ループ ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const b = app.screen === 'battle' || app.screen === 'scResult' ? app.battle : null;
  if (b) {
    if (app.screen === 'battle' && !b.result) {
      const n = clock.advance(dt);
      for (let i = 0; i < n; i++) b.step();
    }
    if (keysDown.has('ArrowLeft')) { renderer.camX -= 700 * dt; renderer.clampCam(b); }
    if (keysDown.has('ArrowRight')) { renderer.camX += 700 * dt; renderer.clampCam(b); }
    renderer.consume(b, onBattleEvent);
    renderer.render(b, clock.paused || b.result ? 1 : clock.alpha(), clock.paused ? 0 : dt * clock.speed);
    hud.update(b);
    if (b.result && !app.resultShown) showResult();
  } else if (app.scene) {
    // 背景だけ（タイトル・ステージ選択・会話）：ゆっくり横へ流す
    if (app.screen === 'scTitle') { renderer.camX = (renderer.camX + dt * 18) % Math.max(1, app.scene.stage.length - VIEW_W); }
    app.scene.events.length = 0;
    renderer.render(app.scene, 1, dt);
  }
  requestAnimationFrame(frame);
}

// テスト・不具合調査用（ゲームの進行には使わない）
window.__game = {
  app, clock, renderer, talk, SKIN,
  get battle() { return app.battle; },
  startStage, toSelect, toTitle,
};

document.addEventListener('visibilitychange', () => { if (document.hidden && app.screen === 'battle' && app.battle && !app.battle.result) setPaused(true); });
document.addEventListener('dblclick', (ev) => ev.preventDefault());

applyUiSkin();
fit();
toTitle();
requestAnimationFrame(frame);
