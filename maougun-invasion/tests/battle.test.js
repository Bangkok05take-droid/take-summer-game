// 戦闘ロジックの自動テスト：node --test tests/battle.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, run, botPlayer, STEP, CONFIG, STAGES } from './helpers.js';
import { createClock } from '../js/core/clock.js';

const stage = (over) => ({ ...STAGES['1-1'], ...over });
const noEnemies = (over = {}) => stage({ spawns: [], ...over });

test('開始時の魔力・上限・回復は仕様どおり（200 / 1000 / 毎秒20）', () => {
  const b = makeBattle({ stage: noEnemies() });
  assert.equal(b.mana, 200); assert.equal(b.manaMax, 1000); assert.equal(b.manaRegen, 20);
  run(b, 10);
  assert.ok(Math.abs(b.mana - 400) < 0.5, `10秒後は400前後（実際 ${b.mana}）`);
  run(b, 100);
  assert.equal(b.mana, 1000, '上限で止まる');
});

test('魔力不足では召喚できず、理由は mana', () => {
  const b = makeBattle({ stage: noEnemies() });
  assert.equal(b.canSummon('vanguard').reason, 'mana'); // 300 > 200
  b.queue({ type: 'summon', key: 'vanguard' }); b.step();
  assert.equal(b.entities.length, 0);
  assert.ok(b.events.some((e) => e.type === 'denied' && e.reason === 'mana'));
  assert.ok(b.canSummon('mass').ok);
});

test('召喚すると魔力が減り、クールタイム中は再召喚できない', () => {
  const b = makeBattle({ stage: noEnemies() });
  b.queue({ type: 'summon', key: 'mass' }); b.step();
  assert.equal(b.entities.length, 1);
  assert.ok(Math.abs(b.mana - (200 - 75 + 20 * STEP)) < 1e-6);
  const chk = b.canSummon('mass');
  assert.equal(chk.reason, 'cooldown'); assert.ok(chk.wait > 2);
  b.queue({ type: 'summon', key: 'mass' }); b.step();
  assert.equal(b.entities.length, 1, 'クールタイム中は増えない');
  run(b, 2.6);
  assert.ok(b.canSummon('mass').ok, 'クールタイム（2.5秒）が明けたら出せる');
});

test('同時出撃上限（30体）に達すると召喚できない', () => {
  const b = makeBattle({ stage: noEnemies({ mana: { start: 1000, max: 99999, regen: 9999 } }) });
  for (let i = 0; i < 40; i++) { b.cooldowns.mass = 0; b.mana = 99999; b.queue({ type: 'summon', key: 'mass' }); b.step(); }
  assert.equal(b.aliveDemons(), CONFIG.demonCap);
  b.cooldowns.mass = 0;
  assert.equal(b.canSummon('mass').reason, 'cap');
});

test('ユニットは自動で進軍する（魔王軍は右、人間軍は左）', () => {
  const b = makeBattle({ stage: stage({ spawns: [{ who: 'militia', start: 0, every: 999, max: 1 }] }) });
  b.queue({ type: 'summon', key: 'mass' });
  run(b, 0.1);
  const d0 = b.entities.find((e) => e.side === 'demon').x;
  const h0 = b.entities.find((e) => e.side === 'human').x;
  run(b, 3);
  assert.ok(b.entities.find((e) => e.side === 'demon').x > d0 + 100);
  assert.ok(b.entities.find((e) => e.side === 'human').x < h0 - 100);
});

test('射程内に敵が入ると止まって攻撃し、遠距離は射程が長い', () => {
  const b = makeBattle({ stage: stage({ spawns: [{ who: 'swordsman', start: 0, every: 999, max: 1 }] }) });
  b.queue({ type: 'summon', key: 'ranged' });
  let firstAttackDist = null;
  run(b, 40, (bb) => {
    const r = bb.entities.find((e) => e.key === 'ranged'); const h = bb.entities.find((e) => e.side === 'human' && e.state !== 'dead');
    if (firstAttackDist == null && r && h && r.state === 'attack') firstAttackDist = h.x - r.x;
  });
  assert.ok(firstAttackDist != null, '攻撃した');
  assert.ok(firstAttackDist > 150 && firstAttackDist <= 210 + 1, `射程の端から撃つ（距離 ${firstAttackDist}）`);
});

test('HPが0になったユニットは撃破され、演出のあと消える。倒した人間からは魔力を得る', () => {
  const b = makeBattle({ stage: stage({ spawns: [{ who: 'militia', start: 0, every: 999, max: 1 }] }) });
  const h = b.spawnHuman('militia');
  const before = b.mana;
  b.damageUnit(h, 9999, null);
  assert.equal(h.state, 'dead');
  assert.ok(b.mana >= before + 30 - 1e-9);
  assert.equal(b.targetsInRange({ ...h, side: 'demon', dir: 1, def: { range: 5000 } }).filter((t) => t.target === h).length, 0, '撃破中は当たらない');
  run(b, CONFIG.deathTime + 0.1);
  assert.ok(!b.entities.includes(h), '消えた');
});

test('ノックバック：決まった回数ごとに後ろへ下がる', () => {
  const b = makeBattle({ stage: noEnemies() });
  const h = b.spawnHuman('swordsman'); // kb 3 → HP 380 を 126.7 ずつ
  h.x = 1200; const x0 = h.x;
  b.damageUnit(h, 100, null); assert.equal(h.state, 'walk');
  b.damageUnit(h, 40, null); assert.equal(h.state, 'kb');
  run(b, CONFIG.kbTime);
  assert.ok(h.x > x0 + CONFIG.kbDistance - 1, '人間は右（自分の拠点側）へ下がる');
});

