// スマホ横画面での操作テスト（Playwright）：node tests/e2e.test.js [スクリーンショットの保存先]
import { createRequire } from 'node:module';
import { serve } from './serve.js';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const outDir = process.argv[2] || null;
const PORT = 8093;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'OK ' : 'NG '} ${name}${detail ? '  ' + detail : ''}`); };

const server = await serve(PORT);
const browser = await chromium.launch();
try {
  // iPhone 13 を横向きで
  const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/?seed=11`);
  await page.waitForFunction(() => window.__game);

  const vis = (sel) => page.locator(sel).isVisible();
  check('開始画面が出る', await vis('#ovStart.show'));
  check('横画面では回転の案内は出ない', !(await vis('#rotate')));
  const box = await page.locator('#game').boundingBox();
  const vp = page.viewportSize();
  check('16:9 で画面に収まる', Math.abs(box.width / box.height - 16 / 9) < 0.01 && box.width <= vp.width + 1 && box.height <= vp.height + 1, `${box.width.toFixed(0)}×${box.height.toFixed(0)} / 画面 ${vp.width}×${vp.height}`);

  await page.tap('#btnStart');
  check('出撃で開始画面が閉じる', !(await vis('#ovStart.show')));

  // 召喚ボタン（タップ）
  const slotBox = await page.locator('.slot[data-key="mass"]').boundingBox();
  check('召喚ボタンが指で押せる大きさ（44px以上）', slotBox.width >= 44 && slotBox.height >= 44, `${slotBox.width.toFixed(0)}×${slotBox.height.toFixed(0)}px`);
  await page.tap('.slot[data-key="mass"]');
  await page.waitForTimeout(150);
  let st = await page.evaluate(() => ({ n: window.__game.battle.entities.filter((e) => e.side === 'demon').length, mana: window.__game.battle.mana }));
  check('タップで召喚され、魔力が減る', st.n === 1 && st.mana < 200, `魔物 ${st.n} 体・魔力 ${st.mana.toFixed(0)}`);

  await page.tap('.slot[data-key="mass"]');
  await page.waitForTimeout(100);
  const toast1 = await page.locator('#toast').textContent();
  st = await page.evaluate(() => window.__game.battle.entities.filter((e) => e.side === 'demon').length);
  check('クールタイム中は再召喚できず、理由が出る', st === 1 && toast1.includes('再召喚'), `「${toast1}」`);
  check('ボタンに待ち時間が出る', (await page.locator('.slot[data-key="mass"] .why').textContent()).includes('秒'));

  await page.tap('.slot[data-key="vanguard"]');
  await page.waitForTimeout(100);
  const toast2 = await page.locator('#toast').textContent();
  check('魔力不足では召喚できず、理由が出る', toast2.includes('魔力が足りません'), `「${toast2}」`);
  check('魔力不足のボタンに表示が出る', (await page.locator('.slot[data-key="vanguard"] .why').textContent()) === '魔力不足');

  // 出撃上限
  await page.evaluate(() => { const b = window.__game.battle; for (let i = 0; i < 30; i++) { const d = b.spawn('demon', b.deck[0], 200); d.x = 200 + i; } });
  await page.waitForTimeout(80);
  await page.tap('.slot[data-key="ranged"]');
  await page.waitForTimeout(80);
  const toast3 = await page.locator('#toast').textContent();
  check('出撃上限では召喚できず、理由が出る', toast3.includes('出撃上限'), `「${toast3}」`);
  await page.evaluate(() => { const b = window.__game.battle; b.entities = b.entities.filter((e) => e.side !== 'demon'); });

  // 戦場のドラッグ
  const cam0 = await page.evaluate(() => window.__game.renderer.camX);
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5, { steps: 5 }); await page.mouse.up();
  const cam1 = await page.evaluate(() => window.__game.renderer.camX);
  check('戦場をドラッグで右へ動かせる', cam1 > cam0 + 100, `camX ${cam0.toFixed(0)} → ${cam1.toFixed(0)}`);

  // 2倍速
  const sp = async () => {
    const t0 = await page.evaluate(() => window.__game.battle.t); const r0 = Date.now();
    await page.waitForTimeout(2000);
    const t1 = await page.evaluate(() => window.__game.battle.t);
    return (t1 - t0) / ((Date.now() - r0) / 1000);
  };
  const s1 = await sp();
  await page.tap('#btnSpeed');
  const s2 = await sp();
  check('2倍速でゲーム内の時間が約2倍で進む', s2 / s1 > 1.8 && s2 / s1 < 2.2, `通常 ${s1.toFixed(2)} / 2倍 ${s2.toFixed(2)}（ゲーム秒/実秒）`);
  await page.tap('#btnSpeed');

  // 一時停止
  await page.tap('#btnPause');
  const tp = await page.evaluate(() => window.__game.battle.t); await page.waitForTimeout(500);
  check('一時停止で止まる', (await page.evaluate(() => window.__game.battle.t)) === tp && await vis('#ovPause.show'));
  await page.tap('#btnResume');

  // 多数のユニットでのフレームレート（30対30・2倍速）
  await page.evaluate(() => {
    const b = window.__game.battle;
    for (let i = 0; i < 30; i++) { const d = b.spawn('demon', b.deck[i % 4], 0); d.x = 700 + i * 8; }
    for (let i = 0; i < 30; i++) { const h = b.spawnHuman(i % 2 ? 'militia' : 'swordsman'); h.x = 760 + i * 8; }
    window.__game.renderer.centerOn(b, 800);
  });
  await page.tap('#btnSpeed');
  const fps = await page.evaluate(() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else ok(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  if (outDir) await page.screenshot({ path: `${outDir}/e2e_crowd.png` });
  check('30対30・2倍速でも重くならない（45fps以上）', fps >= 45, `${fps.toFixed(0)} fps（ヘッドレスの Chromium・CPU描画）`);
  await page.tap('#btnSpeed');

  // 魔王の呪文
  await page.evaluate(() => { window.__game.battle.spellCharge = 999; });
  const hpBefore = await page.evaluate(() => window.__game.battle.entities.filter((e) => e.side === 'human' && e.state !== 'dead').reduce((a, e) => a + e.hp, 0));
  await page.tap('#btnSpell');
  await page.waitForTimeout(200);
  const hpAfter = await page.evaluate(() => window.__game.battle.entities.filter((e) => e.side === 'human' && e.state !== 'dead').reduce((a, e) => a + e.hp, 0));
  check('魔王の呪文で人間軍にダメージ', hpAfter < hpBefore, `${hpBefore} → ${hpAfter}`);

  // 勝利 → リトライ
  await page.evaluate(() => { const b = window.__game.battle; b.damageBase(b.base, b.base.hp, null); });
  await page.waitForSelector('#ovResult.show', { timeout: 3000 });
  check('拠点を壊すと勝利画面', (await page.locator('#resTitle').textContent()).includes('侵略成功'));
  if (outDir) await page.screenshot({ path: `${outDir}/e2e_win.png` });
  await page.tap('#btnRetry');
  await page.waitForTimeout(200);
  st = await page.evaluate(() => ({ t: window.__game.battle.t, r: window.__game.battle.result, mana: window.__game.battle.mana }));
  check('もう一度で最初からやり直せる', st.r === null && st.t < 1 && st.mana < 230, `t=${st.t.toFixed(2)}`);

  // 敗北
  await page.evaluate(() => { const b = window.__game.battle; b.shrine.hp = 1; b.shrine.hp = 0; });
  await page.waitForSelector('#ovResult.show', { timeout: 3000 });
  check('祠を壊されると敗北画面', (await page.locator('#resTitle').textContent()).includes('祠'));
  if (outDir) await page.screenshot({ path: `${outDir}/e2e_lose.png` });

  check('コンソールにエラーが無い', errors.length === 0, errors.join(' / '));
  await ctx.close();

  // 縦持ち
  const ctx2 = await browser.newContext({ ...devices['iPhone 13'] });
  const p2 = await ctx2.newPage();
  await p2.goto(`http://localhost:${PORT}/`);
  await p2.waitForTimeout(300);
  check('縦持ちでは「横向きにしてください」が出る', await p2.locator('#rotate').isVisible());
  if (outDir) await p2.screenshot({ path: `${outDir}/e2e_portrait.png` });
  await ctx2.close();

  // PC（マウス・キーボード）
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p3 = await ctx3.newPage();
  await p3.goto(`http://localhost:${PORT}/?seed=2`);
  await p3.waitForFunction(() => window.__game);
  await p3.click('#btnStart');
  await p3.keyboard.press('1');
  await p3.waitForTimeout(150);
  check('PC：キー1で召喚', (await p3.evaluate(() => window.__game.battle.entities.length)) >= 1);
  await p3.waitForTimeout(3000);
  await p3.click('.slot[data-key="mass"]');
  await p3.waitForTimeout(150);
  check('PC：マウスで召喚', (await p3.evaluate(() => window.__game.battle.stats.summoned)) === 2);
  if (outDir) await p3.screenshot({ path: `${outDir}/e2e_pc.png` });
  await ctx3.close();
} finally {
  await browser.close();
  server.close();
}
const ng = results.filter((r) => !r.ok);
console.log(`\n${results.length - ng.length}/${results.length} OK`);
process.exit(ng.length ? 1 : 0);
