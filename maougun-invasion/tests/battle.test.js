// 戦闘ロジック・進行の自動テスト：node --test tests/battle.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, run, botPlayer, profileFor, STEP, CONFIG, STAGES, CHAPTER1, HUMANS } from './helpers.js';
import { createClock } from '../js/core/clock.js';
import { createBattle } from '../js/core/battle.js';
import { BOSSES, UNITS, EVOLUTIONS, ATTACK_TYPES } from '../js/data/units.js';
import {
  newProfile, loadProfile, saveProfile, resetProfile, applyResult, isStageOpen, nextStage, buildDeck, resolveMana,
  lordLevel, slotsFor, addToFormation, removeFromFormation, migrate, resolveSpell, resolveUnit, evolutionChoices, evolveUnit,
  levelUpUnit, buyUpgrade, START_UNITS, SAVE_KEY,
} from '../js/data/progress.js';

import { STAGE_ORDER as STAGE_ORDER_ALL } from '../js/data/stages.js';
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

test('通常モンスター8体は最初から使える。編成は最初の5体（プチデビルはいない）', () => {
  const p = newProfile();
  assert.deepEqual(START_UNITS, ['mass', 'vanguard', 'tank', 'ranged', 'fast', 'area', 'healer', 'mallet']);
  for (const k of START_UNITS) assert.ok(p.units[k].unlocked, k);
  assert.deepEqual(buildDeck(p).map((d) => d.key), ['mass', 'vanguard', 'tank', 'ranged', 'fast']);
  assert.equal(addToFormation(p, 'special').reason, 'locked');
  const b = makeBattle({ stage: noEnemies(), profile: p });
  assert.equal(b.canSummon('area').reason, 'locked', '編成していない魔物は呼べない');
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
  assert.ok(crowd.every((h) => h.hp === h.maxHp), '唱えた瞬間はまだ当たらない（不死鳥が飛んでいる）');
  run(b, 0.7);
  assert.ok(crowd.every((h) => h.hp <= h.maxHp - CONFIG.spell.damage), '着弾でダメージ');
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
  b.furnaceLv = 3;
  b.queue({ type: 'summon', key: 'charger' }); b.step();
  const boss = b.entities.find((e) => e.key === 'charger');
  assert.equal(b.canSummon('charger').reason, 'alive');
  b.damageUnit(boss, 1e9, null); b.step();
  assert.equal(b.canSummon('charger').reason, 'cooldown');
  run(b, 60.1);
  assert.ok(b.canSummon('charger').ok);
});

// ---------- テンポ・再現性・速度 ----------
test('第1章：ふつうに遊べば勝てる（ボットで確認）', () => {
  for (const id of CHAPTER1.stages) {
    const b = makeBattle({ stageId: id, seed: 2, upgraded: true });
    run(b, 900, botPlayer('normal'));
    assert.equal(b.result, 'win', `${id} ${b.result} ${b.t.toFixed(0)}秒`);
    assert.ok(b.t > 90 && b.t < 360, `${id} クリア時間 ${b.t.toFixed(0)}秒`);
  }
});

