/* 入口：画面の流れ（タイトル → ステージ選択 → 会話 → 戦闘 → 結果 → 報告・戦利品 → 解放 → ステージ選択）と、
 * 戦闘・時計・描画・操作をつなぐ */
import { createBattle, STEP } from './core/battle.js';
import { createClock } from './core/clock.js';
import { HUMANS } from './data/humans.js';
import { STAGES, CONFIG, TEST_ENEMY_POWER } from './data/stages.js';
import { UNIT_ORDER, BOSSES } from './data/units.js';
import { startPointer } from './ui/pointer.js';
import { STORY, CRYSTAL_EVENT, ULTIMATE_EVENT, FINAL_MARCH, ENDING } from './data/story.js';
import { SKIN } from './data/skin.js';
import {
  loadProfile, saveProfile, resetProfile, buildDeck, resolveMana, applyResult, isStageOpen, nextStage,
  levelUpUnit, buyUpgrade, SAVE_KEY, resolveSpell, addToFormation, removeFromFormation, normalizeFormation,
  ruinPending, finishRuinEvent, crystalPending, applyCrystal, ultimatePending, applyUltimate, resolveFurnace, finalPending, markFinal, conquestPending, markConquest, joinPending, joinBoss, tryEvolve,
} from './data/progress.js';
import { Renderer, VIEW_W, VIEW_H, MINIMAP } from './render/renderer.js';
import { Hud, reasonText } from './ui/hud.js';
import { TalkPlayer, renderSelect, renderLoot, renderUnlock, renderUpgrade, renderRecon, renderEnemyInfo, renderFormation, renderEvolveConfirm } from './ui/screens.js';
import { applyUiSkin } from './ui/uiskin.js';
import { Tutor } from './ui/tutorial.js';
import { RUIN_EVENT } from './data/event_ruin.js';
import { SCREEN_TIPS, LOSE_TIPS, SELF_HINT, FORM_GUIDE, UPGRADE_GUIDE } from './data/tutorial.js';
import { ScreenTutor } from './ui/screenTutor.js';
import { CHAPTER1, STAGE_ORDER, chapterOf } from './data/stages.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const canvas = $('field');
const renderer = new Renderer(canvas);
const clock = createClock(STEP);
const talk = new TalkPlayer();
const tutor = new Tutor(clock);
const stutor = new ScreenTutor();

const app = {
  screen: 'title',
  profile: loadProfile(),
  stageId: '1-1',
  battle: null,      // 戦闘中の Battle
  scene: null,       // 背景に描くだけの Battle（タイトル・選択・会話の背景）
  lastResult: null,
};

const SCREENS = ['scTitle', 'scSelect', 'scRecon', 'scForm', 'scResult', 'scLoot', 'scUnlock', 'scUpgrade'];
function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  $('battleUi').hidden = id !== 'battle';
  $('ovPause').hidden = true;
  $('ovEnemy').hidden = true;
  if (id !== 'battle') tutor.stop();
  // 画面の説明（編成・強化）は戦闘に持ちこまない。最後の手順（出撃！）から始まった戦闘なら、説明は済んだことにする
  if (id === 'battle' && stutor.active) { if (stutor.atLastStep) stutor.finish(); else stutor.cancel(); }
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
// ch：見せる章（省略すると、つぎに攻めるステージの章）
function toSelect(ch) {
  const id = nextStage(app.profile) || STAGE_ORDER[STAGE_ORDER.length - 1];
  const show1 = ch && ch.stages ? ch : chapterOf(id);
  const sceneId = show1.stages.includes(id) ? id : show1.stages[0];
  makeScene(sceneId);
  renderer.centerOn(app.scene, app.scene.stage.length / 2);
  renderSelect(app.profile, pickStage, show1, (c) => toSelect(c));
  show('scSelect');
  // 3-3 をクリアして戻ったら：特殊イベント「壊滅した町」（1回だけ）
  if (ruinPending(app.profile) && !app.event) { startRuinEvent(); return; }
  // 1-2 をクリアして戻ったら：強化の手順つき説明（最初の1回）
  const r12 = app.profile.stages['1-2'];
  if (r12 && r12.cleared && !app.profile.story['tip:upgrade'] && !stutor.active) stutor.start(UPGRADE_GUIDE, () => { app.profile.story['tip:upgrade'] = true; save(); });
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
    talk.play(lines, 'field', () => { app.profile.story[key] = true; save(); afterBriefing(id); });
  } else afterBriefing(id);
}
// 1-1（説明のステージ）は偵察と編成をとばして、すぐ戦闘へ。幹部が加わるステージは、先に加入の演出（初回だけ）
function afterBriefing(id) {
  if (joinPending(app.profile, id)) { showJoin(id, () => afterBriefing(id)); return; }
  if (STAGES[id].tutorial === 'guide') startStage(id); else toRecon(id);
}
// 幹部の加入演出（2026-11-26）：幹部の絵と名前、「この戦闘から召喚可能！」。加入は記録され、負けても残る
function showJoin(id, done) {
  const key = joinBoss(app.profile, id); save();
  if (!key) { done(); return; }
  renderUnlock(key);
  $('unlockEyebrow').textContent = 'この戦闘から召喚可能！';
  $('unlockName').textContent = `${SKIN.names[key]} 解放！`;
  $('scUnlock').classList.add('join');
  show('scUnlock');
  app.joinThen = () => { $('scUnlock').classList.remove('join'); done(); };
}

