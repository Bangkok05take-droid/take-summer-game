// 戦闘ロジック・進行の自動テスト：node --test tests/battle.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, run, botPlayer, profileFor, STEP, CONFIG, STAGES, CHAPTER1, HUMANS } from './helpers.js';
import { createClock } from '../js/core/clock.js';
import {
  newProfile, loadProfile, saveProfile, resetProfile, applyResult, isStageOpen, nextStage, buildDeck, resolveMana,
  levelUpUnit, buyUpgrade, START_UNITS, SAVE_KEY,
} from '../js/data/progress.js';

const stage = (over, id = '1-1') => ({ ...STAGES[id], ...over });
const noEnemies = (over = {}) => stage({ spawns: [], ...over });
const ALL = ['mass', 'vanguard', 'tank', 'ranged', 'fast', 'area', 'healer', 'special'];
const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

// ---------- 配置・基本 ----------
test('人間軍の拠点は左、魔王軍の祠は右', () => {
  const b = makeBattle({ stage: noEnemies() });
  assert.ok(b.base.x < b.shrine.x);
  assert.equal(b.dirOf('demon'), -1); assert.equal(b.dirOf('human'), 1);
});

test('開始時の魔力・上限・回復（1-1）', () => {
  const b = makeBattle({ stage: noEnemies() });
  assert.equal(b.mana, 200); assert.equal(b.manaMax, 1000); assert.equal(b.manaRegen, STAGES['1-1'].mana.regen);
  run(b, 100);
  assert.equal(b.mana, 1000, '上限で止まる');
});

test('魔物は右から左へ、人間軍は左から右へ自動で進む', () => {
  const b = makeBattle({ stage: stage({ spawns: [{ who: 'militia', start: 0, every: 999, max: 1 }] }) });
  b.queue({ type: 'summon', key: 'mass' });
  run(b, 0.1);
  const d0 = b.entities.find((e) => e.side === 'demon').x;
  const h0 = b.entities.find((e) => e.side === 'human').x;
  assert.ok(d0 > b.shrine.x - 100, '魔物は祠の前に出る');
  assert.ok(h0 < b.base.x + 100, '人間は拠点の前に出る');
  run(b, 3);
  assert.ok(b.entities.find((e) => e.side === 'demon').x < d0 - 100, '魔物は左へ');
  assert.ok(b.entities.find((e) => e.side === 'human').x > h0 + 100, '人間は右へ');
});

// ---------- 召喚 ----------
test('魔力不足では召喚できない', () => {
  const b = makeBattle({ stage: noEnemies() });
  assert.equal(b.canSummon('tank').reason, 'mana'); // 400 > 200
  b.queue({ type: 'summon', key: 'tank' }); b.step();
  assert.equal(b.entities.length, 0);
  assert.ok(b.events.some((e) => e.type === 'denied' && e.reason === 'mana'));
});

test('召喚コストが引かれ、クールタイム中は再召喚できない', () => {
  const b = makeBattle({ stage: noEnemies() });
  const d = b.deckDef('vanguard');
  b.queue({ type: 'summon', key: 'vanguard' }); b.step();
  assert.equal(b.entities.length, 1);
  assert.ok(Math.abs(b.mana - (200 - d.cost + b.manaRegen * STEP)) < 1e-6);
  assert.equal(b.canSummon('vanguard').reason, 'cooldown');
  b.mana = 1000; b.queue({ type: 'summon', key: 'vanguard' }); b.step();
  assert.equal(b.entities.length, 1, 'クールタイム中は増えない');
  run(b, d.cooldown);
  assert.ok(b.canSummon('vanguard').ok, 'クールタイムが明けたら出せる');
});

test('同時出撃上限（30体）では召喚できない', () => {
  const b = makeBattle({ stage: noEnemies({ mana: { start: 1000, max: 99999, regen: 9999 } }) });
  for (let i = 0; i < 40; i++) { b.cooldowns.mass = 0; b.queue({ type: 'summon', key: 'mass' }); b.step(); }
  assert.equal(b.aliveDemons(), CONFIG.demonCap);
  b.cooldowns.mass = 0;
  assert.equal(b.canSummon('mass').reason, 'cap');
});

