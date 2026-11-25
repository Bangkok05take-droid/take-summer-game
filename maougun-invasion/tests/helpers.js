// テスト用：戦闘を作る・自動で操作するボット
import { createBattle, STEP } from '../js/core/battle.js';
import { UNITS, ALL_DEMONS, UNIT_ORDER } from '../js/data/units.js';
import { HUMANS } from '../js/data/humans.js';
import { STAGES, CONFIG, CHAPTER1, STAGE_ORDER } from '../js/data/stages.js';
import { newProfile, buildDeck, resolveMana, resolveUnit, applyResult } from '../js/data/progress.js';

export { STEP, UNITS, ALL_DEMONS, UNIT_ORDER, HUMANS, STAGES, CONFIG, CHAPTER1, newProfile };

// その時点までのステージを、ふつうに遊んでクリアした状態のプロフィール（強化なし・編成は自動で入った魔物のまま）
// upgraded：それまでの初回クリア報酬を、主力の強化に使った想定（1-1 0石 → 1-5 約730石）
export function profileFor(stageId, upgraded = false) {
  const p = newProfile();
  for (const id of STAGE_ORDER) { if (id === stageId) break; applyResult(p, id, 'win', 200); }
  p.stones = 0;
  if (upgraded) {
    const plan = { '1-1': [], '1-2': ['vanguard'], '1-3': ['vanguard', 'area'], '1-4': ['vanguard', 'area', 'vanguard'], '1-5': ['vanguard', 'area', 'vanguard', 'tank', 'area'] };
    for (const k of plan[stageId] || []) p.units[k].level++;
  }
  return p;
}

export function makeBattle(over = {}) {
  const stage = over.stage || STAGES[over.stageId || '1-1'];
  const profile = over.profile || profileFor(stage.id || '1-1', over.upgraded);
  const deck = over.deck ? over.deck.map((k) => resolveUnit(k, profile)) : buildDeck(profile);
  return createBattle({ stage, deck, humanDefs: HUMANS, config: over.config || CONFIG, seed: over.seed ?? 1, mana: resolveMana(stage.mana, profile) });
}

export function run(b, seconds, each) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n && !b.result; i++) { if (each) each(b); b.step(); }
  return b;
}

// ふつうの遊び方を真似るボット。
//  normal：魔力炉を2段上げてから、手持ちを順に（ほしい物のために魔力をためる）。呪文はたまったら撃つ
//  slow：操作がゆっくり（2秒に1回）／massonly：量産型だけ連打
export function botPlayer(style = 'normal') {
  let next = 0; let i = 0;
  const pattern = ['mass', 'vanguard', 'mass', 'area', 'ranged', 'tank', 'fast', 'mass', 'vanguard', 'healer', 'special', 'ranged', 'fast'];
  return (b) => {
    if (b.t < next) return;
    next = b.t + (style === 'slow' ? 2 : 0.3);
    if (b.canCastSpell().ok) { b.queue({ type: 'spell' }); return; }
    if (style !== 'massonly' && style !== 'nofurnace' && b.furnaceLv < 3 && b.t > 4) {
      if (b.canUpgradeFurnace().ok) b.queue({ type: 'furnace' });
      return;
    }
    const cycle = style === 'massonly' ? ['mass'] : pattern.filter((k) => b.deckDef(k));
    const danger = b.entities.some((e) => e.side === 'human' && e.state !== 'dead' && e.x > b.shrine.x - 350);
    if (danger && b.canSummon('mass').ok) { b.queue({ type: 'summon', key: 'mass' }); return; }
    for (let tries = 0; tries < cycle.length; tries++) {
      const want = cycle[i % cycle.length];
      const chk = b.canSummon(want);
      if (chk.ok) { b.queue({ type: 'summon', key: want }); i++; return; }
      if (chk.reason === 'mana') return; // ためる
      i++;
    }
  };
}