// ---------- 偵察報告 → 編成 → 出撃 ----------
// 偵察報告は毎回（初回は上の会話のあとに1行、2回目以降は1行だけ）。スキップで編成へ
function toRecon(id) {
  app.stageId = id;
  makeScene(id); renderer.camX = 0;
  renderRecon(id);
  // 1-2：偵察の使い方を最初の1回だけ／1-3：2回以上負けたら助言を1つ
  const st = STAGES[id]; const rec = app.profile.stages[id];
  if (st.tutorial === 'hints' && !app.profile.story['tip:recon']) { $('reconText').textContent = SCREEN_TIPS.recon + '　' + $('reconText').textContent; app.profile.story['tip:recon'] = true; save(); }
  if (st.tutorial === 'self' && rec && !rec.cleared && (rec.losses || 0) >= 2) $('reconText').textContent += '　' + SELF_HINT;
  show('scRecon');
}
$('btnReconSkip').addEventListener('click', () => toForm(app.stageId));
$('btnReconNext').addEventListener('click', () => toForm(app.stageId));
$('btnReconBack').addEventListener('click', toSelect);

function toForm(id) {
  app.stageId = id;
  if (!app.scene || app.scene.stage.id !== id) { makeScene(id); renderer.camX = 0; }
  $('formHint').textContent = '';
  const redraw = () => renderFormation(app.profile, id, (key) => {
    const f = normalizeFormation(app.profile);
    if (f.units.includes(key) || f.bosses.includes(key)) { removeFromFormation(app.profile, key); $('formHint').textContent = ''; }
    else {
      const r = addToFormation(app.profile, key);
      $('formHint').textContent = r.ok ? '' : r.reason === 'full' ? '枠がいっぱいです。編成の魔物をタップして外してください' : 'この魔物はまだ編成できません';
    }
    save(); redraw();
  });
  redraw();
  // 1-2：編成の手順つき説明（最初の1回）
  if (STAGES[id].tutorial === 'hints' && !app.profile.story['tip:form'] && !stutor.active) stutor.start(FORM_GUIDE, () => { app.profile.story['tip:form'] = true; save(); });
  show('scForm');
}
$('btnSortie').addEventListener('click', () => { if (normalizeFormation(app.profile).units.length) startStage(app.stageId); });
$('btnFormBack').addEventListener('click', () => toRecon(app.stageId));
$('btnEnemyInfo').addEventListener('click', () => { renderEnemyInfo(app.stageId); $('ovEnemy').hidden = false; });
$('btnEnemyClose').addEventListener('click', () => { $('ovEnemy').hidden = true; });
const speakerKey = (name) => ({ ティウ: 'tiw', モッ: 'mot', ワーン: 'waan', コイ: 'koi' }[name] || name);
$('btnToTitle').addEventListener('click', toTitle);
$('btnReplayOpening').addEventListener('click', () => playOpening(toSelect));
$('btnUpgrade').addEventListener('click', toUpgrade);

// ---------- 強化 ----------
function toUpgrade() {
  const redraw = () => renderUpgrade(app.profile, (k) => { if (levelUpUnit(app.profile, k).ok) { save(); redraw(); } }, (id) => { if (buyUpgrade(app.profile, id).ok) { save(); redraw(); } }, (k, t) => { renderEvolveConfirm(app.profile, k, t); $('ovEvolve').hidden = false; app.evolving = { k, t, redraw }; });
  redraw();
  show('scUpgrade');
}
$('btnUpBack').addEventListener('click', toSelect);

