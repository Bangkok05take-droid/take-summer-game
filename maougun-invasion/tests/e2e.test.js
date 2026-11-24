// ブラウザでの通しテスト（Playwright）：node tests/e2e.test.js [スクリーンショットの保存先]
//  タイトル → オープニング → 1-1 → 報告・戦利品・解放 → 1-2〜1-5 → 再読み込みでセーブ確認 → 強化 → リセット
import { createRequire } from 'node:module';
import { serve } from './serve.js';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const outDir = process.argv[2] || null;
const PORT = 8093;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'OK ' : 'NG '} ${name}${detail ? '  ' + detail : ''}`); };
const shot = async (page, name) => { if (outDir) await page.screenshot({ path: `${outDir}/${name}.png` }); };

const server = await serve(PORT);
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const url = `http://localhost:${PORT}/?seed=11`;
  await page.goto(url);
  await page.waitForFunction(() => window.__game);
  const vis = (sel) => page.locator(sel).isVisible();
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const screen = () => ev(() => window.__game.app.screen);
  // 承認済みの絵の読み込みを待つ（waitForFunction に async 関数を渡すと Promise が真になり待たないため、ここで繰り返し確かめる）
  const waitSprite = async (key) => {
    for (let i = 0; i < 100; i++) {
      if (await ev(async (k) => { const { spriteFor } = await import('./js/render/shapes.js'); return !!spriteFor(k); }, key)) return;
      await page.waitForTimeout(100);
    }
    throw new Error(`絵が読み込まれない：${key}`);
  };

  // ---- タイトル ----
  check('タイトル画面が出る', await vis('#scTitle'));
  check('セーブが無いときは「つづきから」が出ない', !(await vis('#btnContinue')));
  const box = await page.locator('#game').boundingBox();
  const vp = page.viewportSize();
  check('16:9 で画面に収まる', Math.abs(box.width / box.height - 16 / 9) < 0.01 && box.width <= vp.width + 1 && box.height <= vp.height + 1, `${box.width.toFixed(0)}×${box.height.toFixed(0)}`);
  await shot(page, '01_title');

  // ---- オープニング（会話・スキップ） ----
  await page.tap('#btnNew');
  check('オープニングの会話が始まる', await vis('#scTalk'));
  const t1 = await page.locator('#talkText').textContent();
  await page.tap('#talkBox');
  const t2 = await page.locator('#talkText').textContent();
  check('タップで次の会話へ進む', t1 !== t2);
  await page.tap('#talkBox'); await shot(page, '02_opening');
  await page.tap('#btnSkip');
  await page.waitForTimeout(200);
  check('スキップで 1-1 の戦闘が始まる', (await screen()) === 'battle' && (await ev(() => window.__game.app.stageId)) === '1-1');
  check('オープニングを見た記録が残る', await ev(() => JSON.parse(localStorage.getItem('maougunInvasion.save')).story.opening === true));

  // ---- 1-1 の操作 ----
  check('初期の召喚カードは4種', (await page.locator('.slot').count()) === 4);
  const bgs = await ev(async () => { const { SKIN } = await import('./js/data/skin.js'); const r = window.__game.renderer; const g = SKIN.images.stageBg; return { s11: (g['1-1'] || {}).src, s12: (g['1-2'] || g.chapter1).src, drawn: !!document.querySelector('canvas') }; });
  check('1-1 の背景は小さな村・1-2 以降は町の背景のまま', bgs.s11 === 'assets/approved/bg/village_small.png' && bgs.s12 === 'assets/approved/bg/ch1_village.webp', JSON.stringify(bgs));
  await waitSprite('mass');
  const gumi = await ev(async () => { const { spriteFor } = await import('./js/render/shapes.js'); const sp = spriteFor('mass'); const cv = document.querySelector('.slot[data-key="mass"] canvas'); const px = cv && cv.getContext('2d').getImageData(cv.width / 2, cv.height - 8, 1, 1).data; return { label: document.querySelector('.slot[data-key="mass"]').textContent, w: sp.img.width, src: sp.src, px: px && [...px] }; });
  check('グミ：名前が「グミ」・承認済みの画像が読み込まれる', gumi.label.includes('グミ') && gumi.src === 'assets/approved/units/mass.png', JSON.stringify({ label: gumi.label, w: gumi.w }));
  check('グミ：召喚カードのアイコンが承認済みの画像（水色）になる', gumi.px && gumi.px[2] > gumi.px[0] + 40, JSON.stringify(gumi.px));
  await waitSprite('vanguard');
  const knight = await ev(async () => { const { spriteFor } = await import('./js/render/shapes.js'); const sp = spriteFor('vanguard'); const cv = document.querySelector('.slot[data-key="vanguard"] canvas'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let orange = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] > 200 && d[i + 1] > 60 && d[i + 1] < 150 && d[i + 2] < 80) orange++; return { label: document.querySelector('.slot[data-key="vanguard"]').textContent, src: sp.src, w: sp.img.width, orange }; });
  check('闇の騎士：名前と承認済みの画像（256×256）が読み込まれる', knight.label.includes('闇の騎士') && knight.src === 'assets/approved/units/vanguard.png' && knight.w === 256, JSON.stringify(knight));
  check('闇の騎士：召喚カードのアイコンが承認済みの画像（オレンジの羽根飾り）になる', knight.orange > 20, String(knight.orange));
  await waitSprite('tank');
  const rock = await ev(async () => { const { spriteFor } = await import('./js/render/shapes.js'); const sp = spriteFor('tank'); const cv = document.querySelector('.slot[data-key="tank"] canvas'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let brown = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] > 120 && d[i] - d[i + 2] > 40 && d[i + 1] > 70) brown++; return { label: document.querySelector('.slot[data-key="tank"]').textContent, src: sp.src, brown }; });
  check('岩男：名前と承認済みの画像が読み込まれる', rock.label.includes('岩男') && rock.src === 'assets/approved/units/tank.png', JSON.stringify(rock));
  check('岩男：召喚カードのアイコンが承認済みの画像（茶色の岩）になる', rock.brown > 50, String(rock.brown));
  await waitSprite('ranged');
  const gob = await ev(async () => { const { spriteFor, } = await import('./js/render/shapes.js'); const { Renderer } = await import('./js/render/renderer.js'); const sp = spriteFor('ranged'); const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; Renderer.thumb(cv, 'ranged', 0.85); const d = cv.getContext('2d').getImageData(0, 0, 64, 64).data; let green = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i + 1] > 110 && d[i + 1] > d[i] + 15 && d[i + 1] > d[i + 2] + 40) green++; return { src: sp.src, green }; });
  check('弓ゴブリン：承認済みの画像が読み込まれ、カード用の絵（緑の顔）になる', gob.src === 'assets/approved/units/ranged.png' && gob.green > 20, JSON.stringify(gob));
  const ph = await ev(async () => { const { SKIN } = await import('./js/data/skin.js'); return { fast: !!SKIN.sprites.fast, area: !!SKIN.sprites.area, special: !!SKIN.sprites.special }; });
  check('こうもり・魔法使い・プチデビルは画像未登録（仮のドット絵）', !ph.fast && !ph.area && !ph.special, JSON.stringify(ph));
  await waitSprite('healer');
  const ghost = await ev(async () => { const { spriteFor } = await import('./js/render/shapes.js'); const { Renderer } = await import('./js/render/renderer.js'); const { SKIN } = await import('./js/data/skin.js'); const sp = spriteFor('healer'); const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; Renderer.thumb(cv, 'healer', 0.85); const d = cv.getContext('2d').getImageData(0, 0, 64, 64).data; let leaf = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i + 1] > 120 && d[i + 1] > d[i] + 20 && d[i + 1] > d[i + 2] + 60) leaf++; return { name: SKIN.names.healer, src: sp.src, leaf }; });
  check('森のお化け：名前と承認済みの画像・カード用の絵（緑の葉）', ghost.name === '森のお化け' && ghost.src === 'assets/approved/units/healer.png' && ghost.leaf > 20, JSON.stringify(ghost));
  const slotBox = await page.locator('.slot[data-key="mass"]').boundingBox();
  check('召喚カードが指で押せる大きさ（44px以上）', slotBox.width >= 44 && slotBox.height >= 44, `${slotBox.width.toFixed(0)}×${slotBox.height.toFixed(0)}px`);
  await page.tap('.slot[data-key="mass"]');
  await page.waitForTimeout(150);
  let st = await ev(() => { const b = window.__game.battle; const d = b.entities.find((e) => e.side === 'demon'); return { n: b.entities.filter((e) => e.side === 'demon').length, mana: b.mana, x: d && d.x, shrine: b.shrine.x }; });
  check('タップで召喚され、魔力が減る（祠の前＝右に出る）', st.n === 1 && st.mana < 200 && st.x > st.shrine - 120, `魔物 ${st.n}・魔力 ${st.mana.toFixed(0)}`);
  await page.waitForTimeout(800);
  const x2 = await ev(() => window.__game.battle.entities.find((e) => e.side === 'demon').x);
  check('魔物は右から左へ進む', x2 < st.x - 20, `${st.x.toFixed(0)} → ${x2.toFixed(0)}`);
  const hx = await ev(() => { const b = window.__game.battle; const h = b.spawnHuman('militia'); return h.x; });
  await page.waitForTimeout(600);
  const hx2 = await ev(() => window.__game.battle.entities.filter((e) => e.side === 'human').pop().x);
  check('人間軍は左から右へ進む', hx2 > hx + 10, `${hx.toFixed(0)} → ${hx2.toFixed(0)}`);

  await page.tap('.slot[data-key="mass"]'); await page.waitForTimeout(80);
  const toastCd = await page.locator('#toast').textContent();
  check('クールタイム中は再召喚できず、理由が出る', toastCd.includes('再召喚'), `「${toastCd}」`);
  await page.tap('.slot[data-key="tank"]'); await page.waitForTimeout(80);
  const toastMana = await page.locator('#toast').textContent();
  check('魔力不足では召喚できず、理由が出る', toastMana.includes('魔力が足りません'), `「${toastMana}」`);
  check('カードに理由が出る（魔力不足）', (await page.locator('.slot[data-key="tank"] .why').textContent()) === '魔力不足');

  // 2倍速
  const rate = async () => { const t0 = await ev(() => window.__game.battle.t); const r0 = Date.now(); await page.waitForTimeout(1500); return ((await ev(() => window.__game.battle.t)) - t0) / ((Date.now() - r0) / 1000); };
  const s1 = await rate(); await page.tap('#btnX2'); const s2 = await rate(); await page.tap('#btnX1');
  check('2倍速でゲーム内の時間が約2倍で進む', s2 / s1 > 1.8 && s2 / s1 < 2.2, `${s1.toFixed(2)} → ${s2.toFixed(2)}`);

  // 一時停止・リトライ
  await page.tap('#btnPause');
  const tp = await ev(() => window.__game.battle.t); await page.waitForTimeout(400);
  check('一時停止で止まる', (await ev(() => window.__game.battle.t)) === tp && await vis('#ovPause'));
  await page.tap('#btnRetryP'); await page.waitForTimeout(150);
  st = await ev(() => { const b = window.__game.battle; return { t: b.t, n: b.entities.length, mana: b.mana, base: b.base.hp === b.base.maxHp, cd: Object.values(b.cooldowns).every((c) => c === 0), spell: b.spellCharge }; });
  check('リトライで戦闘が初期化される', st.t < 0.5 && st.n <= 1 && st.mana < 215 && st.base && st.cd && st.spell < 0.5, JSON.stringify(st));

  // 30対30のフレームレート
  await ev(() => {
    const b = window.__game.battle;
    for (let i = 0; i < 30; i++) { const d = b.spawn('demon', b.deck[i % 4], 0); d.x = 900 + i * 8; }
    for (let i = 0; i < 30; i++) { const h = b.spawnHuman(i % 2 ? 'militia' : 'swordsman'); h.x = 840 + i * 8; }
    window.__game.renderer.centerOn(b, 900);
  });
  await page.tap('#btnX2');
  const fps = await ev(() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else ok(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  await shot(page, '03_battle_crowd');
  check('30対30・2倍速でも重くならない（45fps以上）', fps >= 45, `${fps.toFixed(0)} fps`);
  await page.tap('#btnX1');

  // 魔王の呪文
  await ev(() => { window.__game.battle.spellCharge = 999; });
  check('呪文がたまるとボタンが光る', await page.locator('#btnSpell.full').count() === 1 || (await page.waitForTimeout(100), await page.locator('#btnSpell.full').count()) === 1);
  const hp0 = await ev(() => window.__game.battle.entities.filter((e) => e.side === 'human' && e.state !== 'dead').reduce((a, e) => a + e.hp, 0));
  await page.tap('#btnSpell'); await page.waitForTimeout(150);
  const hp1 = await ev(() => window.__game.battle.entities.filter((e) => e.side === 'human' && e.state !== 'dead').reduce((a, e) => a + e.hp, 0));
  check('魔王の呪文で人間軍にダメージ', hp1 < hp0, `${hp0} → ${hp1}`);

  // ---- 勝利 → 報告 → 戦利品 → 解放 → 選択 ----
  const winStage = async () => {
    await ev(() => { const b = window.__game.battle; b.damageBase(b.base, b.base.hp); });
    await page.waitForSelector('#scResult:not([hidden])', { timeout: 3000 });
  };
  await winStage();
  check('拠点を壊すと勝利画面', (await page.locator('#resTitle').textContent()).includes('侵略成功'));
  await shot(page, '04_result');
  await page.tap('#btnReport');
  check('勝利後に側近の報告（会話）', await vis('#scTalk'));
  await shot(page, '05_report');
  await page.tap('#btnSkip');
  check('戦利品の画面', await vis('#scLoot') && (await page.locator('#lootName').textContent()).length > 0);
  await shot(page, '06_loot');
  await page.tap('#btnLootNext');
  check('ユニット解放の画面（1-1 → 弓ゴブリン）', await vis('#scUnlock') && (await page.locator('#unlockName').textContent()) === '弓ゴブリン');
  await shot(page, '07_unlock');
  await page.tap('#btnUnlockNext');
  check('ステージ選択に戻り、1-2 が解放される', await vis('#scSelect') && !(await page.locator('.node[data-stage="1-2"]').isDisabled()) && await page.locator('.node[data-stage="1-3"]').isDisabled());
  await shot(page, '08_select');

  // ---- 再読み込みでセーブ確認 ----
  await page.reload(); await page.waitForFunction(() => window.__game);
  check('再読み込み後「つづきから」が出る', await vis('#btnContinue'));
  await page.tap('#btnContinue');
  check('セーブが保持される（1-1 制圧ずみ・1-2 解放）', (await page.locator('.node[data-stage="1-1"]').getAttribute('class')).includes('cleared') && !(await page.locator('.node[data-stage="1-2"]').isDisabled()));

  // ---- 強化 ----
  await page.tap('#btnUpgrade');
  const stones0 = Number(await page.locator('#upStones').textContent());
  await page.tap('#upUnits button[data-unit="mass"]');
  const stones1 = Number(await page.locator('#upStones').textContent());
  check('強化画面で魔界石を使ってレベルが上がる', stones1 < stones0 && (await ev(() => window.__game.app.profile.units.mass.level)) === 2, `${stones0} → ${stones1}`);
  await shot(page, '09_upgrade');
  await page.tap('#btnUpBack');

  // ---- 1-2〜1-5 ----
  // ステージ選択 → （初回は会話）→ 偵察報告 → 編成 → 出撃
  const sortie = async (id) => {
    await page.tap(`.node[data-stage="${id}"]`, { force: true });
    if (await vis('#scTalk')) await page.tap('#btnSkip');
    await page.waitForSelector('#scRecon:not([hidden])', { timeout: 3000 });
    const recon = { text: await page.locator('#reconText').textContent(), enemies: await page.locator('#reconEnemies .enemy').count() };
    await page.tap('#btnReconNext');
    await page.waitForSelector('#scForm:not([hidden])', { timeout: 3000 });
    const form = await ev(() => ({ units: document.querySelectorAll('#formUnits .fcard').length, locked: document.querySelectorAll('#formUnits .fslot.locked').length, bosses: document.querySelectorAll('#formBosses .fcard').length, bossLocked: document.querySelectorAll('#formBosses .fslot.locked').length, pool: document.querySelectorAll('#formPool .fcard').length }));
    return { recon, form };
  };
  const playStage = async (id, unlockName) => {
    const { recon, form } = await sortie(id);
    if (id === '1-2') {
      check('偵察報告：側近の1行報告と、敵の兵種カード（1-2：自警団・見習い剣士・弓兵）', recon.text.includes('弓兵') && recon.enemies === 3 && await page.locator('#reconWho').textContent() === 'ヴェイル', JSON.stringify(recon));
      check('編成：通常5枠＋6枠目は鍵・幹部1枠＋2枠目は鍵（1-2 の時点で控えはなし）', form.units === 5 && form.locked === 1 && form.bossLocked === 1 && form.pool === 0, JSON.stringify(form));
      await shot(page, '12_formation');
      await page.tap('#btnEnemyInfo');
      check('編成画面から敵軍情報を開ける', await vis('#ovEnemy') && (await page.locator('#ovEnemyList .enemy').count()) === 3);
      await page.tap('#btnEnemyClose');
      // 外す → 控えに移り、保存される → もう一度入れる
      await page.tap('#formUnits .fcard[data-key="mass"]');
      const saved = await ev(() => JSON.parse(localStorage.getItem('maougunInvasion.save')).formation.units);
      check('編成から外すと控えに移り、保存される', !saved.includes('mass') && (await page.locator('#formPool .fcard[data-key="mass"]').count()) === 1, JSON.stringify(saved));
      await page.tap('#formPool .fcard[data-key="mass"]');
    }
    if (id === '1-4') check('大魔王Lv4（1-3クリア）で通常6枠に・森のお化けが自動で入る', form.units === 6 && form.locked === 0, JSON.stringify(form));
    await page.tap('#btnSortie');
    await page.waitForTimeout(150);
    const ok = (await screen()) === 'battle' && (await ev(() => window.__game.app.stageId)) === id;
    const ns = await page.locator('.slot').count();
    // 少し本当に戦ってから勝たせる
    await ev(() => { const b = window.__game.battle; for (let i = 0; i < 600; i++) { for (const d of b.deck) if (b.canSummon(d.key).ok) { b.queue({ type: 'summon', key: d.key }); break; } b.step(); } });
    if (id === '1-5') {
      await ev(() => { const b = window.__game.battle; b.damageBase(b.base, b.base.hp - b.base.maxHp * 0.69); for (let i = 0; i < 90; i++) b.step(); });
      const take = await ev(() => window.__game.battle.entities.some((e) => e.key === 'take'));
      await page.waitForTimeout(400); await shot(page, '10_hero');
      await ev(() => { const b = window.__game.battle; b.damageBase(b.base, b.base.hp - b.base.maxHp * 0.39); for (let i = 0; i < 90; i++) b.step(); });
      const sai = await ev(() => window.__game.battle.entities.some((e) => e.key === 'sai'));
      check('1-5：拠点HP70%以下で勇者たけ・40%以下で勇者サイが登場', take && sai);
    }
    await winStage();
    await page.tap('#btnReport');
    if (await vis('#scTalk')) await page.tap('#btnSkip');
    await page.tap('#btnLootNext');
    const unl = (await vis('#scUnlock')) ? await page.locator('#unlockName').textContent() : null;
    if (unl) await page.tap('#btnUnlockNext');
    check(`${id}：開始・勝利・解放（${unlockName}）`, ok && unl === unlockName, `カード ${ns} 枚`);
  };
  await playStage('1-2', 'こうもり');
  await playStage('1-3', '森のお化け');
  await playStage('1-4', 'プチデビル');
  await playStage('1-5', '幹部・突進');
  const prof = await ev(() => window.__game.app.profile);
  check('第1章の全5ステージを制圧', ['1-1', '1-2', '1-3', '1-4', '1-5'].every((id) => prof.stages[id] && prof.stages[id].cleared) && prof.loot.length === 5);
  const again = await sortie('1-1');
  check('2回目の偵察は1行だけ（会話なし）', again.recon.text.startsWith('大魔王様。') && again.recon.enemies === 2);
  check('第1章クリア後：編成は通常6＋幹部1（突進が自動で入る）', again.form.units === 6 && again.form.bosses === 1, JSON.stringify(again.form));
  await page.tap('#btnSortie'); await page.waitForTimeout(150);
  check('戦闘のカードは通常6＋幹部1', (await page.locator('.slot').count()) === 7 && (await page.locator('.slot.boss').count()) === 1);
  await ev(() => { const b = window.__game.battle; b.manaMax = 3000; b.mana = 3000; }); await page.waitForTimeout(150);
  check('幹部カード：魔力が足りても魔力炉Lv不足なら「炉Lv3」', (await page.locator('.slot.boss .why').textContent()) === '炉Lv3');
  await ev(() => { const b = window.__game.battle; b.furnaceLv = 3; b.manaMax = 3000; b.mana = 3000; }); await page.waitForTimeout(100);
  await page.tap('.slot.boss'); await page.waitForTimeout(250);
  check('魔力炉Lv3で幹部を召喚でき、出撃中は「出撃中」', (await ev(() => window.__game.battle.entities.some((e) => e.key === 'charger'))) && (await page.locator('.slot.boss .why').textContent()) === '出撃中');
  await shot(page, '11_battle_boss');
  await page.tap('#btnPause'); await page.tap('#btnQuit');

  // ---- リセット ----
  await page.tap('#btnToTitle');
  await page.tap('#btnReset');
  check('リセットの確認が出る', await vis('#ovConfirm'));
  await page.tap('#btnResetYes');
  const after = await ev(() => ({ save: localStorage.getItem('maougunInvasion.save'), p: window.__game.app.profile }));
  check('データリセットで最初に戻る', after.save === null && Object.keys(after.p.stages).length === 0 && !(await vis('#btnContinue')));

  check('コンソールにエラーが無い', errors.length === 0, errors.join(' / '));
  await ctx.close();

  // ---- 縦持ち ----
  const ctx2 = await browser.newContext({ ...devices['iPhone 13'] });
  const p2 = await ctx2.newPage();
  await p2.goto(`http://localhost:${PORT}/`); await p2.waitForTimeout(300);
  check('縦持ちでは「横向きにしてください」が出る', await p2.locator('#rotate').isVisible());
  await ctx2.close();

  // ---- PC（マウス・キーボード） ----
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p3 = await ctx3.newPage();
  await p3.goto(`http://localhost:${PORT}/?seed=2`); await p3.waitForFunction(() => window.__game);
  await p3.click('#btnNew');
  await p3.keyboard.press('Enter');
  await p3.keyboard.press('Escape'); await p3.waitForTimeout(150);
  check('PC：Enter で会話送り・Esc でスキップ', (await p3.evaluate(() => window.__game.app.screen)) === 'battle');
  await p3.keyboard.press('1'); await p3.waitForTimeout(150);
  check('PC：キー1で召喚', (await p3.evaluate(() => window.__game.battle.stats.summoned)) === 1);
  await p3.waitForTimeout(2200);
  await p3.click('.slot[data-key="mass"]'); await p3.waitForTimeout(150);
  check('PC：マウスで召喚', (await p3.evaluate(() => window.__game.battle.stats.summoned)) === 2);
  await ctx3.close();
} finally {
  await browser.close();
  server.close();
}
const ng = results.filter((r) => !r.ok);
console.log(`\n${results.length - ng.length}/${results.length} OK`);
process.exit(ng.length ? 1 : 0);
