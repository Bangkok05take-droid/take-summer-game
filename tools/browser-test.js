#!/usr/bin/env node
/*
 * browser-test.js — 実際のブラウザ(Chromium)でゲームを動かして確認するテスト
 *
 *   npx http-server -p 8123 .        (別のターミナルで)
 *   node tools/check-stages.js --save  (tools/solutions.json を作る)
 *   node tools/browser-test.js [--shots 出力フォルダ]
 *
 * スマホ横持ち(844x390, タッチあり)を想定して、タッチ操作・一時停止・保存・全10面のクリアを確認します。
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
const ACTIONS = [];
for (const h of [-1, 0, 1]) for (const j of [false, true]) ACTIONS.push({ left: h < 0, right: h > 0, jump: j });

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  OK   ' + name); }
  else { fail++; console.log('  NG   ' + name + (detail ? '  ' + detail : '')); }
}

async function center(page, sel) {
  const b = await page.locator(sel).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b };
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
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id != null ? p.id : i })) });
  const st = () => page.evaluate(() => Input.state());
  const pl = () => page.evaluate(() => { const p = __take.game.player; return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, onGround: p.onGround, dead: p.dead }; });

  console.log('■ タイトル画面');
  check('タイトルが表示される', await page.isVisible('#scr-title'));
  check('「つづきから」は最初は出ない', !(await page.isVisible('#btn-continue')));

  console.log('■ タッチ操作');
  await page.tap('#btn-new');
  await page.waitForTimeout(300);
  check('1面が始まる', (await page.evaluate(() => __take.screen)) === 'play');
  check('タッチボタンが表示される', await page.isVisible('#vb-jump'));
  const L = await center(page, '#vb-left'), R = await center(page, '#vb-right'), J = await center(page, '#vb-jump');

  // 右 + ジャンプ 同時押し
  await page.evaluate(() => { const p = __take.game.player; p.vx = 0; });
  await touch('touchStart', [{ ...R, id: 1 }]);
  await page.waitForTimeout(250);
  await touch('touchStart', [{ ...R, id: 1 }, { ...J, id: 2 }]);
  await page.waitForTimeout(60);
  let s = await st();
  let p = await pl();
  check('右とジャンプの同時入力', s.right && s.jump, JSON.stringify(s));
  check('同時押しで右へ進みながら上昇', p.vx > 100 && p.vy < 0, JSON.stringify(p));
  // ジャンプだけ離す
  await touch('touchEnd', [{ ...J, id: 2 }]);
  await page.waitForTimeout(50);
  s = await st();
  check('ジャンプを離しても右は押されたまま', s.right && !s.jump, JSON.stringify(s));
  // 指を ◀ へすべらせる
  await touch('touchMove', [{ x: L.x, y: L.y, id: 1 }]);
  await page.waitForTimeout(50);
  s = await st();
  check('指を ▶ から ◀ にすべらせると左になる', s.left && !s.right, JSON.stringify(s));
  // 指をボタンの外に出す
  await touch('touchMove', [{ x: 420, y: 150, id: 1 }]);
  await page.waitForTimeout(50);
  s = await st();
  check('指がボタンの外に出たら入力が消える', !s.left && !s.right && !s.jump, JSON.stringify(s));
  await page.waitForTimeout(300);
  p = await pl();
  check('外に出たあと止まる(勝手に動き続けない)', Math.abs(p.vx) < 1, JSON.stringify(p));
  await touch('touchEnd', [{ x: 420, y: 150, id: 1 }]);
  await page.waitForTimeout(50);

  // 長押しと短押しでジャンプの高さが変わる
  async function jumpHeight(frames) {
    // 本物のタッチ入力を使い、ゲームの時間はフレーム単位で進める(タイミングのぶれをなくす)
    await page.evaluate(() => { __take.freeze(true); const g = __take.game; g.player.x = g.level.spawn.x; g.player.y = g.level.spawn.y; g.player.vx = 0; g.player.vy = 0; __take.advance(30); });
    const y0 = (await pl()).y;
    await touch('touchStart', [{ ...J, id: 3 }]);
    let minY = await page.evaluate((n) => { let m = 1e9; for (let i = 0; i < n; i++) { __take.advance(1); m = Math.min(m, __take.game.player.y); } return m; }, frames);
    await touch('touchEnd', [{ ...J, id: 3 }]);
    minY = Math.min(minY, await page.evaluate(() => { let m = 1e9; for (let i = 0; i < 120; i++) { __take.advance(1); m = Math.min(m, __take.game.player.y); } __take.freeze(false); return m; }));
    return y0 - minY;
  }
  const hShort = await jumpHeight(5), hLong = await jumpHeight(48);
  check(`短く押すと低く(${hShort.toFixed(0)}px)、長く押すと高く(${hLong.toFixed(0)}px)跳ぶ`, hShort > 15 && hLong > hShort * 1.8);

  console.log('■ 一時停止と入力のリセット');
  await touch('touchStart', [{ ...R, id: 5 }]);
  await page.waitForTimeout(100);
  check('右を押している', (await st()).right);
  await page.evaluate(() => __take.pause());
  check('一時停止画面が出る', await page.isVisible('#scr-pause'));
  const xPause = (await pl()).x;
  await page.waitForTimeout(300);
  check('一時停止中は止まっている', Math.abs((await pl()).x - xPause) < 0.01);
  await page.evaluate(() => __take.resume());
  await page.waitForTimeout(300);
  s = await st();
  check('再開後、押したままの指は無効(入力が残らない)', !s.right, JSON.stringify(s));
  await touch('touchEnd', [{ ...R, id: 5 }]);
  await touch('touchStart', [{ ...R, id: 6 }]);
  await page.waitForTimeout(80);
  check('指を離して押し直すと、また反応する', (await st()).right);
  await touch('touchEnd', [{ ...R, id: 6 }]);
  // キーボード: 押したまま一時停止→再開
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(50);
  check('キーボードの → で右', (await st()).right);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  check('Esc で一時停止', (await page.evaluate(() => __take.screen)) === 'pause');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  check('再開後、押しっぱなしのキーは残らない', !(await st()).right);
  await page.keyboard.up('ArrowRight');
  // 画面切り替え(ステージ選択→別ステージ)
  await page.keyboard.down('ArrowLeft');
  await page.evaluate(() => { __take.pause(); });
  await page.click('#btn-pause-select');
  await page.click('.stage-card >> nth=0');
  await page.waitForTimeout(100);
  check('画面切り替え後にも入力が残らない', !(await st()).left);
  await page.keyboard.up('ArrowLeft');

  console.log('■ 敵を踏む / 横から当たる');
  await page.evaluate(() => __take.freeze(true));
  const stomp = await page.evaluate(() => {
    __take.startStage(0, -1); __take.freeze(true);
    const g = __take.game; const e = g.world.enemies[0]; const p = g.player;
    p.x = e.x + e.w / 2 - p.w / 2; p.y = e.y - p.h - 30; p.vy = 200; p.onGround = false;
    Input.setVirtual({ left: false, right: false, jump: false });
    __take.advance(20);
    Input.setVirtual(null);
    return { alive: e.alive, dead: p.dead, vy: p.vy };
  });
  check('上から落ちると敵を踏んでたおせる', !stomp.alive && !stomp.dead, JSON.stringify(stomp));
  check('踏んだ後は少し跳ねる', stomp.vy < 0, JSON.stringify(stomp));
  const side = await page.evaluate(() => {
    __take.startStage(0, -1); __take.freeze(true);
    const g = __take.game; const e = g.world.enemies[0]; const p = g.player;
    p.x = e.x - p.w - 6; p.y = e.y + e.h - p.h; p.vx = 0;
    Input.setVirtual({ left: false, right: true, jump: false });
    __take.advance(30);
    Input.setVirtual(null);
    return { alive: e.alive, dead: p.dead };
  });
  check('横から当たるとミス', side.dead && side.alive, JSON.stringify(side));
  const graze = await page.evaluate(() => {
    __take.startStage(0, -1); __take.freeze(true);
    const g = __take.game; const e = g.world.enemies[0]; const p = g.player;
    // 見た目では少し重なっているが、判定はやさしいのでセーフ
    p.x = e.x - p.w + 3; p.y = e.y + e.h - p.h; p.vx = 0;
    e.vx = 0; e.speed = 0;
    Input.setVirtual({ left: false, right: false, jump: false });
    __take.advance(1);
    Input.setVirtual(null);
    return { dead: p.dead };
  });
  check('ほんの少しのかすりはセーフ(やさしい当たり判定)', !graze.dead);

  console.log('■ 落下とチェックポイントからの復帰');
  const respawn = await page.evaluate(() => {
    __take.startStage(1, -1); __take.freeze(true);
    const g = __take.game; const c = g.level.checkpoints[0];
    const p = g.player; p.x = c.x; p.y = c.spawn.y; // チェックポイントにふれる
    Input.setVirtual({ left: false, right: false, jump: false });
    __take.advance(2);
    const cp = g.cp;
    // 穴の上に移動させて落とす
    let hole = -1;
    for (let tx = Math.floor(c.x / 32); tx < g.level.w; tx++) if (g.level.grid[11][tx] === '.') { hole = tx; break; }
    p.x = hole * 32 + 6; p.y = 9 * 32; p.vx = 0; p.vy = 0;
    __take.advance(120 * 2.5);
    Input.setVirtual(null);
    const q = g.player;
    return { cp, resumeCp: __take.save.resume.cp, dead: q.dead, x: q.x, spawnX: c.spawn.x, inv: q.invuln };
  });
  check('チェックポイントを通ると記録される', respawn.cp === 0 && respawn.resumeCp === 0, JSON.stringify(respawn));
  check('穴に落ちたらチェックポイントから復帰', !respawn.dead && Math.abs(respawn.x - respawn.spawnX) < 2, JSON.stringify(respawn));
  const enemyRespawn = await page.evaluate(() => {
    __take.startStage(0, -1); __take.freeze(true);
    const g = __take.game; const e = g.world.enemies[0]; const p = g.player;
    p.x = e.x - p.w - 4; p.y = e.y + e.h - p.h;
    Input.setVirtual({ left: false, right: true, jump: false });
    __take.advance(30);
    const died = p.dead;
    Input.setVirtual({ left: false, right: false, jump: false });
    __take.advance(120 * 1.5);
    Input.setVirtual(null);
    const q = g.player;
    return { died, dead: q.dead, x: q.x, sx: g.level.spawn.x };
  });
  check('敵でミスしたらすぐ再挑戦(スタート地点へ)', enemyRespawn.died && !enemyRespawn.dead && Math.abs(enemyRespawn.x - enemyRespawn.sx) < 2, JSON.stringify(enemyRespawn));

  console.log('■ 全10面のクリア(実際のゲームで、自動探索した操作を再生)');
  await page.evaluate(() => { localStorage.clear(); });
  for (let i = 0; i < 10; i++) {
    const acts = solutions[i + 1];
    if (!acts) { check(`${i + 1}面`, false, 'solutions.json に手順がありません'); continue; }
    const res = await page.evaluate(({ i, acts, ACTIONS }) => {
      __take.startStage(i, -1); __take.freeze(true);
      const g = __take.game;
      let deaths = 0;
      for (const a of acts) {
        Input.setVirtual(ACTIONS[a]);
        for (let k = 0; k < 12; k++) { __take.advance(1); if (g.player.dead) deaths++; }
        if (g.player.won) break;
      }
      Input.setVirtual({ left: false, right: false, jump: false });
      const won = g.player.won;
      __take.advance(240);
      Input.setVirtual(null);
      return { won, deaths, screen: __take.screen, unlocked: __take.save.unlocked, melons: g.melons, total: g.level.melons.length };
    }, { i, acts, ACTIONS });
    check(`${i + 1}面 ゴール到達 (ミス0, スイカ ${res.melons}/${res.total}) → ${res.screen}`, res.won && res.deaths === 0 &&
      (i < 9 ? res.screen === 'clear' && res.unlocked === i + 2 : res.screen === 'ending'), JSON.stringify(res));
    if (shotDir && i === 9) { await page.evaluate(() => __take.freeze(false)); await page.waitForTimeout(12000); await page.screenshot({ path: path.join(shotDir, 'ending.png') }); }
  }
  await page.evaluate(() => __take.freeze(false));

  console.log('■ 保存と途中再開');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    __take.startStage(0, -1); __take.freeze(true);
    const g = __take.game; g.player.x = g.level.goal.x - 30; Input.setVirtual({ right: true }); __take.advance(10);
    Input.setVirtual(null); __take.advance(240); __take.freeze(false);
  });
  await page.evaluate(() => { __take.startStage(1, -1); const g = __take.game; const c = g.level.checkpoints[0]; g.player.x = c.x; g.player.y = c.spawn.y; __take.advance(3); });
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
  // ミュート設定の保存
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
    const boxes = await page.evaluate(() => ['vb-left', 'vb-right', 'vb-jump', 'btn-pause', 'btn-mute'].map((id) => {
      const r = document.getElementById(id).getBoundingClientRect(); return { id, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
    }));
    const inside = boxes.every((b) => b.l >= 10 && b.t >= 6 && b.r <= sz.w - 10 && b.b <= sz.h - 10);
    const big = boxes.filter((b) => b.id.startsWith('vb')).every((b) => b.w >= 60 && b.h >= 60);
    const [bl, br, bj] = boxes;
    const noOverlap = br.l >= bl.r && bj.l > br.r + 100;
    check(`${sz.name} ${sz.w}x${sz.h}: ボタンが画面内・60px以上・重ならない`, inside && big && noOverlap, JSON.stringify(boxes.map((b) => [b.id, Math.round(b.l), Math.round(b.t), Math.round(b.w)])));
    if (shotDir) await page.screenshot({ path: path.join(shotDir, `layout-${sz.w}x${sz.h}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  check('縦持ちでは横向きの案内が出て、一時停止になる', (await page.isVisible('#scr-rotate')) && (await page.evaluate(() => __take.screen)) === 'pause');
  if (shotDir) await page.screenshot({ path: path.join(shotDir, 'portrait.png') });
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
