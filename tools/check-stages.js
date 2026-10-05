#!/usr/bin/env node
/*
 * check-stages.js — 全ステージがゴールまで到達できるかを、実際のゲームと同じ物理で自動探索します。
 *
 *   node tools/check-stages.js            # 全ステージ
 *   node tools/check-stages.js 7          # 7面だけ
 *   node tools/check-stages.js --save     # 見つけた操作手順を tools/solutions.json に保存
 *
 * 0.1秒ごとに「ダッシュ押す/離す × ジャンプ押す/離す」の4通りを試す幅優先探索です。
 * 同じ時刻の状態を同時に進めるので、敵やボールの位置も正しく再現されます。
 * 厳しめの判定にするため、探索では「変身・無敵なし」「敵は倒れずに残る」で確認します。
 *
 * 確認すること
 *   1. スタートと各チェックポイントからゴールに着ける
 *   2. 敵やボールの動きのタイミングをずらしても着ける(= 立ち止まって待つ必要がない)
 *   3. 1〜5面はダッシュを使わなくても着ける
 *   4. ダッシュなしで着けない面は「ダッシュ必須」と表示
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Engine = require('../js/engine.js');
const STAGES = require('../js/stages.js');

const DT = 1 / 120;
const SUB = 12; // 1アクション = 0.1秒
const MAX_LAYER = 3000;
const MAX_TIME = 240; // 秒
const ACTIONS = [];
for (const d of [false, true]) for (const j of [false, true]) ACTIONS.push({ dash: d, jump: j });
const PHASES = [0, 0.65, 1.3, 1.95]; // 敵・ボールのタイミングのずらし方(秒)。ボールの周期2.6秒を4分割
const NO_DASH_REQUIRED = 5; // この面までは、ダッシュなしでもクリアできること

function clonePlayer(p) {
  const c = Object.assign({}, p);
  return c;
}

function keyOf(p, world) {
  const mi = p.mover ? world.movers.indexOf(p.mover) : -1;
  return [
    Math.round(p.x / 5), Math.round(p.y / 5), Math.round(p.vx / 30), Math.round(p.vy / 90),
    p.onGround ? 1 : 0, p.jumpHeld ? 1 : 0, p.jumping ? 1 : 0, mi, p.checkpoint, p.hold > 0 ? 1 : 0,
  ].join(',');
}

function solve(index, fromCheckpoint, opts) {
  opts = opts || {};
  const acts = opts.noDash ? [0, 1] : [0, 1, 2, 3];
  const level = Engine.parseStage(STAGES[index], index);
  const world = Engine.createWorld(level);
  world.immortalEnemies = true;
  for (let t = 0; t < (opts.phase || 0); t += DT) Engine.stepWorld(world, DT);
  const spawn = fromCheckpoint >= 0 ? level.checkpoints[fromCheckpoint].spawn : level.spawn;
  const start = Engine.createPlayer(spawn);
  start.checkpoint = fromCheckpoint;
  start.noPowers = true;
  let layer = [{ p: start, hist: null }];
  let steps = 0;
  const events = [];
  while (layer.length && steps * SUB * DT < MAX_TIME) {
    // 子状態を作る
    const children = [];
    for (const node of layer) {
      for (const a of acts) {
        children.push({ p: clonePlayer(node.p), a, parent: node });
      }
    }
    let winner = null;
    for (let s = 0; s < SUB; s++) {
      Engine.stepWorld(world, DT);
      for (const c of children) {
        if (c.p.dead || c.p.won) continue;
        events.length = 0;
        Engine.stepPlayer(c.p, ACTIONS[c.a], world, DT, events);
        if (c.p.won && !winner) winner = c;
      }
    }
    steps++;
    if (winner) {
      const acts = [];
      for (let n = winner; n && n.parent; n = n.parent) acts.push(n.a);
      acts.reverse();
      return { ok: true, time: steps * SUB * DT, actions: acts };
    }
    // 重複を除き、先へ進んだものを優先して残す
    const seen = new Map();
    for (const c of children) {
      if (c.p.dead) continue;
      const k = keyOf(c.p, world);
      if (!seen.has(k)) seen.set(k, c);
    }
    let next = Array.from(seen.values());
    if (next.length > MAX_LAYER) {
      next.sort((a, b) => b.p.x - a.p.x);
      // 先頭(前に進んだもの)を多めに、残りは間引いて多様性を残す
      const keep = next.slice(0, MAX_LAYER * 0.7);
      const rest = next.slice(MAX_LAYER * 0.7);
      const stride = rest.length / (MAX_LAYER * 0.3);
      for (let i = 0; i < rest.length && keep.length < MAX_LAYER; i += stride) keep.push(rest[Math.floor(i)]);
      next = keep;
    }
    layer = next;
  }
  let best = 0;
  for (const n of layer) best = Math.max(best, n.p.x);
  return { ok: false, time: steps * SUB * DT, bestX: best / Engine.TILE };
}

function staticChecks(index) {
  const errors = [];
  const level = Engine.parseStage(STAGES[index], index);
  const T = Engine.TILE;
  const standOk = (sp, label) => {
    const tx = Math.floor((sp.x + Engine.PLAYER_W / 2) / T);
    const ty = Math.floor((sp.y + Engine.PLAYER_H) / T);
    if (!Engine.isSolid(level, tx, ty) && Engine.tileAt(level, tx, ty) !== '-') errors.push(`${label} の下に地面がありません (${tx},${ty})`);
    if (Engine.isSolid(level, tx, ty - 1)) errors.push(`${label} が地面に埋まっています`);
  };
  standOk(level.spawn, 'スタート');
  level.checkpoints.forEach((c, i) => standOk(c.spawn, `チェックポイント${i + 1}`));
  level.melons.forEach((m, i) => {
    if (Engine.isSolid(level, Math.floor(m.x / T), Math.floor(m.y / T))) errors.push(`スイカ${i + 1} が地面に埋まっています`);
  });
  return { level, errors };
}

// 1つのステージをすべて確認する(ワーカーの中で実行)
function checkStage(i, quick) {
  const { level, errors } = staticChecks(i);
  const t0 = Date.now();
  const starts = [-1].concat(level.checkpoints.map((_, ci) => ci));
  const label = (s) => (s < 0 ? 'スタート' : `CP${s + 1}`);
  const problems = [];
  const times = [];
  let main = null;
  for (const s of starts) {
    for (const ph of quick ? [0] : PHASES) {
      const r = solve(i, s, { phase: ph });
      if (!r.ok) problems.push(`${label(s)}から到達できず(タイミング+${ph}秒): x=${r.bestX.toFixed(1)}マス`);
      else if (ph === 0) { times.push(r.time); if (s < 0) main = r; }
    }
  }
  const nd = solve(i, -1, { noDash: true });
  if (i < NO_DASH_REQUIRED) {
    if (!nd.ok) problems.push(`ダッシュなしで到達できず: x=${nd.bestX.toFixed(1)}マス`);
    for (const s of starts.slice(1)) {
      const r = solve(i, s, { noDash: true });
      if (!r.ok) problems.push(`${label(s)}からダッシュなしで到達できず`);
    }
  }
  const ms = Date.now() - t0;
  const head = `${String(i + 1).padStart(2)}面 ${level.name.padEnd(10, '　')} 幅${level.w}マス スイカ${level.melons.length} 敵${level.enemies.length} CP${level.checkpoints.length}`;
  const all = problems.concat(errors);
  if (!all.length) {
    return { ok: true, actions: main.actions, time: times[0], text: `OK  ${head}  最短 ${times[0].toFixed(1)}秒` +
      (times.length > 1 ? ` / CPから ${times.slice(1).map((t) => t.toFixed(1) + '秒').join(', ')}` : '') +
      `  ${nd.ok ? 'ダッシュなしでもOK' : 'ダッシュ必須'}  (${(ms / 1000).toFixed(0)}秒)` };
  }
  return { ok: false, text: `NG  ${head}\n` + all.map((e) => '    ' + e).join('\n') };
}

function main() {
  const { Worker } = require('worker_threads');
  const os = require('os');
  const args = process.argv.slice(2);
  const save = args.includes('--save');
  const quick = args.includes('--quick');
  const only = args.filter((a) => /^\d+$/.test(a)).map((a) => parseInt(a, 10) - 1);
  const targets = only.length ? only : STAGES.map((_, i) => i);
  const solPath = path.join(__dirname, 'solutions.json');
  const solutions = save && fs.existsSync(solPath) ? JSON.parse(fs.readFileSync(solPath)) : {};
  const results = {};
  let next = 0, running = 0;
  const pool = Math.max(1, Math.min(os.cpus().length, targets.length));
  console.log(`${targets.length}面を確認中…(${quick ? 'かんたん' : 'タイミング4通り'}、${pool}並列)`);
  return new Promise((resolve) => {
    const launch = () => {
      if (next >= targets.length) { if (!running) resolve(); return; }
      const i = targets[next++];
      running++;
      const w = new Worker(__filename, { workerData: { i, quick } });
      w.on('message', (r) => { results[i] = r; console.log(r.text); });
      w.on('error', (e) => { results[i] = { ok: false, text: `NG  ${i + 1}面: ${e.message}` }; console.log(results[i].text); });
      w.on('exit', () => { running--; launch(); });
    };
    for (let k = 0; k < pool; k++) launch();
  }).then(() => {
    let fail = 0, total = 0;
    for (const i of targets) {
      const r = results[i];
      if (!r || !r.ok) fail++;
      else { solutions[i + 1] = r.actions; total += r.time; }
    }
    if (!only.length && !fail) console.log(`全10面の最短クリア合計: ${(total / 60).toFixed(1)}分 (ミスなし・最短ルートの場合)`);
    if (save) { fs.writeFileSync(solPath, JSON.stringify(solutions)); console.log('saved', solPath); }
    process.exit(fail ? 1 : 0);
  });
}

const wt = require('worker_threads');
if (wt.isMainThread) main();
else wt.parentPort.postMessage(checkStage(wt.workerData.i, wt.workerData.quick));