// ---------- 戦闘 ----------
const hud = new Hud({
  summon(key) {
    const b = app.battle; if (!b || app.screen !== 'battle') return;
    const chk = b.canSummon(key);
    if (chk.ok) { b.queue({ type: 'summon', key }); tutor.notify('summon', key); }
    else { hud.deny(key); hud.toast(reasonText(chk, b.config.demonCap)); }
  },
  furnace() {
    const b = app.battle; if (!b || app.screen !== 'battle') return;
    const chk = b.canUpgradeFurnace();
    if (chk.ok) { b.queue({ type: 'furnace' }); hud.toast(`魔力炉 Lv${b.furnaceLv + 1}！ 魔力の上限と回復が上がった`, true); tutor.notify('furnace'); }
    else hud.toast(reasonText(chk));
  },
  spell() {
    const b = app.battle; if (!b || app.screen !== 'battle') return;
    const chk = b.canCastSpell();
    if (chk.ok) { b.queue({ type: 'spell' }); tutor.notify('spell'); }
    else hud.toast(reasonText(chk));
  },
  speed(v) { clock.speed = v; hud.setSpeed(v); },
  pause() { if (app.screen === 'battle' && app.battle && !app.battle.result && !tutor.pausing && !app.forced) setPaused(!clock.paused); },
});

// ---------- 特殊イベント「壊滅した町」（js/data/event_ruin.js） ----------
// ①② 会話 → 特殊戦闘（強制敗北。③の台詞を吹き出しで）→ ④ → 選択肢 → ⑤A/B → ⑥ → ステージ選択
function startRuinEvent() {
  app.event = 'ruin';
  makeScene('ex-1'); renderer.camX = 0;
  show(null);
  talk.play(RUIN_EVENT.DISCOVER, 'ruin', () => startStage('ex-1', { forced: true }));
}
// branch：'charger'＝ワニ将軍が倒された（専用会話のあと、提案から合流）／それ以外＝通常の敗北
function ruinAfterDefeat(branch) {
  makeScene('ex-1'); renderer.camX = 0;
  show(null);
  const lines = branch === 'charger' ? [...RUIN_EVENT.CHARGER_DOWN, ...RUIN_EVENT.AFTER_DEFEAT.slice(RUIN_EVENT.PROPOSAL_FROM)] : RUIN_EVENT.AFTER_DEFEAT;
  talk.play(lines, 'ruin', () => {
    $('btnChoiceA').textContent = RUIN_EVENT.CHOICES.recruit;
    $('btnChoiceB').textContent = RUIN_EVENT.CHOICES.reject;
    $('ovChoice').hidden = false;
  });
}
function ruinChoose(choice) {
  $('ovChoice').hidden = true;
  finishRuinEvent(app.profile, choice); save(); // 選んだ時点で記録（加入・再戦の状態）
  const lines = [...(choice === 'recruit' ? RUIN_EVENT.RECRUIT : RUIN_EVENT.REJECT), ...RUIN_EVENT.MARCH];
  talk.play(lines, 'ruin', () => { app.event = null; toSelect(); });
}
$('btnChoiceA').addEventListener('click', () => ruinChoose('recruit'));
$('btnChoiceB').addEventListener('click', () => ruinChoose('reject'));

