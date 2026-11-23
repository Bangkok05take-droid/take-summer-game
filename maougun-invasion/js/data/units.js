/* 魔王軍のユニット（調整用の数値）
 *
 * - キー（mass・vanguard…）は「役割の枠」。セーブ・ステージ・編成はこのキーで参照する。
 * - 表示名・アイコン・絵は js/data/skin.js（ここには書かない）。
 * - 数値はすべて仮。単位：HP・攻撃＝そのまま、射程・移動＝論理ドット（画面幅960）、時間＝秒。
 *
 * 項目
 *   cost 召喚の魔力 / cooldown 再召喚までの秒 / hp / atk / range 射程（自分の前方）/ speed 移動（ドット/秒）
 *   interval 攻撃1回の長さ（準備＋発動＋戻り）/ windup 攻撃が当たるまでの秒 / kb ノックバック回数
 *   attack 'single'（いちばん近い1体）| 'area'（射程内の全員）
 *   projectile 見た目だけの飛び道具（当たりは windup の時点で決まる）
 *   heal 回復 { every 秒ごと, ratio 最大HPの割合, radius 届く距離 }
 *   flying 飛行（将来：地面の罠にかからない）
 *   size 描画の大きさ（1 = 標準）
 *   tier 段階（1 = 基本形）/ evolvesTo 進化先のキー（将来）/ growth レベル1ごとの上昇率
 */

const GROWTH = { hp: 0.2, atk: 0.2 }; // 将来の育成：レベル1ごとに +20%（試作では使わない）

export const UNITS = {
  mass: {
    role: '量産型', tier: 1, evolvesTo: null, growth: GROWTH,
    cost: 75, cooldown: 2.5, hp: 130, atk: 12, range: 28, speed: 46,
    interval: 1.2, windup: 0.35, kb: 3, attack: 'single', size: 0.8,
  },
  vanguard: {
    role: '前衛', tier: 1, evolvesTo: null, growth: GROWTH,
    cost: 300, cooldown: 9, hp: 1100, atk: 85, range: 42, speed: 34,
    interval: 2.0, windup: 0.6, kb: 3, attack: 'single', size: 1.05,
  },
  tank: {
    role: '高HPタンク', tier: 1, evolvesTo: null, growth: GROWTH,
    cost: 240, cooldown: 12, hp: 2000, atk: 14, range: 30, speed: 20,
    interval: 2.4, windup: 0.5, kb: 1, attack: 'single', size: 1.3,
  },
  ranged: {
    role: '遠距離', tier: 1, evolvesTo: null, growth: GROWTH,
    cost: 180, cooldown: 6, hp: 170, atk: 34, range: 210, speed: 38,
    interval: 2.4, windup: 0.5, kb: 2, attack: 'single', projectile: 'arrow', size: 0.85,
  },
  // ---- ここから下は第1章の後半以降（試作の 1-1 では編成しない） ----
  fast: {
    role: '高速型', tier: 1, evolvesTo: null, growth: GROWTH,
    cost: 120, cooldown: 4, hp: 180, atk: 18, range: 30, speed: 95,
    interval: 0.9, windup: 0.25, kb: 3, attack: 'single', flying: true, size: 0.8,
  },
  area: {
    role: '範囲攻撃', tier: 1, evolvesTo: null, growth: GROWTH,
    cost: 420, cooldown: 15, hp: 320, atk: 45, range: 170, speed: 30,
    interval: 3.0, windup: 0.8, kb: 2, attack: 'area', projectile: 'fire', size: 0.95,
  },
  healer: {
    role: '回復支援', tier: 1, evolvesTo: null, growth: GROWTH,
    cost: 260, cooldown: 15, hp: 280, atk: 6, range: 30, speed: 32,
    interval: 2.0, windup: 0.4, kb: 2, attack: 'single', heal: { every: 5, ratio: 0.15, radius: 160 }, size: 0.85,
  },
  special: {
    role: '特殊魔法型', tier: 1, evolvesTo: null, growth: GROWTH, note: '能力は調整中（仮で範囲の魔法弾）',
    cost: 360, cooldown: 18, hp: 320, atk: 40, range: 180, speed: 32,
    interval: 3.0, windup: 0.6, kb: 2, attack: 'area', projectile: 'fire', size: 0.85,
  },
};

/* 幹部（レア召喚）。unique：同じ種類は戦場に1体まで。倒されてから cooldown 秒で再召喚できる。
 * skill は固有の特技（試作では未実装。通常攻撃だけで動く） */
export const BOSSES = {
  charger: {
    role: '幹部・突進', unique: true, skill: 'charge', skillNote: '突進して通り道の敵をまとめて吹き飛ばす',
    cost: 1500, cooldown: 60, hp: 6000, atk: 180, range: 50, speed: 30,
    interval: 3.0, windup: 0.8, kb: 5, attack: 'area', size: 1.6, growth: GROWTH,
  },
  elemental: {
    role: '幹部・炎と氷', unique: true, skill: 'fireIce', skillNote: '前方の地面に炎（継続ダメージ）と氷（足どめ）',
    cost: 1400, cooldown: 70, hp: 4500, atk: 140, range: 160, speed: 28,
    interval: 3.0, windup: 0.8, kb: 5, attack: 'area', projectile: 'fire', size: 1.5, growth: GROWTH,
  },
  trickster: {
    role: '幹部・罠と身代わり', unique: true, skill: 'trap', skillNote: '前線に罠を置く。倒れそうになると1回だけ身代わり',
    cost: 1300, cooldown: 80, hp: 4000, atk: 120, range: 120, speed: 34,
    interval: 2.6, windup: 0.6, kb: 5, attack: 'single', size: 1.5, growth: GROWTH,
  },
  thunder: {
    role: '幹部・落雷', unique: true, skill: 'thunder', skillNote: '最前列の敵へ落雷（高火力。勇者によく効く）',
    cost: 1600, cooldown: 90, hp: 6500, atk: 220, range: 140, speed: 30,
    interval: 3.2, windup: 0.9, kb: 5, attack: 'single', size: 1.6, growth: GROWTH,
  },
  mist: {
    role: '幹部・霧', unique: true, skill: 'mist', skillNote: '前方の敵の移動と攻撃を数秒止める',
    cost: 1500, cooldown: 90, hp: 7000, atk: 90, range: 100, speed: 28,
    interval: 2.8, windup: 0.7, kb: 5, attack: 'area', size: 1.6, growth: GROWTH,
  },
};

/* 大魔王（別枠）。ふだんは祠にいて「魔王の呪文」を使う。覚醒形態は最終章の特別ユニット（構想） */
export const LORD = {
  lord: { role: '大魔王', inShrine: true },
  lordAwakened: { role: '大魔王（覚醒）', unique: true, planned: true },
};

export const ALL_DEMONS = { ...UNITS, ...BOSSES };
