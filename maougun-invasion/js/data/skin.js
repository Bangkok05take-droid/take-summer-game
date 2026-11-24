import { APPROVED } from './approved.js';

/* 見た目の設定（表示名・色・絵）。ゲームの数値・ルールとは独立。
 *
 * - names：ユニットの枠ごとの表示名。既定は役割名（仮）。
 * - speakers：会話の話し手の表示名。lord（大魔王）・aide（側近）は既定で役職名。
 * - sprites：枠ごとの絵。登録が無い・読み込めない枠は、図形の仮の絵で描く。
 *     { src, frameW, frameH, frames: { walk: [0, 1], windup: 2, attack: 3 }, footY, facing: 'right' | 'left', scale, hover }
 *     hover：空を飛ぶ魔物を地面から浮かせる高さ（論理ドット。省略で0）
 * - portraits：会話の顔絵 { lord: 'assets/talk/lord.png', … }。無ければ図形の仮の顔。
 *   絵の仕様は docs/ART_SPEC.md。
 */
export const SKIN = {
  names: {
    // 2026-11-24：ユーザー指定の名前
    mass: 'グミ', vanguard: '闇の騎士', tank: '岩男', ranged: '弓ゴブリン',
    fast: 'こうもり', area: '魔法使い', healer: '森のお化け', special: '悪魔くん',
    charger: '幹部・突進', elemental: '幹部・炎氷', trickster: '幹部・罠', thunder: '幹部・落雷', mist: '幹部・霧',
    lord: '大魔王', lordAwakened: '大魔王（真の姿）',
  },
  speakers: {
    lord: '大魔王', aide: '側近', narr: '',
    tiw: 'ティウ', mot: 'モッ', waan: 'ワーン', koi: 'コイ', take: '勇者たけ', sai: '勇者サイ', yanai: 'マスター・ヤナイ',
  },
  sprites: {
    // 2026-11-24：グミ（ユーザー承認のオリジナルデザイン・チャットで受け取った画像 11440.png に差し替え。1374×1145・静止画1枚。見た目は変えず、倍率と足元だけ指定。動きはゲーム側）
    mass: { src: 'assets/approved/units/mass.png', frameW: 1374, frameH: 1145, frames: { walk: [0], windup: 0, attack: 0 }, footY: 975, facing: 'left', scale: 0.05 },
    // 2026-11-24：闇の騎士（ユーザー承認のオリジナルデザイン・maougun_dark_knight_test.zip。256×256・静止画1枚・左向き。見た目は変えず、倍率と足元だけ指定。倍率は人間軍の兵士と同じ）
    vanguard: { src: 'assets/approved/units/vanguard.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 240, facing: 'left', scale: 0.25 },
    // 2026-11-24：岩男（ユーザー承認のオリジナルデザイン・チャットで受け取った画像 11413.png。480×482・静止画1枚・左向き。見た目は変えず、倍率と足元だけ指定。闇の騎士の約1.3倍の高さ）
    tank: { src: 'assets/approved/units/tank.png', frameW: 480, frameH: 482, frames: { walk: [0], windup: 0, attack: 0 }, footY: 414, facing: 'left', scale: 0.2 },
    // 2026-11-24：弓ゴブリン（ユーザー承認のオリジナルデザイン・チャットで受け取った画像 11414.png。456×456・静止画1枚・左向き。見た目は変えず、倍率と足元だけ指定。闇の騎士の約0.9倍の高さ）
    ranged: { src: 'assets/approved/units/ranged.png', frameW: 456, frameH: 456, frames: { walk: [0], windup: 0, attack: 0 }, footY: 418, facing: 'left', scale: 0.14 },
    // 2026-11-24：こうもり（ユーザー承認のオリジナルデザイン・チャットで受け取った画像 11417.png。1200×1310・静止画1枚・左向き。見た目は変えず、倍率と足元だけ指定。空を飛ぶので仮の絵と同じ高さに浮かせる）
    fast: { src: 'assets/approved/units/fast.png', frameW: 1200, frameH: 1310, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1073, facing: 'left', scale: 0.06, hover: 25 },
    // 2026-11-24：魔法使い（ユーザー承認のオリジナルデザイン・チャットで受け取った画像 11422.png。496×444・静止画1枚・左向き。見た目は変えず、倍率と足元だけ指定。闇の騎士とほぼ同じ高さ）
    area: { src: 'assets/approved/units/area.png', frameW: 496, frameH: 444, frames: { walk: [0], windup: 0, attack: 0 }, footY: 412, facing: 'left', scale: 0.14 },
    // 2026-11-24：森のお化け（回復支援。ユーザー承認のオリジナルデザイン・チャットで受け取った画像 11442.png。1254×1254・静止画1枚・左向き。足があるので浮かせず地面に立たせる。見た目は変えず、倍率と足元だけ指定）
    healer: { src: 'assets/approved/units/healer.png', frameW: 1254, frameH: 1254, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1196, facing: 'left', scale: 0.045 },
  },
  portraits: {},
  /* 画面の各場所に入れる承認済み画像（場所と仕様の一覧：docs/ASSET_MAP.md）。
   * 未登録・読み込み失敗のときは、今の仮の表示に戻る。見た目は変えず、拡大縮小と位置だけ指定する。 */
  images: {
    // 戦闘の背景。ステージIDで個別に、無ければ chapter1（1-2 以降は大きな町の背景）。scale：論理画面（960×540）での倍率、offsetY：上下の位置
    stageBg: {
      chapter1: { src: 'assets/approved/bg/ch1_village.webp', scale: 0.62, offsetY: -66 },
      // 2026-11-24：小さな村（1-1・見張り小屋）。ユーザー承認の 1920×1080。画面ちょうど（960×540）に合わせて表示し、土の道が足元の列に重なる。
      // 絵の右側の見張り台は背景の一部（拠点の当たり判定・HP・破損表示は左の拠点オブジェクトのまま。重ならないことを確認済み）
      '1-1': { src: 'assets/approved/bg/village_small.png', scale: 0.5, offsetY: 0 },
    },
    // 人間軍の拠点（tower：1-1〜1-3、gate：1-4、castle：1-5）と、魔王軍の祠。{ src, width, footY }
    base: {},
    shrine: null,
    // 会話の背景（shrine：祠の中、field：戦場）
    talkBg: {},
  },
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

// 承認済み素材（tools/accept_assets.py が書いた js/data/approved.js）を重ねる。手で書いた登録より優先
Object.assign(SKIN.sprites, APPROVED.sprites);
Object.assign(SKIN.portraits, APPROVED.portraits);
Object.assign(SKIN.images.stageBg, APPROVED.images.stageBg);
Object.assign(SKIN.images.base, APPROVED.images.base);
Object.assign(SKIN.images.talkBg, APPROVED.images.talkBg);
if (APPROVED.images.shrine) SKIN.images.shrine = APPROVED.images.shrine;
// エフェクト（{ src, frameW, frameH, frames }）と UI 画像（ファイルのパス）。docs/ASSET_MAP.md
SKIN.fx = { ...(APPROVED.fx || {}) };
SKIN.ui = { ...(APPROVED.ui || {}) };