test('未解放のユニットは編成されない（初期は4種）', () => {
  const deck = buildDeck(newProfile()).map((d) => d.key);
  assert.deepEqual(deck, ['mass', 'vanguard', 'tank', 'area']);
  const b = makeBattle({ stage: noEnemies(), profile: newProfile() });
  assert.equal(b.canSummon('ranged').reason, 'locked');
});

// ---------- 戦闘 ----------
test('射程内で止まって攻撃する（遠距離は射程が長い）', () => {
  const b = makeBattle({ stage: stage({ spawns: [{ who: 'swordsman', start: 0, every: 999, max: 1 }] }), deck: ALL });
  b.queue({ type: 'summon', key: 'ranged' });
  let dist = null;
  run(b, 40, (bb) => {
    const r = bb.entities.find((e) => e.key === 'ranged'); const h = bb.entities.find((e) => e.side === 'human' && e.state !== 'dead');
    if (dist == null && r && h && r.state === 'attack') dist = r.x - h.x;
  });
  assert.ok(dist != null && dist > 150 && dist <= 211, `射程の端から撃つ（距離 ${dist}）`);
});

test('HPが0になったユニットは消え、倒した人間からは魔力を得る', () => {
  const b = makeBattle({ stage: noEnemies() });
  const h = b.spawnHuman('militia');
  const before = b.mana;
  b.damageUnit(h, 9999, null);
  assert.equal(h.state, 'dead');
  assert.ok(b.mana >= before + HUMANS.militia.mana - 1e-9);
  run(b, CONFIG.deathTime + 0.1);
  assert.ok(!b.entities.includes(h));
});

test('範囲攻撃は射程内の全員に当たる', () => {
  const b = makeBattle({ stage: noEnemies(), deck: ALL });
  const m = b.spawn('demon', b.deckDef('area'), 1200);
  const hs = [0, 40, 90].map((dx) => { const h = b.spawnHuman('swordsman'); h.x = 1200 - 60 - dx; return h; });
  m.x = 1200;
  run(b, 1.2);
  assert.ok(hs.every((h) => h.hp < h.maxHp), '3人ともダメージ');
});

test('回復：回復支援は周りの傷ついた味方を回復する', () => {
  const b = makeBattle({ stage: noEnemies(), deck: ALL });
  const hl = b.spawn('demon', b.deckDef('healer'), 1500); hl.x = 1500;
  const t = b.spawn('demon', b.deckDef('vanguard'), 1500); t.x = 1450; t.hp = 100;
  run(b, 4.2);
  assert.ok(t.hp > 100, `回復した（${t.hp}）`);
});

test('特殊魔法：弱い魔法・強い魔法・失敗がどれも起きる', () => {
  const kinds = { weak: 0, big: 0, fizzle: 0 };
  for (let seed = 1; seed <= 6; seed++) {
    const b = makeBattle({ stage: noEnemies(), deck: ALL, seed });
    const s = b.spawn('demon', b.deckDef('special'), 1500); s.x = 1500;
    for (let i = 0; i < 30; i++) {
      for (const e of b.entities) if (e.side === 'human') e.hp = e.maxHp;
      if (!b.entities.some((e) => e.side === 'human')) { const h = b.spawnHuman('shield'); h.x = 1400; h.def = { ...h.def, speed: 0, hp: 1e9 }; h.hp = h.maxHp = 1e9; }
      b.events.length = 0;
      run(b, 2.5);
      for (const ev of b.events) { if (ev.type === 'bigMagic') kinds.big++; if (ev.type === 'fizzle') kinds.fizzle++; if (ev.type === 'strike' && ev.side === 'demon') kinds.weak++; }
    }
  }
  assert.ok(kinds.big > 0 && kinds.fizzle > 0 && kinds.weak > kinds.big, JSON.stringify(kinds));
});

