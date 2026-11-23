// テスト用：戦闘を作る・自動で操作するボット
import { createBattle, STEP } from '../js/core/battle.js';
import { UNITS, ALL_DEMONS } from '../js/data/units.js';
import { HUMANS } from '../js/data/humans.js';
import { STAGES, CONFIG } from '../js/data/stages.js';

export { STEP, UNITS, ALL_DEMONS, HUMANS, STAGES, CONFIG };

export function makeBattle(over = {}) {
  const stage = over.stage || STAGES['1-1'];
  return createBattle({ stage, unitDefs: ALL_DEMONS, humanDefs: HUMANS, config: over.config || CONFIG, seed: over.seed ?? 1, deck: over.deck, profile: over.profile });
}

export function run(b, seconds, each) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n && !b.result; i++) { if (each) each(b); b.step(); }
  return b;
}

// ふつうの遊び方を真似るボット。
//  normal：魔力炉を2段上げてから、前衛・タンク・遠距離・量産型を順に（ほしい物のために魔力をためる）。呪文はたまったら撃つ
//  slow：操作がゆっくり（2秒に1回）／massonly：量産型だけ連打／nofurnace：魔力炉を使わない
export function botPlayer(style = 'normal') {
  let next = 0; let i = 0;
  const cycle = style === 'massonly' ? ['mass'] : ['mass', 'vanguard', 'mass', 'ranged', 'tank', 'mass', 'vanguard', 'ranged'];
  return (b) => {
    if (b.t < next) return;
    next = b.t + (style === 'slow' ? 2 : 0.3);
    if (b.canCastSpell().ok && b.entities.some((e) => e.side === 'human' && e.state !== 'dead' && e.x < 1100)) { b.queue({ type: 'spell' }); return; }
    if (style !== 'nofurnace' && style !== 'massonly' && b.furnaceLv < 3 && b.t > 4) {
      if (b.canUpgradeFurnace().ok) b.queue({ type: 'furnace' });
      return;
    }
    // 祠の近くまで敵が来ていたら、すぐ出せる量産型で守る
    const danger = b.entities.some((e) => e.side === 'human' && e.state !== 'dead' && e.x < 400);
    if (danger && b.canSummon('mass').ok) { b.queue({ type: 'summon', key: 'mass' }); return; }
    const want = cycle[i % cycle.length];
    const chk = b.canSummon(want);
    if (chk.ok) { b.queue({ type: 'summon', key: want }); i++; }
    else if (chk.reason === 'cooldown' || chk.reason === 'cap') i++;
  };
}