function startStage(id, opts = {}) {
  app.ruinBranch = null;
  if (joinPending(app.profile, id)) { joinBoss(app.profile, id); save(); } // 演出をとおらずに始めたときも、幹部は使えるように
  app.stageId = id;
  app.forced = !!opts.forced;
  const st = STAGES[id];
  const seed = Number(params.get('seed')) || ((Date.now() % 100000) + 1);
  const config = { ...CONFIG, spell: resolveSpell(CONFIG.spell, app.profile), furnace: resolveFurnace(CONFIG.furnace, app.profile), enemyPower: enemyPower() }; // 魔王の力（呪文の強化）を反映
  app.battle = createBattle({ stage: st, deck: buildDeck(app.profile), humanDefs: HUMANS, config, seed, mana: resolveMana(st.mana, app.profile) });
  app.resultShown = false;
  renderer.fx = [];
  renderer.centerOn(app.battle, app.battle.shrine.x); // 祠（右）から始める
  clock.reset();
  hud.build(app.battle, st);
  hud.setSpeed(clock.speed);
  show('battle');
  setPaused(false);
  // チュートリアル：1-1 は手順つき説明（クリア済みなら出さない）、1-2 はヒント
  const rec = app.profile.stages[id];
  tutor.start(app.battle, st.tutorial === 'guide' && !(rec && rec.cleared) ? 'guide' : st.tutorial === 'hints' ? 'hints' : null);
  app.forcedLines = opts.forced ? RUIN_EVENT.BATTLE_LINES.slice() : null;
  // 初戦（20秒）でもワニ将軍を呼べるように：魔力炉の強化（Lv3まで）と召喚の分の魔力を最初から持たせる（2026-11-26）
  if (opts.forced && app.profile.units.charger && app.profile.units.charger.unlocked) {
    const b = app.battle; const need = BOSSES.charger.cost + CONFIG.furnace.costs[0] + CONFIG.furnace.costs[1];
    b.manaMax = Math.max(b.manaMax, need); b.mana = Math.max(b.mana, need);
  }
}
// 壊滅した町の初戦（強制敗北）：オルドはとても強く呪文も効かない。台本の秒数で吹き出しを出し、最後に敗北
function tickForced(b) {
  if (!app.forced || b.result) return;
  for (const e of b.entities) if (e.key === 'ord' && e.side === 'human' && !e.forcedBoost) {
    e.forcedBoost = true; e.spellImmune = true; e.maxHp = e.hp = 999999; e.def = { ...e.def, atk: e.def.atk * 10, speed: 60 }; // 2026-11-26：×3→×10・速く（ワニ将軍を呼んでも30秒ほどで倒しきる）
  }
  b.base.hp = b.base.maxHp; // 初戦は拠点を壊せない
  // 2026-11-26：召喚したワニ将軍が倒れたら、その場で戦闘を終える（専用会話へ）。初戦だけ
  if (b.entities.some((e) => e.key === 'charger' && e.side === 'demon' && (e.state === 'dead' || e.hp <= 0))) { app.ruinBranch = 'charger'; b.finish('lose'); return; }
  const l = app.forcedLines[0];
  if (l && b.t >= l.at) {
    app.forcedLines.shift();
    $('tutorHintWho').textContent = SKIN.speakers[l.who]; $('tutorHintText').textContent = l.text; $('tutorHint').hidden = false;
  }
  // 終わりの秒数になってもワニ将軍が戦っていれば、倒れるまで少し待つ（最大30秒。専用会話を優先）
  const chargerOut = b.entities.some((e) => e.key === 'charger' && e.side === 'demon' && e.state !== 'dead');
  if (b.t >= RUIN_EVENT.BATTLE_END && !(chargerOut && b.t < RUIN_EVENT.BATTLE_END + 30)) { b.shrine.hp = 0; b.finish('lose'); }
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
  if (ev.type === 'heroAlarm' && app.stageId === '1-5' && STORY.heroLines && STORY.heroLines[ev.who]) { // 旧 1-5 用の一言（最終決戦では出さない）
    const l = STORY.heroLines[ev.who];
    ev.line = { who: SKIN.speakers[l.who], text: l.text };
  }
}