test('状態異常：気絶中は動かず攻撃しない', () => {
  const b = makeBattle({ stage: noEnemies() });
  const d = b.spawn('demon', b.deckDef('mass'), 1500); d.x = 1500; d.stun = 2;
  run(b, 1.5);
  assert.equal(Math.round(d.x), 1500);
  run(b, 1.0);
  assert.ok(d.x < 1500);
});

test('ノックバック：決まった回数ごとに後ろ（人間は左）へ下がる', () => {
  const b = makeBattle({ stage: noEnemies() });
  const h = b.spawnHuman('swordsman'); h.x = 1200;
  b.damageUnit(h, 100, null); assert.equal(h.state, 'walk');
  b.damageUnit(h, 60, null); assert.equal(h.state, 'kb');
  run(b, CONFIG.kbTime);
  assert.ok(h.x < 1200 - CONFIG.kbDistance + 1);
});

// ---------- 勇者 ----------
test('1-5：拠点HP70%で勇者たけ、40%で勇者サイが1回だけ登場する', () => {
  const b = makeBattle({ stageId: '1-5', stage: { ...STAGES['1-5'], spawns: STAGES['1-5'].spawns.filter((r) => r.trigger) } });
  const count = (k) => b.entities.filter((e) => e.key === k).length;
  b.damageBase(b.base, b.base.maxHp * 0.29); run(b, 3);
  assert.equal(count('take'), 0, '71%ではまだ');
  b.damageBase(b.base, b.base.maxHp * 0.02); run(b, 3);
  assert.equal(count('take'), 1, '69%でたけ');
  assert.equal(count('sai'), 0);
  b.damageBase(b.base, b.base.maxHp * 0.3); run(b, 3);
  assert.equal(count('sai'), 1, '39%でサイ');
  run(b, 5);
  assert.equal(count('take') + count('sai'), 2, 'それぞれ1回だけ');
});

test('勇者たけ：2連撃・飛ぶ斬撃（吹き飛ばし）', () => {
  const b = makeBattle({ stage: noEnemies() });
  const t = b.spawnHuman('take'); t.x = 1000;
  const ms = [0, 100, 200].map((dx) => { const m = b.spawn('demon', b.deckDef('tank'), 1100); m.x = 1050 + dx; return m; });
  let strikes = 0; let wave = 0;
  run(b, 6, (bb) => { for (const ev of bb.events) { if (ev.type === 'strike' && ev.id === t.id) strikes++; if (ev.type === 'skill' && ev.skill === 'wave') wave++; } bb.events.length = 0; });
  assert.ok(strikes >= 2 && strikes % 2 === 0, `通常攻撃は2回ずつ当たる（${strikes}回）`);
  assert.ok(wave >= 1, '飛ぶ斬撃を使った');
  assert.ok(ms.every((m) => m.kbDone >= 0 && m.hp < m.maxHp), '前方の魔物全員にダメージ');
});

test('勇者サイ：回復と行動妨害', () => {
  const b = makeBattle({ stage: noEnemies() });
  const s = b.spawnHuman('sai'); s.x = 1000;
  const ally = b.spawnHuman('swordsman'); ally.x = 1050; ally.hp = 50;
  const m = b.spawn('demon', b.deckDef('tank'), 1150); m.x = 1150;
  let stunned = false;
  run(b, 12, () => { if (m.stun > 0) stunned = true; });
  assert.ok(ally.hp > 50 || ally.state === 'dead', '味方を回復');
  assert.ok(stunned, '魔物を止めた');
});

// ---------- 呪文・魔力炉 ----------
test('魔王の呪文：人間の密集地点を中心に範囲ダメージ', () => {
  const b = makeBattle({ stage: noEnemies() });
  run(b, CONFIG.spell.charge + 0.1);
  const crowd = [0, 30, 60, 90].map((dx) => { const h = b.spawnHuman('swordsman'); h.x = 800 + dx; return h; });
  const lone = b.spawnHuman('swordsman'); lone.x = 1600;
  assert.ok(b.canCastSpell().ok);
  b.queue({ type: 'spell' }); b.step();
  assert.ok(crowd.every((h) => h.hp <= h.maxHp - CONFIG.spell.damage));
  assert.equal(lone.hp, lone.maxHp, '密集から離れた1人には当たらない');
});

