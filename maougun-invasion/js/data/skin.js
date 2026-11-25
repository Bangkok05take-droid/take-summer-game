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
    fast: 'こうもり', area: '魔法使い', healer: '森のお化け',
    special: 'プチデビル', // 2026-11-24：既存作品名と重なる旧名から変更
    mallet: '木槌小鬼', // 2026-11-24 追加の後衛狙撃型（仮称）。正式名はビジュアル制作室で確定
    mallet_2: '木槌小鬼（第2形態）', mallet_3a: '木槌小鬼（一撃）', mallet_3b: '木槌小鬼（連投）', // 進化形（仮称）
    charger: 'ワニ将軍', // 2026-11-25：幹部1体目（ユーザーのデザイン）。内部キーは charger のまま elemental: '幹部・炎氷', trickster: '幹部・罠', thunder: '幹部・落雷', mist: '幹部・霧',
    lord: '大魔王', lordAwakened: '大魔王（真の姿）',
    ord: '竜人オルド', // 2026-11-25（依頼文での呼び方：バラン）
  },
  speakers: {
    lord: '大魔王', aide: 'ヴェイル', narr: '', ord: 'オルド', // aide：影の側近（2026-11-24 命名。既存作品の名前に近い「ミスト」を避けた）
    tiw: 'ティウ', mot: 'モッ', waan: 'ワーン', koi: 'コイ', take: '勇者たけ', sai: '勇者サイ', yanai: 'マスター・ヤナイ',
  },
  sprites: {
    // 2026-11-25：竜人オルド（ビジュアル制作室の納品・画像 1000021131.png。1254×1254・左向き・透過）。敵（壊滅した町）・味方の両方で使う
    ord: { src: 'assets/approved/units/ord.png', frameW: 1254, frameH: 1254, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1236, facing: 'left', scale: 0.092 },
    // 2026-11-25：ワニ将軍（幹部1体目・画像 1000021128.png。1254×1254・左向き・透過）
    charger: { src: 'assets/approved/units/charger.png', frameW: 1254, frameH: 1254, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1195, facing: 'left', scale: 0.082 },
    // 2026-11-25：木槌小鬼（ユーザー承認のデザイン・画像 11481.png）。元画像は背景の市松模様が焼き込まれていたため、端からつながる白・薄灰だけを透明にした（キャラクターは加工なし）。1312×1199・左向き
    mallet: { src: 'assets/approved/units/mallet.png', frameW: 1312, frameH: 1199, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1180, facing: 'left', scale: 0.046 },
    // 2026-11-25：魔法使い（新デザイン・画像 11497.png。1312×1199・静止画1枚・透過）。絵は左向き（敵のいる左を向く）
    area: { src: 'assets/approved/units/area.png', frameW: 1312, frameH: 1199, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1118, facing: 'left', scale: 0.06 },
    // 2026-11-25：こうもり（新デザイン・画像 11496.png。1536×1024・静止画1枚・左向き・透過）。空を飛ぶので浮かせる
    fast: { src: 'assets/approved/units/fast.png', frameW: 1536, frameH: 1024, frames: { walk: [0], windup: 0, attack: 0 }, footY: 914, facing: 'left', scale: 0.065, hover: 25 },
    // 2026-11-24：グミ（ユーザー承認のオリジナルデザイン・チャットで受け取った画像 11440.png に差し替え。1374×1145・静止画1枚。見た目は変えず、倍率と足元だけ指定。動きはゲーム側）
    mass: { src: 'assets/approved/units/mass.png', frameW: 1374, frameH: 1145, frames: { walk: [0], windup: 0, attack: 0 }, footY: 975, facing: 'left', scale: 0.05 },
    // 2026-11-24：闇の騎士（ユーザー承認のオリジナルデザイン・maougun_dark_knight_test.zip。256×256・静止画1枚・左向き。見た目は変えず、倍率と足元だけ指定。倍率は人間軍の兵士と同じ）
    vanguard: { src: 'assets/approved/units/vanguard.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 240, facing: 'left', scale: 0.25 },
    // 2026-11-24：岩男（ユーザー承認のオリジナルデザイン・チャットで受け取った画像 11413.png。480×482・静止画1枚・左向き。見た目は変えず、倍率と足元だけ指定。闇の騎士の約1.3倍の高さ）
    tank: { src: 'assets/approved/units/tank.png', frameW: 480, frameH: 482, frames: { walk: [0], windup: 0, attack: 0 }, footY: 414, facing: 'left', scale: 0.2 },
    // 2026-11-24：弓ゴブリン（ユーザー承認のオリジナルデザイン・チャットで受け取った画像 11414.png。456×456・静止画1枚・左向き。見た目は変えず、倍率と足元だけ指定。闇の騎士の約0.9倍の高さ）
    ranged: { src: 'assets/approved/units/ranged.png', frameW: 456, frameH: 456, frames: { walk: [0], windup: 0, attack: 0 }, footY: 418, facing: 'left', scale: 0.14 },
    // 2026-11-24：森のお化け（回復支援。ユーザー承認のオリジナルデザイン・チャットで受け取った画像 11442.png。1254×1254・静止画1枚・左向き。足があるので浮かせず地面に立たせる。見た目は変えず、倍率と足元だけ指定）
    healer: { src: 'assets/approved/units/healer.png', frameW: 1254, frameH: 1254, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1196, facing: 'left', scale: 0.045 },
  },
  // 会話の立ち絵（2026-11-24 ユーザー承認。大魔王は左枠・右向き、影の側近は右枠・左向き）。表情差分が無いときは _normal を使う
  portraits: {
    lord_normal: 'assets/approved/talk/lord_normal.png',
    aide_normal: 'assets/approved/talk/aide_normal.png',
  },
  /* 画面の各場所に入れる承認済み画像（場所と仕様の一覧：docs/ASSET_MAP.md）。
   * 未登録・読み込み失敗のときは、今の仮の表示に戻る。見た目は変えず、拡大縮小と位置だけ指定する。 */
  images: {
    // 戦闘の背景。ステージIDで個別に、無ければ chapter1（1-3 以降は大きな町の背景）。scale：論理画面（960×540）での倍率、offsetY：上下の位置
    stageBg: {
      // 2026-11-25：第1章（はじまりの村・3ステージ）はすべて横長パノラマの村（2172×358）。高さを画面に合わせて ×1.36。
      // カメラの移動量の35%だけ背景が動く（parallax）。focus：動く範囲の中心を画像のどこに置くか（0＝左端・0.5＝中央・1＝右端）
      // 町のパノラマ（pano_village_town.png）は第2章（城下町）用に残す。16:9 の旧背景（village_small.png・village_town.png）もファイルは残す
      // 2026-11-25：第1〜3章の本番背景（ビジュアル制作室・2172×724）。土の道の上端がユニットの足元（画面 y≈372）に来るよう倍率と上下の位置を合わせた
      chapter1: { src: 'assets/approved/bg/ch1_village_v2.png', scale: 0.76, offsetY: -1, parallax: 0.35, focus: 0.5 },
      chapter2: { src: 'assets/approved/bg/ch2_town_v2.png', scale: 0.98, offsetY: -165, parallax: 0.35, focus: 0.5 },
      // 2026-11-25：壊滅した町の本番背景（ビジュアル制作室・2172×724）。道の上端（画像 y≈511）がユニットの足元に来るよう合わせた
      'ex-1': { src: 'assets/approved/bg/ex_ruin_town.png', scale: 0.77, offsetY: -16, parallax: 0.35, focus: 0.5 },
      chapter4: { src: 'assets/approved/bg/ch4_harbor.png', scale: 0.85, offsetY: -75, parallax: 0.35, focus: 0.5 }, // 2026-11-25：港町の本番背景（2172×724・道の上端 y≈532）
      // 第5章 鉄鋼の要塞都市：承認済みの背景が届いたら src をその画像にする（今は町のパノラマを暗くして代用）
      chapter5: { src: 'assets/approved/bg/pano_village_town.png', scale: 1.36, offsetY: 0, parallax: 0.35, focus: 0.5, tint: 'rgba(30,30,45,.35)' },
      // 第6章 砂漠の古代王国：承認済みの砂漠・ピラミッド背景が届いたら src をその画像にする（今は町のパノラマを砂色に染めて代用）
      chapter6: { src: 'assets/approved/bg/pano_village_town.png', scale: 1.36, offsetY: 0, parallax: 0.35, focus: 0.5, tint: 'rgba(200,150,60,.35)' },
      // 第7章 聖なる都：承認済みの背景が届いたら src をその画像にする（今は城の背景を白く明るくして代用）
      chapter8: { src: 'assets/approved/bg/pano_village_town.png', scale: 1.36, offsetY: 0, parallax: 0.35, focus: 0.5, tint: 'rgba(90,50,160,.35)' }, // 仮：魔法都市の背景（未着）。4ステージ共通
      chapter7: { src: 'assets/approved/bg/ch3_castle_v2.png', scale: 1.22, offsetY: -358, parallax: 0.35, focus: 0.5, tint: 'rgba(255,250,220,.3)' },
      chapter3: { src: 'assets/approved/bg/ch3_castle_v2.png', scale: 1.22, offsetY: -358, parallax: 0.35, focus: 0.5 },
    },
    // 人間軍の拠点（tower：1-1〜1-3、gate：1-4、castle：1-5）と、魔王軍の祠。{ src, width, footY }
    base: {},
    shrine: null,
    // 会話の背景（shrine：祠の中、field：戦場）
    talkBg: {},
  },
  /* 魔法使い（area）の火球（2026-11-25・maougun_mage_fireball_fx.zip）。各1コマ。ax・ay：画像の基準点（manifest.csv）、w：表示の幅（論理ドット）
   *   charge：攻撃の溜めの間、頭上で膨らむ／shot：発射から着弾まで（先端が基準点・約0.16秒）／impact：着弾で足元に広がる低い炎の輪（約0.35秒）
   *   見た目だけ。ダメージの瞬間・射程・範囲・攻撃間隔は units.js のまま */
  mageFire: {
    keys: ['area'],
    charge: { src: 'assets/approved/fx/mage_fireball_charge.png', ax: 124, ay: 142, w: 40 },
    shot: { src: 'assets/approved/fx/mage_fireball_projectile.png', ax: 59, ay: 212, w: 72, life: 0.16, angle: Math.atan2(172, -271) },
    impact: { src: 'assets/approved/fx/mage_fireball_impact.png', ax: 190, ay: 141, w: 110, life: 0.35 },
  },
  /* 弓ゴブリン（ranged）の矢（2026-11-25・maougun_goblin_arrow_fx.zip）。192×48・左向き・矢じり (6,24)。
   *   放物線：x は直線、y は lerp − 4・lift・u(1−u)。lift は距離に合わせる（liftRate × 距離、liftMin〜liftMax）。飛ぶ時間は units.js の flight */
  goblinArrow: {
    keys: ['ranged'],
    src: 'assets/approved/fx/goblin_arrow.png', ax: 6, ay: 24, w: 40,
    liftRate: 0.28, liftMin: 18, liftMax: 62, glow: '#c8ff6a',
  },
  /* 基本6タイプの戦闘エフェクト（2026-11-25・maougun_remaining_unit_fx.zip）。各1コマ。ax・ay：基準点、w：表示の幅、life：秒（見え方の目安）
   *   on：impact＝近接が当たった地点／strike＝攻撃の瞬間（本人の前）／heal＝回復できた仲間の足元／shot＝通常の弾／jackpot・fizzle＝特殊魔法
   *   anim：pop＝弾けて消える／ground＝足元で低く広がる／rise＝上へ薄れる／streak＝前方斜め下に一瞬 */
  unitFx: {
    mass: { impact: { src: 'assets/approved/fx/gummy_splash.png', ax: 96, ay: 110, w: 46, life: 0.16, anim: 'pop' } },
    vanguard: { strike: { src: 'assets/approved/fx/knight_slash.png', ax: 135, ay: 126, w: 58, life: 0.16, anim: 'pop', ahead: 20, up: 30 } },
    tank: { impact: { src: 'assets/approved/fx/rock_impact.png', ax: 128, ay: 103, w: 84, life: 0.26, anim: 'ground' } },
    fast: { strike: { src: 'assets/approved/fx/bat_dive.png', ax: 126, ay: 98, w: 52, life: 0.14, anim: 'streak', ahead: 14, up: 28 }, dip: 6 },
    healer: {
      heal: { src: 'assets/approved/fx/forest_heal.png', ax: 128, ay: 144, w: 62, life: 0.45, anim: 'rise' },
      shot: { src: 'assets/approved/fx/forest_seed.png', ax: 70, ay: 48, w: 30 },
    },
    special: {
      shot: { src: 'assets/approved/fx/imp_magic.png', ax: 79, ay: 57, w: 34 },
      jackpot: { src: 'assets/approved/fx/imp_jackpot.png', ax: 160, ay: 133, w: 96, life: 0.4, anim: 'pop' },
      fizzle: { src: 'assets/approved/fx/imp_fizzle.png', ax: 96, ay: 122, w: 42, life: 0.6, anim: 'rise' },
    },
  },
  /* 木槌小鬼の木槌投げ（2026-11-25・maougun_mallet_throw_fx.zip）。手元からゆるい弧で約1回転し、命中で閃光と木くず・土煙（約0.24秒） */
  malletThrow: {
    keys: ['mallet'],
    shot: { src: 'assets/approved/fx/mallet_projectile.png', ax: 160, ay: 160, w: 34, lift: 34 },
    impact: { src: 'assets/approved/fx/mallet_impact.png', ax: 160, ay: 140, w: 88, life: 0.24 },
  },
  /* 大魔王の呪文の演出（2026-11-25）。祠の上で炎が集まり（charge）→ 不死鳥が左下へ飛び（flight）→ 炎の輪（impact・約0.27秒）。
   * ゲーム内の呪文名は「魔王の呪文」のまま（既存作品の技名は使わない） */
  spellPhoenix: {
    charge: { src: 'assets/approved/fx/phoenix_charge.png', ax: 160, ay: 174, w: 120 },
    flight: { src: 'assets/approved/fx/phoenix_flight.png', ax: 89, ay: 349, w: 190, angle: Math.atan2(349 - 120, 89 - 330) },
    impact: { src: 'assets/approved/fx/phoenix_impact.png', ax: 256, ay: 223, life: 0.27 },
  },
  /* ワニ将軍の大盾突進（2026-11-25・maougun_crocodile_charge_fx.zip）
   *   wind：突進中、盾の前に付いていく青緑の風圧（膨らむ側が進む向き）／dust：足の少し後ろに残る土煙／impact：命中した所の金色の衝撃（盾側の基準点から相手側へ伸びる・約0.2秒） */
  chargeFx: {
    keys: ['charger'],
    wind: { src: 'assets/approved/fx/crocodile_charge_wind.png', ax: 102, ay: 148, h: 120, ahead: 34, life: 0.35 },
    dust: { src: 'assets/approved/fx/crocodile_charge_dust.png', ax: 75, ay: 103, w: 100, behind: 18, life: 0.45 },
    impact: { src: 'assets/approved/fx/crocodile_charge_impact.png', ax: 241, ay: 116, w: 120, life: 0.2 },
  },
  /* 竜人オルド「カミナリスラッシュ」（2026-11-25・maougun_ordo_thunder_slash_fx.zip）
   *   bolt：溜めの最初0.25秒、頭上から落雷（下端をオルドに）／charge：足元から吹き上がる雷のオーラ（発射直前に強まる）／slash：砦まで進む斬撃／hit：通過した敵は小さく、砦は大きく */
  ordThunder: {
    bolt: { src: 'assets/approved/fx/ordo_thunder_bolt.png', ax: 179, ay: 419, h: 170 },
    charge: { src: 'assets/approved/fx/ordo_thunder_charge.png', ax: 192, ay: 374, h: 150 },
    slash: { src: 'assets/approved/fx/ordo_thunder_slash.png', ax: 79, ay: 147, w: 120 },
    hit: { src: 'assets/approved/fx/ordo_thunder_hit.png', ax: 144, ay: 114, w: 44, wBig: 110 },
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
    mallet: ['#c9784a', '#5a2a10'],
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
// 警備隊長（第2章のボス・仮）：専用の絵が届くまで、見習い剣士の絵を1.4倍で使う
if (SKIN.sprites.swordsman && !SKIN.sprites.captain) SKIN.sprites.captain = { ...SKIN.sprites.swordsman, scale: (SKIN.sprites.swordsman.scale || 0.25) * 1.4 };
// 第3章（仮）：王国騎士は盾兵の絵を1.15倍、国王は盾兵の絵を1.45倍（専用の絵が届くまで）
if (SKIN.sprites.shield && !SKIN.sprites.knight) SKIN.sprites.knight = { ...SKIN.sprites.shield, scale: (SKIN.sprites.shield.scale || 0.25) * 1.15 };
// 竜人オルド（仮）：ビジュアル制作室の絵が届くまで、闇の騎士の絵を1.6倍で代用
if (SKIN.sprites.swordsman && !SKIN.sprites.harbor_captain) SKIN.sprites.harbor_captain = { ...SKIN.sprites.swordsman, scale: (SKIN.sprites.swordsman.scale || 0.25) * 1.5 };
// 第5章（仮）：防衛砲台は弓兵の絵、重装兵は盾兵の絵、要塞司令官は見習い剣士の絵を大きくして代用（兵器・重装兵のデザインは未承認）
if (SKIN.sprites.archer && !SKIN.sprites.turret) SKIN.sprites.turret = { ...SKIN.sprites.archer, scale: (SKIN.sprites.archer.scale || 0.25) * 1.2 };
if (SKIN.sprites.shield && !SKIN.sprites.heavy) SKIN.sprites.heavy = { ...SKIN.sprites.shield, scale: (SKIN.sprites.shield.scale || 0.25) * 1.2 };
if (SKIN.sprites.swordsman && !SKIN.sprites.commander) SKIN.sprites.commander = { ...SKIN.sprites.swordsman, scale: (SKIN.sprites.swordsman.scale || 0.25) * 1.5 };
// 第6章（仮）：守護者は盾兵の絵を1.2倍、古代王は盾兵の絵を1.5倍で代用（デザイン未承認）
if (SKIN.sprites.shield && !SKIN.sprites.guardian) SKIN.sprites.guardian = { ...SKIN.sprites.shield, scale: (SKIN.sprites.shield.scale || 0.25) * 1.2 };
if (SKIN.sprites.shield && !SKIN.sprites.ancient_king) SKIN.sprites.ancient_king = { ...SKIN.sprites.shield, scale: (SKIN.sprites.shield.scale || 0.25) * 1.5 };
// 第7章（仮）：聖騎士は見習い剣士の絵を1.2倍、聖騎士団長は見習い僧侶の絵を1.5倍で代用（デザイン未承認）
if (SKIN.sprites.swordsman && !SKIN.sprites.paladin) SKIN.sprites.paladin = { ...SKIN.sprites.swordsman, scale: (SKIN.sprites.swordsman.scale || 0.25) * 1.2 };
for (const [k, mul] of [['mage', 1.0], ['elite_mage', 1.15], ['mage_captain', 1.4], ['archmage', 1.55]]) {
  if (SKIN.sprites.priest && !SKIN.sprites[k]) SKIN.sprites[k] = { ...SKIN.sprites.priest, scale: (SKIN.sprites.priest.scale || 0.25) * mul };
}
if (SKIN.sprites.priest && !SKIN.sprites.holy_captain) SKIN.sprites.holy_captain = { ...SKIN.sprites.priest, scale: (SKIN.sprites.priest.scale || 0.25) * 1.5 };
if (SKIN.sprites.vanguard && !SKIN.sprites.ord) SKIN.sprites.ord = { ...SKIN.sprites.vanguard, scale: (SKIN.sprites.vanguard.scale || 0.25) * 1.6 };
if (SKIN.sprites.shield && !SKIN.sprites.king) SKIN.sprites.king = { ...SKIN.sprites.shield, scale: (SKIN.sprites.shield.scale || 0.25) * 1.45 };
Object.assign(SKIN.portraits, APPROVED.portraits);
Object.assign(SKIN.images.stageBg, APPROVED.images.stageBg);
Object.assign(SKIN.images.base, APPROVED.images.base);
Object.assign(SKIN.images.talkBg, APPROVED.images.talkBg);
if (APPROVED.images.shrine) SKIN.images.shrine = APPROVED.images.shrine;
// エフェクト（{ src, frameW, frameH, frames }）と UI 画像（ファイルのパス）。docs/ASSET_MAP.md
SKIN.fx = { ...(APPROVED.fx || {}) };
SKIN.ui = { ...(APPROVED.ui || {}) };
