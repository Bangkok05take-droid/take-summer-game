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

test('勇者たけ：2連撃・飛ぶ斬撃', () => {
  const b = makeBattle({ stage: noEnemies() });
  const t = b.spawnHuman('take'); t.x = 1000;
  const ms = [0, 100, 200].map((dx) => { const m = b.spawn('demon', b.deckDef('tank'), 1100); m.x = 1050 + dx; return m; });
  let strikes = 0; let wave = 0;
  run(b, 10, (bb) => { for (const ev of bb.events) { if (ev.type === 'strike' && ev.id === t.id) strikes++; if (ev.type === 'skill' && ev.skill === 'wave') wave++; } bb.events.length = 0; });
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
  assert.equal(who('3-3', 'before'), 'aide,lord,王国軍,lord'); // 2026-11-25 共通背景対応の修正
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
  assert.ok(b.entities.some((e) => e.key === 'knight_commander'), '3-3：拠点HP60%で王国騎士団長（2026-11-25 国王から変更）');
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
const UPTO33 = STAGE_ORDER_ALL.slice(0, STAGE_ORDER_ALL.indexOf('3-3') + 1);
const clearTo33 = () => { const p = newProfile(); for (const id of UPTO33) applyResult(p, id, 'win', 100); return p; };
test('壊滅した町：3-3 クリアで発生。イベント前は「特別」に出ない', async () => {
  const pr = await import('../js/data/progress.js');
  const p = newProfile();
  assert.ok(!pr.ruinPending(p));
  for (const id of UPTO33) applyResult(p, id, 'win', 100);
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
    assert.equal(nextStage(p), '5-1', '第4章をクリアすると第5章へ');
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

test('第5章（鉄鋼の要塞都市）：4ステージ。4-3 のあと開き、台本どおりの順番。オルドの有無を問わず', async () => {
  const pr = await import('../js/data/progress.js');
  const { STORY } = await import('../js/data/story.js');
  const { CHAPTER5 } = await import('../js/data/stages.js');
  assert.deepEqual(CHAPTER5.stages, ['5-1', '5-2', '5-3', '5-4']);
  assert.equal(CHAPTER5.name, '鉄鋼の要塞都市を攻略せよ');
  for (const choice of ['recruit', 'reject']) {
    const p = clearTo33(); pr.finishRuinEvent(p, choice);
    for (const id of ['4-1', '4-2', '4-3']) applyResult(p, id, 'win', 100);
    for (const id of CHAPTER5.stages) { assert.ok(isStageOpen(p, id), id); applyResult(p, id, 'win', 100); }
    assert.equal(nextStage(p), '6-1', '第5章をクリアすると第6章へ');
  }
  for (const id of CHAPTER5.stages) assert.ok(!STAGES[id].talk, id);
  assert.equal(STORY.before['5-1'].map((l) => l.who).join(','), 'aide,lord,aide,lord,人間軍兵士');
  assert.equal(STORY.before['5-2'].map((l) => l.who).join(','), 'aide,lord,人間軍技師,lord');
  assert.equal(STORY.before['5-3'].map((l) => l.who).join(','), 'aide,重装兵団長,lord,aide,lord');
  assert.equal(STORY.before['5-4'].map((l) => l.who).join(','), 'aide,要塞司令官,要塞司令官,lord,lord');
  assert.equal(STORY.after['5-1'][0].who, 'lord', '5-1 の戦闘後は大魔王から');
  const a = STORY.after['5-4'];
  assert.equal(a.length, 18); assert.equal(a[13].text, 'それを早く言わんかぁぁ！！'); assert.equal(a[16].text, '――第5章クリア。'); assert.equal(a[17].text, '――魔王軍は新たな力を求め、砂漠の古代王国へと向かった。');
  assert.ok(STAGES['5-1'].spawns.some((r) => r.who === 'turret') && STAGES['5-3'].spawns.some((r) => r.who === 'heavy'), '兵器・重装兵');
  assert.ok(STAGES['5-4'].boss && STAGES['5-4'].spawns.some((r) => r.hero === 'commander'));
  assert.ok(STAGES['5-1'].enemyScale >= STAGES['4-1'].enemyScale, 'これまでより手ごわい');
});
test('竜人オルド「カミナリスラッシュ」：溜め中はダメージなし。前方の敵すべてと砦に各1回（敵がいなくても砦に届く）', () => {
  const mk = () => { const b = makeBattle({ stage: noEnemies({ mana: { start: 0, max: 0, regen: 0 } }), deck: ['ord'] }); const o = b.spawn('demon', b.deckDef('ord'), 1400); o.x = 1400; o.def = { ...o.def, speed: 0 }; return { b, o, s: b.deckDef('ord').skills[0] }; };
  const { b, o, s } = mk();
  const foes = [1300, 1000, 700, 400].map((x) => { const h = b.spawnHuman('heavy'); h.x = x; h.def = { ...h.def, speed: 0, hp: 99999 }; h.hp = 99999; return h; });
  const base0 = b.base.hp;
  o.state = 'skill'; o.timer = 0; o.skill = { ...s, done: false };
  run(b, s.windup - 0.05);
  assert.ok(foes.every((h) => h.hp === 99999) && b.base.hp === base0, '溜め中はダメージなし');
  run(b, 2.5);
  const dmg = foes.map((h) => 99999 - h.hp);
  assert.ok(dmg.every((d) => d > 0) && new Set(dmg).size === 1, `全員に1回ずつ同じダメージ ${dmg}`);
  assert.ok(b.base.hp < base0 && base0 - b.base.hp === Math.round(o.def.atk * s.mult), '砦にも1回');
  assert.equal(b.pierces.length, 0);
  const m = mk(); const b0 = m.b.base.hp; m.b.useSkill(m.o, m.s); run(m.b, 2.5);
  assert.ok(m.b.base.hp < b0, '敵がいなくても砦に届く');
});
test('貫通斬撃は速くても敵を飛び越さない（区間で判定）', () => {
  const b = makeBattle({ stage: noEnemies(), deck: ['ord'] });
  const o = b.spawn('demon', b.deckDef('ord'), 1400); o.x = 1400;
  const h = b.spawnHuman('swordsman'); h.x = 1100; h.def = { ...h.def, speed: 0, hp: 99999 }; h.hp = 99999;
  b.pierces.push({ id: 999, src: o, side: 'demon', dir: -1, x: 1380, prevX: 1400, speed: 30000, dmg: 50, hit: new Set(), done: false, lane: 0.5 });
  b.step();
  assert.equal(99999 - h.hp >= 50, true, '1手で何百も進んでも当たる');
});
test('第6章（砂漠の古代王国）：3ステージ・台本どおり。6-3 の初回だけ魔力回復と上位進化の解放（重複しない・セーブ）', async () => {
  const pr = await import('../js/data/progress.js');
  const { STORY, CRYSTAL_EVENT } = await import('../js/data/story.js');
  const { CHAPTER6 } = await import('../js/data/stages.js');
  assert.deepEqual(CHAPTER6.stages, ['6-1', '6-2', '6-3']);
  assert.equal(CHAPTER6.name, '砂漠の古代王国');
  assert.equal(STORY.before['6-3'].map((l) => l.who).join(','), 'narr,narr,古代王,aide,lord,古代王,lord'); // 2026-11-25 修正
  assert.equal(STORY.after['6-3'].length, 5);
  assert.equal(CRYSTAL_EVENT.LINES.length, 15); assert.equal(CRYSTAL_EVENT.LINES[10].text, 'なんでじゃぁぁぁ！！');
  assert.equal(CRYSTAL_EVENT.AFTER[3].text, '――第6章クリア。');
  assert.ok(CRYSTAL_EVENT.LINES.some((l) => l.fx === 'absorb') && CRYSTAL_EVENT.LINES.some((l) => l.fx === 'quake'));
  const p = clearTo33(); pr.finishRuinEvent(p, 'reject');
  for (const id of ['4-1', '4-2', '4-3', '5-1', '5-2', '5-3', '5-4', '6-1', '6-2']) applyResult(p, id, 'win', 100);
  assert.ok(isStageOpen(p, '6-3'));
  const m0 = pr.resolveMana(STAGES['6-3'].mana, p);
  applyResult(p, '6-3', 'win', 100);
  assert.ok(pr.crystalPending(p) && pr.evolveTierCap(p) === 1, 'クリア直後（イベント前）');
  assert.equal(pr.applyCrystal(p), true);
  assert.equal(pr.applyCrystal(p), false, '再クリアでは回復しない');
  const m1 = pr.resolveMana(STAGES['6-3'].mana, p);
  assert.equal(m1.max - m0.max, pr.CRYSTAL_BONUS.max + 60, '結晶の分（＋大魔王Lvの分）だけ増える');
  applyResult(p, '6-3', 'win', 100);
  assert.equal(pr.resolveMana(STAGES['6-3'].mana, p).max, m1.max, '2回目のクリアで結晶の回復は重ならない');
  assert.ok(!pr.crystalPending(p));
  assert.equal(nextStage(p), '7-1', '第6章をクリアすると第7章へ');
  const st = memStore(); saveProfile(p, st); const q = loadProfile(st);
  assert.ok(pr.crystalDone(q) && pr.evolveTierCap(q) === 2, 'セーブから戻る');
});
test('上位進化：魔力結晶の前はできない・Lv5と魔界石が必要・最上位はまだ・デザイン待ちの進化先は不可', async () => {
  const pr = await import('../js/data/progress.js');
  const p = newProfile(); p.stones = 9999;
  assert.equal(pr.tryEvolve(p, 'mallet', 'mallet_2').reason, 'feature');
  pr.applyCrystal(p);
  assert.equal(pr.tryEvolve(p, 'mallet', 'mallet_2').reason, 'level');
  p.units.mallet.level = 5;
  assert.equal(pr.tryEvolve(p, 'mallet', 'mallet_2').reason, 'planned', '進化先のデザイン待ち（ready: false）');
  EVOLUTIONS.mallet_2.ready = true;
  try {
    const r = pr.tryEvolve(p, 'mallet', 'mallet_2');
    assert.ok(r.ok && p.stones === 9999 - r.cost && resolveUnit('mallet', p).tier === 2);
    EVOLUTIONS.mallet_3a.ready = true;
    assert.equal(pr.tryEvolve(p, 'mallet', 'mallet_3a').reason, 'tier', '最上位はまだ解放しない');
  } finally { EVOLUTIONS.mallet_2.ready = false; EVOLUTIONS.mallet_3a.ready = false; }
});

test('第7章（聖なる都）：2ステージ・台本どおり。6-3 のあと開き、7-2 は聖騎士団長・クリアで第8章へ', async () => {
  const pr = await import('../js/data/progress.js');
  const { STORY } = await import('../js/data/story.js');
  const { CHAPTER7 } = await import('../js/data/stages.js');
  assert.deepEqual(CHAPTER7.stages, ['7-1', '7-2']); assert.equal(CHAPTER7.name, '聖なる都を攻略せよ');
  assert.equal(STORY.before['7-1'].map((l) => l.who).join(','), 'aide,lord,aide,lord,聖騎士,lord');
  assert.equal(STORY.before['7-2'].map((l) => l.who).join(','), '聖騎士団長,聖騎士団長,lord,aide,lord,聖騎士団長,lord');
  const a = STORY.after['7-2']; assert.equal(a.length, 12); assert.equal(a[10].text, '――第7章クリア。'); assert.equal(a[11].text, '――魔王軍は魔法都市へと向かった。');
  for (const choice of ['recruit', 'reject']) {
    const p = clearTo33(); pr.finishRuinEvent(p, choice);
    for (const id of ['4-1', '4-2', '4-3', '5-1', '5-2', '5-3', '5-4', '6-1', '6-2', '6-3']) applyResult(p, id, 'win', 100);
    pr.applyCrystal(p);
    for (const id of CHAPTER7.stages) { assert.ok(isStageOpen(p, id), id); applyResult(p, id, 'win', 100); }
    assert.equal(nextStage(p), '8-1', '第7章をクリアすると第8章へ');
    assert.equal(pr.evolveTierCap(p), 2, '最上位はまだ');
  }
  const b = makeBattle({ stageId: '7-2', seed: 1 });
  b.damageBase(b.base, b.base.hp - b.base.maxHp * 0.59); run(b, 3);
  assert.ok(b.entities.some((e) => e.key === 'holy_captain'));
});

test('第8章（魔法都市）：4ステージ・台本どおり・背景は共通1枚。8-4 は大魔導士。初回だけ究極進化（魔力炉の強化・最上位進化・重複なし・セーブ）', async () => {
  const pr = await import('../js/data/progress.js');
  const { STORY, ULTIMATE_EVENT } = await import('../js/data/story.js');
  const { CHAPTER8, CONFIG } = await import('../js/data/stages.js');
  const { SKIN } = await import('../js/data/skin.js');
  assert.deepEqual(CHAPTER8.stages, ['8-1', '8-2', '8-3', '8-4']); assert.equal(CHAPTER8.name, '魔法都市');
  for (const id of CHAPTER8.stages) { assert.ok(!SKIN.images.stageBg[id], id + '：ステージ別の背景はない（章で共通）'); assert.equal(STAGES[id].theme, 'magic'); }
  assert.ok(SKIN.images.stageBg.chapter8);
  assert.equal(STORY.before['8-1'].map((l) => l.who).join(','), 'aide,lord,人間軍魔法使い,lord');
  assert.equal(STORY.before['8-3'].map((l) => l.who).join(','), 'aide,魔導士団長,lord,lord');
  assert.equal(STORY.before['8-4'].map((l) => l.who).join(','), '大魔導士,大魔導士,lord,大魔導士,lord');
  assert.ok(!Object.values(STORY.before).flat().some((l) => l.text === '――ボス戦開始。'));
  assert.deepEqual(['8-1', '8-2', '8-3', '8-4'].map((id) => STORY.after[id].length), [2, 4, 4, 4]);
  assert.equal(ULTIMATE_EVENT.LINES.length, 10); assert.equal(ULTIMATE_EVENT.LINES[0].text, '――ヴェイルは魔導装置の技術を封印の祠の魔力炉に応用した。');
  assert.equal(ULTIMATE_EVENT.FEATURE.title, '最上位モンスター進化');
  assert.deepEqual(ULTIMATE_EVENT.FEATURE.items, ['魔力炉のさらなる強化', '最上位モンスター進化解放']);
  assert.equal(ULTIMATE_EVENT.AFTER.length, 11); assert.equal(ULTIMATE_EVENT.AFTER[9].text, '――第8章クリア。'); assert.equal(ULTIMATE_EVENT.AFTER[10].text, '――魔王軍と人間軍の全面戦争が始まろうとしていた。');
  const banned = /たけ|サイ|ヤナイ」|yanai|take|sai/;
  for (const id of CHAPTER8.stages) for (const l of [...STORY.before[id], ...STORY.after[id]]) assert.ok(!banned.test(l.who), 'たけ・サイ・ヤナイ本人は出ない');
  for (const id of CHAPTER8.stages) assert.ok(!STAGES[id].spawns.some((x) => ['take', 'sai'].includes(x.who) || ['take', 'sai'].includes(x.hero)));
  for (const choice of ['recruit', 'reject']) {
    const p = clearTo33(); pr.finishRuinEvent(p, choice);
    for (const id of ['4-1', '4-2', '4-3', '5-1', '5-2', '5-3', '5-4', '6-1', '6-2', '6-3']) applyResult(p, id, 'win', 100);
    pr.applyCrystal(p);
    for (const id of ['7-1', '7-2']) applyResult(p, id, 'win', 100);
    for (const id of CHAPTER8.stages) { assert.ok(isStageOpen(p, id), id); assert.ok(!pr.ultimatePending(p)); applyResult(p, id, 'win', 100); }
    assert.ok(pr.ultimatePending(p) && pr.evolveTierCap(p) === 2, 'クリア直後（イベント前）');
    assert.equal(pr.resolveFurnace(CONFIG.furnace, p), CONFIG.furnace, 'イベント前は魔力炉そのまま');
    assert.equal(pr.applyUltimate(p), true);
    assert.equal(pr.applyUltimate(p), false, '2回目は起きない');
    assert.equal(pr.evolveTierCap(p), 3, '最上位進化の解放');
    const f = pr.resolveFurnace(CONFIG.furnace, p);
    assert.equal(f.costs.length, CONFIG.furnace.costs.length + 1); assert.ok(f.maxAdd > CONFIG.furnace.maxAdd && f.regenAdd > CONFIG.furnace.regenAdd);
    const stones = p.stones; applyResult(p, '8-4', 'win', 100);
    assert.ok(!pr.ultimatePending(p)); assert.deepEqual(pr.resolveFurnace(CONFIG.furnace, p), f, '再クリアで強化が重ならない');
    assert.ok(p.stones - stones < STAGES['8-4'].reward.stones, '再クリアは初回報酬なし');
    assert.equal(nextStage(p), '9-1', '第8章をクリアすると第9章へ');
    const st = memStore(); saveProfile(p, st); const q = loadProfile(st);
    assert.ok(pr.ultimateDone(q) && pr.crystalDone(q) && pr.evolveTierCap(q) === 3, 'セーブから戻る');
    assert.deepEqual(pr.resolveFurnace(CONFIG.furnace, q), f);
  }
  // 古いセーブ（events.ultimate なし）でも読める
  const old = newProfile(); delete old.events; const st2 = memStore(); saveProfile(old, st2);
  assert.equal(pr.evolveTierCap(loadProfile(st2)), 1);
  // 戦闘：8-4 は拠点HP60%で大魔導士。強化した魔力炉は1段多く上がる
  const b = makeBattle({ stageId: '8-4', seed: 1 });
  b.damageBase(b.base, b.base.hp - b.base.maxHp * 0.59); run(b, 3);
  assert.ok(b.entities.some((e) => e.key === 'archmage'));
  const p2 = newProfile(); pr.applyUltimate(p2);
  const b2 = makeBattle({ stageId: '8-1', profile: p2, seed: 1 });
  b2.mana = 99999; b2.manaMax = 99999;
  for (let i = 0; i < 12; i++) { b2.queue({ type: 'furnace' }); b2.step(); b2.mana = 99999; }
  assert.equal(b2.furnaceLv, CONFIG.furnace.costs.length + 2, '魔力炉の最大Lvが1つ上がる');
});
test('最上位進化：究極進化のあとだけ（上位からのみ・デザイン待ちは不可）', async () => {
  const pr = await import('../js/data/progress.js');
  const p = newProfile(); p.stones = 99999; pr.applyCrystal(p); p.units.mallet.level = 5;
  EVOLUTIONS.mallet_2.ready = true; EVOLUTIONS.mallet_3a.ready = true;
  try {
    assert.ok(pr.tryEvolve(p, 'mallet', 'mallet_2').ok);
    assert.equal(pr.tryEvolve(p, 'mallet', 'mallet_3a').reason, 'tier');
    pr.applyUltimate(p);
    const r = pr.tryEvolve(p, 'mallet', 'mallet_3a');
    assert.ok(r.ok && resolveUnit('mallet', p).tier === 3 && r.cost === pr.EVOLVE_NEED.stones(3));
    assert.equal(pr.tryEvolve(p, 'mallet', 'mallet_3b').reason, 'invalid', '分岐はどちらか1つ');
  } finally { EVOLUTIONS.mallet_2.ready = false; EVOLUTIONS.mallet_3a.ready = false; }
  const q = newProfile(); q.stones = 99999; pr.applyCrystal(q); pr.applyUltimate(q); q.units.mallet.level = 9;
  assert.equal(pr.tryEvolve(q, 'mallet', 'mallet_2').reason, 'planned', '進化先のデザイン待ち');
});

test('第9章（人間界の王都）：4ステージ・台本どおり・背景は共通1枚。9-4 は人間軍総司令官。初回だけ最終章への進軍（セーブ）・第10章へ', async () => {
  const pr = await import('../js/data/progress.js');
  const { STORY, FINAL_MARCH } = await import('../js/data/story.js');
  const { CHAPTER9 } = await import('../js/data/stages.js');
  const { SKIN } = await import('../js/data/skin.js');
  assert.deepEqual(CHAPTER9.stages, ['9-1', '9-2', '9-3', '9-4']); assert.equal(CHAPTER9.name, '人間界の王都');
  for (const id of CHAPTER9.stages) { assert.ok(!SKIN.images.stageBg[id]); assert.equal(STAGES[id].theme, 'capital'); }
  assert.ok(SKIN.images.stageBg.chapter9);
  assert.equal(STORY.before['9-1'].map((l) => l.who).join(','), 'aide,lord,aide,人間軍指揮官,lord');
  assert.equal(STORY.before['9-3'].map((l) => l.who).join(','), 'aide,王国軍指揮官,lord,aide,lord');
  assert.equal(STORY.before['9-4'].map((l) => l.who).join(','), '人間軍総司令官,人間軍総司令官,lord,lord,lord');
  assert.ok(!Object.values(STORY.before).flat().some((l) => /最終決戦開始/.test(l.text)));
  assert.deepEqual(CHAPTER9.stages.map((id) => STORY.after[id].length), [4, 4, 4, 10]);
  assert.equal(STORY.after['9-4'][9].text, '空の上まで逃げおったのかぁぁ！！');
  assert.equal(FINAL_MARCH.LINES.length, 9); assert.equal(FINAL_MARCH.LINES[8].text, '――第9章クリア。');
  assert.deepEqual(FINAL_MARCH.TITLE, { eyebrow: 'FINAL CHAPTER', chapter: '第10章', name: '天空・勇者の聖域', text: '魔王軍、最後の戦いへ。' });
  // 人間軍の兵種を総動員（これまでの一般兵がほぼ全部出る）
  const used = new Set(CHAPTER9.stages.flatMap((id) => STAGES[id].spawns.flatMap((x) => x.who ? [x.who] : x.wave.map((w) => w.who))));
  for (const k of ['swordsman', 'shield', 'archer', 'priest', 'rider', 'knight', 'heavy', 'guardian', 'paladin', 'mage', 'elite_mage']) assert.ok(used.has(k), k);
  for (const k of ['take', 'sai']) assert.ok(!used.has(k), 'たけ・サイは出ない');
  for (const id of CHAPTER9.stages) for (const l of [...STORY.before[id], ...STORY.after[id]]) assert.ok(!/yanai|take|sai|聖竜/.test(l.who));
  for (const choice of ['recruit', 'reject']) {
    const p = clearTo33(); pr.finishRuinEvent(p, choice);
    for (const id of ['4-1', '4-2', '4-3', '5-1', '5-2', '5-3', '5-4', '6-1', '6-2', '6-3', '7-1', '7-2', '8-1', '8-2', '8-3', '8-4']) applyResult(p, id, 'win', 100);
    pr.applyCrystal(p); pr.applyUltimate(p);
    for (const id of CHAPTER9.stages) { assert.ok(isStageOpen(p, id), id); assert.ok(!pr.finalPending(p)); applyResult(p, id, 'win', 100); }
    assert.ok(pr.finalPending(p));
    assert.equal(pr.markFinal(p), true); assert.equal(pr.markFinal(p), false, '2回目は起きない');
    applyResult(p, '9-4', 'win', 100); assert.ok(!pr.finalPending(p));
    assert.equal(nextStage(p), '10-1', '第9章をクリアすると第10章へ');
    const st = memStore(); saveProfile(p, st); const q = loadProfile(st);
    assert.ok(pr.finalDone(q) && pr.ultimateDone(q) && pr.evolveTierCap(q) === 3, 'セーブから戻る');
  }
  const b = makeBattle({ stageId: '9-4', seed: 1 });
  b.damageBase(b.base, b.base.hp - b.base.maxHp * 0.59); run(b, 3);
  assert.ok(b.entities.some((e) => e.key === 'supreme_commander'));
  const c = makeBattle({ stageId: '9-3', seed: 1 });
  c.damageBase(c.base, c.base.hp - c.base.maxHp * 0.49); run(c, 3);
  assert.ok(c.entities.some((e) => e.key === 'royal_commander'));
});

test('第10章（天空・勇者の聖域）：5ステージ・台本どおり・背景は共通1枚。10-3 聖竜・10-5 たけ/サイ/ヤナイ。初回だけエンディング（世界征服達成・セーブ・重複なし）', async () => {
  const pr = await import('../js/data/progress.js');
  const { STORY, ENDING } = await import('../js/data/story.js');
  const { CHAPTER10, CHAPTERS } = await import('../js/data/stages.js');
  const { SKIN } = await import('../js/data/skin.js');
  assert.deepEqual(CHAPTER10.stages, ['10-1', '10-2', '10-3', '10-4', '10-5']); assert.equal(CHAPTER10.name, '天空・勇者の聖域');
  assert.equal(CHAPTERS.length, 10);
  for (const id of CHAPTER10.stages) { assert.ok(!SKIN.images.stageBg[id]); assert.equal(STAGES[id].theme, 'sky'); }
  assert.ok(SKIN.images.stageBg.chapter10);
  assert.deepEqual(CHAPTER10.stages.map((id) => STORY.before[id].length), [6, 4, 8, 5, 16]);
  assert.deepEqual(CHAPTER10.stages.slice(0, 4).map((id) => STORY.after[id].length), [2, 4, 5, 8]);
  assert.ok(!STORY.after['10-5'], '10-5 の勝利後はエンディング（ENDING）');
  assert.ok(!Object.values(STORY.before).flat().some((l) => /ボス戦開始|最終決戦開始/.test(l.text)));
  assert.equal(STORY.before['10-5'].map((l) => l.who).join(','), 'narr,マスター・ヤナイ,lord,lord,マスター・ヤナイ,lord,たけ,サイ,lord,マスター・ヤナイ,たけ,サイ,lord,lord,aide,lord');
  assert.equal(ENDING.LINES.length, 14); assert.equal(ENDING.LINES[13].text, '――魔王軍の歓声が世界中に響き渡った。');
  assert.deepEqual(ENDING.TITLE, { eyebrow: 'WORLD CONQUEST COMPLETE', chapter: '世界征服達成', name: '魔王軍の世界侵略', text: '全10章クリア', end: 'THE END' });
  assert.equal(ENDING.EPILOGUE.length, 13); assert.equal(ENDING.EPILOGUE[12].text, '――そして、大魔王の退屈な日々が再び始まるのであった。');
  assert.equal(ENDING.END.end, 'THE END');
  assert.deepEqual(ENDING.STEPS, ['lines', 'title', 'epilogue', 'end']);
  assert.equal(SKIN.movies.ending, null, 'ムービーは保留（差し込み口だけ）');
  // たけ・サイ・ヤナイは 10-5 より前に出ない（台詞・敵の両方）
  const heroKeys = ['take', 'sai', 'yanai'];
  for (const id of STAGE_ORDER_ALL.filter((x) => x !== '10-5')) {
    assert.ok(!STAGES[id].spawns.some((x) => heroKeys.includes(x.who) || heroKeys.includes(x.hero) || (x.wave || []).some((w) => heroKeys.includes(w.who))), id);
    for (const l of [...(STORY.before[id] || []), ...(STORY.after[id] || [])]) assert.ok(!['たけ', 'サイ', 'マスター・ヤナイ', 'take', 'sai', 'yanai'].includes(l.who), id + ' ' + l.who);
  }
  const used = (id) => STAGES[id].spawns.flatMap((x) => x.who ? [x.who] : x.wave.map((w) => w.who));
  assert.ok(used('10-3').includes('holy_dragon'));
  for (const k of heroKeys) assert.ok(used('10-5').includes(k), k);
  for (const choice of ['recruit', 'reject']) {
    const p = clearTo33(); pr.finishRuinEvent(p, choice);
    for (const id of STAGE_ORDER_ALL.slice(STAGE_ORDER_ALL.indexOf('4-1'), STAGE_ORDER_ALL.indexOf('10-1'))) applyResult(p, id, 'win', 100);
    pr.applyCrystal(p); pr.applyUltimate(p); pr.markFinal(p);
    for (const id of CHAPTER10.stages) { assert.ok(isStageOpen(p, id), id); assert.ok(!pr.conquestPending(p)); applyResult(p, id, 'win', 100); }
    assert.ok(pr.conquestPending(p) && !pr.conquestDone(p));
    assert.equal(pr.markConquest(p), true); assert.equal(pr.markConquest(p), false, '2回目は起きない');
    const stones = p.stones; const r = applyResult(p, '10-5', 'win', 100);
    assert.ok(!r.firstClear && p.stones - stones < STAGES['10-5'].reward.stones, '再クリアで初回報酬は重ならない');
    assert.ok(!pr.conquestPending(p));
    assert.equal(nextStage(p), null, '全10章クリア');
    const st = memStore(); saveProfile(p, st); const q = loadProfile(st);
    assert.ok(pr.conquestDone(q) && q.stages['10-5'].cleared, 'セーブから戻る');
  }
  // 戦闘：10-3 は拠点HP60%で聖竜、10-5 は最初からたけ・サイ、拠点HP60%でヤナイ
  const b = makeBattle({ stageId: '10-3', seed: 1 }); b.damageBase(b.base, b.base.hp - b.base.maxHp * 0.59); run(b, 3);
  assert.ok(b.entities.some((e) => e.key === 'holy_dragon'));
  const c = makeBattle({ stageId: '10-5', seed: 1 }); run(c, 4);
  assert.ok(c.entities.some((e) => e.key === 'take') && c.entities.some((e) => e.key === 'sai') && !c.entities.some((e) => e.key === 'yanai'));
  c.damageBase(c.base, c.base.hp - c.base.maxHp * 0.59); run(c, 3);
  assert.ok(c.entities.some((e) => e.key === 'yanai'));
});

test('共通背景対応の修正（第1〜7章）：ステージ名・台詞の差し替え・全34ステージ・各章の背景は1枚', async () => {
  const { STORY } = await import('../js/data/story.js');
  const { CHAPTERS, STAGE_ORDER } = await import('../js/data/stages.js');
  const { SKIN } = await import('../js/data/skin.js');
  assert.deepEqual(CHAPTERS.map((c) => c.stages.length), [3, 3, 3, 3, 4, 3, 2, 4, 4, 5]);
  assert.equal(STAGE_ORDER.length, 34, '通常34ステージ（壊滅した町は別枠）');
  assert.ok(!STAGE_ORDER.includes('ex-1'));
  const names = { '1-1': '見張り小屋', '1-2': '村の自警団', '1-3': '村の最終防衛戦', '2-1': '城下町の門', '2-2': '城下町の守備隊', '2-3': '城下町の最終防衛戦', '3-1': '王国の城門', '3-2': '王国騎士団', '3-3': '王国の最終決戦', '4-1': '港町の防衛線', '4-2': '港町の守備隊', '4-3': '港町の最終決戦', '5-1': '鉄鋼都市の外壁', '5-2': '新型兵器の反撃', '5-3': '重装兵団', '5-4': '鉄鋼都市の最終決戦', '6-1': '砂漠の古代遺跡', '6-2': '古代王国の守護者', '6-3': '古代王の復活', '7-1': '聖都の防衛線', '7-2': '聖騎士団との決戦' };
  for (const [id, n] of Object.entries(names)) assert.equal(STAGES[id].name, n, id);
  // 各章の背景は1枚（ステージ別の背景は使わない。壊滅した町だけ別枠）
  for (const id of STAGE_ORDER) assert.ok(!SKIN.images.stageBg[id], id);
  for (let c = 1; c <= 10; c++) assert.ok(SKIN.images.stageBg['chapter' + c], 'chapter' + c);
  assert.ok(SKIN.images.stageBg['ex-1']);
  const T = (id, k) => STORY[k][id].map((l) => l.text);
  assert.deepEqual(T('1-2', 'before'), ['大魔王様、村の自警団が集まってきました。', 'ほう！ 少しは戦う気があるようじゃな！', 'みんなで力を合わせるんだ！ 村を守れ！', 'ふっふっふ！ 蹴散らすのじゃ！']);
  assert.deepEqual(T('1-2', 'after'), ['自警団を撃破しました。', 'うむ！ 順調じゃな！']);
  assert.equal(STORY.before['1-3'][2].who, '自警団長');
  assert.equal(STORY.after['1-3'].length, 5, '1-3 のあとのヤナイの情報・幹部解放・第2章への接続はそのまま');
  for (const id of ['1-2', '1-3', '2-2', '2-3']) assert.ok(!STAGES[id].talk, id + '：台本に入った村・町の声を二重に出さない');
  assert.ok(STAGES['1-1'].talk && STAGES['2-1'].talk, '変更なしのステージはそのまま');
  assert.deepEqual(STORY.before['2-2'].map((l) => l.who), ['aide', 'lord', '守備兵', 'lord']);
  assert.equal(STORY.after['2-2'][2].text, '次は警備隊長が自ら出撃してくるようです。');
  assert.deepEqual(STORY.before['2-3'].map((l) => l.who), ['警備隊長', 'lord', 'lord']);
  assert.equal(STORY.after['3-3'][4].text, '港町から船に乗り、海を渡ったとの情報を得ました。');
  assert.deepEqual(T('4-1', 'after'), ['港町の第一防衛部隊を撃破しました。', 'よし！ ヤナイの行方も調べておくのじゃ！']);
  assert.equal(STORY.before['4-2'][0].text, '大魔王様、港の守備隊が出撃してきました。'); assert.equal(STORY.before['4-2'].length, 3);
  assert.equal(STORY.before['4-3'][0].text, '大魔王様、港町の最後の守備部隊が出撃してきました。');
  assert.equal(STORY.before['5-2'][0].text, '大魔王様、人間軍が新型兵器を投入してきました。');
  assert.equal(STORY.before['5-2'][1].text, 'ほう！ 今度はどんなおもちゃを持ち出してきたのじゃ？');
  assert.equal(STORY.after['5-2'][0].text, '新型兵器を破壊しました。しかし、魔王軍にもかなりの被害が出ております。');
  assert.equal(STORY.before['5-4'][0].text, '大魔王様、鉄鋼都市が残された全戦力を投入してきました。');
  assert.deepEqual(T('6-1', 'after'), ['古代王国の第一防衛部隊を撃破しました。', '急げ急げ！ 久しぶりに楽しみになってきたわい！']);
  assert.equal(STORY.after['6-2'][2].text, '大魔王様、ピラミッドからさらに強大な魔力を感じます。');
  assert.deepEqual(T('6-3', 'before').slice(0, 2), ['――巨大なピラミッドが怪しく輝き始めた。', '――強大な魔力とともに、古代王が姿を現した。']);
  assert.equal(STORY.after['7-1'][2].text, '聖騎士団を率いる団長が、自ら出撃してきました。');
  assert.ok(!Object.values(STORY.before).flat().some((l) => /ボス戦開始|戦闘開始/.test(l.text)));
  // 背景の移動を前提にした言い方が、差し替えた台詞に残っていない
  for (const id of ['1-2', '2-2', '2-3', '3-3', '4-2', '5-2', '6-3', '7-1']) for (const k of ['before', 'after']) for (const l of STORY[k][id] || []) assert.ok(!/麦畑|市場通り|管理所|製造工場|最深部への道|大門を突破/.test(l.text), id + ' ' + l.text);
});

test('第1〜3章の追加キャラクター（承認済みデザイン）：人間軍11体・右向き・ボスは大きめ・配置', async () => {
  const { SKIN } = await import('../js/data/skin.js');
  const keys = ['militia', 'swordsman', 'archer', 'shield', 'priest', 'rider', 'militia_captain', 'captain', 'knight', 'court_mage', 'knight_commander'];
  for (const k of keys) { const s = SKIN.sprites[k]; assert.ok(s && /assets\/approved\/humans\//.test(s.src), k); assert.equal(s.facing, 'right', k); }
  const h = (k) => SKIN.sprites[k].footY * SKIN.sprites[k].scale; // 画面での背の高さ（足元まで）
  for (const k of ['knight', 'court_mage']) assert.ok(h(k) >= h('swordsman') * 0.95 && h(k) <= h('swordsman') * 1.25, k + '：通常兵と同じくらい');
  for (const k of ['militia_captain', 'captain', 'knight_commander']) assert.ok(h(k) > h('swordsman') * 1.3, k + '：ボスは存在感のある大きさ');
  const used = (id) => STAGES[id].spawns.flatMap((x) => x.who ? [x.who] : x.wave.map((w) => w.who));
  assert.ok(used('1-3').includes('militia_captain') && STAGES['1-3'].spawns.some((x) => x.hero === 'militia_captain'));
  assert.ok(STAGES['2-3'].spawns.some((x) => x.hero === 'captain'));
  for (const id of ['3-1', '3-2', '3-3']) assert.ok(used(id).includes('knight') && used(id).includes('court_mage'), id);
  assert.ok(STAGES['3-3'].spawns.some((x) => x.hero === 'knight_commander'));
  for (const [id, hero] of [['1-3', 'militia_captain'], ['2-3', 'captain'], ['3-3', 'knight_commander']]) {
    const b = makeBattle({ stageId: id, seed: 1 });
    const row = STAGES[id].spawns.find((x) => x.hero === hero);
    b.damageBase(b.base, b.base.hp - b.base.maxHp * (row.trigger.baseBelow - 0.01)); run(b, 3);
    assert.ok(b.entities.some((e) => e.key === hero), id + '：' + hero);
  }
});
