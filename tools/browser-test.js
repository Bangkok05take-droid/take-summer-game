#!/usr/bin/env node
/*
 * browser-test.js — 実際のブラウザ(Chromium)でゲームを動かして確認するテスト
 *
 *   npx http-server -p 8123 .          (別のターミナルで)
 *   node tools/check-stages.js --save  (tools/solutions.json を作る)
 *   node tools/browser-test.js [--shots 出力フォルダ]
 *
 * スマホ横持ち(844x390, タッチあり)を想定して、自動走行・ダッシュ・ジャンプ・変身・無敵・
 * 一時停止・保存・全10面のクリアを確認します。
 */
'use strict';
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const URL = process.env.GAME_URL || 'http://localhost:8123/index.html';
const args = process.argv.slice(2);
const shotDir = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const solutions = JSON.parse(fs.readFileSync(path.join(__dirname, 'solutions.json'), 'utf8'));
// tools/check-stages.js と同じ順番
const ACTIONS = [];
for (const d of [false, true]) for (const j of [false, true]) ACTIONS.push({ dash: d, jump: j });

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  OK   ' + name); }
  else { fail++; console.log('  NG   ' + name + (detail ? '  ' + detail : '')); }
}
async function center(page, sel) {
  const b = await page.locator(sel).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

(async () => {
  const browser = await playwright.chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_CERT|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id })) });
  const st = () => page.evaluate(() => Input.state());
  const pl = () => page.evaluate(() => { const p = __take.game.player; return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, onGround: p.onGround, dead: p.dead, form: p.form, kills: p.kills, melons: p.melons, starT: p.starT, hurtT: p.hurtT }; });
  // ゲーム内の時間をフレーム単位で進める
  const adv = (n, inp) => page.evaluate(({ n, inp }) => { if (inp) Input.setVirtual(inp); __take.advance(n); if (inp) Input.setVirtual(null); }, { n, inp });

  console.log('■ タイトルとストーリー');
  check('タイトル「たけ少年とサイちゃんの日本大冒険」', /サイちゃん/.test(await page.textContent('.title-logo')) && await page.isVisible('#scr-title'));
  await page.tap('#btn-new');
  await page.waitForTimeout(200);
  check('はじめから → ストーリーと操作の説明が出る', await page.isVisible('#scr-story') && /はぐれ/.test(await page.textContent('#scr-story')));
  await page.tap('#btn-story-start');
  await page.waitForTimeout(300);
  check('1面が始まる', (await page.evaluate(() => __take.screen)) === 'play');
  check('ボタンはダッシュとジャンプの2つだけ', await page.isVisible('#vb-dash') && await page.isVisible('#vb-jump') && (await page.$$('#controls .vbtn')).length === 2);
  check('「大人まで あと3体」「無敵まで あと5個」を表示', /大人まで あと3体/.test(await page.textContent('#hud-power')) && /無敵まで あと5個/.test(await page.textContent('#hud-star')));

  console.log('■ 自動走行とダッシュ');
  await page.evaluate(() => { __take.startStage(0, -1); __take.freeze(true); });
  const x0 = (await pl()).x;
  await adv(30, { dash: false, jump: false });
  check('スタート直後は少しだけ立ち止まる(0.5秒)', Math.abs((await pl()).x - x0) < 0.5);
  await adv(120, { dash: false, jump: false });
  let p = await pl();
  const PH = await page.evaluate(() => Engine.PHYS);
  check(`何も押さなくても右へ走る (速さ ${p.vx.toFixed(0)})`, p.x > x0 + 100 && Math.abs(p.vx - PH.runSpeed) < 1);
  // 速さは障害物のない平らな地面でくらべる
  const speeds = await page.evaluate(() => {
    const def = { name: 't', chunks: [['.'.repeat(200), '..P' + '.'.repeat(196) + 'G', '#'.repeat(200)]] };
    const lvl = Engine.parseStage(def, 0), w = Engine.createWorld(lvl), p = Engine.createPlayer(lvl.spawn), ev = [];
    const run = (n, dash) => { for (let i = 0; i < n; i++) { Engine.stepWorld(w, 1 / 120); Engine.stepPlayer(p, { dash, jump: false }, w, 1 / 120, ev); } return p.vx; };
    run(180, false);
    const mid = run(12, true), max = run(60, true), max2 = run(120, true), back = run(60, false);
    return { mid, max, max2, back };
  });
  const vMid = speeds.mid, vMax = speeds.max, vMax2 = speeds.max2;
  check(`ダッシュはなめらかに加速 (0.1秒後 ${vMid.toFixed(0)} → ${vMax.toFixed(0)})`, vMid > PH.runSpeed + 1 && vMid < PH.dashSpeed - 1);
  check(`ダッシュの上限は約1.5倍 (${vMax2.toFixed(0)} / ${PH.runSpeed})`, Math.abs(vMax2 / PH.runSpeed - 1.5) < 0.01);
  check('ダッシュを離すと通常速度に戻る', Math.abs(speeds.back - PH.runSpeed) < 1, JSON.stringify(speeds));

  // ダッシュ中は横のジャンプ距離が伸びる(平らな地面でくらべる)
  const dist = await page.evaluate(() => {
    const def = { name: 't', chunks: [['.'.repeat(80), '..P' + '.'.repeat(76) + 'G', '#'.repeat(80)]] };
    const res = {};
    for (const dash of [false, true]) {
      const lvl = Engine.parseStage(def, 0), w = Engine.createWorld(lvl), p = Engine.createPlayer(lvl.spawn), ev = [];
      for (let i = 0; i < 180; i++) { Engine.stepWorld(w, 1 / 120); Engine.stepPlayer(p, { dash, jump: false }, w, 1 / 120, ev); }
      const sx = p.x; let i = 0;
      do { Engine.stepWorld(w, 1 / 120); Engine.stepPlayer(p, { dash, jump: i < 40 }, w, 1 / 120, ev); i++; } while (!(p.onGround && i > 10) && i < 400);
      res[dash ? 'dash' : 'run'] = (p.x - sx) / 32;
    }
    return res;
  });
  check(`ダッシュ中はジャンプが遠くまで届く (通常 ${dist.run.toFixed(1)}マス → ダッシュ ${dist.dash.toFixed(1)}マス)`, dist.dash > dist.run * 1.3);

  console.log('■ タッチ操作');
  await page.evaluate(() => { __take.startStage(0, -1); __take.freeze(true); __take.advance(80); });
  const D = await center(page, '#vb-dash'), J = await center(page, '#vb-jump');
  await touch('touchStart', [{ ...D, id: 1 }]);
  await adv(30);
  await touch('touchStart', [{ ...D, id: 1 }, { ...J, id: 2 }]);
  await adv(4);
  let s = await st();
  p = await pl();
  check('ダッシュとジャンプの同時押し', s.dash && s.jump, JSON.stringify(s));
  check('同時押しで加速しながら上昇', p.vx > PH.runSpeed + 5 && p.vy < 0, JSON.stringify(p));
  await touch('touchEnd', [{ ...J, id: 2 }]);
  s = await st();
  check('ジャンプを離してもダッシュは押されたまま', s.dash && !s.jump, JSON.stringify(s));
  await touch('touchMove', [{ x: 420, y: 150, id: 1 }]);
  s = await st();
  check('指がボタンの外に出たら入力が消える', !s.dash && !s.jump, JSON.stringify(s));
  await touch('touchMove', [{ ...J, id: 1 }]);
  s = await st();
  check('指をダッシュからジャンプへすべらせると切り替わる', s.jump && !s.dash, JSON.stringify(s));
  await touch('touchEnd', [{ ...J, id: 1 }]);
  check('指を離すと入力は残らない', !(await st()).jump);

  async function jumpHeight(frames) {
    await page.evaluate(() => { __take.startStage(0, -1); __take.freeze(true); __take.advance(70); });
    const y0 = (await pl()).y;
    await touch('touchStart', [{ ...J, id: 3 }]);
    let minY = await page.evaluate((n) => { let m = 1e9; for (let i = 0; i < n; i++) { __take.advance(1); m = Math.min(m, __take.game.player.y); } return m; }, frames);
    await touch('touchEnd', [{ ...J, id: 3 }]);
    minY = Math.min(minY, await page.evaluate(() => { let m = 1e9; for (let i = 0; i < 90; i++) { __take.advance(1); m = Math.min(m, __take.game.player.y); } return m; }));
    return y0 - minY;
  }
  const hShort = await jumpHeight(5), hLong = await jumpHeight(48);
  check(`短く押すと低く(${hShort.toFixed(0)}px)、長く押すと高く(${hLong.toFixed(0)}px)跳ぶ`, hShort > 15 && hLong > hShort * 1.8);

  console.log('■ 一時停止と入力のリセット');
  await page.evaluate(() => { __take.startStage(0, -1); __take.freeze(false); });
  await page.waitForTimeout(700);
  await touch('touchStart', [{ ...D, id: 5 }]);
  await page.waitForTimeout(80);
  check('ダッシュを押している', (await st()).dash);
  await page.evaluate(() => __take.pause());
  check('一時停止画面が出る', await page.isVisible('#scr-pause'));
  const xPause = (await pl()).x;
  await page.waitForTimeout(300);
  check('一時停止中は止まっている', Math.abs((await pl()).x - xPause) < 0.01);
  await page.evaluate(() => __take.resume());
  await page.waitForTimeout(100);
  check('再開後、押したままの指は無効(入力が残らない)', !(await st()).dash);
  await touch('touchEnd', [{ ...D, id: 5 }]);
  await touch('touchStart', [{ ...D, id: 6 }]);
  await page.waitForTimeout(50);
  check('指を離して押し直すと、また反応する', (await st()).dash);
  await touch('touchEnd', [{ ...D, id: 6 }]);
  await page.keyboard.down('Shift');
  await page.keyboard.down('Space');
  await page.waitForTimeout(30);
  s = await st();
  check('PC: Shift でダッシュ、Space でジャンプ(同時押し)', s.dash && s.jump, JSON.stringify(s));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(30);
  check('Esc で一時停止', (await page.evaluate(() => __take.screen)) === 'pause');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  s = await st();
  check('再開後、押しっぱなしのキーは残らない', !s.dash && !s.jump, JSON.stringify(s));
  await page.keyboard.up('Shift');
  await page.keyboard.up('Space');

  console.log('■ 大人への変身');
  // 敵を主人公の真下に置いて、上から踏ませる
  const stompAt = () => page.evaluate(() => {
    const g = __take.game, p = g.player;
    const e = g.world.enemies.find((q) => q.alive);
    p.x = g.level.spawn.x; p.y = g.level.spawn.y - 60; p.vy = 300; p.onGround = false; p.hold = 0;
    e.x = p.x - 3; e.y = p.y + p.h - 2; e.vx = 0; e.type = 'walker';
    Input.setVirtual({ dash: false, jump: false });
    __take.advance(3);
    Input.setVirtual(null);
    e.alive = false;
    __take.advance(50);
  });
  await page.evaluate(() => { __take.startStage(3, -1); __take.freeze(true); __take.advance(80); });
  await stompAt();
  p = await pl();
  check('踏むと敵カウント1', p.kills === 1 && p.form === 'boy' && /あと2体/.test(await page.textContent('#hud-power')), JSON.stringify(p));
  await stompAt(); await stompAt();
  p = await pl();
  check('3体目で大人に変身、カウントは0に', p.form === 'adult' && p.kills === 0, JSON.stringify(p));
  check('変身の演出と「ガード1回」表示', /変身/.test(await page.textContent('#toast')) && /ガード1回/.test(await page.textContent('#hud-power')));
  await stompAt();
  p = await pl();
  check('大人の間は変身用カウントを貯めない', p.form === 'adult' && p.kills === 0, JSON.stringify(p));
  // 横からぶつかる
  const sideHit = () => page.evaluate(() => {
    const g = __take.game, p = g.player;
    let e = g.world.enemies.find((q) => q.alive);
    e.x = p.x + p.w - 8; e.y = p.y + p.h - e.h; e.vx = 0; e.type = 'walker';
    p.vy = 0;
    Input.setVirtual({ dash: false, jump: false });
    __take.advance(2);
    Input.setVirtual(null);
    return { e: e.alive };
  });
  await sideHit();
  p = await pl();
  check('大人で敵にぶつかるとミスにならず少年に戻る', !p.dead && p.form === 'boy' && p.kills === 0, JSON.stringify(p));
  check(`少年に戻った直後はダメージを受けない時間 (${p.hurtT.toFixed(1)}秒)`, p.hurtT > 1.9);
  await page.evaluate(() => { __take.advance(60); });
  await sideHit();
  p = await pl();
  check('保護時間中に同じ敵にふれてもミスにならない', !p.dead, JSON.stringify(p));
  await page.evaluate(() => { const g = __take.game; g.world.enemies.forEach((e) => { e.alive = false; }); g.player.y = g.level.spawn.y; __take.advance(240); });
  p = await pl();
  await page.evaluate(() => { const g = __take.game; g.world.enemies.forEach((e) => { e.alive = true; }); });
  await sideHit();
  p = await pl();
  check('保護時間が終わった少年はぶつかるとミス', p.dead, JSON.stringify(p));
  await adv(150);
  p = await pl();
  check('ミス後は少年・カウント0・無敵なしで再開', !p.dead && p.form === 'boy' && p.kills === 0 && p.melons === 0 && p.starT === 0, JSON.stringify(p));
  // 大人でトゲ
  const spike = await page.evaluate(() => {
    __take.startStage(3, -1); __take.freeze(true); __take.advance(80);
    const g = __take.game, p = g.player; p.form = 'adult';
    const lv = g.level; let sx = -1, sy = -1;
    for (let ty = 0; ty < lv.h && sx < 0; ty++) for (let tx = 0; tx < lv.w; tx++) if (lv.grid[ty][tx] === '^') { sx = tx; sy = ty; break; }
    lv.grid[sy][sx] = '.'; // 一時的に移動
    const tx = Math.floor((p.x + p.w / 2) / 32), ty = Math.floor((p.y + p.h - 1) / 32);
    lv.grid[ty][tx] = '^';
    __take.advance(2);
    lv.grid[ty][tx] = '.'; lv.grid[sy][sx] = '^';
    return { dead: p.dead, form: p.form, hurtT: p.hurtT };
  });
  check('大人でトゲにふれると少年に戻る(ミスにならない)', !spike.dead && spike.form === 'boy' && spike.hurtT > 1.9, JSON.stringify(spike));
  const adultFall = await page.evaluate(() => {
    __take.startStage(1, -1); __take.freeze(true); __take.advance(80);
    const g = __take.game, p = g.player; p.form = 'adult';
    p.y = g.level.h * 32 + 10; p.vy = 100;
    Input.setVirtual({ dash: false, jump: false }); __take.advance(40); Input.setVirtual(null);
    return { dead: p.dead };
  });
  check('大人でも穴に落ちるとミス', adultFall.dead);

  console.log('■ スイカ5個で無敵');
  const collect = () => page.evaluate(() => {
    const g = __take.game, p = g.player;
    const i = g.level.melons.findIndex((m, k) => !g.melonGot[k]);
    const m = g.level.melons[i];
    p.x = m.x - p.w / 2; p.y = m.y - p.h / 2; p.vy = 0;
    Input.setVirtual({ dash: false, jump: false }); __take.advance(1); Input.setVirtual(null);
  });
  await page.evaluate(() => { __take.startStage(0, -1); __take.freeze(true); __take.advance(80); });
  for (let k = 0; k < 4; k++) await collect();
  p = await pl();
  check('4個で「無敵まで あと1個」', p.melons === 4 && p.starT === 0 && /あと1個/.test(await page.textContent('#hud-star')), JSON.stringify(p));
  await collect();
  p = await pl();
  check('5個で8秒の無敵、カウントは0に', p.starT > 7.9 && p.melons === 0, JSON.stringify(p));
  check('無敵の演出と残り時間の表示', /無敵/.test(await page.textContent('#toast')) && /無敵 8秒/.test(await page.textContent('#hud-star')));
  const score1 = await page.evaluate(() => __take.game.melonGot.filter(Boolean).length);
  const t1 = (await pl()).starT;
  await collect();
  p = await pl();
  const score2 = await page.evaluate(() => __take.game.melonGot.filter(Boolean).length);
  check('無敵中のスイカはスコアだけ(延長・カウントなし)', score2 === score1 + 1 && p.melons === 0 && p.starT <= t1, JSON.stringify(p));
  await page.evaluate(() => { const g = __take.game; g.player.y = g.level.spawn.y; g.player.x = g.level.spawn.x + 100; __take.advance(30); });
  const vStar = (await pl()).vx;
  check('無敵で速さは変わらない', Math.abs(vStar - PH.runSpeed) < 1, String(vStar));
  const starSide = await page.evaluate(() => {
    const g = __take.game, p = g.player;
    const e = g.world.enemies.find((q) => q.alive);
    e.x = p.x + p.w - 2; e.y = p.y + p.h - e.h; e.vx = 0;
    const kills = p.kills;
    Input.setVirtual({ dash: false, jump: false }); __take.advance(2); Input.setVirtual(null);
    return { dead: p.dead, alive: e.alive, kills, kills2: p.kills };
  });
  check('無敵中は横からぶつかっても敵をたおせる', !starSide.dead && !starSide.alive, JSON.stringify(starSide));
  check('無敵中にたおした敵は変身カウントに入らない', starSide.kills2 === starSide.kills, JSON.stringify(starSide));
  await page.evaluate(() => { const g = __take.game; g.player.starT = 0.5; });
  await adv(70, { dash: false, jump: false });
  p = await pl();
  check('8秒たつと無敵が終わる', p.starT === 0 && /無敵まで あと5個/.test(await page.textContent('#hud-star')), JSON.stringify(p));
  const starFall = await page.evaluate(() => {
    __take.startStage(1, -1); __take.freeze(true); __take.advance(80);
    const g = __take.game, p = g.player; p.starT = 5;
    p.y = g.level.h * 32 + 10; p.vy = 100;
    Input.setVirtual({ dash: false, jump: false }); __take.advance(40); Input.setVirtual(null);
    return { dead: p.dead };
  });
  check('無敵中でも穴に落ちるとミス', starFall.dead);
  await adv(120);
  p = await pl();
  check('ミス後は無敵が切れて少年から再開', !p.dead && p.starT === 0 && p.form === 'boy', JSON.stringify(p));

  console.log('■ チェックポイント');
  const respawn = await page.evaluate(() => {
    __take.startStage(1, -1); __take.freeze(true);
    const g = __take.game; const c = g.level.checkpoints[0];
    const p = g.player; p.x = c.x; p.y = c.spawn.y; p.hold = 0;
    Input.setVirtual({ dash: false, jump: false });
    __take.advance(2);
    const cp = g.cp;
    p.form = 'adult'; p.melons = 3;
    p.y = g.level.h * 32 + 10; p.vy = 100;
    __take.advance(120 * 1.2);
    Input.setVirtual(null);
    const q = g.player;
    return { cp, resumeCp: __take.save.resume.cp, dead: q.dead, x: q.x, spawnX: c.spawn.x, form: q.form, melons: q.melons, hurtT: q.hurtT };
  });
  check('チェックポイントを通ると記録される', respawn.cp === 0 && respawn.resumeCp === 0, JSON.stringify(respawn));
  check('落ちたらチェックポイントから少年・カウント0で復帰', !respawn.dead && Math.abs(respawn.x - respawn.spawnX) < 2 && respawn.form === 'boy' && respawn.melons === 0, JSON.stringify(respawn));

  console.log('■ 全10面のクリア(実際のゲームで、自動探索した操作を再生)');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(300);
  for (let i = 0; i < 10; i++) {
    const acts = solutions[i + 1];
    if (!acts) { check(`${i + 1}面`, false, 'solutions.json に手順がありません'); continue; }
    const res = await page.evaluate(({ i, acts, ACTIONS }) => {
      __take.startStage(i, -1); __take.freeze(true);
      const g = __take.game;
      let deaths = 0, toast = '';
      for (const a of acts) {
        Input.setVirtual(ACTIONS[a]);
        for (let k = 0; k < 12; k++) { __take.advance(1); if (g.player.dead) deaths++; }
        if (g.player.won) break;
      }
      Input.setVirtual({ dash: false, jump: false });
      const won = g.player.won;
      __take.advance(30);
      toast = document.getElementById('toast').textContent;
      __take.advance(300);
      Input.setVirtual(null);
      return { won, deaths, toast, screen: __take.screen, unlocked: __take.save.unlocked };
    }, { i, acts, ACTIONS });
    check(`${i + 1}面 ${res.won ? 'サイちゃんに到着' : '未到達'} (ミス${res.deaths}) → ${res.screen}`, res.won && res.deaths === 0 && /サイちゃん、みつけた/.test(res.toast) &&
      (i < 9 ? res.screen === 'clear' && res.unlocked === i + 2 : res.screen === 'ending'), JSON.stringify(res));
    if (shotDir && i === 0) await page.screenshot({ path: path.join(shotDir, 'clear.png') });
    if (i < 9) {
      const reset = await page.evaluate((i) => { __take.startStage(i + 1, -1); const p = __take.game.player; return { form: p.form, kills: p.kills, melons: p.melons, starT: p.starT }; }, i);
      if (i === 0) check('次のステージは少年・カウント0・無敵なしで始まる', reset.form === 'boy' && reset.kills === 0 && reset.melons === 0 && reset.starT === 0, JSON.stringify(reset));
    }
  }
  if (shotDir) { await page.evaluate(() => __take.freeze(false)); await page.waitForTimeout(12000); await page.screenshot({ path: path.join(shotDir, 'ending.png') }); }
  await page.evaluate(() => __take.freeze(false));

  console.log('■ 保存と途中再開');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    __take.startStage(0, -1); __take.freeze(true);
    const g = __take.game; g.player.x = g.level.goal.x - 40; g.player.hold = 0;
    Input.setVirtual({ dash: false, jump: false }); __take.advance(400); Input.setVirtual(null);
    __take.startStage(1, -1);
    const c = __take.game.level.checkpoints[0]; __take.game.player.x = c.x; __take.game.player.y = c.spawn.y; __take.game.player.hold = 0; __take.advance(3);
    __take.freeze(false);
  });
  await page.reload();
  await page.waitForTimeout(400);
  const contText = await page.textContent('#btn-continue');
  check('再読み込み後「つづきから」が出る(2面・チェックポイント)', (await page.isVisible('#btn-continue')) && /2面/.test(contText) && /チェックポイント/.test(contText), contText);
  await page.tap('#btn-continue');
  await page.waitForTimeout(200);
  const cont = await page.evaluate(() => ({ i: __take.game.index, cp: __take.game.cp, x: __take.game.player.x, cx: __take.game.level.checkpoints[0].spawn.x }));
  check('つづきから → 2面のチェックポイントから再開', cont.i === 1 && cont.cp === 0 && Math.abs(cont.x - cont.cx) < 1, JSON.stringify(cont));
  await page.evaluate(() => __take.setScreen('select'));
  const cards = await page.$$eval('.stage-card', (els) => els.map((e) => !e.disabled));
  check('ステージ選択: 1〜2面が解放、3面以降はロック', cards[0] && cards[1] && !cards[2], JSON.stringify(cards));
  await page.evaluate(() => __take.setScreen('title'));
  await page.tap('#btn-mute-title');
  await page.reload();
  await page.waitForTimeout(300);
  check('ミュート設定が保存される', await page.evaluate(() => __take.save.muted === true && Sound.isMuted()));
  await page.tap('#btn-mute-title');

  console.log('■ 画面サイズとボタン配置');
  const sizes = [
    { name: 'iPhone SE 横', w: 667, h: 375 }, { name: 'iPhone 15 横', w: 852, h: 393 },
    { name: 'Android 横', w: 915, h: 412 }, { name: 'iPad 横', w: 1024, h: 768 },
  ];
  for (const sz of sizes) {
    await page.setViewportSize({ width: sz.w, height: sz.h });
    await page.evaluate(() => { __take.startStage(6, -1); });
    await page.waitForTimeout(300);
    const boxes = await page.evaluate(() => ['vb-dash', 'vb-jump', 'btn-pause', 'btn-mute', 'hud-star'].map((id) => {
      const r = document.getElementById(id).getBoundingClientRect(); return { id, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
    }));
    const inside = boxes.every((b) => b.l >= 10 && b.t >= 6 && b.r <= sz.w - 10 && b.b <= sz.h - 10);
    const [bd, bj, bp, bm, bs] = boxes;
    const big = bd.w >= 84 && bj.w >= 84;
    const noOverlap = bj.l > bd.r + 200 && bs.r < bm.l;
    // 主人公が左のボタンに隠れない
    const pScreen = await page.evaluate(() => { const g = __take.game; const r = document.getElementById('game').getBoundingClientRect(); return (g.player.x + 10 - g.cam.x) * (r.height / (14 * 32)); });
    check(`${sz.name} ${sz.w}x${sz.h}: ボタンが画面内・大きい・重ならない・主人公が隠れない`, inside && big && noOverlap && pScreen > bd.r, JSON.stringify(boxes.map((b) => [b.id, Math.round(b.l), Math.round(b.t), Math.round(b.w)])) + ' player@' + Math.round(pScreen));
    if (shotDir) await page.screenshot({ path: path.join(shotDir, `layout-${sz.w}x${sz.h}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  check('縦持ちでは横向きの案内が出て、一時停止になる', (await page.isVisible('#scr-rotate')) && (await page.evaluate(() => __take.screen)) === 'pause');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  check('横に戻すと案内が消える', !(await page.isVisible('#scr-rotate')));

  console.log('■ スクロール・拡大の防止');
  const sc = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return { touchAction: cs.touchAction, overflow: cs.overflow, vp: document.querySelector('meta[name=viewport]').content };
  });
  check('touch-action:none / overflow:hidden / user-scalable=no', sc.touchAction === 'none' && sc.overflow === 'hidden' && /user-scalable=no/.test(sc.vp), JSON.stringify(sc));

  check('JavaScript のエラーなし', errors.length === 0, errors.join(' | '));
  console.log(`\n結果: ${pass} OK / ${fail} NG`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