test('魔力炉：最大魔力と回復が上がる', () => {
  const b = makeBattle({ stage: noEnemies() });
  const m0 = b.manaMax; const r0 = b.manaRegen;
  b.queue({ type: 'furnace' }); b.step();
  assert.equal(b.furnaceLv, 2);
  assert.equal(b.manaMax, m0 + CONFIG.furnace.maxAdd);
  assert.equal(b.manaRegen, r0 + CONFIG.furnace.regenAdd);
});

test('幹部：同時に1体まで・撃破時からクールタイム', () => {
  const b = makeBattle({ stage: noEnemies({ mana: { start: 5000, max: 9999, regen: 0 } }), deck: ['mass', 'charger'] });
  b.queue({ type: 'summon', key: 'charger' }); b.step();
  const boss = b.entities.find((e) => e.key === 'charger');
  assert.equal(b.canSummon('charger').reason, 'alive');
  b.damageUnit(boss, 1e9, null); b.step();
  assert.equal(b.canSummon('charger').reason, 'cooldown');
  run(b, 60.1);
  assert.ok(b.canSummon('charger').ok);
});

// ---------- テンポ・再現性・速度 ----------
test('全5ステージ：ふつうに遊べば勝てる（ボットで確認）', () => {
  for (const id of CHAPTER1.stages) {
    const b = makeBattle({ stageId: id, seed: 2, upgraded: true });
    run(b, 900, botPlayer('normal'));
    assert.equal(b.result, 'win', `${id} ${b.result} ${b.t.toFixed(0)}秒`);
    assert.ok(b.t > 120 && b.t < (id === '1-5' ? 480 : 360), `${id} クリア時間 ${b.t.toFixed(0)}秒`);
  }
});

test('全5ステージ：何もしなければ負ける', () => {
  for (const id of CHAPTER1.stages) {
    const b = makeBattle({ stageId: id, seed: 3 });
    run(b, 600);
    assert.equal(b.result, 'lose', id);
  }
});

test('同じシード・同じ操作なら同じ結果', () => {
  const a = makeBattle({ seed: 42, stageId: '1-5' }); const c = makeBattle({ seed: 42, stageId: '1-5' });
  run(a, 200, botPlayer()); run(c, 200, botPlayer());
  assert.deepEqual(a.snapshot(), c.snapshot());
});

test('2倍速：実時間あたりの手数が2倍で、結果は通常速度と同じ', () => {
  const c1 = createClock(STEP); const c2 = createClock(STEP); c2.speed = 2;
  const a = makeBattle({ seed: 7 }); const b = makeBattle({ seed: 7 });
  const bot1 = botPlayer(); const bot2 = botPlayer();
  let n1 = 0; let n2 = 0;
  for (let i = 0; i < 600; i++) for (let k = c1.advance(1 / 60); k > 0; k--, n1++) { bot1(a); a.step(); }
  for (let i = 0; i < 300; i++) for (let k = c2.advance(1 / 60); k > 0; k--, n2++) { bot2(b); b.step(); }
  assert.equal(n1, 300); assert.equal(n2, 300);
  assert.deepEqual(a.snapshot(), b.snapshot());
});

test('多数のユニット（30対30＋勇者）でも1手が十分速い', () => {
  const b = makeBattle({ stage: noEnemies({ mana: { start: 0, max: 0, regen: 0 } }), deck: ALL });
  for (let i = 0; i < 30; i++) { const d = b.spawn('demon', b.deck[i % 8], 0); d.x = 1000 + i * 5; }
  for (let i = 0; i < 30; i++) { const h = b.spawnHuman(['militia', 'swordsman', 'archer', 'priest'][i % 4]); h.x = 900 + i * 5; }
  b.spawnHuman('take').x = 950; b.spawnHuman('sai').x = 800;
  const t0 = performance.now();
  for (let i = 0; i < 300; i++) b.step();
  const per = (performance.now() - t0) / 300;
  assert.ok(per < 1.0, `1手 ${per.toFixed(3)} ms`);
});

