// 素材の受け入れの通しテスト：node tests/accept.test.mjs
//  ダミーの画像（単色の四角。テスト専用で、ゲームには入れない）で ZIP を作り、プロジェクトのコピーに受け入れて、
//  ブラウザでその絵が仮の表示と差し替わることを確かめる
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'maougun-accept-'));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'OK ' : 'NG '} ${name}${detail ? '  ' + detail : ''}`); };

// 1) ダミーの ZIP を作る（Python + Pillow）
const zip = path.join(tmp, 'dummy_batch.zip');
execFileSync('python3', ['-I', '-c', `
import io, zipfile, sys
from PIL import Image, ImageDraw
def sheet(fw, fh, n, color, transparent=True):
    im = Image.new('RGBA', (fw*n, fh), (0,0,0,0) if transparent else (40,120,40,255))
    d = ImageDraw.Draw(im)
    for i in range(n):
        d.rectangle([i*fw+fw*0.3, fh*0.25, i*fw+fw*0.7, fh-16], fill=color)
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()
with zipfile.ZipFile(sys.argv[1], 'w') as z:
    z.writestr('batch01/humans/militia.png', sheet(256, 256, 4, (230,180,90,255)))
    z.writestr('batch01/humans/archer.png', sheet(256, 256, 4, (90,180,90,255), transparent=False))
    z.writestr('batch01/humans/swordsman.png', sheet(256, 256, 3, (90,120,230,255)))
    z.writestr('batch01/bases/watchtower_0.png', sheet(480, 640, 1, (150,100,60,255)))
    z.writestr('batch01/units/mass.png', sheet(256, 256, 4, (140,90,230,255)))
    z.writestr('batch01/talk/tiw_normal.png', sheet(512, 512, 1, (120,200,120,255)))
    z.writestr('batch01/readme_images/extra.png', sheet(64, 64, 1, (255,0,0,255)))
    z.writestr('batch01/fx/hit.png', sheet(128, 128, 4, (255,240,160,255)))
    z.writestr('batch01/fx/summon.png', sheet(256, 96, 6, (180,90,255,255)))
    z.writestr('batch01/fx/slash.png', sheet(192, 192, 5, (255,255,255,255)))
    z.writestr('batch01/ui/logo.png', sheet(1600, 600, 1, (240,200,90,255)))
    z.writestr('batch01/ui/frame_card.png', sheet(160, 192, 1, (230,190,90,255)))
    z.writestr('batch01/ui/loot_1-1.png', sheet(192, 192, 1, (220,200,150,255)))