test('敵拠点を破壊すると勝利', () => {
  const b = makeBattle({ stage: noEnemies() });
  b.damageBase(b.base, b.base.maxHp, null); b.step();
  assert.equal(b.result, 'win');
  assert.equal(b.canSummon('mass').reason, 'ended');
});

test('祠を破壊されると敗北（何もしなければ負ける）', () => {
  const b = makeBattle({ seed: 5 });
  run(b, 600);
  assert.equal(b.result, 'lose');
  assert.equal(b.shrine.hp, 0);
});

test('ボットが普通に遊べば 1-1 に勝てる（3〜5分くらい）', () => {
  for (const seed of [1, 2, 3]) {
    const b = makeBattle({ seed });
    run(b, 900, botPlayer('normal'));
    assert.equal(b.result, 'win', `seed ${seed}`);
    assert.ok(b.t > 150 && b.t < 330, `クリア時間 ${b.t.toFixed(0)} 秒`);
  }
});

test('同じシード・同じ操作なら同じ結果（再現性）', () => {
  const a = makeBattle({ seed: 42 }); const c = makeBattle({ seed: 42 });
  run(a, 200, botPlayer()); run(c, 200, botPlayer());
  assert.deepEqual(a.snapshot(), c.snapshot());
});

test('2倍速：同じ実時間で手数がちょうど2倍、結果は通常速度と同じ', () => {
  const c1 = createClock(STEP); const c2 = createClock(STEP); c2.speed = 2;
  let n1 = 0; let n2 = 0;
  for (let i = 0; i < 600; i++) { n1 += c1.advance(1 / 60); n2 += c2.advance(1 / 60); } // 実時間10秒
  assert.equal(n1, 300); assert.equal(n2, 600);
  const a = makeBattle({ seed: 7 }); const b = makeBattle({ seed: 7 });
  const bot1 = botPlayer(); const bot2 = botPlayer();
  for (let i = 0; i < 600; i++) { for (let k = c1.advance(1 / 60); k > 0; k--) { bot1(a); a.step(); } } // 通常速度で実時間10秒
  for (let i = 0; i < 300; i++) { for (let k = c2.advance(1 / 60); k > 0; k--) { bot2(b); b.step(); } } // 2倍速で実時間5秒
  assert.deepEqual(a.snapshot(), b.snapshot(), '2倍速で半分の実時間 = 通常速度と同じ状態');
});

test('一時停止中は進まない', () => {
  const c = createClock(STEP); c.paused = true;
  assert.equal(c.advance(1), 0);
});

test('魔力炉：最大魔力と回復が上がり、費用が引かれる', () => {
  const b = makeBattle({ stage: noEnemies() });
  b.queue({ type: 'furnace' }); b.step();
  assert.equal(b.furnaceLv, 2);
  assert.equal(b.manaMax, 1000 + CONFIG.furnace.maxAdd);
  assert.equal(b.manaRegen, 20 + CONFIG.furnace.regenAdd);
  assert.ok(b.mana < 60);
});

test('魔王の呪文：たまるまで使えず、使うと範囲内の人間にダメージとノックバック', () => {
  const b = makeBattle({ stage: noEnemies() });
  assert.equal(b.canCastSpell().ok, false);
  run(b, CONFIG.spell.charge + 0.1);
  assert.equal(b.canCastSpell().ok, true);
  const near = b.spawnHuman('swordsman'); near.x = 600;
  const far = b.spawnHuman('swordsman'); far.x = 2000;
  b.queue({ type: 'spell' }); b.step();
  assert.equal(near.hp, near.maxHp - CONFIG.spell.damage);
  assert.equal(near.state, 'kb');
  assert.equal(far.hp, far.maxHp, '範囲外には当たらない');
  assert.equal(b.spellCharge < 1, true);
});

test('幹部：同時に1体まで・生存中は再召喚不可・撃破時からクールタイム', () => {
  const b = makeBattle({ stage: noEnemies({ mana: { start: 5000, max: 9999, regen: 0 } }), deck: ['mass', 'charger'] });
  b.queue({ type: 'summon', key: 'charger' }); b.step();
  const boss = b.entities.find((e) => e.key === 'charger');
  assert.ok(boss);
  assert.equal(b.canSummon('charger').reason, 'alive');
  b.damageUnit(boss, 1e9, null); b.step();
  assert.equal(b.canSummon('charger').reason, 'cooldown');
  assert.ok(Math.abs(b.cooldowns.charger - (60 - STEP)) < 1e-6, '撃破時から60秒');
  run(b, 60.1);
  assert.ok(b.canSummon('charger').ok);
});

test('拠点HPが減ると増援が出る', () => {
  const b = makeBattle({ stage: noEnemies({ spawns: [STAGES['1-1'].spawns.find((s) => s.trigger)] }) });
  b.damageBase(b.base, b.base.maxHp * 0.45, null);
  run(b, 6);
  assert.ok(b.aliveHumans() >= 6, `増援 ${b.aliveHumans()} 人`);
});

test('多数のユニット（30対30）でも1手が十分速い', () => {
  const b = makeBattle({ stage: noEnemies({ mana: { start: 0, max: 0, regen: 0 } }) });
  for (let i = 0; i < 30; i++) { const d = b.spawn('demon', b.deck[i % 4], 300 + i * 20); d.x = 800 + i * 5; }
  for (let i = 0; i < 30; i++) { const h = b.spawnHuman(i % 2 ? 'militia' : 'swordsman'); h.x = 900 + i * 5; }
  const t0 = performance.now();
  for (let i = 0; i < 300; i++) b.step();
  const per = (performance.now() - t0) / 300;
  assert.ok(per < 1.0, `1手 ${per.toFixed(3)} ms（1フレームあたり2手でも余裕があること）`);
});