test('何もしなければ負ける（1-1 は説明のステージなので負けない）', () => {
  for (const id of CHAPTER1.stages) {
    const b = makeBattle({ stageId: id, seed: 3 });
    run(b, 600);
    if (STAGES[id].noLose) { assert.notEqual(b.result, 'lose', id); assert.ok(b.shrine.hp >= 1); }
    else assert.equal(b.result, 'lose', id);
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
test('第1章は3ステージ。順に解放され、1-3 クリアで幹部・突進', () => {
  const p = newProfile();
  assert.deepEqual(CHAPTER1.stages, ['1-1', '1-2', '1-3']);
  assert.ok(isStageOpen(p, '1-1')); assert.ok(!isStageOpen(p, '1-2'));
  const order = { '1-1': null, '1-2': null, '1-3': 'charger' };
  for (const id of CHAPTER1.stages) {
    const r = applyResult(p, id, 'win', 200);
    assert.equal(r.unlocked, order[id], id);
    assert.ok(r.firstClear);
    const i = CHAPTER1.stages.indexOf(id);
    if (i < CHAPTER1.stages.length - 1) assert.ok(isStageOpen(p, CHAPTER1.stages[i + 1]));
  }
  assert.equal(nextStage(p), '2-1', '第1章をクリアすると第2章へ');
  assert.ok(isStageOpen(p, '2-1') && !isStageOpen(p, '2-2'));
  assert.equal(p.loot.length, 3);
  assert.equal(lordLevel(p), 4);
  assert.deepEqual(buildDeck(p).map((d) => d.key), ['mass', 'vanguard', 'tank', 'ranged', 'fast', 'area', 'charger'], '1-3 クリアで大魔王Lv4（増えた6枠目は控えから自動で埋まる）＋幹部・突進');
  const again = applyResult(p, '1-1', 'win', 150);
  assert.ok(!again.firstClear && again.stones < STAGES['1-1'].reward.stones && !again.unlocked);
});
test('チュートリアル：1-1 説明・1-2 ヒント・1-3 自分で。旧 1-4・1-5 は遊べない（第2章の素材）', () => {
  assert.equal(STAGES['1-1'].tutorial, 'guide'); assert.ok(STAGES['1-1'].noLose);
  assert.equal(STAGES['1-2'].tutorial, 'hints'); assert.equal(STAGES['1-3'].tutorial, 'self');
  assert.ok(STAGES['1-4'].reserve && STAGES['1-5'].reserve);
  assert.ok(!CHAPTER1.stages.includes('1-4') && !CHAPTER1.stages.includes('1-5'));
  const b = makeBattle({ stageId: '1-2' });
  b.spawnerOff = true; run(b, 30);
  assert.equal(b.aliveHumans(), 0, 'spawnerOff の間は敵が出ない');
  b.spawnerOff = false; run(b, 5);
  assert.ok(b.aliveHumans() > 0, '止めた分だけ遅れて出始める');
});
test('負けると負けた回数が記録される（1-3 の助言用）', () => {
  const p = newProfile(); applyResult(p, '1-3', 'lose', 50); applyResult(p, '1-3', 'lose', 50);
  assert.equal(p.stages['1-3'].losses, 2); assert.ok(!p.stages['1-3'].cleared);
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
  assert.equal(levelUpUnit(p, 'special').reason, 'locked');
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
  assert.equal(q.stones, 777); assert.ok(q.stages['1-1'].cleared); assert.ok(q.units.mallet.unlocked); assert.ok(q.story.opening);
  const r = resetProfile(st);
  assert.equal(st.getItem(SAVE_KEY), null);
  assert.equal(r.stones, 0); assert.deepEqual(buildDeck(r).map((d) => d.key), START_UNITS.slice(0, 5));
});

test('壊れたセーブデータでも新しいプロフィールで始まる', () => {
  const st = memStore(); st.setItem(SAVE_KEY, '{oops');
  assert.equal(loadProfile(st).stones, 0);
  st.setItem(SAVE_KEY, JSON.stringify({ stones: 5, units: { mass: { level: 3 } } }));
  const p = loadProfile(st);
  assert.equal(p.units.mass.level, 3); assert.ok(p.units.mass.unlocked); assert.ok(p.upgrades && p.stages && p.story);
});

// ---------- 編成・幹部・成長（2026-11-24 承認仕様） ----------
test('編成枠：大魔王Lv1 は通常5＋幹部1、Lv4 で 6＋1、Lv9 で 6＋2', () => {
  const p = newProfile();
  assert.deepEqual(slotsFor(p), { units: 5, bosses: 1 });
  for (const id of ['1-1', '1-2', '1-3']) applyResult(p, id, 'win', 100);
  assert.equal(lordLevel(p), 4); assert.deepEqual(slotsFor(p), { units: 6, bosses: 1 });
  for (let i = 0; i < 5; i++) p.stages['x' + i] = { cleared: true };
  assert.equal(lordLevel(p), 9); assert.deepEqual(slotsFor(p), { units: 6, bosses: 2 });
});

test('編成：枠を超えて入れられない・外すと空く・未解放は入れられない', () => {
  const p = newProfile();
  assert.equal(addToFormation(p, 'area').reason, 'full');
  assert.equal(addToFormation(p, 'special').reason, 'locked');
  removeFromFormation(p, 'mass');
  assert.ok(addToFormation(p, 'mallet').ok);
  assert.deepEqual(buildDeck(p).map((d) => d.key), ['vanguard', 'tank', 'ranged', 'fast', 'mallet']);
  assert.equal(addToFormation(p, 'trickster').reason, 'locked', '準備中の幹部は編成できない');
});

test('編成は保存され、版1のセーブは解放済みの魔物で編成が作られる', () => {
  const st = memStore();
  const p = newProfile(); p.units.ranged.unlocked = true; p.units.fast.unlocked = true;
  p.formation.units = ['fast', 'mass'];
  saveProfile(p, st);
  assert.deepEqual(loadProfile(st).formation.units, ['fast', 'mass']);
  const old = { version: 1, stones: 3, units: { ranged: { unlocked: true }, fast: { unlocked: true }, healer: { unlocked: true } }, stages: {} };
  const q = migrate(old);
  assert.equal(q.version, 2);
  assert.deepEqual(q.formation.units, ['mass', 'vanguard', 'tank', 'ranged', 'fast']);
});

test('幹部：魔力が足りても魔力炉Lvが足りなければ召喚できない', () => {
  const b = makeBattle({ stage: noEnemies({ mana: { start: 5000, max: 9999, regen: 0 } }), deck: ['mass', 'charger'] });
  assert.equal(b.canSummon('charger').reason, 'furnace');
  assert.equal(b.canSummon('charger').lv, BOSSES.charger.needFurnace);
  b.furnaceLv = BOSSES.charger.needFurnace;
  assert.ok(b.canSummon('charger').ok);
  b.mana = 0;
  assert.equal(b.canSummon('charger').reason, 'mana');
});

test('幹部：別の幹部が出撃中は召喚できず、撃破後は別の幹部が20秒・同じ幹部が60秒待つ', () => {
  const twin = { ...BOSSES.charger, ready: true, role: 'テスト用の幹部' };
  const deck = [resolveUnit('charger', newProfile()), { ...twin, key: 'twin', hp: 7000 }];
  const b = createBattle({ stage: noEnemies({ mana: { start: 9000, max: 9999, regen: 0 } }), deck, humanDefs: HUMANS, config: CONFIG, seed: 1 });
  b.furnaceLv = 8;
  b.queue({ type: 'summon', key: 'charger' }); b.step();
  assert.equal(b.canSummon('twin').reason, 'bossOut');
  assert.equal(b.canSummon('charger').reason, 'alive');
  b.damageUnit(b.entities.find((e) => e.key === 'charger'), 1e9, null); b.step();
  assert.equal(b.canSummon('twin').reason, 'cooldown');
  assert.ok(b.canSummon('twin').wait <= CONFIG.bossSwitch && b.canSummon('twin').wait > CONFIG.bossSwitch - 1);
  run(b, CONFIG.bossSwitch + 0.1);
  assert.ok(b.canSummon('twin').ok, '20秒で別の幹部を出せる');
  assert.equal(b.canSummon('charger').reason, 'cooldown', '同じ幹部はまだ待つ');
  run(b, 60 - CONFIG.bossSwitch);
  assert.ok(b.canSummon('charger').ok, '同じ幹部は60秒で、魔力を払えば何度でも');
});

test('幹部の召喚費用は 1200〜2200、必要な魔力炉Lvは 2〜8', () => {
  for (const [k, d] of Object.entries(BOSSES)) {
    if (d.special) continue; // 竜人オルドは別枠（とても高い）
    assert.ok(d.cost >= 1200 && d.cost <= 2200, k);
    assert.ok(d.needFurnace >= 2 && d.needFurnace <= 8, k);
    assert.equal(d.cooldown, 60, k);
    // 必要な炉Lvで、最大魔力が費用に届く（恒久強化なしでも）
    assert.ok(1000 + (d.needFurnace - 1) * CONFIG.furnace.maxAdd >= d.cost, k);
  }
});

test('魔王の力：呪文の威力とため時間が強化される', () => {
  const p = newProfile(); p.stones = 9999;
  const s0 = resolveSpell(CONFIG.spell, p);
  assert.ok(buyUpgrade(p, 'spellPower').ok && buyUpgrade(p, 'spellCharge').ok);
  const s1 = resolveSpell(CONFIG.spell, p);
  assert.ok(s1.damage > s0.damage && s1.charge < s0.charge);
});

// ---------- 攻撃タイプ・後衛狙撃・木槌小鬼（2026-11-24） ----------
test('全ユニットに攻撃タイプと標的の選び方がある（射程とは別）', () => {
  for (const [k, d] of Object.entries({ ...UNITS, ...BOSSES, ...EVOLUTIONS })) {
    assert.ok(ATTACK_TYPES[d.attackType], k);
    assert.ok(['front', 'backline'].includes(d.target), k);
    assert.equal(d.target === 'backline', d.attackType === 'sniper', k);
  }
  assert.equal(UNITS.special.attackType, 'long');
  assert.ok(UNITS.special.range >= UNITS.ranged.range, 'プチデビルは遠距離型（弓ゴブリン以上の射程）');
});

const sniperBattle = () => {
  const b = makeBattle({ stage: noEnemies(), deck: ['mallet'] });
  const m = b.spawn('demon', b.deckDef('mallet'), 1400); m.x = 1400;
  return { b, m };
};
test('後衛狙撃：前衛を無視して、射程内の後衛（回復役を優先）を狙う', () => {
  const { b, m } = sniperBattle();
  const front = b.spawnHuman('shield'); front.x = 1330;
  const archer = b.spawnHuman('archer'); archer.x = 1240;
  const priest = b.spawnHuman('priest'); priest.x = 1220;
  const hp = [front.hp, archer.hp, priest.hp];
  b.resolveAttack(m); run(b, 0.6); // 木槌が届くまで待つ
  assert.equal(front.hp, hp[0], '前衛には当てない');
  assert.equal(archer.hp, hp[1], '回復役を優先');
  assert.ok(priest.hp < hp[2]);
});
test('後衛狙撃：後衛がいなければ前衛に切り替えず空振り（演出は出る）', () => {
  const { b, m } = sniperBattle();
  const front = b.spawnHuman('swordsman'); front.x = 1300; const hp = front.hp;
  b.events.length = 0;
  b.resolveAttack(m); run(b, 0.6); // 木槌が届くまで待つ
  assert.equal(front.hp, hp);
  assert.ok(b.events.some((e) => e.type === 'whiff') && b.events.some((e) => e.type === 'shot' && e.miss));
});
test('後衛狙撃：前衛が射程にいれば止まって構える（前に出すぎない）', () => {
  const { b, m } = sniperBattle();
  const front = b.spawnHuman('swordsman'); front.x = 1230; front.def = { ...front.def, speed: 0 };
  const x0 = m.x; run(b, 1);
  assert.ok(Math.abs(m.x - x0) < 1 && m.state === 'attack');
});
test('後衛狙撃：敵拠点が射程に入れば、後衛がいなくても拠点を攻撃する', () => {
  const b = makeBattle({ stage: noEnemies(), deck: ['mallet'] });
  const m = b.spawn('demon', b.deckDef('mallet'), 0); m.x = b.base.x + b.base.halfWidth + 200;
  const front = b.spawnHuman('swordsman'); front.x = m.x - 60;
  const hp0 = b.base.hp; const fh = front.hp;
  b.resolveAttack(m); run(b, 0.6); // 木槌が届くまで待つ
  assert.ok(b.base.hp < hp0 && front.hp === fh);
});
test('後衛狙撃：高火力・高コスト・低HP・長い構え（ほかの通常モンスターと比べて）', () => {
  const others = Object.entries(UNITS).filter(([k]) => k !== 'mallet').map(([, d]) => d);
  const m = UNITS.mallet;
  assert.ok(m.atk > Math.max(...others.map((d) => d.atk)));
  assert.ok(m.cost >= 400 && m.hp <= 200 && m.windup >= Math.max(...others.map((d) => d.windup)));
});
test('木槌小鬼は最初から使える。所持は8体でも編成枠は5（Lv4で6）', () => {
  const p = newProfile();
  assert.ok(p.units.mallet.unlocked);
  assert.deepEqual(slotsFor(p), { units: 5, bosses: 1 });
  assert.ok(!p.formation.units.includes('mallet'), '最初は控え');
  for (const id of CHAPTER1.stages) applyResult(p, id, 'win', 100);
  assert.deepEqual(slotsFor(p), { units: 6, bosses: 1 });
});
test('進化：3段階・最終形態は2方向に分岐（データの仕組み）', () => {
  const p = newProfile(); p.units.mallet.unlocked = true;
  assert.deepEqual(evolutionChoices(p, 'mallet'), ['mallet_2']);
  assert.equal(evolveUnit(p, 'mallet', 'mallet_2').reason, 'planned', '進化形は準備中');
  p.units.mallet.formKey = 'mallet_2';
  assert.deepEqual(evolutionChoices(p, 'mallet'), ['mallet_3a', 'mallet_3b']);
  assert.equal(resolveUnit('mallet', p).tier, 2);
  assert.equal(evolveUnit(p, 'mallet', 'mallet_2').reason, 'invalid');
});
test('後衛狙撃：後衛と拠点が両方射程にあるときは後衛を先に（拠点は最後）', () => {
  const b = makeBattle({ stage: noEnemies(), deck: ['mallet'] });
  const m = b.spawn('demon', b.deckDef('mallet'), 0); m.x = b.base.x + b.base.halfWidth + 250;
  const priest = b.spawnHuman('priest'); priest.x = m.x - 100;
  const hp0 = b.base.hp; const ph = priest.hp;
  b.resolveAttack(m); run(b, 0.6); // 木槌が届くまで待つ
  assert.ok(priest.hp < ph && b.base.hp === hp0);
});
test('飛び道具（弓ゴブリン・魔法使い）は届いた瞬間にダメージ。遠いほど遅く届く', () => {
  const b = makeBattle({ stage: noEnemies(), deck: ['ranged'] });
  const a = b.spawn('demon', b.deckDef('ranged'), 1200); a.x = 1200;
  const near = b.spawnHuman('swordsman'); near.x = 1150; near.def = { ...near.def, speed: 0 };
  const hp0 = near.hp;
  b.resolveAttack(a);
  assert.equal(near.hp, hp0, '撃った瞬間はまだ当たらない');
  const f = b.inFlight[0]; assert.ok(f.at - b.t >= 0.22 && f.at - b.t < 0.3);
  run(b, 0.4); assert.ok(near.hp < hp0, '届いたら当たる');
  const far = b.spawnHuman('swordsman'); far.x = 1200 - 205; far.def = { ...far.def, speed: 0 };
  near.x = -999; b.resolveAttack(a);
  assert.ok(b.inFlight[0].at - b.t > 0.33, '遠いほど遅い');
});

test('後衛狙撃の空振り：前線の頭上を越えて後ろ（射程いっぱい）に落ち、誰にも当たらない', () => {
  const b = makeBattle({ stage: noEnemies(), deck: ['mallet'] });
  const m = b.spawn('demon', b.deckDef('mallet'), 1400); m.x = 1400;
  const front = b.spawnHuman('swordsman'); front.x = 1300; front.def = { ...front.def, speed: 0 }; const hp = front.hp;
  b.events.length = 0; b.resolveAttack(m);
  const shot = b.events.find((e) => e.type === 'shot');
  assert.ok(shot.miss && shot.over && shot.to < front.x - 20, `前線（1300）の頭上を越えて後ろに落ちる：${shot.to}`);
  run(b, 0.7); assert.equal(front.hp, hp);
  assert.ok(UNITS.mallet.stopRange > UNITS.area.range && UNITS.mallet.stopRange <= UNITS.area.range + 60, '止まる位置は魔法使いのすぐ後ろ');
  assert.ok(UNITS.mallet.range > UNITS.mallet.stopRange + 80, '投げる距離は前線の後ろまで届く');
});
test('後衛狙撃：前衛は stopRange で止まる／前線の後ろの後衛には range まで届く', () => {
  const b = makeBattle({ stage: noEnemies(), deck: ['mallet'] });
  const m = b.spawn('demon', b.deckDef('mallet'), 1400); m.x = 1400;
  const front = b.spawnHuman('swordsman'); front.x = 1300; front.def = { ...front.def, speed: 0 };
  run(b, 0.5); assert.ok(m.state === 'attack' && Math.abs(m.x - 1400) < 2, '前衛が stopRange（200）以内なら止まって構える');
  const b2 = makeBattle({ stage: noEnemies(), deck: ['mallet'] });
  const m2 = b2.spawn('demon', b2.deckDef('mallet'), 1400); m2.x = 1400;
  const f2 = b2.spawnHuman('swordsman'); f2.x = 1180; f2.def = { ...f2.def, speed: 0 }; // 220 先：stopRange の外
  const ar = b2.spawnHuman('archer'); ar.x = 1100; ar.def = { ...ar.def, speed: 0 }; const ah = ar.hp; // 300 先：range の中
  run(b2, 3); assert.ok(Math.abs(m2.x - 1400) < 2, '後衛が届く距離なので、その場で止まって投げる'); assert.ok(ar.hp < ah, '前線の後ろの弓兵に当たる');
});

test('第2章（城下町）：3ステージ。順に開き、2-3 は警備隊長が出る強敵ステージ', () => {
  const p = newProfile();
  for (const id of CHAPTER1.stages) applyResult(p, id, 'win', 100);
  for (const id of ['2-1', '2-2', '2-3']) { assert.ok(isStageOpen(p, id), id); applyResult(p, id, 'win', 100); }
  assert.equal(nextStage(p), '3-1', '第2章をクリアすると第3章へ');
  assert.equal(lordLevel(p), 7);
  assert.ok(STAGES['2-3'].spawns.some((s) => s.hero === 'captain'));
  const b = makeBattle({ stageId: '2-3', seed: 1 });
  b.damageBase(b.base, b.base.hp - b.base.maxHp * 0.59); run(b, 3);
  assert.ok(b.entities.some((e) => e.key === 'captain'), '拠点HP60%で警備隊長');
});

test('第3章（地方王国の城）：3ステージ。台本どおりの順番・話し手', async () => {
  const { STORY } = await import('../js/data/story.js');
  const { CHAPTER3 } = await import('../js/data/stages.js');
  assert.deepEqual(CHAPTER3.stages, ['3-1', '3-2', '3-3']);
  assert.equal(CHAPTER3.name, '地方王国の城を攻略せよ');
  for (const id of CHAPTER3.stages) assert.ok(!STAGES[id].talk, `${id} は自動の差し込み（talk）を使わない`);
  const who = (id, k) => STORY[k][id].map((l) => l.who).join(',');
  assert.equal(who('3-1', 'before'), 'aide,lord,aide,lord,王国兵');
  assert.equal(who('3-2', 'before'), 'aide,王国騎士,lord,aide,lord');
  assert.equal(who('3-3', 'before'), '国王,aide,lord');
  assert.equal(STORY.before['3-2'][4].text, 'わしは本当に偉いのじゃ！！');
  assert.equal(STORY.after['3-3'].length, 15);
  assert.equal(STORY.after['3-3'][9].text, 'まったく……いつになったら、この祠から出られるんじゃ……。');
  assert.equal(STORY.after['3-3'][10].text, '――第3章クリア。');
  const p = newProfile();
  for (const id of [...CHAPTER1.stages, '2-1', '2-2', '2-3', '3-1', '3-2']) applyResult(p, id, 'win', 100);
  assert.ok(isStageOpen(p, '3-3'));
  applyResult(p, '3-3', 'win', 100);
  assert.equal(nextStage(p), '4-1');
  assert.ok(!isStageOpen(p, '4-1'), '壊滅した町のイベントが終わるまで第4章は開かない');
  const b = makeBattle({ stageId: '3-3', seed: 1 });
  b.damageBase(b.base, b.base.hp - b.base.maxHp * 0.59); run(b, 3);
  assert.ok(b.entities.some((e) => e.key === 'king'), '王の間：拠点HP60%で国王');
});
test('ワニ将軍の突進：前方の敵にダメージ、前線を押し下げる（強敵も下がる）', () => {
  const b = makeBattle({ stage: noEnemies({ mana: { start: 5000, max: 9999, regen: 0 } }), deck: ['charger'] });
  const g = b.spawn('demon', b.deckDef('charger'), 1300); g.x = 1300;
  const a = b.spawnHuman('swordsman'); a.x = 1200; a.def = { ...a.def, speed: 0, hp: 99999 }; a.hp = 99999;
  const k = b.spawnHuman('captain'); k.x = 1150; k.def = { ...k.def, speed: 0, hp: 99999 }; k.hp = 99999;
  const s = b.deckDef('charger').skills[0];
  g.state = 'skill'; g.timer = s.windup; g.skill = { ...s, done: true };
  b.useSkill(g, s); run(b, 0.6); // 突進は0.3秒かけて踏み込む
  assert.ok(a.hp < 99999 && k.hp < 99999, 'ダメージ');
  assert.ok(1200 - a.x >= s.push - 1 && 1150 - k.x >= s.push - 1, `押し下げ ${(1200 - a.x).toFixed(0)}・${(1150 - k.x).toFixed(0)}`);
  assert.ok(1300 - g.x > 100, '将軍は前へ出る');
});

// ---------- 特殊イベント「壊滅した町」 ----------
const clearTo33 = () => { const p = newProfile(); for (const id of STAGE_ORDER_ALL) applyResult(p, id, 'win', 100); return p; };
test('壊滅した町：3-3 クリアで発生。イベント前は「特別」に出ない', async () => {
  const pr = await import('../js/data/progress.js');
  const p = newProfile();
  assert.ok(!pr.ruinPending(p));
  for (const id of STAGE_ORDER_ALL) applyResult(p, id, 'win', 100);
  assert.ok(pr.ruinPending(p) && !pr.ruinVisible(p) && !isStageOpen(p, 'ex-1'));
});
test('壊滅した町：勧誘ルートはすぐ加入（重複しない）・再戦は開かない', async () => {
  const pr = await import('../js/data/progress.js');
  const p = clearTo33();
  pr.finishRuinEvent(p, 'recruit');
  assert.ok(p.units.ord.unlocked && p.events.ruin.recruited && p.events.ruin.done);
  assert.ok(pr.ruinVisible(p) && !isStageOpen(p, 'ex-1'), '加入済みなら再戦できない');
  assert.equal(pr.recruitOrd(p), false, '二度目の加入は起きない');
  const st = memStore(); saveProfile(p, st); const q = loadProfile(st);
  assert.ok(q.units.ord.unlocked && q.events.ruin.choice === 'recruit', 'セーブから戻る');
});
test('壊滅した町：敵対ルートは加入せず、再戦に勝つと加入（負けても進行は止まらない）', async () => {
  const pr = await import('../js/data/progress.js');
  const p = clearTo33();
  pr.finishRuinEvent(p, 'reject');
  assert.ok(!p.units.ord.unlocked && isStageOpen(p, 'ex-1'));
  const lose = applyResult(p, 'ex-1', 'lose', 60);
  assert.ok(!lose.unlocked && isStageOpen(p, 'ex-1') && p.events.ruin.rematches === 1);
  const win = applyResult(p, 'ex-1', 'win', 200);
  assert.deepEqual(win.unlockedAll, ['ord']);
  assert.ok(p.units.ord.unlocked && p.events.ruin.recruited && !isStageOpen(p, 'ex-1'));
  const again = applyResult(p, 'ex-1', 'win', 200);
  assert.deepEqual(again.unlockedAll, [], '重複して獲得しない');
});
test('竜人オルド：魔力炉 Lv8 でも今の最大魔力では届かない・幹部の出撃制限に従う', async () => {
  const pr = await import('../js/data/progress.js');
  const p = clearTo33(); pr.finishRuinEvent(p, 'recruit');
  const m = pr.resolveMana(STAGES['3-3'].mana, p);
  const maxWithFurnace = m.max + 7 * CONFIG.furnace.maxAdd;
  assert.ok(maxWithFurnace < BOSSES.ord.cost, `${maxWithFurnace} < ${BOSSES.ord.cost}`);
  assert.ok(BOSSES.ord.unique && BOSSES.ord.needFurnace === 8);
  const b = makeBattle({ stage: noEnemies({ mana: { start: 9999, max: 99999, regen: 0 } }), deck: ['charger', 'ord'] });
  b.furnaceLv = 8; b.queue({ type: 'summon', key: 'charger' }); b.step();
  assert.equal(b.canSummon('ord').reason, 'bossOut');
});

test('第4章（港町）：壊滅した町のあと開く（加入・未加入どちらでも）。台本どおりの順番', async () => {
  const pr = await import('../js/data/progress.js');
  const { STORY } = await import('../js/data/story.js');
  const { CHAPTER4 } = await import('../js/data/stages.js');
  assert.deepEqual(CHAPTER4.stages, ['4-1', '4-2', '4-3']);
  assert.equal(CHAPTER4.name, '港町を制圧せよ');
  for (const choice of ['recruit', 'reject']) {
    const p = clearTo33(); pr.finishRuinEvent(p, choice);
    assert.ok(isStageOpen(p, '4-1'), choice);
    for (const id of CHAPTER4.stages) { assert.ok(isStageOpen(p, id)); applyResult(p, id, 'win', 100); }
    assert.equal(nextStage(p), null, '第5章は未実装');
    assert.equal(p.units.ord.unlocked, choice === 'recruit', 'オルドの状態はそのまま');
    if (choice === 'reject') assert.ok(isStageOpen(p, 'ex-1'), '再戦できる状態もそのまま');
  }
  for (const id of CHAPTER4.stages) assert.ok(!STAGES[id].talk, id);
  assert.equal(STORY.before['4-2'].map((l) => l.who).join(','), 'aide,港の警備兵,lord');
  assert.equal(STORY.before['4-3'].map((l) => l.who).join(','), 'aide,港の守備隊長,lord');
  const a = STORY.after['4-3'];
  assert.equal(a.length, 10); assert.equal(a[7].text, 'そればっかりじゃないかぁぁ！！'); assert.equal(a[9].text, '――魔王軍は海を渡り、鉄鋼の要塞都市へと向かった。');
  assert.equal(STORY.after['4-2'].length, 6);
  const b = makeBattle({ stageId: '4-3', seed: 1 });
  b.damageBase(b.base, b.base.hp - b.base.maxHp * 0.59); run(b, 3);
  assert.ok(b.entities.some((e) => e.key === 'harbor_captain'), '4-3：港の守備隊長');
});
