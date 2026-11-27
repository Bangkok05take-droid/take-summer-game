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
    // 2026-11-27：最終進化16体（maougun_final_evolutions.zip・manifest の名前）
    mass_3a: 'ギガグミ', mass_3b: 'ポイズングミ', vanguard_3a: '冥獄騎士', vanguard_3b: '吸魂騎士', tank_3a: '黒鋼巨人', tank_3b: '棘晶巨人', ranged_3a: '剛弩ゴブリン', ranged_3b: '爆弩ゴブリン', fast_3a: 'テンペストイーグル', fast_3b: 'サンダーイーグル', area_3a: '獄炎魔導師', area_3b: '氷獄魔導師', healer_3a: '生命樹の精霊', healer_3b: '守護樹の精霊', mallet_3a: '破城槌鬼', mallet_3b: '連槌鬼',
    // 2026-11-25：第2形態の正式名（ユーザー指定）。森のお化け・木槌小鬼はデザイン待ち
    mass_2: 'ハードグミ', vanguard_2: '悪魔の騎士', tank_2: '鋼男', fast_2: 'イーグル', ranged_2: '弩ゴブリン', area_2: '星炎の魔導士', healer_2: '花灯りの精霊', mallet_2: '鉄槌鬼',
    charger: 'ワニ将軍', // 2026-11-25：幹部1体目（ユーザーのデザイン）。内部キーは charger のまま
    elemental: '熔氷の岩魔', reaper: '死神', // 2026-11-26：幹部3体目 // 2026-11-26：幹部2体目（依頼時の名前「氷炎魔人」は既存作品に近いので変更）
    mist: 'ヴェイル', // 2026-11-26：霧の幹部＝大魔王の側近ヴェイル（罠＝死神・落雷＝オルド）
    lord: '大魔王', lordAwakened: '大魔王（真の姿）',
    ord: '竜人オルド', // 2026-11-25（依頼文での呼び方：バラン）
  },
  speakers: {
    lord: '大魔王', aide: 'ヴェイル', narr: '', ord: 'オルド', // aide：影の側近（2026-11-24 命名。既存作品の名前に近い「ミスト」を避けた）
    tiw: 'ティウ', mot: 'モッ', waan: 'ワーン', koi: 'コイ', take: '勇者たけ', sai: '勇者サイ', yanai: 'マスター・ヤナイ',
  },
  // エンディングのムービー（保留中・2026-11-25）。{ src: 'assets/approved/movie/…mp4', replaces: ['lines'] } を入れると、その段の代わりに動画を流す
  movies: { ending: null },
  sprites: {
    // 2026-11-27：最終進化16体（maougun_final_evolutions.zip・透過・左向き・静止画）。倍率は下の SIZE_CLASS から自動
    mass_3a: { src: 'assets/approved/units/mass_3a.png', frameW: 1536, frameH: 1024, frames: { walk: [0], windup: 0, attack: 0 }, footY: 898, facing: 'left', scale: 0.05 },
    mass_3b: { src: 'assets/approved/units/mass_3b.png', frameW: 1536, frameH: 1024, frames: { walk: [0], windup: 0, attack: 0 }, footY: 898, facing: 'left', scale: 0.05 },
    vanguard_3a: { src: 'assets/approved/units/vanguard_3a.png', frameW: 1295, frameH: 1215, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1143, facing: 'left', scale: 0.05 },
    vanguard_3b: { src: 'assets/approved/units/vanguard_3b.png', frameW: 1295, frameH: 1215, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1143, facing: 'left', scale: 0.05 },
    tank_3a: { src: 'assets/approved/units/tank_3a.png', frameW: 1312, frameH: 1199, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1116, facing: 'left', scale: 0.05 },
    tank_3b: { src: 'assets/approved/units/tank_3b.png', frameW: 1312, frameH: 1199, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1116, facing: 'left', scale: 0.05 },
    ranged_3a: { src: 'assets/approved/units/ranged_3a.png', frameW: 1254, frameH: 1254, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1182, facing: 'left', scale: 0.05 },
    ranged_3b: { src: 'assets/approved/units/ranged_3b.png', frameW: 1254, frameH: 1254, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1182, facing: 'left', scale: 0.05 },
    fast_3a: { src: 'assets/approved/units/fast_3a.png', frameW: 1536, frameH: 1024, frames: { walk: [0], windup: 0, attack: 0 }, footY: 884, facing: 'left', scale: 0.05, hover: 25 },
    fast_3b: { src: 'assets/approved/units/fast_3b.png', frameW: 1536, frameH: 1024, frames: { walk: [0], windup: 0, attack: 0 }, footY: 970, facing: 'left', scale: 0.05, hover: 25 },
    area_3a: { src: 'assets/approved/units/area_3a.png', frameW: 1312, frameH: 1199, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1127, facing: 'left', scale: 0.05 },
    area_3b: { src: 'assets/approved/units/area_3b.png', frameW: 1312, frameH: 1199, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1127, facing: 'left', scale: 0.05 },
    healer_3a: { src: 'assets/approved/units/healer_3a.png', frameW: 1254, frameH: 1254, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1207, facing: 'left', scale: 0.05 },
    healer_3b: { src: 'assets/approved/units/healer_3b.png', frameW: 1254, frameH: 1254, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1206, facing: 'left', scale: 0.05 },
    mallet_3a: { src: 'assets/approved/units/mallet_3a.png', frameW: 1312, frameH: 1199, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1176, facing: 'left', scale: 0.05 },
    mallet_3b: { src: 'assets/approved/units/mallet_3b.png', frameW: 1312, frameH: 1199, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1177, facing: 'left', scale: 0.05 },
    // 2026-11-26：ヴェイル（霧の幹部・11618.png・1199×1312・透過）。顔が左を向いているので左向き
    mist: { src: 'assets/approved/units/mist.png', frameW: 1199, frameH: 1312, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1261, facing: 'left', scale: 0.1 },
    // 2026-11-26：死神（1000021155.png・1214×1295・透過・左向き）
    reaper: { src: 'assets/approved/units/reaper.png', frameW: 1214, frameH: 1295, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1266, facing: 'left', scale: 0.1, hover: 8 },
    // 2026-11-26：熔氷の岩魔（11594.png・1254×1254・透過・左向き）
    elemental: { src: 'assets/approved/units/elemental.png', frameW: 1254, frameH: 1254, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1200, facing: 'left', scale: 0.1 },
    // 2026-11-25：進化形（第2形態）鉄槌鬼・花灯りの精霊（ユーザー納品・透過・左向き）
    mallet_2: { src: 'assets/approved/units/mallet_2.png', frameW: 1312, frameH: 1199, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1177, facing: 'left', scale: 0.0538 },
    healer_2: { src: 'assets/approved/units/healer_2.png', frameW: 1254, frameH: 1254, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1207, facing: 'left', scale: 0.0495 },
    // 2026-11-25：進化形（第2形態）6体（ユーザー納品・透過PNG・左向き・静止画）。表示は基本形の約1.12倍の背の高さ
    mass_2: { src: 'assets/approved/units/mass_2.png', frameW: 1536, frameH: 1024, frames: { walk: [0], windup: 0, attack: 0 }, footY: 899, facing: 'left', scale: 0.0528 },
    vanguard_2: { src: 'assets/approved/units/vanguard_2.png', frameW: 1295, frameH: 1215, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1144, facing: 'left', scale: 0.0593 },
    tank_2: { src: 'assets/approved/units/tank_2.png', frameW: 1312, frameH: 1199, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1117, facing: 'left', scale: 0.0768 },
    fast_2: { src: 'assets/approved/units/fast_2.png', frameW: 1536, frameH: 1024, frames: { walk: [0], windup: 0, attack: 0 }, footY: 958, facing: 'left', scale: 0.0685, hover: 25 },
    ranged_2: { src: 'assets/approved/units/ranged_2.png', frameW: 1254, frameH: 1254, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1183, facing: 'left', scale: 0.0529 },
    area_2: { src: 'assets/approved/units/area_2.png', frameW: 1312, frameH: 1199, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1128, facing: 'left', scale: 0.0669 },
    // 2026-11-25：追加6体（batch04）。承認済みの一覧画像 11550.png から Claude Code が背景を抜いて1体ずつに分け、256／384 の枠に収めた（描き直しなし）。倍率は batch03 と同じ
    heavy_captain: { src: 'assets/approved/humans/heavy_commander.png', frameW: 384, frameH: 384, frames: { walk: [0], windup: 0, attack: 0 }, footY: 367, facing: 'right', scale: 0.23 },
    elite_mage: { src: 'assets/approved/humans/elite_mage.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 239, facing: 'right', scale: 0.25 },
    mage_captain: { src: 'assets/approved/humans/mage_commander.png', frameW: 384, frameH: 384, frames: { walk: [0], windup: 0, attack: 0 }, footY: 367, facing: 'right', scale: 0.2 }, // 一覧画像での大きさに合わせて調整
    royal_commander: { src: 'assets/approved/humans/royal_commander.png', frameW: 384, frameH: 384, frames: { walk: [0], windup: 0, attack: 0 }, footY: 367, facing: 'right', scale: 0.265 }, // 一覧画像での大きさに合わせて調整
    sky_commander: { src: 'assets/approved/humans/celestial_commander.png', frameW: 384, frameH: 384, frames: { walk: [0], windup: 0, attack: 0 }, footY: 367, facing: 'right', scale: 0.28 }, // 一覧画像での大きさに合わせて調整
    sky_guardian: { src: 'assets/approved/humans/celestial_guardian.png', frameW: 384, frameH: 384, frames: { walk: [0], windup: 0, attack: 0 }, footY: 367, facing: 'right', scale: 0.25 }, // 一覧画像での大きさに合わせて調整
    // 2026-11-25：素材 batch03（ビジュアル制作室・maougun_assets_batch03.zip・manifest.csv）。26体の個別透過PNG・右向き・静止画1コマ。絵は変更なし
    // 倍率：通常兵 256×256 は基本の兵士と同じ 0.25／ボス 384×384 は 0.23（兵士の約1.4倍）／勇者 0.245（約1.5倍）／聖竜は manifest どおりボスの1.65倍（0.38）
    naval_soldier: { src: 'assets/approved/humans/naval_soldier.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 239, facing: 'right', scale: 0.25 },
    harbor_captain: { src: 'assets/approved/humans/port_commander.png', frameW: 384, frameH: 384, frames: { walk: [0], windup: 0, attack: 0 }, footY: 367, facing: 'right', scale: 0.23 },
    heavy: { src: 'assets/approved/humans/heavy_infantry.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 239, facing: 'right', scale: 0.25 },
    engineer: { src: 'assets/approved/humans/engineer.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 240, facing: 'right', scale: 0.25 },
    turret: { src: 'assets/approved/humans/mobile_cannon.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 239, facing: 'right', scale: 0.25 },
    commander: { src: 'assets/approved/humans/fortress_commander.png', frameW: 384, frameH: 384, frames: { walk: [0], windup: 0, attack: 0 }, footY: 367, facing: 'right', scale: 0.23 },
    ancient_soldier: { src: 'assets/approved/humans/ancient_soldier.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 239, facing: 'right', scale: 0.25 },
    guardian: { src: 'assets/approved/humans/ancient_guardian.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 240, facing: 'right', scale: 0.25 },
    ancient_priest: { src: 'assets/approved/humans/ancient_priest.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 239, facing: 'right', scale: 0.25 },
    ancient_king: { src: 'assets/approved/humans/ancient_king.png', frameW: 384, frameH: 384, frames: { walk: [0], windup: 0, attack: 0 }, footY: 367, facing: 'right', scale: 0.23 },
    paladin: { src: 'assets/approved/humans/holy_knight.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 239, facing: 'right', scale: 0.25 },
    high_priest: { src: 'assets/approved/humans/high_priest.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 240, facing: 'right', scale: 0.25 },
    holy_captain: { src: 'assets/approved/humans/holy_knight_commander.png', frameW: 384, frameH: 384, frames: { walk: [0], windup: 0, attack: 0 }, footY: 367, facing: 'right', scale: 0.23 },
    mage: { src: 'assets/approved/humans/fire_mage.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 239, facing: 'right', scale: 0.25 },
    ice_mage: { src: 'assets/approved/humans/ice_mage.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 239, facing: 'right', scale: 0.25 },
    magic_knight: { src: 'assets/approved/humans/magic_knight.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 239, facing: 'right', scale: 0.25 },
    archmage: { src: 'assets/approved/humans/archmage.png', frameW: 384, frameH: 384, frames: { walk: [0], windup: 0, attack: 0 }, footY: 367, facing: 'right', scale: 0.23 },
    royal_guard: { src: 'assets/approved/humans/royal_guard.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 239, facing: 'right', scale: 0.25 },
    royal_guard_cavalry: { src: 'assets/approved/humans/royal_guard_cavalry.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 240, facing: 'right', scale: 0.25 },
    supreme_commander: { src: 'assets/approved/humans/supreme_commander.png', frameW: 384, frameH: 384, frames: { walk: [0], windup: 0, attack: 0 }, footY: 367, facing: 'right', scale: 0.23 },
    sky_guard: { src: 'assets/approved/humans/celestial_soldier.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 240, facing: 'right', scale: 0.25 },
    celestial_mage: { src: 'assets/approved/humans/celestial_mage.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 240, facing: 'right', scale: 0.25 },
    celestial_knight: { src: 'assets/approved/humans/celestial_knight.png', frameW: 256, frameH: 256, frames: { walk: [0], windup: 0, attack: 0 }, footY: 240, facing: 'right', scale: 0.25 },
    holy_dragon: { src: 'assets/approved/humans/holy_dragon.png', frameW: 384, frameH: 384, frames: { walk: [0], windup: 0, attack: 0 }, footY: 368, facing: 'right', scale: 0.46 }, // 大型ボス：ボスの2倍
    take: { src: 'assets/approved/humans/hero_take.png', frameW: 384, frameH: 384, frames: { walk: [0], windup: 0, attack: 0 }, footY: 368, facing: 'right', scale: 0.245 },
    sai: { src: 'assets/approved/humans/hero_sai.png', frameW: 384, frameH: 384, frames: { walk: [0], windup: 0, attack: 0 }, footY: 368, facing: 'right', scale: 0.245 },
    // 2026-11-25：マスター・ヤナイ（承認済みデザイン・個別の透過画像 1254×1254・右向き。PNGに保存しただけで絵は変更なし）。最終ボスなので兵士の約1.6倍
    yanai: { src: 'assets/approved/humans/master_yanai.png', frameW: 1254, frameH: 1254, frames: { walk: [0], windup: 0, attack: 0 }, footY: 1202, facing: 'right', scale: 0.105 },
    // 2026-11-25：第1〜3章の追加キャラクター（ビジュアル制作室・11528.png の5体を1体ずつに切り出し。絵は変更なし）。右向き。足元は不透明部分の下端
    militia_captain: { src: 'assets/approved/humans/militia_captain.png', frameW: 468, frameH: 544, frames: { walk: [0], windup: 0, attack: 0 }, footY: 538, facing: 'right', scale: 0.152 },
    captain: { src: 'assets/approved/humans/guard_captain.png', frameW: 483, frameH: 650, frames: { walk: [0], windup: 0, attack: 0 }, footY: 643, facing: 'right', scale: 0.14 },
    knight: { src: 'assets/approved/humans/royal_knight.png', frameW: 379, frameH: 519, frames: { walk: [0], windup: 0, attack: 0 }, footY: 513, facing: 'right', scale: 0.122 },
    court_mage: { src: 'assets/approved/humans/court_mage.png', frameW: 375, frameH: 555, frames: { walk: [0], windup: 0, attack: 0 }, footY: 549, facing: 'right', scale: 0.114 },
    knight_commander: { src: 'assets/approved/humans/royal_knight_commander.png', frameW: 591, frameH: 594, frames: { walk: [0], windup: 0, attack: 0 }, footY: 587, facing: 'right', scale: 0.143 },
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
    // 2026-11-26：大魔王（封印で弱った「おじいちゃん大魔王」・オリジナルデザイン・lord_expressions.zip・512×512）。
    //   前の大魔王の絵は既存作品に似ていたため差し替え（古い画像は削除。ブラウザに残った古い画像が出ないようファイル名も変えた）
    lord_normal: 'assets/approved/talk/lord2_normal.png',
    lord_happy: 'assets/approved/talk/lord2_happy.png',
    lord_angry: 'assets/approved/talk/lord2_angry.png',
    lord_sad: 'assets/approved/talk/lord2_sad.png',
    lord_surprised: 'assets/approved/talk/lord2_surprised.png',
    ord_normal: 'assets/approved/talk/ord_normal.png', // 竜人オルドの会話の顔（同じZIP・戦闘素材から胸元まで切り出し・左向き）
    lord_revived: 'assets/approved/talk/lord_revived.png', // 2026-11-25：完全復活後の大魔王（11551.png・全身。正方形の透明な余白を足しただけ）。エンディングの復活の場面から使う
    aide_normal: 'assets/approved/talk/aide_normal.png',
  },
  /* 画面の各場所に入れる承認済み画像（場所と仕様の一覧：docs/ASSET_MAP.md）。
   * 未登録・読み込み失敗のときは、今の仮の表示に戻る。見た目は変えず、拡大縮小と位置だけ指定する。 */
  images: {
    // 最終章解放演出の背景（承認済み天空背景・2026-11-25 到着）。文字が読めるよう少し暗くして表示
    finalBg: 'assets/approved/bg/ch10_sky.png', // 2026-11-25：承認済み天空背景
    // エンディングの「世界征服達成」画面の背景（未定・null のあいだは夜空のグラデーション）
    endingBg: null,
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
      chapter5: { src: 'assets/approved/bg/ch5_fortress.png', scale: 0.95, offsetY: -147, parallax: 0.35, focus: 0.5 }, // 2026-11-25：鉄鋼の要塞都市の本番背景（2172×724・道の上端 y≈552）。4ステージ共通
      chapter6: { src: 'assets/approved/bg/ch6_desert.png', scale: 0.85, offsetY: -75, parallax: 0.35, focus: 0.5 }, // 2026-11-25：砂漠の古代王国の本番背景（2172×724・道の上端 y≈532）。3ステージ共通
      chapter10: { src: 'assets/approved/bg/ch10_sky.png', scale: 0.95, offsetY: -144, parallax: 0.35, focus: 0.5 }, // 2026-11-25：天空・勇者の聖域の本番背景（2172×724・床の上端 y≈548）。5ステージ共通
      chapter9: { src: 'assets/approved/bg/ch9_capital.png', scale: 0.85, offsetY: -75, parallax: 0.35, focus: 0.5 }, // 2026-11-25：人間界の王都の本番背景（2172×724・道の上端 y≈533）。4ステージ共通
      chapter8: { src: 'assets/approved/bg/ch8_magic.png', scale: 0.85, offsetY: -75, parallax: 0.35, focus: 0.5 }, // 2026-11-25：魔法都市の本番背景（2172×724・道の上端 y≈533）。4ステージ共通
      chapter7: { src: 'assets/approved/bg/ch7_holy.png', scale: 0.95, offsetY: -147, parallax: 0.35, focus: 0.5 }, // 2026-11-25：聖なる都の本番背景（2172×724・道の上端 y≈553）。2ステージ共通
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
// 第10章の追加（2026-11-25）：個別の透過PNGが届くまでの代用
if (SKIN.sprites.priest && !SKIN.sprites.celestial_mage) SKIN.sprites.celestial_mage = { ...SKIN.sprites.priest };
if (SKIN.sprites.shield && !SKIN.sprites.celestial_knight) SKIN.sprites.celestial_knight = { ...SKIN.sprites.shield, scale: (SKIN.sprites.shield.scale || 0.25) * 1.25 };
// 第8〜9章の追加（2026-11-25）：個別の透過PNGが届くまでの代用
if (SKIN.sprites.priest && !SKIN.sprites.ice_mage) SKIN.sprites.ice_mage = { ...SKIN.sprites.priest };
if (SKIN.sprites.swordsman && !SKIN.sprites.magic_knight) SKIN.sprites.magic_knight = { ...SKIN.sprites.swordsman, scale: (SKIN.sprites.swordsman.scale || 0.25) * 1.05 };
if (SKIN.sprites.shield && !SKIN.sprites.royal_guard) SKIN.sprites.royal_guard = { ...SKIN.sprites.shield, scale: (SKIN.sprites.shield.scale || 0.25) * 1.05 };
if (SKIN.sprites.rider && !SKIN.sprites.royal_guard_cavalry) SKIN.sprites.royal_guard_cavalry = { ...SKIN.sprites.rider, scale: (SKIN.sprites.rider.scale || 0.25) * 1.15 };
// 第6〜7章の追加（2026-11-25）：個別の透過PNGが届くまでの代用
if (SKIN.sprites.swordsman && !SKIN.sprites.ancient_soldier) SKIN.sprites.ancient_soldier = { ...SKIN.sprites.swordsman };
if (SKIN.sprites.priest && !SKIN.sprites.ancient_priest) SKIN.sprites.ancient_priest = { ...SKIN.sprites.priest };
if (SKIN.sprites.priest && !SKIN.sprites.high_priest) SKIN.sprites.high_priest = { ...SKIN.sprites.priest, scale: (SKIN.sprites.priest.scale || 0.25) * 1.1 };
// 第4〜5章の追加（2026-11-25）：個別の透過PNGが届くまでの代用
if (SKIN.sprites.swordsman && !SKIN.sprites.naval_soldier) SKIN.sprites.naval_soldier = { ...SKIN.sprites.swordsman };
if (SKIN.sprites.archer && !SKIN.sprites.engineer) SKIN.sprites.engineer = { ...SKIN.sprites.archer, scale: (SKIN.sprites.archer.scale || 0.25) * 1.05 };
if (SKIN.sprites.archer && !SKIN.sprites.turret) SKIN.sprites.turret = { ...SKIN.sprites.archer, scale: (SKIN.sprites.archer.scale || 0.25) * 1.2 };
if (SKIN.sprites.shield && !SKIN.sprites.heavy) SKIN.sprites.heavy = { ...SKIN.sprites.shield, scale: (SKIN.sprites.shield.scale || 0.25) * 1.2 };
if (SKIN.sprites.heavy && !SKIN.sprites.heavy_captain) SKIN.sprites.heavy_captain = { ...SKIN.sprites.heavy, scale: SKIN.sprites.heavy.scale * 1.3 }; // 重装兵団長：重装兵の強化個体（暫定）
if (SKIN.sprites.swordsman && !SKIN.sprites.commander) SKIN.sprites.commander = { ...SKIN.sprites.swordsman, scale: (SKIN.sprites.swordsman.scale || 0.25) * 1.5 };
// 第6章（仮）：守護者は盾兵の絵を1.2倍、古代王は盾兵の絵を1.5倍で代用（デザイン未承認）
if (SKIN.sprites.shield && !SKIN.sprites.guardian) SKIN.sprites.guardian = { ...SKIN.sprites.shield, scale: (SKIN.sprites.shield.scale || 0.25) * 1.2 };
if (SKIN.sprites.shield && !SKIN.sprites.ancient_king) SKIN.sprites.ancient_king = { ...SKIN.sprites.shield, scale: (SKIN.sprites.shield.scale || 0.25) * 1.5 };
// 第7章（仮）：聖騎士は見習い剣士の絵を1.2倍、聖騎士団長は見習い僧侶の絵を1.5倍で代用（デザイン未承認）
if (SKIN.sprites.swordsman && !SKIN.sprites.paladin) SKIN.sprites.paladin = { ...SKIN.sprites.swordsman, scale: (SKIN.sprites.swordsman.scale || 0.25) * 1.2 };
for (const [k, mul] of [['mage', 1.0], ['elite_mage', 1.15], ['mage_captain', 1.4], ['archmage', 1.55]]) {
  if (SKIN.sprites.priest && !SKIN.sprites[k]) SKIN.sprites[k] = { ...SKIN.sprites.priest, scale: (SKIN.sprites.priest.scale || 0.25) * mul };
}
for (const [k, mul] of [['royal_commander', 1.45], ['supreme_commander', 1.6]]) {
  if (SKIN.sprites.swordsman && !SKIN.sprites[k]) SKIN.sprites[k] = { ...SKIN.sprites.swordsman, scale: (SKIN.sprites.swordsman.scale || 0.25) * mul };
}
// 第10章（仮）：天空の兵・聖竜・勇者たちのデザインは未承認のため、既存の兵士の絵を大きくして代用
for (const [k, base, mul] of [['sky_guard', 'shield', 1.1], ['sky_commander', 'shield', 1.5], ['sky_guardian', 'shield', 1.55], ['holy_dragon', 'shield', 2.0], ['take', 'swordsman', 1.35], ['sai', 'priest', 1.3], ['yanai', 'swordsman', 1.6]]) {
  if (SKIN.sprites[base] && !SKIN.sprites[k]) SKIN.sprites[k] = { ...SKIN.sprites[base], scale: (SKIN.sprites[base].scale || 0.25) * mul };
}
if (SKIN.sprites.priest && !SKIN.sprites.holy_captain) SKIN.sprites.holy_captain = { ...SKIN.sprites.priest, scale: (SKIN.sprites.priest.scale || 0.25) * 1.5 };
if (SKIN.sprites.vanguard && !SKIN.sprites.ord) SKIN.sprites.ord = { ...SKIN.sprites.vanguard, scale: (SKIN.sprites.vanguard.scale || 0.25) * 1.6 };
if (SKIN.sprites.shield && !SKIN.sprites.king) SKIN.sprites.king = { ...SKIN.sprites.shield, scale: (SKIN.sprites.shield.scale || 0.25) * 1.45 };
Object.assign(SKIN.portraits, APPROVED.portraits);
// 竜人オルドは会話の顔が未着のため、戦闘の絵（全身・左向き）を会話でも使う（右側に置くので大魔王のほうを向く）
if (!SKIN.portraits.ord_normal) SKIN.portraits.ord_normal = 'assets/approved/units/ord.png'; // ↑会話の顔が届いたので通常は使われない
// 2026-11-25：会話の顔（maougun_dialogue_portraits.zip・portrait_registry.json そのまま。512×512・通常の表情のみ・右向き）
Object.assign(SKIN.portraits, {
  "yanai_normal": "assets/approved/talk/yanai_normal.png",
  "マスター・ヤナイ_normal": "assets/approved/talk/yanai_normal.png",
  "たけ_normal": "assets/approved/talk/take_normal.png",
  "take_normal": "assets/approved/talk/take_normal.png",
  "サイ_normal": "assets/approved/talk/sai_normal.png",
  "sai_normal": "assets/approved/talk/sai_normal.png",
  "聖竜_normal": "assets/approved/talk/holy_dragon_normal.png",
  "holy_dragon_normal": "assets/approved/talk/holy_dragon_normal.png",
  "古代王_normal": "assets/approved/talk/ancient_king_normal.png",
  "ancient_king_normal": "assets/approved/talk/ancient_king_normal.png",
  "自警団長_normal": "assets/approved/talk/militia_captain_normal.png",
  "militia_captain_normal": "assets/approved/talk/militia_captain_normal.png",
  "警備隊長_normal": "assets/approved/talk/captain_normal.png",
  "captain_normal": "assets/approved/talk/captain_normal.png",
  "王国軍_normal": "assets/approved/talk/knight_commander_normal.png",
  "knight_commander_normal": "assets/approved/talk/knight_commander_normal.png",
  "港の守備隊長_normal": "assets/approved/talk/harbor_captain_normal.png",
  "harbor_captain_normal": "assets/approved/talk/harbor_captain_normal.png",
  "重装兵団長_normal": "assets/approved/talk/heavy_captain_normal.png",
  "heavy_captain_normal": "assets/approved/talk/heavy_captain_normal.png",
  "要塞司令官_normal": "assets/approved/talk/commander_normal.png",
  "commander_normal": "assets/approved/talk/commander_normal.png",
  "聖騎士団長_normal": "assets/approved/talk/holy_captain_normal.png",
  "holy_captain_normal": "assets/approved/talk/holy_captain_normal.png",
  "魔導士団長_normal": "assets/approved/talk/mage_captain_normal.png",
  "mage_captain_normal": "assets/approved/talk/mage_captain_normal.png",
  "大魔導士_normal": "assets/approved/talk/archmage_normal.png",
  "archmage_normal": "assets/approved/talk/archmage_normal.png",
  "王国軍指揮官_normal": "assets/approved/talk/royal_commander_normal.png",
  "royal_commander_normal": "assets/approved/talk/royal_commander_normal.png",
  "人間軍総司令官_normal": "assets/approved/talk/supreme_commander_normal.png",
  "supreme_commander_normal": "assets/approved/talk/supreme_commander_normal.png",
  "天空の指揮官_normal": "assets/approved/talk/sky_commander_normal.png",
  "sky_commander_normal": "assets/approved/talk/sky_commander_normal.png",
  "天空の守護者_normal": "assets/approved/talk/sky_guardian_normal.png",
  "sky_guardian_normal": "assets/approved/talk/sky_guardian_normal.png",
  "tiw_normal": "assets/approved/talk/tiw_normal.png",
  "mot_normal": "assets/approved/talk/mot_normal.png",
  "自警団_normal": "assets/approved/talk/militia_normal.png",
  "militia_normal": "assets/approved/talk/militia_normal.png",
  "門番_normal": "assets/approved/talk/shield_normal.png",
  "shield_normal": "assets/approved/talk/shield_normal.png",
  "守備兵_normal": "assets/approved/talk/shield_normal.png",
  "王国兵_normal": "assets/approved/talk/swordsman_normal.png",
  "swordsman_normal": "assets/approved/talk/swordsman_normal.png",
  "王国騎士_normal": "assets/approved/talk/knight_normal.png",
  "knight_normal": "assets/approved/talk/knight_normal.png",
  "港の警備兵_normal": "assets/approved/talk/naval_soldier_normal.png",
  "naval_soldier_normal": "assets/approved/talk/naval_soldier_normal.png",
  "人間軍兵士_normal": "assets/approved/talk/swordsman_normal.png",
  "人間軍技師_normal": "assets/approved/talk/engineer_normal.png",
  "engineer_normal": "assets/approved/talk/engineer_normal.png",
  "聖騎士_normal": "assets/approved/talk/paladin_normal.png",
  "paladin_normal": "assets/approved/talk/paladin_normal.png",
  "人間軍魔法使い_normal": "assets/approved/talk/mage_normal.png",
  "mage_normal": "assets/approved/talk/mage_normal.png",
  "人間軍指揮官_normal": "assets/approved/talk/royal_commander_normal.png",
  "天空の守護兵_normal": "assets/approved/talk/sky_guard_normal.png",
  "sky_guard_normal": "assets/approved/talk/sky_guard_normal.png"
});
Object.assign(SKIN.images.stageBg, APPROVED.images.stageBg);
Object.assign(SKIN.images.base, APPROVED.images.base);
Object.assign(SKIN.images.talkBg, APPROVED.images.talkBg);
// 2026-11-25：大魔王とヴェイルの会話シーン（封印の祠）の背景（ユーザー指定・11462.png・1920×1080）
if (!SKIN.images.talkBg.shrine) SKIN.images.talkBg.shrine = 'assets/approved/talk/bg_shrine.png';
if (APPROVED.images.shrine) SKIN.images.shrine = APPROVED.images.shrine;
// エフェクト（{ src, frameW, frameH, frames }）と UI 画像（ファイルのパス）。docs/ASSET_MAP.md
SKIN.fx = { ...(APPROVED.fx || {}) };
SKIN.ui = { ...(APPROVED.ui || {}) };

/* ---------- 表示サイズの統一（2026-11-25 ユーザー依頼：大中小＋特大） ----------
 * 画面での背の高さ（論理ドット・画面は 960×540）。絵の倍率はここから自動で決める（絵そのものは変えない）。
 *   ミニ XS＝グミ・こうもり／小 S＝小さな魔物／中 M＝ふつうの兵・前衛／大 L＝重装・騎兵・大型の魔物／特大 XL＝ボス・幹部（数字はその都度）
 * 進化形は基本形と同じ分類で ×1.12。サイズを変えるときは SIZE_PX か SIZE_CLASS を直す */
export const SIZE_PX = { XS: 44, S: 64, M: 80, L: 100, XL: 110 }; // 2026-11-26：ボス 118 → 110 // XS＝ミニ（2026-11-26：グミ・こうもり）
export const SIZE_CLASS = {
  // 魔王軍
  mass: ['XS', 0.9], fast: 'XS', ranged: 'S', mallet: 'S', healer: 'S', vanguard: 'M', area: 'M', tank: 'L',
  charger: ['XL', 125], ord: ['XL', 132], elemental: ['XL', 125], reaper: ['XL', 120], mist: ['XL', 120],
  // 人間軍：中（2026-11-26：村人・弓兵・僧侶・魔導士系・神官系・兵器技師も小 → 中）
  militia: 'M', archer: 'M', priest: 'M', court_mage: 'M', mage: 'M', ice_mage: 'M', elite_mage: 'M', ancient_priest: 'M', high_priest: 'M', celestial_mage: 'M', engineer: 'M',
  // 人間軍：中
  swordsman: 'M', shield: 'M', rider: 'M', knight: 'M', naval_soldier: 'M', ancient_soldier: 'M', paladin: 'M', magic_knight: 'M', royal_guard: 'M', sky_guard: 'M',
  // 人間軍：大
  heavy: 'L', guardian: 'L', turret: 'L', royal_guard_cavalry: 'L', celestial_knight: 'L',
  // ボス（特大）
  militia_captain: 'XL', captain: 'XL', king: 'XL', knight_commander: 'XL', harbor_captain: 'XL', commander: 'XL', heavy_captain: 'XL', ancient_king: 'XL',
  holy_captain: 'XL', mage_captain: 'XL', archmage: 'XL', royal_commander: 'XL', supreme_commander: 'XL', sky_commander: 'XL', sky_guardian: 'XL',
  take: 'XL', sai: 'XL', yanai: 'XL', holy_dragon: ['XL', 150], // 2026-11-26：たけ・サイ・ヤナイもボスと同じ 110
};
// 各画像の「絵の上端」（不透明部分の一番上・画像の上からの距離。Claude Code が画像から計測）
const INK_TOP = {"mass_3a": 73, "mass_3b": 19, "vanguard_3a": 16, "vanguard_3b": 16, "tank_3a": 13, "tank_3b": 13, "ranged_3a": 138, "ranged_3b": 16, "fast_3a": 13, "fast_3b": 13, "area_3a": 13, "area_3b": 17, "healer_3a": 13, "healer_3b": 52, "mallet_3a": 13, "mallet_3b": 13, "mist": 72, "reaper": 31, "elemental": 25, "mallet_2": 68, "healer_2": 38, "mass_2": 121, "vanguard_2": 58, "tank_2": 50, "fast_2": 67, "ranged_2": 90, "area_2": 69, "heavy_captain": 16, "elite_mage": 15, "mage_captain": 16, "royal_commander": 15, "sky_commander": 16, "sky_guardian": 15, "naval_soldier": 15, "harbor_captain": 15, "heavy": 15, "engineer": 58, "turret": 15, "commander": 29, "ancient_soldier": 15, "guardian": 14, "ancient_priest": 15, "ancient_king": 15, "paladin": 15, "high_priest": 14, "holy_captain": 15, "mage": 15, "ice_mage": 15, "magic_knight": 15, "archmage": 15, "royal_guard": 15, "royal_guard_cavalry": 15, "supreme_commander": 25, "sky_guard": 15, "celestial_mage": 15, "celestial_knight": 15, "holy_dragon": 165, "take": 14, "sai": 14, "yanai": 69, "militia_captain": 7, "captain": 7, "knight": 7, "court_mage": 7, "knight_commander": 6, "ord": 9, "charger": 66, "mallet": 21, "area": 64, "fast": 76, "mass": 241, "vanguard": 10, "tank": 48, "ranged": 49, "healer": 47, "archer": 8, "militia": 8, "priest": 8, "rider": 9, "shield": 8, "swordsman": 8, "king": 8};
export function displayHeight(key) {
  const m = /_(2|3a|3b)$/.exec(key); const evolved = !!m; const base = m ? key.slice(0, -m[0].length) : key;
  if (key === 'mass_3a') return SIZE_PX.L * 0.75; // ギガグミ：大（横に広い形なので背は低め）
  const c = SIZE_CLASS[base]; if (!c) return null;
  const [cls, v] = Array.isArray(c) ? c : [c];
  const h = cls === 'XL' && v ? v : SIZE_PX[cls] * (v && cls !== 'XL' ? v : 1);
  return !m ? h : m[1] === '2' ? h * 1.12 : h * 1.25; // 第2形態 ×1.12・第3形態 ×1.25
}
for (const [k, sp] of Object.entries(SKIN.sprites)) {
  const h = displayHeight(k); if (!h || INK_TOP[k] == null) continue;
  sp.scale = Math.round(h / Math.max(1, sp.footY - INK_TOP[k]) * 10000) / 10000;
}

// 拠点（人間軍の拠点・魔王軍の祠）の表示倍率（2026-11-26：キャラクターを大きくしたのに合わせて大きく）
export const BASE_SCALE = 1.4;
SKIN.images.baseScale = BASE_SCALE;
SKIN.images.pixelBaseScale = 1.1; // 承認済みの絵が無い拠点（第2章以降の門・城の仮のドット絵）
