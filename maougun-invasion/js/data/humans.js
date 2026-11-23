/* 人間軍（調整用の数値）。項目は js/data/units.js と同じ。mana：倒したときに魔王軍が得る魔力 */
export const HUMANS = {
  militia: {
    name: '自警団', role: '量産',
    hp: 130, atk: 11, range: 28, speed: 40, interval: 1.3, windup: 0.4, kb: 3, attack: 'single', mana: 30, size: 0.85,
  },
  swordsman: {
    name: '見習い剣士', role: '前衛',
    hp: 380, atk: 26, range: 34, speed: 36, interval: 1.5, windup: 0.45, kb: 3, attack: 'single', mana: 70, size: 0.95,
  },
  // ---- 1-2 以降（試作では出さない） ----
  archer: {
    name: '弓兵', role: '遠距離',
    hp: 140, atk: 18, range: 170, speed: 32, interval: 2.4, windup: 0.5, kb: 2, attack: 'single', projectile: 'arrow', mana: 60, size: 0.9,
  },
  shield: {
    name: '盾兵', role: 'タンク',
    hp: 900, atk: 8, range: 26, speed: 20, interval: 2.2, windup: 0.5, kb: 1, attack: 'single', mana: 90, size: 1.1,
  },
  priest: {
    name: '見習い僧侶', role: '支援',
    hp: 180, atk: 5, range: 40, speed: 30, interval: 2.0, windup: 0.4, kb: 2, attack: 'single', heal: { every: 4, ratio: 0.15, radius: 150 }, mana: 80, size: 0.9,
  },
  rider: {
    name: '子馬の騎兵', role: '高速',
    hp: 300, atk: 24, range: 36, speed: 85, interval: 1.2, windup: 0.3, kb: 2, attack: 'single', mana: 80, size: 1.0,
  },
  // 勇者（ボス）。skill は試作では未実装
  take: {
    name: '勇者たけ', role: '勇者', boss: true, skill: ['doubleStrike', 'slashWave', 'blowAway'],
    hp: 4000, atk: 60, range: 40, speed: 34, interval: 1.6, windup: 0.4, kb: 4, attack: 'single', mana: 500, size: 1.4,
  },
  sai: {
    name: '勇者サイ', role: '勇者', boss: true, skill: ['healAllies', 'stunLight'],
    hp: 2500, atk: 30, range: 160, speed: 30, interval: 2.2, windup: 0.5, kb: 4, attack: 'single', projectile: 'orb', mana: 400, size: 1.35,
    heal: { every: 6, ratio: 0.12, radius: 220 },
  },
};
