/* 育成・セーブのデータ構造（試作では画面も保存も未実装。形だけ先に決めておく）
 *
 * プロフィール（将来 localStorage の 'maougunInvasion.save' に保存）
 *   version     形式の版（移行用）
 *   stones      魔界石
 *   units[key]  { unlocked, level, form }  form：進化の段階（0 = 基本形。UNITS[key].evolvesTo をたどる）
 *   upgrades    { manaMax, manaRegen, cooldown } の段階
 *   stages[id]  { cleared, stars, bestTime }
 */
export const SAVE_KEY = 'maougunInvasion.save';
export const SAVE_VERSION = 1;

export const UPGRADE_EFFECT = {
  manaMax: 100,      // 1段ごとの最大魔力
  manaRegen: 2,      // 1段ごとの回復（毎秒）
  cooldown: 0.04,    // 1段ごとの再召喚時間の短縮率（上限 40%）
};

export function newProfile() {
  return {
    version: SAVE_VERSION,
    stones: 0,
    units: {
      mass: { unlocked: true, level: 1, form: 0 },
      vanguard: { unlocked: true, level: 1, form: 0 },
      tank: { unlocked: true, level: 1, form: 0 },
      ranged: { unlocked: true, level: 1, form: 0 },
    },
    upgrades: { manaMax: 0, manaRegen: 0, cooldown: 0 },
    stages: {},
  };
}

// ユニットの定義にプロフィールのレベル・進化を当てはめた、戦闘で使う数値を返す
export function resolveUnit(key, defs, profile) {
  const u = profile && profile.units && profile.units[key];
  let def = defs[key];
  for (let f = 0; u && f < (u.form || 0) && def.evolvesTo; f++) def = defs[def.evolvesTo];
  const lv = (u && u.level) || 1;
  const g = def.growth || { hp: 0, atk: 0 };
  const cdCut = Math.min(0.4, ((profile && profile.upgrades.cooldown) || 0) * UPGRADE_EFFECT.cooldown);
  return {
    ...def,
    key,
    hp: Math.round(def.hp * (1 + g.hp * (lv - 1))),
    atk: Math.round(def.atk * (1 + g.atk * (lv - 1))),
    cooldown: def.cooldown * (1 - cdCut),
  };
}

export function resolveMana(stageMana, profile) {
  const up = (profile && profile.upgrades) || {};
  return {
    start: stageMana.start,
    max: stageMana.max + (up.manaMax || 0) * UPGRADE_EFFECT.manaMax,
    regen: stageMana.regen + (up.manaRegen || 0) * UPGRADE_EFFECT.manaRegen,
  };
}