`, zip]);

// 2) プロジェクトのコピーに受け入れる
const proj = path.join(tmp, 'proj');
fs.cpSync(ROOT, proj, { recursive: true, filter: (s) => !s.includes(`${path.sep}.git`) && !s.includes('node_modules') });
// 本物の承認済み素材は使わず、空の登録から始める（ダミーだけで確かめる）
fs.rmSync(path.join(proj, 'assets/approved'), { recursive: true, force: true });
fs.writeFileSync(path.join(proj, 'js/data/approved.js'), 'export const APPROVED = /*JSON*/{"sprites":{},"images":{"stageBg":{},"base":{},"shrine":null,"talkBg":{}},"portraits":{},"fx":{},"ui":{}}/*END*/;\n');
let out = '';
try { out = execFileSync('python3', ['-I', path.join(proj, 'tools/accept_assets.py'), zip, '--root', proj], { encoding: 'utf8' }); }
catch (e) { out = e.stdout; } // 不合格があると終了コード1
const row = (f) => out.split('\n').find((l) => l.includes(f)) || '';
check('透過・4コマの兵士は合格して登録', row('humans/militia.png').includes('合格') && row('humans/militia.png').includes('登録：sprites.militia'));
check('背景が透過されていない素材は不合格', row('humans/archer.png').includes('不合格') && row('humans/archer.png').includes('透過'));
check('コマ数が仕様と違う素材は不合格', row('humans/swordsman.png').includes('不合格') && row('humans/swordsman.png').includes('コマ数'));
check('見張り小屋は合格して登録', row('watchtower_0.png').includes('登録：watchtower'));
check('魔王軍のユニットは取り込みのみ（登録はしない）', row('units/mass.png').includes('取り込みのみ'));
check('村人の顔は登録', row('tiw_normal.png').includes('登録：portraits.tiw_normal'));
check('依頼書にないファイルは対象外', row('extra.png').includes('対象外'));
check('エフェクト（4コマ・6コマ）は合格して登録', row('fx/hit.png').includes('登録：fx.hit') && row('fx/summon.png').includes('登録：fx.summon'));
check('エフェクトのコマ数違いは不合格', row('fx/slash.png').includes('不合格'));
check('UI画像は合格して登録', row('ui/logo.png').includes('登録：ui.logo') && row('ui/frame_card.png').includes('登録：ui.frame_card') && row('ui/loot_1-1.png').includes('登録：ui.loot_1-1'));
check('合格した素材が元のバイト列のままコピーされる', fs.existsSync(path.join(proj, 'assets/approved/humans/militia.png')) && !fs.existsSync(path.join(proj, 'assets/approved/humans/archer.png')));
const manifest = fs.readFileSync(path.join(proj, 'js/data/approved.js'), 'utf8');
check('approved.js に登録が書かれる', manifest.includes('"militia"') && manifest.includes('"tower"') && !manifest.includes('"mass"'));
check('検査の結果が docs/reports に残る', fs.readdirSync(path.join(proj, 'docs/reports')).some((f) => f.startsWith('accept_')));

// 3) ブラウザで差し替わることを確かめる
const { serve } = await import(path.join(proj, 'tests/serve.js'));
const server = await serve(8099);
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ ...devices['iPhone 13 landscape'] });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:8099/?seed=1'); await page.waitForFunction(() => window.__game);
  await page.evaluate(() => { const g = window.__game; g.startStage('1-1'); const b = g.battle; const h = b.spawnHuman('militia'); h.x = 300; g.renderer.camX = 0; });
  await page.waitForTimeout(600);
  const st = await page.evaluate(async () => {
    const { spriteFor } = await import('./js/render/shapes.js');
    const { SKIN } = await import('./js/data/skin.js');
    return { sprite: !!spriteFor('militia'), mass: !!SKIN.sprites.mass, base: !!(SKIN.images.base.tower && SKIN.images.base.tower.src) };
  });
  check('ブラウザで兵士の絵が読み込まれ、仮の絵と差し替わる', st.sprite);
  check('見張り小屋の絵が登録されている', st.base);
  check('魔王軍のユニットは登録されていない（仮の表示のまま）', !st.mass);
  const ui = await page.evaluate(() => ({ logo: !!document.querySelector('.logo img.logoImg'), card: document.getElementById('game').classList.contains('ui-card'), panel: document.getElementById('game').classList.contains('ui-panel') }));
  check('タイトルロゴとカード枠の画像が当たる（未着のパネル枠は今のまま）', ui.logo && ui.card && !ui.panel, JSON.stringify(ui));
  const fx = await page.evaluate(() => { const r = window.__game.renderer; return { hit: !!r.fxImage('hit'), summon: !!r.fxImage('summon'), slash: !!r.fxImage('slash') }; });
  check('エフェクト画像が読み込まれる（不合格のものは仮の演出のまま）', fx.hit && fx.summon && !fx.slash, JSON.stringify(fx));
  await page.evaluate(() => { const g = window.__game; const b = g.battle; for (let i = 0; i < 3; i++) b.queue({ type: 'summon', key: 'mass' }); b.cooldowns.mass = 0; b.step(); const h = b.entities.find((e) => e.side === 'human'); b.damageUnit(h, 10, null); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(tmp, 'accept_battle.png') });
  check('コンソールにエラーが無い', errors.length === 0, errors.join(' / '));
  console.log('スクリーンショット：' + path.join(tmp, 'accept_battle.png'));
} finally { await browser.close(); server.close(); }

console.log(`\n${results.filter(Boolean).length}/${results.length} OK`);
process.exit(results.every(Boolean) ? 0 : 1);