// ---------- 進行・セーブ ----------
test('勝利でつぎのステージとユニットが解放される（解放順）', () => {
  const p = newProfile();
  assert.ok(isStageOpen(p, '1-1')); assert.ok(!isStageOpen(p, '1-2'));
  const order = { '1-1': 'ranged', '1-2': 'fast', '1-3': 'healer', '1-4': 'special', '1-5': 'charger' };
  for (const id of CHAPTER1.stages) {
    const r = applyResult(p, id, 'win', 200);
    assert.equal(r.unlocked, order[id], id);
    assert.ok(r.firstClear);
    const i = CHAPTER1.stages.indexOf(id);
    if (i < 4) assert.ok(isStageOpen(p, CHAPTER1.stages[i + 1]));
  }
  assert.equal(nextStage(p), null);
  assert.equal(p.loot.length, 5);
  assert.deepEqual(buildDeck(p).map((d) => d.key), ALL, '第1章クリアで通常8種がそろう（幹部は第2章から）');
  const again = applyResult(p, '1-1', 'win', 150);
  assert.ok(!again.firstClear && again.stones < STAGES['1-1'].reward.stones && !again.unlocked);
});

test('負けても少し魔界石が入り、解放はされない', () => {
  const p = newProfile();
  const r = applyResult(p, '1-1', 'lose', 100);
  assert.ok(r.stones > 0 && !r.unlocked && !isStageOpen(p, '1-2'));
});

test('ステージを進めると大魔王の魔力（最大・回復）が上がる', () => {
  const p0 = newProfile(); const m0 = resolveMana(STAGES['1-1'].mana, p0);
  const p1 = profileFor('1-3'); const m1 = resolveMana(STAGES['1-1'].mana, p1);
  assert.ok(m1.max > m0.max && m1.regen > m0.regen);
});

test('簡易強化：魔界石でレベル・魔力が上がり、足りなければ買えない', () => {
  const p = newProfile(); p.stones = 1000;
  const hp0 = buildDeck(p).find((d) => d.key === 'mass').hp;
  assert.ok(levelUpUnit(p, 'mass').ok);
  assert.ok(buildDeck(p).find((d) => d.key === 'mass').hp > hp0);
  assert.equal(levelUpUnit(p, 'ranged').reason, 'locked');
  assert.ok(buyUpgrade(p, 'manaMax').ok);
  assert.equal(resolveMana(STAGES['1-1'].mana, p).max, 1100);
  p.stones = 0;
  assert.equal(buyUpgrade(p, 'manaRegen').reason, 'stones');
});

test('セーブ・ロード・リセット', () => {
  const st = memStore();
  const p = newProfile(); applyResult(p, '1-1', 'win', 123); p.stones = 777; p.story.opening = true;
  saveProfile(p, st);
  const q = loadProfile(st);
  assert.equal(q.stones, 777); assert.ok(q.stages['1-1'].cleared); assert.ok(q.units.ranged.unlocked); assert.ok(q.story.opening);
  const r = resetProfile(st);
  assert.equal(st.getItem(SAVE_KEY), null);
  assert.equal(r.stones, 0); assert.deepEqual(buildDeck(r).map((d) => d.key), START_UNITS);
});

test('壊れたセーブデータでも新しいプロフィールで始まる', () => {
  const st = memStore(); st.setItem(SAVE_KEY, '{oops');
  assert.equal(loadProfile(st).stones, 0);
  st.setItem(SAVE_KEY, JSON.stringify({ stones: 5, units: { mass: { level: 3 } } }));
  const p = loadProfile(st);
  assert.equal(p.units.mass.level, 3); assert.ok(p.units.mass.unlocked); assert.ok(p.upgrades && p.stages && p.story);
});
