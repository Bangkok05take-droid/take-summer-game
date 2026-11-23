/* 見た目の設定（表示名・色・絵）。ゲームの数値・ルールとは独立。
 *
 * - names：ユニットの枠ごとの表示名。既定は役割名（仮）。
 * - speakers：会話の話し手の表示名。lord（大魔王）・aide（側近）は既定で役職名。
 * - sprites：枠ごとの絵。登録が無い・読み込めない枠は、図形の仮の絵で描く。
 *     { src, frameW, frameH, frames: { walk: [0, 1], windup: 2, attack: 3 }, footY, facing: 'right' | 'left', scale }
 * - portraits：会話の顔絵 { lord: 'assets/talk/lord.png', … }。無ければ図形の仮の顔。
 *   絵の仕様は docs/ART_SPEC.md。
 */
export const SKIN = {
  names: {
    mass: '量産型', vanguard: '前衛', tank: 'タンク', ranged: '遠距離',
    fast: '高速型', area: '範囲魔法', healer: '回復', special: '特殊魔法',
    charger: '幹部・突進', elemental: '幹部・炎氷', trickster: '幹部・罠', thunder: '幹部・落雷', mist: '幹部・霧',
    lord: '大魔王', lordAwakened: '大魔王（真の姿）',
  },
  speakers: {
    lord: '大魔王', aide: '側近', narr: '',
    tiw: 'ティウ', mot: 'モッ', waan: 'ワーン', koi: 'コイ', take: '勇者たけ', sai: '勇者サイ', yanai: 'マスター・ヤナイ',
  },
  sprites: {},
  portraits: {},
  colors: {
    mass: ['#8b5cf6', '#3b1d74'],
    vanguard: ['#6d6a86', '#25233a'],
    tank: ['#7a6a9a', '#2a2040'],
    ranged: ['#c2417a', '#4a1430'],
    fast: ['#4b3f8f', '#1b1540'],
    area: ['#7c3aed', '#2e0f5a'],
    healer: ['#3fb6a8', '#0f3d39'],
    special: ['#e0559a', '#4a0f30'],
    charger: ['#b4532a', '#3a1608'],
    militia: ['#e8c48a', '#6b4a22'],
    swordsman: ['#7fb2ef', '#244a7a'],
    archer: ['#9bd47a', '#2f5a1c'],
    shield: ['#c9d2dc', '#4a5563'],
    priest: ['#fff3d6', '#8a7a52'],
    rider: ['#f2a3b5', '#7a2f43'],
    take: ['#3e6fc4', '#14306a'],
    sai: ['#f5f0ff', '#6a5a9a'],
  },
};
