/* 戦闘の共通設定とステージ（数値はすべて仮）
 *
 * 敵の出し方（spawns）
 *   { who, start, every, max, until? }      start 秒から every 秒ごと。max はこの行で出した敵が同時に何体まで
 *   { trigger: { baseBelow: 0.5 }, wave: [{ who, count }], gap }
 *                                           拠点HPがその割合を下回ったら1回だけ、gap 秒間隔で順に出す
 */
export const CONFIG = {
  demonCap: 30,          // 魔王軍の同時出撃上限
  humanCap: 30,          // 人間軍の同時出撃上限
  baseHalfWidth: 50,     // 祠・拠点の当たりの半分の幅
  kbDistance: 70,        // ノックバックで下がる距離
  kbTime: 0.45,
  deathTime: 0.7,        // 撃破の演出の長さ（その間は当たらない）
  furnace: {             // 魔力炉。costs[lv-1] が Lv → Lv+1 の費用
    costs: [150, 250, 350, 450, 550, 650, 750],
    maxAdd: 250,         // 1段ごとの最大魔力の上昇
    regenAdd: 6,         // 1段ごとの回復（毎秒）の上昇
  },
  spell: {               // 魔王の呪文（範囲攻撃）
    name: '魔王の呪文',
    charge: 40,          // ためる秒数（開始時は空）
    damage: 260,
    reach: 1100,         // 祠の前から、この距離までの人間すべて
    knockback: true,
  },
};

export const STAGES = {
  '1-1': {
    id: '1-1', chapter: 1, name: '見張り小屋', chapterName: 'はじまりの村を侵略せよ',
    length: 2400,
    shrineHp: 5000,
    baseHp: 9000,
    mana: { start: 200, max: 1000, regen: 20 },
    deck: ['mass', 'vanguard', 'tank', 'ranged'],
    spawns: [
      { who: 'militia', start: 3, every: 6, max: 6 },
      { who: 'militia', start: 45, every: 4, max: 8 },
      { who: 'swordsman', start: 25, every: 16, max: 3 },
      { who: 'swordsman', start: 90, every: 9, max: 4 },
      { who: 'militia', start: 150, every: 2.5, max: 8 },
      { who: 'swordsman', start: 200, every: 6, max: 4 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'swordsman', count: 2 }, { who: 'militia', count: 4 }], gap: 0.7 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'swordsman', count: 3 }, { who: 'militia', count: 5 }], gap: 0.6 },
    ],
    reward: { stones: 100, unlock: [] },
    talk: {
      start: [
        { who: 'ティウ', text: 'み、見張り小屋に魔物が来たぞー！ みんな、クワを持てー！' },
      ],
    },
  },
};
