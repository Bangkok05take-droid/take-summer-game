#!/usr/bin/env node
/*
 * check-stages.js — 全ステージがゴールまで到達できるかを、実際のゲームと同じ物理で自動探索します。
 *
 *   node tools/check-stages.js            # 全ステージ
 *   node tools/check-stages.js 7          # 7面だけ
 *   node tools/check-stages.js --save     # 見つけた操作手順を tools/solutions.json に保存
 *
 * 0.1秒ごとに「左/右/なし × ジャンプ押す/離す」の6通りを試す幅優先探索です。
 * 同じ時刻の状態を同時に進めるので、動く足場や敵の位置も正しく再現されます。
 * 敵は「踏める・横から当たるとミス」で扱います(探索中は倒れずに残る = 厳しめの判定)。
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
for (const h of [-1, 0, 1]) for (const j of [false, true]) ACTIONS.push({ left: h < 0, right: h > 0, jump: j });

function clonePlayer(p) {
  const c = Object.assign({}, p);
  return c;
}

function keyOf(p, world) {
  const mi = p.mover ? world.movers.indexOf(p.mover) : -1;
  return [
    Math.round(p.x / 5), Math.round(p.y / 5), Math.round(p.vx / 60), Math.round(p.vy / 90),
    p.onGround ? 1 : 0, p.jumpHeld ? 1 : 0, p.jumping ? 1 : 0, mi, p.checkpoint,
  ].join(',');
}

function solve(index, fromCheckpoint) {
  const level = Engine.parseStage(STAGES[index], index);
  const world = Engine.createWorld(level);
  world.immortalEnemies = true;
  const spawn = fromCheckpoint >= 0 ? level.checkpoints[fromCheckpoint].spawn : level.spawn;
  const start = Engine.createPlayer(spawn);
  start.checkpoint = fromCheckpoint;
  let layer = [{ p: start, hist: null }];
  let steps = 0;
  const events = [];
  while (layer.length && steps * SUB * DT < MAX_TIME) {
    // 子状態を作る
    const children = [];
    for (const node of layer) {
      for (let a = 0; a < ACTIONS.length; a++) {
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

function main() {
  const args = process.argv.slice(2);
  const save = args.includes('--save');
  const only = args.filter((a) => /^\d+$/.test(a)).map((a) => parseInt(a, 10) - 1);
  const targets = only.length ? only : STAGES.map((_, i) => i);
  const solutions = {};
  let fail = 0;
  for (const i of targets) {
    const { level, errors } = staticChecks(i);
    const t0 = Date.now();
    const r = solve(i, -1);
    const cps = level.checkpoints.map((_, ci) => solve(i, ci));
    const ms = Date.now() - t0;
    const head = `${String(i + 1).padStart(2)}面 ${level.name.padEnd(8, '　')} 幅${level.w}マス スイカ${level.melons.length} CP${level.checkpoints.length}`;
    if (r.ok && cps.every((c) => c.ok) && !errors.length) {
      console.log(`OK  ${head}  最短クリア ${r.time.toFixed(1)}秒` +
        (cps.length ? ` / CPから ${cps.map((c) => c.time.toFixed(1) + '秒').join(', ')}` : '') + `  (${ms}ms)`);
      solutions[i + 1] = r.actions;
    } else {
      fail++;
      console.log(`NG  ${head}`);
      if (!r.ok) console.log(`    スタートから到達できず: 最も進んだ位置 x=${r.bestX.toFixed(1)}マス`);
      cps.forEach((c, ci) => { if (!c.ok) console.log(`    チェックポイント${ci + 1}から到達できず: x=${c.bestX.toFixed(1)}`); });
      errors.forEach((e) => console.log('    ' + e));
    }
  }
  if (save) {
    const out = path.join(__dirname, 'solutions.json');
    fs.writeFileSync(out, JSON.stringify(solutions));
    console.log('saved', out);
  }
  process.exit(fail ? 1 : 0);
}

main();
