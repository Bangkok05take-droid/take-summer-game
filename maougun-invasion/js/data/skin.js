/* 見た目の設定（表示名・色・絵）。ゲームの数値・ルールとは独立。
 *
 * - names：ユニットの枠ごとの表示名。既定は役割名（仮）。
 * - sprites：枠ごとの絵。登録が無い・読み込めない枠は、図形の仮の絵で描く。
 *     { src, frameW, frameH, frames: { walk: [0, 1], windup: 2, attack: 3 }, footY, facing: 'right' | 'left', scale }
 *   絵の仕様は docs/ART_SPEC.md。
 * - colors：仮の絵の色（体・ふち・目のまわり）。
 */
export const SKIN = {
  names: {
    mass: '量産型', vanguard: '前衛', tank: 'タンク', ranged: '遠距離',
    fast: '高速型', area: '範囲攻撃', healer: '回復支援', special: '特殊魔法',
    charger: '幹部・突進', elemental: '幹部・炎氷', trickster: '幹部・罠', thunder: '幹部・落雷', mist: '幹部・霧',
    lord: '大魔王', lordAwakened: '大魔王（覚醒）',
  },
  sprites: {},
  colors: {
    mass: ['#8b5cf6', '#3b1d74'],
    vanguard: ['#6d6a86', '#25233a'],
    tank: ['#5b4a7a', '#221a33'],
    ranged: ['#c2417a', '#4a1430'],
    fast: ['#4b3f8f', '#1b1540'],
    area: ['#d9472b', '#4a130a'],
    healer: ['#3fb6a8', '#0f3d39'],
    special: ['#b23ad1', '#3d0f4a'],
    militia: ['#e8c48a', '#6b4a22'],
    swordsman: ['#7fb2ef', '#244a7a'],
    archer: ['#9bd47a', '#2f5a1c'],
    shield: ['#c9d2dc', '#4a5563'],
    priest: ['#fff3d6', '#8a7a52'],
    rider: ['#f2a3b5', '#7a2f43'],
    take: ['#ffd25a', '#7a5a10'],
    sai: ['#ffb3d9', '#7a2f5a'],
  },
};
