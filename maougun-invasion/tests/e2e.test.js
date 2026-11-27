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
  // オープニングのスライド（初回だけ・タップで進む）
  await page.waitForTimeout(300);
  const slides = [];
  for (let i = 0; i < 5 && await vis('#scSlides'); i++) { await page.waitForTimeout(500); slides.push({ src: (await page.locator('#slideImg').getAttribute('src')).split('/').pop(), text: await page.locator('#slideText').textContent() }); if (i === 0) await shot(page, '00_opening_slide'); await page.tap('#scSlides', { position: { x: 300, y: 200 } }); await page.waitForTimeout(150); }
  check('オープニングのスライド3枚が順に出て、タップで進む', slides.length === 3 && slides.map((x) => x.src).join(',') === 'opening_01_battle.png,opening_02_seal.png,opening_03_seven_days.png' && slides[0].text.startsWith('かつて、世界を恐怖に陥れた大魔王は') && slides[1].text.includes('肉体と魔力に分けられ') && slides[2].text === 'それから、しばらくの時が流れた――。', JSON.stringify(slides));
  const fit = await page.evaluate(() => { const r = document.getElementById('slideImg').getBoundingClientRect(); const g = document.getElementById('game').getBoundingClientRect(); return r.width <= g.width + 1 && r.height <= g.height + 1; });
  check('スライドの画像は画面に収まる（切り抜かない）', fit);
  check('スライドのあとにオープニングの会話が始まる（説明のナレーションは重ねない）', await vis('#scTalk') && !(await vis('#scSlides')) && (await page.locator('#talkText').textContent()).startsWith('おのれぇぇ、ヤナイめ！'));
  const t1 = await page.locator('#talkText').textContent();
  await page.tap('#talkBox');
  const t2 = await page.locator('#talkText').textContent();
  check('タップで次の会話へ進む', t1 !== t2);
  await page.tap('#talkBox'); await shot(page, '02_opening');
  await page.tap('#btnSkip');
  await page.waitForTimeout(200);
  check('スキップで 1-1 の戦闘が始まる', (await screen()) === 'battle' && (await ev(() => window.__game.app.stageId)) === '1-1');
  check('オープニングを見た記録が残る', await ev(() => JSON.parse(localStorage.getItem('maougunInvasion.save')).story.opening === true));
  check('1-1 は説明つき：最初の説明でゲームが止まる', await vis('#tutor') && (await ev(() => window.__game.clock.paused)) && (await ev(() => window.__game.battle.spawnerOff)));
  await page.tap('#btnTutorSkip'); await page.waitForTimeout(100);
  check('「説明をとばす」で説明が消え、ゲームが動く', !(await vis('#tutor')) && !(await ev(() => window.__game.clock.paused)) && !(await ev(() => window.__game.battle.spawnerOff)));

  // ---- 1-1 の操作 ----
  check('初期の召喚カードは5枚（8体のうち編成した5体）', (await page.locator('.slot').count()) === 5);
  const bgs = await ev(async () => { const { SKIN } = await import('./js/data/skin.js'); const r = window.__game.renderer; const g = SKIN.images.stageBg; return { s11: (g['1-1'] || g.chapter1).src, s12: (g['1-2'] || g.chapter1).src, s13: (g['1-3'] || g.chapter1).src, drawn: !!document.querySelector('canvas') }; });
  check('背景：第1章はすべて村の本番背景', bgs.s11 === 'assets/approved/bg/ch1_village_v2.png' && bgs.s12 === bgs.s11 && bgs.s13 === bgs.s11, JSON.stringify(bgs));
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
  const ph = await ev(async () => { const { SKIN } = await import('./js/data/skin.js'); return { fast: SKIN.sprites.fast && SKIN.sprites.fast.src, area: !!SKIN.sprites.area }; });
  check('こうもり・魔法使いは新デザインの画像', ph.fast === 'assets/approved/units/fast.png' && ph.area, JSON.stringify(ph));
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
  if (await vis('#tutor')) { await page.tap('#btnTutorSkip'); await page.waitForTimeout(50); }
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
  await page.tap('#btnSpell'); await page.waitForTimeout(900); // 不死鳥が着弾するまで
  const hp1 = await ev(() => window.__game.battle.entities.filter((e) => e.side === 'human' && e.state !== 'dead').reduce((a, e) => a + e.hp, 0));
  check('魔王の呪文で人間軍にダメージ', hp1 < hp0, `${hp0} → ${hp1}`);

  // ---- 勝利 → 報告 → ステージ選択 → 解放 → 選択 ----
  const winStage = async () => {
    await ev(() => { const b = window.__game.battle; b.damageBase(b.base, b.base.hp); });
    await page.waitForSelector('#scResult:not([hidden])', { timeout: 3000 });
  };
  await winStage();
  check('拠点を壊すと勝利画面', (await page.locator('#resTitle').textContent()).includes('侵略成功'));
  check('勝利画面に報酬（魔界石を大きく・大魔王の魔力の回復）が出る（戦利品の画面は廃止）', (await page.locator('#resStones b').textContent()).startsWith('+') && (await page.locator('#resGains').textContent()).includes('大魔王の魔力が戻った') && !(await page.locator('#scLoot').count()));
  await shot(page, '04_result');
  await page.tap('#btnReport');
  check('勝利後に側近の報告（会話）', await vis('#scTalk'));
  await shot(page, '05_report');
  await page.tap('#btnSkip');
  check('1-1 では新しい魔物の解放は無い（全員最初から）', !(await vis('#scUnlock')));
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
    if (await vis('#stutor')) { stutorSeen.push(await page.locator('#stutorText').textContent()); await page.tap('#btnSTutorSkip'); }
    await page.tap(`.node[data-stage="${id}"]`, { force: true });
    if (await vis('#scTalk')) await page.tap('#btnSkip');
    await page.waitForSelector('#scRecon:not([hidden])', { timeout: 3000 });
    const recon = { text: await page.locator('#reconText').textContent(), enemies: await page.locator('#reconEnemies .enemy').count() };
    await page.tap('#btnReconNext');
    await page.waitForSelector('#scForm:not([hidden])', { timeout: 3000 });
    if (await vis('#stutor')) { stutorSeen.push(await page.locator('#stutorText').textContent()); await page.tap('#btnSTutorSkip'); }
    const form = await ev(() => ({ units: document.querySelectorAll('#formUnits .fcard').length, locked: document.querySelectorAll('#formUnits .fslot.locked').length, bosses: document.querySelectorAll('#formBosses .fcard').length, bossLocked: document.querySelectorAll('#formBosses .fslot.locked').length, pool: document.querySelectorAll('#formPool .fcard').length }));
    return { recon, form };
  };
  const stutorSeen = [];
  const playStage = async (id, unlockName) => {
    const { recon, form } = await sortie(id);
    if (id === '1-2') {
      check('偵察報告（1-2）：使い方の説明と1行報告、敵の兵種カード4種（僧侶を含む）', recon.text.includes('戦う前に') && recon.text.includes('弓兵') && recon.enemies === 4 && await page.locator('#reconWho').textContent() === 'ヴェイル', JSON.stringify(recon));
      check('編成：通常5枠＋6枠目は鍵・幹部1枠＋2枠目は鍵・控えに3体（魔法使い・森のお化け・木槌小鬼）', form.units === 5 && form.locked === 1 && form.bossLocked === 1 && form.pool === 3, JSON.stringify(form));
      check('編成の手順つき説明が出る（1-2 の最初だけ）', stutorSeen.some((t) => t.includes('出撃の編成')), JSON.stringify(stutorSeen));
      await shot(page, '12_formation');
      await page.tap('#btnEnemyInfo');
      check('編成画面から敵軍情報を開ける', await vis('#ovEnemy') && (await page.locator('#ovEnemyList .enemy').count()) === 4);
      await page.tap('#btnEnemyClose');
      // 外す → 控えに移り、保存される → もう一度入れる
      await page.tap('#formUnits .fcard[data-key="mass"]');
      const saved = await ev(() => JSON.parse(localStorage.getItem('maougunInvasion.save')).formation.units);
      check('編成から外すと控えに移り、保存される', !saved.includes('mass') && (await page.locator('#formPool .fcard[data-key="mass"]').count()) === 1, JSON.stringify(saved));
      await page.tap('#formPool .fcard[data-key="mass"]');
    }
    await page.tap('#btnSortie');
    await page.waitForTimeout(150);
    const ok = (await screen()) === 'battle' && (await ev(() => window.__game.app.stageId)) === id;
    const ns = await page.locator('.slot').count();
    // 少し本当に戦ってから勝たせる
    await ev(() => { const b = window.__game.battle; for (let i = 0; i < 600; i++) { for (const d of b.deck) if (b.canSummon(d.key).ok) { b.queue({ type: 'summon', key: d.key }); break; } b.step(); } });
    await page.waitForTimeout(250);
    if (id === '1-2') { check('1-2：戦闘中に、敵に合わせたヒントが出る（止まらない）', await vis('#tutorHint') && (await page.locator('#tutorHintText').textContent()).length > 5 && !(await ev(() => window.__game.clock.paused))); await shot(page, '10_hint'); }
    if (id === '1-3') check('1-3：ヒントは出ない', !(await vis('#tutorHint')) && !(await vis('#tutor')));
    await winStage();
    await page.tap('#btnReport');
    if (await vis('#scTalk')) await page.tap('#btnSkip');
    await page.waitForTimeout(80);
    const names = [];
    while (await vis('#scUnlock')) { names.push(await page.locator('#unlockName').textContent()); await page.tap('#btnUnlockNext'); await page.waitForTimeout(50); }
    const unl = names.join('＋') || null;
    check(`${id}：開始・勝利・解放（${unlockName}）`, ok && unl === unlockName, `カード ${ns} 枚`);
  };
  await playStage('1-2', null);
  check('1-2 クリア後のステージ選択で、強化の手順つき説明が出る', await vis('#stutor') && (await page.locator('#stutorText').textContent()).includes('魔王軍を強化'));
  await page.tap('#stutor'); await page.waitForTimeout(80);
  check('強化の説明中は、案内しているボタンしか押せない', (await screen()) === 'scSelect');
  await page.tap('#btnUpgrade'); await page.waitForTimeout(150);
  check('案内どおり「魔王軍を強化」を押すと強化画面で説明が続く', (await screen()) === 'scUpgrade' && (await page.locator('#stutorText').textContent()).includes('魔物'));
  await page.tap('#btnSTutorSkip'); await page.tap('#btnUpBack'); await page.waitForTimeout(100);
  check('説明は一度きり（とばした後は出ない）', !(await vis('#stutor')));
  await playStage('1-3', null); // 2026-11-26：ワニ将軍は第3章の終わりで仲間に
  // 幹部の確認のため、ワニ将軍を仲間にした状態にする（本来は 3-3 のクリアで加入）
  await ev(async () => { const m = await import('./js/data/progress.js'); const p = window.__game.app.profile; p.units.charger.unlocked = true; m.addToFormation(p, 'charger'); m.saveProfile(p); });
  const prof = await ev(() => window.__game.app.profile);
  check('第1章の全3ステージを制圧', ['1-1', '1-2', '1-3'].every((id) => prof.stages[id] && prof.stages[id].cleared) && prof.loot.length === 3);
  check('第1章クリア後のステージ選択は第2章（城下町）で、2-1 が開いている', (await page.locator('#selChapName').textContent()) === '城下町を制圧せよ' && !(await page.locator('.node[data-stage="2-1"]').isDisabled()) && await page.locator('.node[data-stage="2-2"]').isDisabled());
  await shot(page, '16_chapter2');
  await page.tap('.chapTab[data-chapter="1"]');
  check('章のタブで第1章に戻れる', (await page.locator('#selChapName').textContent()) === 'はじまりの村を侵略せよ');
  const again = await sortie('1-2');
  check('2回目の偵察は1行だけ（会話・説明なし）', again.recon.text.startsWith('大魔王様。') && again.recon.enemies === 4);
  check('第1章クリア後：編成は通常6＋幹部1（幹部を加えた状態）・木槌小鬼は控え', again.form.units === 6 && again.form.bosses === 1 && (await page.locator('#formPool .fcard[data-key="mallet"]').count()) === 1, JSON.stringify(again.form));
  check('編成カードに攻撃タイプの印（木槌小鬼＝狙）', (await page.locator('#formPool .fcard[data-key="mallet"] .at').textContent()) === '狙');
  await shot(page, '13_formation_mallet');
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

  // ---- 1-1 の説明を最後まで ----
  const ctx4 = await browser.newContext({ ...devices['iPhone 13 landscape'] });
  const p4 = await ctx4.newPage();
  const e4 = []; p4.on('pageerror', (e) => e4.push(String(e)));
  await p4.goto(`http://localhost:${PORT}/?seed=4`); await p4.waitForFunction(() => window.__game);
  await p4.tap('#btnNew'); await p4.waitForTimeout(150); if (await p4.locator('#scSlides').isVisible()) await p4.tap('#btnSlideSkip'); await p4.tap('#btnSkip'); await p4.waitForTimeout(200);
  const tt = () => p4.locator('#tutorText').textContent();
  const steps = [];
  steps.push(await tt()); await p4.tap('#tutor'); await p4.waitForTimeout(100);
  steps.push(await tt()); check('説明：グミのカードが光る', (await p4.locator('.slot[data-key="mass"].tutor-focus').count()) === 1);
  if (outDir) await p4.screenshot({ path: `${outDir}/14_guide_summon.png` });
  await p4.tap('.slot[data-key="mass"]'); await p4.waitForTimeout(150);
  steps.push(await tt()); await p4.waitForFunction(() => !document.getElementById('tutor').classList.contains('tap') ? document.getElementById('tutorText').textContent.includes('魔力」') : true, null, { timeout: 15000 }).catch(() => {});
  await p4.waitForSelector('#tutor.tap', { timeout: 15000 });
  steps.push(await tt()); await p4.tap('#tutor'); await p4.waitForTimeout(100);
  await p4.tap('.slot[data-key="vanguard"]'); await p4.waitForTimeout(150);
  steps.push(await tt()); check('説明：魔力炉が光る', (await p4.locator('#btnFurnace.tutor-focus').count()) === 1);
  await p4.tap('#btnFurnace'); await p4.waitForTimeout(150);
  steps.push(await tt());
  if (outDir) await p4.screenshot({ path: `${outDir}/15_guide_spell.png` });
  await p4.tap('#btnSpell'); await p4.waitForTimeout(200);
  steps.push(await tt()); await p4.tap('#tutor'); await p4.waitForTimeout(150);
  const done = await p4.evaluate(() => ({ tutor: !document.getElementById('tutor').hidden, off: window.__game.battle.spawnerOff, paused: window.__game.clock.paused, fl: window.__game.battle.furnaceLv, spells: window.__game.battle.stats.spells, sum: window.__game.battle.stats.summoned }));
  check('説明を最後まで：召喚・魔力炉・呪文を実際に使い、終わると敵が出始める', !done.tutor && !done.off && !done.paused && done.fl === 2 && done.spells === 1 && done.sum >= 2 && new Set(steps).size === steps.length, JSON.stringify(done));
  await p4.evaluate(() => { const b = window.__game.battle; for (let i = 0; i < 30 * 200; i++) b.step(); });
  check('1-1 では祠が壊れない', (await p4.evaluate(() => window.__game.battle.shrine.hp)) >= 1 && (await p4.evaluate(() => window.__game.battle.result)) !== 'lose');
  check('説明の途中でエラーが無い', e4.length === 0, e4.join(' / '));
  await ctx4.close();

  // ---- 第3章：会話が台本どおりの順番で流れる ----
  const ctx5 = await browser.newContext({ ...devices['iPhone 13 landscape'] });
  const p5 = await ctx5.newPage();
  const e5 = []; p5.on('pageerror', (e) => e5.push(String(e)));
  await p5.goto(`http://localhost:${PORT}/?seed=5`); await p5.waitForFunction(() => window.__game);
  await p5.evaluate(async () => { const m = await import('./js/data/progress.js'); const g = window.__game; const p = m.newProfile(); for (const id of ['1-1', '1-2', '1-3', '2-1', '2-2', '2-3']) m.applyResult(p, id, 'win', 100); Object.assign(p.story, { opening: true, 'tip:recon': true, 'tip:form': true, 'tip:upgrade': true }); g.app.profile = p; m.saveProfile(p); g.toSelect(); });
  await p5.waitForTimeout(200);
  check('第2章クリア後は第3章「地方王国の城を攻略せよ」が開く', (await p5.locator('#selChapName').textContent()) === '地方王国の城を攻略せよ' && !(await p5.locator('.node[data-stage="3-1"]').isDisabled()));
  const readTalk = async () => { const out = []; for (let i = 0; i < 30 && await p5.locator('#scTalk').isVisible(); i++) { out.push(`${await p5.locator('#talkWho').textContent()}：${await p5.locator('#talkText').textContent()}`); await p5.tap('#talkBox'); await p5.waitForTimeout(40); } return out; };
  await p5.tap('.node[data-stage="3-1"]', { force: true }); await p5.waitForTimeout(150);
  const t31 = await readTalk();
  const want31 = ['ヴェイル：大魔王様、王国の城に到着しました。これまでとは比べものにならないほど立派な城です。', '大魔王：ほほう！ なかなか立派ではないか。わしの新しい住みかにちょうどよい！', 'ヴェイル：大魔王様は、まだ祠から出られませんが。', '大魔王：……わかっとるわ！！', '王国兵：魔物の軍勢が来たぞ！ 城門を守れ！'];
  check('3-1 戦闘前の会話が台本どおりの順番（差し込みなし）', JSON.stringify(t31) === JSON.stringify(want31), JSON.stringify(t31));
  check('会話のあとは偵察報告へ', await p5.locator('#scRecon').isVisible());
  // 3-3 の勝利後
  await p5.evaluate(async () => { const m = await import('./js/data/progress.js'); const g = window.__game; for (const id of ['3-1', '3-2']) m.applyResult(g.app.profile, id, 'win', 100); g.app.profile.story['before:3-3'] = true; g.startStage('3-3'); });
  await p5.waitForTimeout(200);
  await p5.evaluate(() => { const b = window.__game.battle; b.damageBase(b.base, b.base.hp); });
  await p5.waitForSelector('#scResult:not([hidden])', { timeout: 3000 });
  await p5.tap('#btnReport'); await p5.waitForTimeout(150);
  const t33 = await readTalk();
  check('3-3 勝利後：15行・「まったく……」→「――第3章クリア。」→ 伏線 の順（そのまま壊滅した町のイベントへ続く）', t33.length >= 15 && t33[15] === '：――王国の城を制圧した魔王軍は、港町へ向かっていた。しかし、その途中で異様な光景を目にする。' && t33[9].endsWith('まったく……いつになったら、この祠から出られるんじゃ……。') && t33[10] === '：――第3章クリア。' && t33[14] === '：――竜人オルドとの遭遇へ続く。', JSON.stringify(t33.slice(8)));
  check('第3章でエラーが無い', e5.length === 0, e5.join(' / '));
  await ctx5.close();

  // ---- 特殊イベント「壊滅した町」：両ルート ----
  for (const choice of ['recruit', 'reject']) {
    const c6 = await browser.newContext({ ...devices['iPhone 13 landscape'] });
    const p6 = await c6.newPage(); const e6 = []; p6.on('pageerror', (e) => e6.push(String(e)));
    await p6.goto(`http://localhost:${PORT}/?seed=6`); await p6.waitForFunction(() => window.__game);
    await p6.evaluate(async () => { const m = await import('./js/data/progress.js'); const g = window.__game; const p = m.newProfile(); for (const id of ['1-1','1-2','1-3','2-1','2-2','2-3','3-1','3-2','3-3']) m.applyResult(p, id, 'win', 100); Object.assign(p.story, { opening: true, 'tip:recon': true, 'tip:form': true, 'tip:upgrade': true }); g.app.profile = p; m.saveProfile(p); g.toSelect(); });
    await p6.waitForTimeout(200);
    const read6 = async () => { const o = []; for (let i = 0; i < 40 && await p6.locator('#scTalk').isVisible(); i++) { o.push(await p6.locator('#talkText').textContent()); await p6.tap('#talkBox'); await p6.waitForTimeout(25); } return o; };
    const d = await read6();
    const battle = await p6.evaluate(() => window.__game.app.screen === 'battle' && window.__game.app.stageId === 'ex-1');
    await p6.evaluate(() => { const b = window.__game.battle; for (let i = 0; i < 30 * 21; i++) { window.__game.__tick && 0; b.step(); if (b.t > 0) break; } });
    await p6.waitForSelector('#scTalk:not([hidden])', { timeout: 30000 });
    const a = await read6();
    await p6.waitForSelector('#ovChoice:not([hidden])', { timeout: 3000 });
    await p6.tap(choice === 'recruit' ? '#btnChoiceA' : '#btnChoiceB'); await p6.waitForTimeout(80);
    const r = await read6();
    const st6 = await p6.evaluate(() => { const g = window.__game; const p = g.app.profile; return { screen: g.app.screen, ruin: p.events.ruin, ord: !!(p.units.ord && p.units.ord.unlocked), special: !!document.querySelector('.chapTab[data-chapter="ex"]') }; });
    check(`壊滅した町（${choice}）：①②16行 → 特殊戦闘 → 敗北のあと④8行 → 選択 → ⑤・⑥ → ステージ選択`, d.length === 16 && d[15] === '……承知いたしました。' && battle && a[0] === '――魔王軍、敗北。' && a.length === 8 && r[r.length - 1] === '――第4章「港町」へ。' && r.length === (choice === 'recruit' ? 19 : 10) && st6.screen === 'scSelect', JSON.stringify({ d: d.length, a: a.length, r: r.length, st6 }));
    check(`壊滅した町（${choice}）：結果の記録・「特別」タブ`, st6.ruin.done && st6.ruin.choice === choice && st6.ord === (choice === 'recruit') && st6.special);
    if (choice === 'reject') {
      await p6.reload(); await p6.waitForFunction(() => window.__game); await p6.tap('#btnContinue'); await p6.waitForTimeout(150);
      check('敵対ルート：再読み込み後も再戦できる（特別タブの壊滅した町が押せる）', !(await p6.evaluate(() => { window.__game.toSelect({ ...window.__game.app, stages: ['ex-1'], special: true, id: 'ex', name: '壊滅した町' }); return document.querySelector('.node[data-stage="ex-1"]').disabled; })) && !(await p6.evaluate(() => window.__game.app.profile.units.ord.unlocked)));
    }
    check(`壊滅した町（${choice}）：エラーなし`, e6.length === 0, e6.join(' / '));
    await c6.close();
  }

  // ---- 壊滅した町の初戦：ワニ将軍が倒れると専用会話 → 提案から合流（2026-11-26）／再戦では起きない ----
  {
    const cr = await browser.newContext({ ...devices['iPhone 13 landscape'] });
    const q = await cr.newPage(); const er = []; q.on('pageerror', (e) => er.push(String(e)));
    await q.goto(`http://localhost:${PORT}/?seed=5`); await q.waitForFunction(() => window.__game);
    await q.evaluate(async () => { const m = await import('./js/data/progress.js'); const g = window.__game; const pr = m.newProfile();
      for (const id of ['1-1','1-2','1-3','2-1','2-2','2-3','3-1','3-2']) m.applyResult(pr, id, 'win', 100); m.joinBoss(pr, '3-3'); m.applyResult(pr, '3-3', 'win', 100);
      Object.assign(pr.story, { opening: true, 'tip:recon': true, 'tip:form': true, 'tip:upgrade': true }); g.app.profile = pr; m.saveProfile(pr); g.startRuinEvent(); });
    await q.waitForTimeout(200);
    const readR = async () => { const o = []; for (let i = 0; i < 40 && await q.locator('#scTalk').isVisible(); i++) { o.push(await q.locator('#talkText').textContent()); await q.tap('#talkBox'); await q.waitForTimeout(25); } return o; };
    await readR();
    const can = await q.evaluate(() => { const b = window.__game.battle; b.queue({ type: 'furnace' }); b.step(); b.queue({ type: 'furnace' }); b.step(); b.queue({ type: 'summon', key: 'charger' }); b.step(); const ch = b.entities.find((e) => e.key === 'charger'); if (ch) b.damageUnit(ch, 1e9, null); return !!ch; });
    await q.waitForSelector('#scTalk:not([hidden])', { timeout: 8000 });
    const a = await readR();
    await q.waitForSelector('#ovChoice:not([hidden])', { timeout: 3000 });
    check('壊滅した町の初戦：初めから魔力が足りてワニ将軍を呼べる → 倒れると専用会話（10行）→「ひとつ、ご提案があります。」から合流（重複なし）', can && a[0] === '――ワニ将軍が倒れる。' && a[9] === '――魔王軍、敗北。' && a[10] === '大魔王様。ひとつ、ご提案があります。' && a.length === 15 && a.filter((x) => x === '――魔王軍、敗北。').length === 1, JSON.stringify(a));
    await q.tap('#btnChoiceB'); await q.waitForTimeout(80); await readR();
    const st = await q.evaluate(() => ({ ch: window.__game.app.profile.units.charger.unlocked, screen: window.__game.app.screen }));
    check('専用敗北のあとも加入の選択へ進み、ワニ将軍は離脱しない', st.ch && st.screen === 'scSelect', JSON.stringify(st));
    await q.reload(); await q.waitForFunction(() => window.__game); await q.tap('#btnContinue'); await q.waitForTimeout(150);
    const re = await q.evaluate(() => { const g = window.__game; g.startStage('ex-1'); const b = g.battle; b.mana = 99999; b.manaMax = 99999; b.furnaceLv = 3; b.queue({ type: 'summon', key: 'charger' }); b.step(); const ch = b.entities.find((e) => e.key === 'charger'); b.damageUnit(ch, 1e9, null); for (let i = 0; i < 60; i++) b.step(); return { forced: g.app.forced, result: b.result, ch: g.app.profile.units.charger.unlocked }; });
    await q.waitForTimeout(400);
    check('再読み込み後の再戦：ワニ将軍が倒れても戦闘は続く（専用敗北は初戦だけ）', !re.forced && re.result === null && re.ch && !(await q.locator('#scTalk').isVisible()), JSON.stringify(re));
    check('壊滅した町（ワニ将軍）：エラーなし', er.length === 0, er.join(' / '));
    await cr.close();
  }

  // ---- 第6章：6-3 の初回クリア → 大魔王の魔力回復 → 新機能の解放画面 → 続き → ステージ選択／再クリアでは起きない ----
  {
    const c7 = await browser.newContext({ ...devices['iPhone 13 landscape'] });
    const p7 = await c7.newPage(); const e7 = []; p7.on('pageerror', (e) => e7.push(String(e)));
    await p7.goto(`http://localhost:${PORT}/?seed=7`); await p7.waitForFunction(() => window.__game);
    await p7.evaluate(async () => { const m = await import('./js/data/progress.js'); const g = window.__game; const p = m.newProfile(); for (const id of ['1-1','1-2','1-3','2-1','2-2','2-3','3-1','3-2','3-3']) m.applyResult(p, id, 'win', 100); m.finishRuinEvent(p, 'recruit'); for (const id of ['4-1','4-2','4-3','5-1','5-2','5-3','5-4','6-1','6-2']) m.applyResult(p, id, 'win', 100); Object.assign(p.story, { opening: true, 'tip:recon': true, 'tip:form': true, 'tip:upgrade': true, 'before:6-3': true }); p.stones = 5000; g.app.profile = p; m.saveProfile(p); g.startStage('6-3'); });
    const win7 = async () => { await p7.waitForTimeout(150); await p7.evaluate(() => { const b = window.__game.battle; b.damageBase(b.base, b.base.hp); }); await p7.waitForSelector('#scResult:not([hidden])', { timeout: 4000 }); await p7.tap('#btnReport'); await p7.waitForTimeout(100); };
    const read7 = async () => { const o = []; let fx = 0; for (let i = 0; i < 40 && await p7.locator('#scTalk').isVisible(); i++) { o.push(await p7.locator('#talkText').textContent()); if (await p7.evaluate(() => /fx-/.test(document.getElementById('scTalk').className))) fx++; await p7.tap('#talkBox'); await p7.waitForTimeout(25); } return { o, fx }; };
    await win7();
    const a7 = await read7();
    const feat = await p7.locator('#ovFeature').isVisible() && (await p7.locator('#featTitle').textContent()) === '上位モンスター進化';
    await p7.tap('#btnFeatNext'); await p7.waitForTimeout(80);
    const b7 = await read7();
    const st7 = await p7.evaluate(() => ({ crystal: window.__game.app.profile.events.crystal, saved: JSON.parse(localStorage.getItem('maougunInvasion.save')).events.crystal, loot: window.__game.app.screen === 'scSelect' || window.__game.app.screen === 'scUnlock' }));
    check('6-3 初回：勝利後の会話（5行）→ 魔力回復（15行・発光と振動）→ 新機能の解放画面 → 続き（4行）→ ステージ選択', a7.o.length === 20 && a7.o[4] === 'おおおお！ でかしたぞ、ヴェイル！！' && a7.o[19] === 'ふっふっふ……。人間どもよ、ここからが本当の恐怖の始まりじゃ！' && a7.fx >= 2 && feat && b7.o.length === 4 && b7.o[3] === '――第6章クリア。' && st7.crystal.done && st7.saved.done && st7.loot, JSON.stringify({ a: a7.o.length, fx: a7.fx, feat, b: b7.o.length, st7 }));
    await p7.waitForTimeout(100);
    if (await p7.locator('#scUnlock').isVisible()) await p7.tap('#btnUnlockNext');
    await p7.tap('#btnUpgrade'); await p7.waitForTimeout(100);
    check('魔力回復のあと、強化画面に進化の欄が出る（進化先はデザイン待ち）', (await p7.locator('#upUnits .evo').count()) >= 8);
    await p7.tap('#btnUpBack');
    await p7.evaluate(() => window.__game.startStage('6-3'));
    await win7();
    const again7 = await p7.locator('#scTalk').isVisible();
    check('6-3 の再クリアでは魔力回復のイベントが起きない（会話なしでステージ選択へ）', !again7 && await p7.evaluate(() => window.__game.app.screen === 'scSelect') && !(await p7.locator('#ovFeature').isVisible()));
    check('第6章：エラーなし', e7.length === 0, e7.join(' / '));
    await c7.close();
  }

  // ---- 第8章：章タブ・会話 → 8-4 の初回クリア → 究極進化 → 解放画面 → 第9章への進軍 → ステージ選択／再読み込み／再クリアでは起きない ----
  {
    const c8 = await browser.newContext({ ...devices['iPhone 13 landscape'] });
    const p8 = await c8.newPage(); const e8 = []; p8.on('pageerror', (e) => e8.push(String(e)));
    await p8.goto(`http://localhost:${PORT}/?seed=8`); await p8.waitForFunction(() => window.__game);
    await p8.evaluate(async () => { const m = await import('./js/data/progress.js'); const g = window.__game; const p = m.newProfile(); for (const id of ['1-1','1-2','1-3','2-1','2-2','2-3','3-1','3-2','3-3']) m.applyResult(p, id, 'win', 100); m.finishRuinEvent(p, 'reject'); for (const id of ['4-1','4-2','4-3','5-1','5-2','5-3','5-4','6-1','6-2','6-3']) m.applyResult(p, id, 'win', 100); m.applyCrystal(p); for (const id of ['7-1','7-2']) m.applyResult(p, id, 'win', 100); Object.assign(p.story, { opening: true, 'tip:recon': true, 'tip:form': true, 'tip:upgrade': true }); p.stones = 5000; g.app.profile = p; m.saveProfile(p); g.toSelect(); });
    await p8.waitForTimeout(200);
    const read8 = async () => { const o = []; let fx = 0; for (let i = 0; i < 40 && await p8.locator('#scTalk').isVisible(); i++) { o.push(await p8.locator('#talkText').textContent()); if (await p8.evaluate(() => /fx-/.test(document.getElementById('scTalk').className))) fx++; await p8.tap('#talkBox'); await p8.waitForTimeout(25); } return { o, fx }; };
    const sel8 = await p8.evaluate(() => ({ tab: !!document.querySelector('.chapTab[data-chapter="8"]'), node: document.querySelector('.node[data-stage="8-1"]') && !document.querySelector('.node[data-stage="8-1"]').disabled }));
    check('第7章のあと：第8章のタブと 8-1 が開いている', sel8.tab && sel8.node, JSON.stringify(sel8));
    await p8.evaluate(() => { window.__game.toSelect(); }); await p8.waitForTimeout(100); await p8.evaluate(() => document.querySelector('.node[data-stage="8-1"]').click()); await p8.waitForTimeout(150);
    const bf = await read8();
    await p8.waitForTimeout(100);
    const rc8 = await p8.locator('#scRecon').isVisible();
    check('8-1 戦闘前の会話（4行・台本どおり）→ 偵察', bf.o.length === 4 && bf.o[2] === '魔王軍接近！ 防御結界を展開せよ！' && bf.o[3] === 'ふっふっふ……。魔法でわしに勝とうなど、百年早いわ！' && rc8, JSON.stringify({ o: bf.o, rc8 }));
    await p8.evaluate(() => { const g = window.__game.app; g.profile.story['before:8-4'] = true; for (const id of ['8-1','8-2','8-3']) { g.profile.stages[id] = { cleared: true, best: 100 }; } });
    await p8.evaluate(() => window.__game.startStage('8-4')); await p8.waitForTimeout(150);
    for (let i = 0; i < 6 && !(await p8.evaluate(() => window.__game.app.screen === 'battle')); i++) { for (const b of ['#btnReconSkip', '#btnReconNext', '#btnSortie']) if (await p8.locator(b).isVisible()) await p8.tap(b); await p8.waitForTimeout(100); }
    const bg8 = await p8.evaluate(() => { const b = window.__game.battle; b.damageBase(b.base, b.base.hp - b.base.maxHp * 0.59); for (let i = 0; i < 90; i++) b.step(); return { arch: b.entities.some((e) => e.key === 'archmage'), lv: b.config.furnace.costs.length }; });
    check('8-4：拠点HP60%で大魔導士が出る（イベント前の魔力炉は従来どおり）', bg8.arch && bg8.lv === 7, JSON.stringify(bg8));
    const win8 = async () => { await p8.waitForTimeout(150); await p8.evaluate(() => { const b = window.__game.battle; b.damageBase(b.base, b.base.hp); }); await p8.waitForSelector('#scResult:not([hidden])', { timeout: 4000 }); await p8.tap('#btnReport'); await p8.waitForTimeout(100); };
    await win8();
    const a8 = await read8();
    const feat8 = await p8.locator('#ovFeature').isVisible() && (await p8.locator('#featTitle').textContent()) === '最上位モンスター進化' && (await p8.locator('#featItems').textContent()).includes('魔力炉のさらなる強化');
    await p8.tap('#btnFeatNext'); await p8.waitForTimeout(80);
    const b8 = await read8();
    const st8 = await p8.evaluate(() => ({ ev: window.__game.app.profile.events.ultimate, saved: JSON.parse(localStorage.getItem('maougunInvasion.save')).events.ultimate, loot: window.__game.app.screen === 'scSelect' || window.__game.app.screen === 'scUnlock' }));
    check('8-4 初回：勝利後の会話（4行）→ 究極進化（10行・発光と振動）→ 解放画面 → 第9章への進軍（11行）→ ステージ選択', a8.o.length === 14 && a8.o[3] === 'よし！ 早速試すのじゃ！' && a8.o[4] === '――ヴェイルは魔導装置の技術を封印の祠の魔力炉に応用した。' && a8.o[13] === 'よし！ 最強の魔王軍を作り上げるのじゃ！' && a8.fx >= 2 && feat8 && b8.o.length === 11 && b8.o[9] === '――第8章クリア。' && b8.o[10] === '――魔王軍と人間軍の全面戦争が始まろうとしていた。' && st8.ev.done && st8.saved.done && st8.loot, JSON.stringify({ a: a8.o.length, fx: a8.fx, feat8, b: b8.o.length, st8 }));
    await p8.reload(); await p8.waitForFunction(() => window.__game); await p8.tap('#btnContinue'); await p8.waitForTimeout(150);
    const rl = await p8.evaluate(async () => { const m = await import('./js/data/progress.js'); const p = window.__game.app.profile; return { done: m.ultimateDone(p), cap: m.evolveTierCap(p) }; });
    check('再読み込み後も究極進化（最上位進化・魔力炉の強化）が残る', rl.done && rl.cap === 3, JSON.stringify(rl));
    await p8.evaluate(() => { window.__game.app.profile.story['before:8-4'] = true; window.__game.startStage('8-4'); }); await p8.waitForTimeout(150);
    for (let i = 0; i < 6 && !(await p8.evaluate(() => window.__game.app.screen === 'battle')); i++) { for (const b of ['#btnReconSkip', '#btnReconNext', '#btnSortie']) if (await p8.locator(b).isVisible()) await p8.tap(b); await p8.waitForTimeout(100); }
    const fz = await p8.evaluate(() => window.__game.battle.config.furnace.costs.length);
    check('究極進化のあと：戦闘の魔力炉が1段多く上がる', fz === 8, String(fz));
    await win8();
    check('8-4 の再クリアでは究極進化が起きない（会話なしでステージ選択へ）', !(await p8.locator('#scTalk').isVisible()) && await p8.evaluate(() => window.__game.app.screen === 'scSelect') && !(await p8.locator('#ovFeature').isVisible()));
    check('第8章：エラーなし', e8.length === 0, e8.join(' / '));
    await c8.close();
  }

  // ---- 第9章：9-4 の初回クリア → 勝利後の会話 → 最終章への進軍 → 最終章解放演出 → ステージ選択／再読み込み／再クリアでは起きない ----
  {
    const c9 = await browser.newContext({ ...devices['iPhone 13 landscape'] });
    const p9 = await c9.newPage(); const e9 = []; p9.on('pageerror', (e) => e9.push(String(e)));
    await p9.goto(`http://localhost:${PORT}/?seed=9`); await p9.waitForFunction(() => window.__game);
    await p9.evaluate(async () => { const m = await import('./js/data/progress.js'); const g = window.__game; const p = m.newProfile(); for (const id of ['1-1','1-2','1-3','2-1','2-2','2-3','3-1','3-2','3-3']) m.applyResult(p, id, 'win', 100); m.finishRuinEvent(p, 'recruit'); for (const id of ['4-1','4-2','4-3','5-1','5-2','5-3','5-4','6-1','6-2','6-3','7-1','7-2','8-1','8-2','8-3','8-4']) m.applyResult(p, id, 'win', 100); m.applyCrystal(p); m.applyUltimate(p); Object.assign(p.story, { opening: true, 'tip:recon': true, 'tip:form': true, 'tip:upgrade': true }); g.app.profile = p; m.saveProfile(p); g.toSelect(); });
    await p9.waitForTimeout(200);
    const read9 = async () => { const o = []; for (let i = 0; i < 40 && await p9.locator('#scTalk').isVisible(); i++) { o.push(await p9.locator('#talkText').textContent()); await p9.tap('#talkBox'); await p9.waitForTimeout(25); } return o; };
    check('第8章のあと：第9章のタブと 9-1 が開いている', await p9.evaluate(() => !!document.querySelector('.chapTab[data-chapter="9"]') && !document.querySelector('.node[data-stage="9-1"]').disabled));
    await p9.evaluate(() => document.querySelector('.node[data-stage="9-1"]').click()); await p9.waitForTimeout(150);
    const bf9 = await read9();
    check('9-1 戦闘前の会話（5行・台本どおり）', bf9.length === 5 && bf9[3] === 'これ以上、魔王軍の侵略を許すな！ 全軍、戦闘準備！', JSON.stringify(bf9));
    await p9.evaluate(() => { const g = window.__game.app; g.profile.story['before:9-4'] = true; for (const id of ['9-1','9-2','9-3']) g.profile.stages[id] = { cleared: true, clears: 1, bestTime: 100 }; window.__game.startStage('9-4'); });
    await p9.waitForTimeout(150);
    const boss9 = await p9.evaluate(() => { const b = window.__game.battle; b.damageBase(b.base, b.base.hp - b.base.maxHp * 0.59); for (let i = 0; i < 90; i++) b.step(); return b.entities.some((e) => e.key === 'supreme_commander'); });
    check('9-4：拠点HP60%で人間軍総司令官が出る', boss9);
    const win9 = async () => { await p9.waitForTimeout(150); await p9.evaluate(() => { const b = window.__game.battle; b.damageBase(b.base, b.base.hp); }); await p9.waitForSelector('#scResult:not([hidden])', { timeout: 4000 }); await p9.tap('#btnReport'); await p9.waitForTimeout(100); };
    await win9();
    const a9 = await read9();
    const fin = await p9.evaluate(() => ({ vis: !document.getElementById('ovFinal').hidden, t: ['finEyebrow', 'finChapter', 'finName', 'finText'].map((i) => document.getElementById(i).textContent) }));
    await p9.waitForTimeout(1500); await p9.tap('#btnFinalNext'); await p9.waitForTimeout(100);
    const st9 = await p9.evaluate(() => ({ ev: window.__game.app.profile.events.final, saved: JSON.parse(localStorage.getItem('maougunInvasion.save')).events.final, loot: window.__game.app.screen === 'scSelect' || window.__game.app.screen === 'scUnlock' }));
    check('9-4 初回：勝利後の会話（10行）→ 最終章への進軍（9行）→ 最終章解放演出 → ステージ選択', a9.length === 19 && a9[9] === '空の上まで逃げおったのかぁぁ！！' && a9[18] === '――第9章クリア。' && fin.vis && fin.t.join('/') === 'FINAL CHAPTER/第10章/天空・勇者の聖域/魔王軍、最後の戦いへ。' && st9.ev.done && st9.saved.done && st9.loot, JSON.stringify({ a: a9.length, fin, st9 }));
    await p9.reload(); await p9.waitForFunction(() => window.__game); await p9.tap('#btnContinue'); await p9.waitForTimeout(150);
    check('再読み込み後も第9章クリア・演出済みが残る', await p9.evaluate(() => { const p = window.__game.app.profile; return p.events.final.done && p.stages['9-4'].cleared; }));
    await p9.evaluate(() => { window.__game.startStage('9-4'); });
    await win9();
    check('9-4 の再クリアでは進軍の会話と演出が起きない', !(await p9.locator('#scTalk').isVisible()) && !(await p9.locator('#ovFinal').isVisible()) && await p9.evaluate(() => window.__game.app.screen === 'scSelect'));
    check('第9章：エラーなし', e9.length === 0, e9.join(' / '));
    await c9.close();
  }

  // ---- 第10章：会話 → 10-5（たけ・サイ・ヤナイ）→ エンディング → 世界征服達成 → おまけ会話 → THE END → ステージ選択／再読み込み／再クリア／ムービーの差し込み口 ----
  {
    const c10 = await browser.newContext({ ...devices['iPhone 13 landscape'] });
    const q = await c10.newPage(); const e10 = []; q.on('pageerror', (e) => e10.push(String(e)));
    await q.goto(`http://localhost:${PORT}/?seed=10`); await q.waitForFunction(() => window.__game);
    await q.evaluate(async () => { const m = await import('./js/data/progress.js'); const st = await import('./js/data/stages.js'); const g = window.__game; const p = m.newProfile(); for (const id of ['1-1','1-2','1-3','2-1','2-2','2-3','3-1','3-2','3-3']) m.applyResult(p, id, 'win', 100); m.finishRuinEvent(p, 'reject'); for (const id of st.STAGE_ORDER.slice(st.STAGE_ORDER.indexOf('4-1'), st.STAGE_ORDER.indexOf('10-1'))) m.applyResult(p, id, 'win', 100); m.applyCrystal(p); m.applyUltimate(p); m.markFinal(p); Object.assign(p.story, { opening: true, 'tip:recon': true, 'tip:form': true, 'tip:upgrade': true }); g.app.profile = p; m.saveProfile(p); g.toSelect(); });
    await q.waitForTimeout(200);
    const readQ = async () => { const o = []; let fx = 0; for (let i = 0; i < 40 && await q.locator('#scTalk').isVisible(); i++) { o.push(await q.locator('#talkText').textContent()); if (await q.evaluate(() => /fx-/.test(document.getElementById('scTalk').className))) fx++; await q.tap('#talkBox'); await q.waitForTimeout(25); } return { o, fx }; };
    check('第9章のあと：第10章のタブと 10-1 が開いている', await q.evaluate(() => !!document.querySelector('.chapTab[data-chapter="10"]') && !document.querySelector('.node[data-stage="10-1"]').disabled));
    await q.evaluate(() => document.querySelector('.node[data-stage="10-1"]').click()); await q.waitForTimeout(150);
    const b1 = await readQ();
    check('10-1 戦闘前の会話（6行・台本どおり）', b1.o.length === 6 && b1.o[3] === '魔王軍よ！ この先へ進むことは許さぬ！', JSON.stringify(b1.o));
    await q.evaluate(() => { const g = window.__game.app; for (const id of ['10-1','10-2','10-3','10-4']) g.profile.stages[id] = { cleared: true, clears: 1, bestTime: 100 }; g.profile.story['before:10-3'] = false; });
    await q.evaluate(() => { window.__game.toSelect(); document.querySelector('.node[data-stage="10-3"]').click(); }); await q.waitForTimeout(150);
    const b3 = await readQ();
    check('10-3 聖竜降臨：戦闘前の会話（8行・光と振動の演出）', b3.o.length === 8 && b3.o[0] === '――天空に巨大な光が現れる。' && b3.fx >= 2, JSON.stringify(b3));
    await q.evaluate(() => { window.__game.app.profile.story['before:10-5'] = false; window.__game.toSelect(); document.querySelector('.node[data-stage="10-5"]').click(); }); await q.waitForTimeout(150);
    const b5 = await readQ();
    check('10-5 戦闘前の会話（16行・台本どおり）', b5.o.length === 16 && b5.o[0] === '――魔王軍の前に、三人の勇者が立ちはだかった。' && b5.o[15] === 'これが魔王軍の総力じゃ！ いくぞぉぉ！！', JSON.stringify(b5.o.length));
    await q.evaluate(() => window.__game.startStage('10-5')); await q.waitForTimeout(150);
    const h5 = await q.evaluate(() => { const b = window.__game.battle; for (let i = 0; i < 30 * 4; i++) b.step(); const a = ['take', 'sai'].every((k) => b.entities.some((e) => e.key === k)); b.damageBase(b.base, b.base.hp - b.base.maxHp * 0.59); for (let i = 0; i < 90; i++) b.step(); return { a, y: b.entities.some((e) => e.key === 'yanai') }; });
    check('10-5：たけ・サイが最初から、拠点HP60%でマスター・ヤナイ', h5.a && h5.y, JSON.stringify(h5));
    const winQ = async () => { await q.waitForTimeout(150); await q.evaluate(() => { const b = window.__game.battle; b.damageBase(b.base, b.base.hp); }); await q.waitForSelector('#scResult:not([hidden])', { timeout: 4000 }); await q.tap('#btnReport'); await q.waitForTimeout(100); };
    await winQ();
    const en = await readQ();
    const t1 = await q.evaluate(() => ({ vis: !document.getElementById('ovFinal').hidden, t: ['finEyebrow', 'finChapter', 'finName', 'finText', 'finEnd'].map((i) => document.getElementById(i).textContent), saved: JSON.parse(localStorage.getItem('maougunInvasion.save')).events.conquest }));
    await q.waitForTimeout(1500); await q.tap('#btnFinalNext'); await q.waitForTimeout(100);
    const ep = await readQ();
    const t2 = await q.evaluate(() => ({ vis: !document.getElementById('ovFinal').hidden, t: document.getElementById('finEnd').textContent, name: document.getElementById('finName').hidden }));
    await q.waitForTimeout(1500); await q.tap('#btnFinalNext'); await q.waitForTimeout(100);
    const loot = await q.evaluate(() => window.__game.app.screen === 'scSelect');
    check('10-5 初回：大魔王復活（14行・演出つき）→ 世界征服達成画面（セーブ）→ おまけ会話（13行）→ THE END → ステージ選択', en.o.length === 14 && en.o[0] === 'まさか……ここまで力を取り戻すとは……。' && en.fx >= 3 && t1.vis && t1.t.join('/') === 'WORLD CONQUEST COMPLETE/世界征服達成/魔王軍の世界侵略/全10章クリア/THE END' && t1.saved && t1.saved.done && ep.o.length === 13 && ep.o[12] === '――そして、大魔王の退屈な日々が再び始まるのであった。' && t2.vis && t2.t === 'THE END' && t2.name && loot, JSON.stringify({ en: en.o.length, fx: en.fx, t1, ep: ep.o.length, t2, loot }));
    await q.reload(); await q.waitForFunction(() => window.__game); await q.tap('#btnContinue'); await q.waitForTimeout(150);
    check('再読み込み後も世界征服達成が残る', await q.evaluate(async () => { const m = await import('./js/data/progress.js'); return m.conquestDone(window.__game.app.profile) && m.nextStage(window.__game.app.profile) === null; }));
    const st0 = await q.evaluate(() => window.__game.app.profile.stones);
    await q.evaluate(() => window.__game.startStage('10-5')); await winQ();
    const st1 = await q.evaluate(() => window.__game.app.profile.stones);
    check('10-5 の再クリアではエンディングが起きず、初回報酬も重ならない', !(await q.locator('#scTalk').isVisible()) && !(await q.locator('#ovFinal').isVisible()) && await q.evaluate(() => window.__game.app.screen === 'scSelect') && st1 - st0 < 2000, JSON.stringify({ st0, st1 }));
    // ムービーの差し込み口：動画が読めないときは、その段をとばして続きへ
    await q.evaluate(() => { const g = window.__game; g.SKIN.movies.ending = { src: 'assets/none/ending.mp4', replaces: ['lines'] }; g.app.profile.events.conquest = null; g.startStage('10-5'); });
    await winQ(); await q.waitForTimeout(400);
    const mv = await q.evaluate(() => ({ title: !document.getElementById('ovFinal').hidden, talk: !document.getElementById('scTalk').hidden }));
    check('ムービーの差し込み口：SKIN.movies.ending を入れると会話の段の代わりに動画（読めなければとばす）', mv.title && !mv.talk, JSON.stringify(mv));
    await q.evaluate(() => { window.__game.SKIN.movies.ending = null; });
    check('第10章：エラーなし', e10.length === 0, e10.join(' / '));
    await c10.close();
  }

  // ---- オープニングのスライド：スキップ／二度目は出ない ----
  {
    const cs = await browser.newContext({ ...devices['iPhone 13 landscape'] });
    const q = await cs.newPage(); const es = []; q.on('pageerror', (e) => es.push(String(e)));
    await q.goto(`http://localhost:${PORT}/`); await q.waitForFunction(() => window.__game);
    await q.tap('#btnNew'); await q.waitForTimeout(400);
    const on = await q.locator('#scSlides').isVisible();
    await q.tap('#btnSlideSkip'); await q.waitForTimeout(200);
    const talkFirst = await q.locator('#talkText').textContent();
    check('スライドのスキップで、オープニング会話の掛け合いの最初へ（説明のナレーションは重ねない）', on && !(await q.locator('#scSlides').isVisible()) && talkFirst.startsWith('おのれぇぇ、ヤナイめ！'), talkFirst);
    await q.tap('#btnSkip'); await q.waitForTimeout(200);
    await q.reload(); await q.waitForFunction(() => window.__game); await q.waitForTimeout(150);
    await q.tap('#btnContinue'); await q.waitForTimeout(200);
    check('つづきからではスライドが出ない', !(await q.locator('#scSlides').isVisible()) && await q.evaluate(() => window.__game.app.screen === 'scSelect'));
    await q.evaluate(() => window.__game.toTitle()); await q.waitForTimeout(100);
    await q.tap('#btnNew'); await q.waitForTimeout(150); if (await q.locator('#btnResetYes').isVisible()) await q.tap('#btnResetYes'); await q.waitForTimeout(300);
    check('一度見た（スキップした）あとは、はじめからでもスライドは出ない', !(await q.locator('#scSlides').isVisible()) && await q.locator('#scTalk').isVisible());
    check('スライド：エラーなし', es.length === 0, es.join(' / '));
    await cs.close();
  }

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
  await p3.click('#btnNew'); await p3.waitForTimeout(150);
  await p3.keyboard.press('Escape'); await p3.waitForTimeout(150); // オープニングのスライドを Esc でスキップ
  await p3.keyboard.press('Enter');
  await p3.keyboard.press('Escape'); await p3.waitForTimeout(150);
  check('PC：Enter で会話送り・Esc でスキップ', (await p3.evaluate(() => window.__game.app.screen)) === 'battle');
  await p3.keyboard.press('Enter'); await p3.waitForTimeout(100);
  check('PC：説明も Enter で送れる', (await p3.locator('.slot[data-key="mass"].tutor-focus').count()) === 1);
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