function showResult() {
  app.resultShown = true;
  const b = app.battle;
  if (app.forced) { // 強制敗北：結果も記録もせず、イベントの続きへ
    // 通常の敗北と同時にワニ将軍が倒れていたら、ワニ将軍の専用会話を優先
    const branch = app.ruinBranch || (b.entities.some((e) => e.key === 'charger' && e.side === 'demon' && (e.state === 'dead' || e.hp <= 0)) ? 'charger' : null);
    app.forced = false; app.ruinBranch = null; $('tutorHint').hidden = true;
    setTimeout(() => { app.battle = null; ruinAfterDefeat(branch); }, 1200);
    return;
  }
  const win = b.result === 'win';
  const t = Math.floor(b.t);
  const res = applyResult(app.profile, app.stageId, b.result, t);
  save();
  app.lastResult = res;
  $('resTitle').textContent = win ? '侵略成功！' : '祠が破られた…';
  $('resTitle').className = win ? 'win' : 'lose';
  $('resText').textContent = win ? `${STAGES[app.stageId].name}を制圧した！` : '魔物の組み合わせや強化を見直して、もう一度挑もう。';
  // 第7章から：進化できる魔物がいるのに進化していないとき、ヴェイルが進化をすすめる（2026-11-25）
  if (!win && STAGES[app.stageId].chapter >= 7 && UNIT_ORDER.some((k) => { const u = app.profile.units[k]; return u && u.unlocked && !u.formKey && u.level >= 5; })) {
    $('resText').textContent = SKIN.speakers.aide + '「' + LOSE_TIPS.evolve + '」';
  }
  if (!win && STAGES[app.stageId].tutorial) { // 第1章：負けた理由の見当を一言
    const priest = b.entities.some((e) => e.side === 'human' && e.state !== 'dead' && e.def.heal);
    $('resText').textContent = SKIN.speakers.aide + '「' + (b.furnaceLv === 1 ? LOSE_TIPS.furnace : b.stats.summoned < 12 ? LOSE_TIPS.few : priest ? LOSE_TIPS.healer : LOSE_TIPS.default) + '」';
  }
  tutor.stop();
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
  else { mk('もう一度', 'big', () => startStage(app.stageId), 'btnRetry'); mk('編成を見直す', 'big sub', () => toForm(app.stageId), 'btnReform'); mk('ステージ選択へ', 'big sub', toSelect, 'btnBackSelect'); }
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
    const toLoot = () => { renderLoot(app.stageId, res, res.firstClear); show('scLoot'); };
    // 6-3 の初回クリア：特殊イベント「大魔王の魔力回復」→ 新機能の解放画面 → 続きの会話（1回だけ・再クリアでは起きない）
    if (app.stageId === '6-3' && crystalPending(app.profile)) { playCrystalEvent(toLoot); return; }
    // 8-4 の初回クリア：特殊イベント「魔王軍の究極進化」→ 新機能の解放画面 → 第9章への進軍（1回だけ）
    if (app.stageId === '8-4' && ultimatePending(app.profile)) { playFeatureEvent(ULTIMATE_EVENT, applyUltimate, toLoot); return; }
    // 9-4 の初回クリア：最終章への進軍 → 最終章解放演出（1回だけ）
    if (app.stageId === '9-4' && finalPending(app.profile)) { playFinalMarch(toLoot); return; }
    // 10-5 の初回クリア：エンディング（大魔王復活 → 世界征服達成画面 → おまけ会話 → THE END）。1回だけ
    if (app.stageId === '10-5' && conquestPending(app.profile)) { playEnding(toLoot); return; }
    toLoot();
  });
}
function playCrystalEvent(done) { playFeatureEvent(CRYSTAL_EVENT, applyCrystal, done); }
// 特殊イベント：会話 → 記録（apply は1回だけ効く）→ 新機能の解放画面 → 続きの会話
function playFeatureEvent(EV, apply, done) {
  talk.play(EV.LINES, 'shrine', () => {
    apply(app.profile); save(); // 解放を記録（重複しない）
    const F = EV.FEATURE;
    $('featTitle').textContent = F.title; $('featText').textContent = F.text;
    $('featItems').innerHTML = F.items.map((t) => `<li>・${t}</li>`).join('');
    $('ovFeature').hidden = false;
    app.afterFeature = () => talk.play(EV.AFTER, 'shrine', done);
  });
}
function playFinalMarch(done) {
  talk.play(FINAL_MARCH.LINES, 'shrine', () => {
    markFinal(app.profile); save();
    showTitleCard(FINAL_MARCH.TITLE, SKIN.images.finalBg, done);
  });
}
// 文字だけの演出画面（最終章解放・世界征服達成・THE END）。T：{ eyebrow, chapter, name, text, end }（無い項目は出さない）
function showTitleCard(T, bg, done) {
  for (const [id, k] of [['finEyebrow', 'eyebrow'], ['finChapter', 'chapter'], ['finName', 'name'], ['finText', 'text'], ['finEnd', 'end']]) { $(id).textContent = T[k] || ''; $(id).hidden = !T[k]; }
  document.querySelector('#ovFinal .finalCard').classList.toggle('endOnly', !T.name && !!T.end);
  const card = document.querySelector('#ovFinal .finalCard'); card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  $('ovFinal').style.backgroundImage = bg ? `linear-gradient(rgba(12,6,32,.5), rgba(12,6,32,.5)), url(${bg})` : ''; // 文字が読めるよう少し暗く
  $('ovFinal').hidden = false;
  app.afterFinal = done;
}
// エンディング：ENDING.STEPS の順に進める。SKIN.movies.ending（保留中）があれば、replaces の段の代わりに動画を流す
function playEnding(done) {
  talk.revived = false; // 復活の行から復活後の絵。おまけ会話も復活後のまま
  const finish = done; done = () => { talk.revived = false; finish(); };
  const movie = SKIN.movies && SKIN.movies.ending;
  const steps = ENDING.STEPS.slice();
  let movieShown = false;
  const next = () => {
    const st = steps.shift();
    if (!st) { done(); return; }
    if (movie && movie.src && (movie.replaces || []).includes(st)) { if (movieShown) { next(); return; } movieShown = true; playMovie(movie.src, next); return; }
    if (st === 'lines') talk.play(ENDING.LINES, 'shrine', next);
    else if (st === 'title') { markConquest(app.profile); save(); showTitleCard(ENDING.TITLE, SKIN.images.endingBg, next); } // 世界征服達成をセーブ
    else if (st === 'epilogue') talk.play(ENDING.EPILOGUE, 'shrine', next);
    else if (st === 'end') showTitleCard(ENDING.END, SKIN.images.endingBg, next);
    else next();
  };
  next();
}
function playMovie(src, done) {
  const v = $('movieVideo'); const ov = $('ovMovie');
  const end = () => { v.pause(); v.removeAttribute('src'); ov.hidden = true; v.onended = v.onerror = null; $('btnMovieSkip').onclick = null; done(); };
  v.onended = end; v.onerror = end; $('btnMovieSkip').onclick = end;
  v.src = src; ov.hidden = false;
  const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});
}
$('btnFinalNext').addEventListener('click', () => { $('ovFinal').hidden = true; const f = app.afterFinal; app.afterFinal = null; if (f) f(); });
$('btnEvoYes').addEventListener('click', () => { const e = app.evolving; $('ovEvolve').hidden = true; app.evolving = null; if (e && tryEvolve(app.profile, e.k, e.t).ok) { save(); e.redraw(); } });
$('btnEvoNo').addEventListener('click', () => { $('ovEvolve').hidden = true; app.evolving = null; });
$('btnFeatNext').addEventListener('click', () => { $('ovFeature').hidden = true; const f = app.afterFeature; app.afterFeature = null; if (f) f(); });
// 解放した仲間を1体ずつ見せる（複数のときは順に）
function nextUnlock() {
  const q = app.unlockQueue || [];
  const u = q.shift();
  if (u) { renderUnlock(u); app.profile.seen[u] = true; save(); show('scUnlock'); }
  else toSelect();
}
$('btnLootNext').addEventListener('click', () => {
  app.unlockQueue = ((app.lastResult && app.lastResult.unlockedAll) || []).slice();
  nextUnlock();
});
$('btnUnlockNext').addEventListener('click', () => { const j = app.joinThen; if (j) { app.joinThen = null; j(); } else nextUnlock(); });

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
  if (tutor.pausing && (ev.key === 'Enter' || ev.key === ' ')) { tutor.next(); ev.preventDefault(); return; } // 説明を Enter で送る
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
    if (app.screen === 'battle') { tutor.tick(b, now); tickForced(b); }
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
// テストプレイ用の敵の強さ。?full を付けると本番の強さ（自動テストもこちら）。?easy で自動テスト中も弱く
function enemyPower() { try { const q = new URLSearchParams(location.search); if (q.has('easy')) return TEST_ENEMY_POWER; if (q.has('full') || navigator.webdriver) return 1; } catch { /* */ } return TEST_ENEMY_POWER; }
startPointer();
if (enemyPower() !== 1) { const t = document.createElement('div'); t.id = 'testBadge'; t.textContent = `テスト中：敵の強さ ${Math.round(enemyPower() * 100)}%`; document.body.appendChild(t); }
window.__game = {
  app, clock, renderer, talk, SKIN,
  get battle() { return app.battle; },
  startStage, toSelect, toTitle, toRecon, toForm, tutor, stutor, startRuinEvent,
};

document.addEventListener('visibilitychange', () => { if (document.hidden && app.screen === 'battle' && app.battle && !app.battle.result) setPaused(true); });
document.addEventListener('dblclick', (ev) => ev.preventDefault());

applyUiSkin();
fit();
toTitle();
requestAnimationFrame(frame);
