/* 魔王軍のユニット（調整用の数値。すべて仮）
 *
 * - キー（mass・vanguard…）は「役割の枠」。セーブ・ステージ・編成・解放はこのキーで参照する。
 * - 表示名・絵は js/data/skin.js（ここには書かない）。
 * - 単位：射程・移動＝論理ドット（画面幅960）、時間＝秒。
 * - 項目の意味は js/core/battle.js の先頭。
 *
 * 将来の上位互換・進化：tier（段階）・evolvesTo（進化先のキー）・growth（レベル1ごとの上昇率）。
 * 進化形は別のキー（例：mass_2）で同じ表に足し、基本形の evolvesTo に書く。
 */

export const GROWTH = { hp: 0.12, atk: 0.12 }; // 簡易強化：レベル1ごとに +12%

/* 攻撃タイプ（attackType）と標的の選び方（target）は、射程（range）とは別に持つ（2026-11-24）
 *   attackType  melee＝近距離（前線でぶつかる）／mid＝中距離魔法（前衛の後ろから・範囲や特殊効果）／
 *               long＝遠距離（後方から敵の最前線）／sniper＝後衛狙撃（後方から敵の後衛を直接）
 *   target      front＝いちばん近い相手（既定）／backline＝敵の後衛（line: 'back'）と敵拠点だけ。
 *               backline は前衛に標的を切り替えない。射程に後衛も拠点も無ければ空振りする（battle.js resolveAttack）
 *   line        自分が前衛（front・既定）か後衛（back）か。相手の後衛狙撃の対象になる */
export const ATTACK_TYPES = {
  melee: { name: '近距離', short: '近' },
  mid: { name: '中距離魔法', short: '中' },
  long: { name: '遠距離', short: '遠' },
  sniper: { name: '後衛狙撃', short: '狙' },
};

export const UNITS = {
  mass: {
    role: '量産型', attackType: 'melee', target: 'front', tier: 1, evolvesTo: null, growth: GROWTH,
    cost: 50, cooldown: 2, hp: 120, atk: 11, range: 26, speed: 48,
    interval: 1.1, windup: 0.3, kb: 3, attack: 'single', size: 0.8,
  },
  vanguard: {
    role: '前衛', attackType: 'melee', target: 'front', tier: 1, evolvesTo: null, growth: GROWTH,
    cost: 150, cooldown: 6, hp: 650, atk: 42, range: 38, speed: 36,
    interval: 1.6, windup: 0.45, kb: 3, attack: 'single', size: 1.0,
  },
  tank: {
    role: '高HPタンク', attackType: 'melee', target: 'front', tier: 1, evolvesTo: null, growth: GROWTH,
    cost: 400, cooldown: 14, hp: 2800, atk: 32, range: 34, speed: 18,
    interval: 2.6, windup: 0.7, kb: 2, attack: 'single', size: 1.3,
  },
  ranged: {
    role: '遠距離', attackType: 'long', target: 'front', line: 'back', tier: 1, evolvesTo: null, growth: GROWTH,
    cost: 200, cooldown: 6, hp: 170, atk: 34, range: 210, speed: 36,
    interval: 2.3, windup: 0.5, kb: 2, attack: 'single', projectile: 'arrow', size: 0.85,
  },
  fast: {
    role: '高速型', attackType: 'melee', target: 'front', tier: 1, evolvesTo: null, growth: GROWTH, flying: true,
    cost: 100, cooldown: 3, hp: 170, atk: 17, range: 28, speed: 105,
    interval: 0.8, windup: 0.2, kb: 3, attack: 'single', size: 0.8,
  },
  area: {
    role: '範囲攻撃', attackType: 'mid', target: 'front', line: 'back', tier: 1, evolvesTo: null, growth: GROWTH,
    cost: 300, cooldown: 10, hp: 260, atk: 28, range: 160, speed: 32,
    interval: 2.6, windup: 0.7, kb: 2, attack: 'area', projectile: 'magic', size: 0.9,
  },
  healer: {
    role: '回復支援', attackType: 'mid', target: 'front', line: 'back', tier: 1, evolvesTo: null, growth: GROWTH,
    cost: 250, cooldown: 14, hp: 320, atk: 8, range: 120, speed: 34,
    interval: 2.0, windup: 0.4, kb: 2, attack: 'single', projectile: 'bubble', size: 0.85,
    heal: { every: 4, ratio: 0.18, radius: 190 },
  },
  special: {
    role: '特殊魔法型', attackType: 'long', target: 'front', line: 'back', tier: 1, evolvesTo: null, growth: GROWTH,
    // 2026-11-24：遠距離型へ変更（射程 170 → 220。弓ゴブリン 210 と同じく後方から最前線を撃つ）。ほかの能力・絵はそのまま
    cost: 350, cooldown: 16, hp: 300, atk: 18, range: 220, speed: 32,
    interval: 2.4, windup: 0.6, kb: 2, attack: 'single', projectile: 'magic', size: 0.85,
    // ふだんは弱い魔法。25%で強い魔法（攻撃力×6・半径110の範囲）、15%で失敗（1.2秒動けない）
    gamble: { strong: 0.25, fail: 0.15, strongMult: 6, strongRadius: 110, failStun: 1.2 },
  },
  // 後衛狙撃型（2026-11-24 追加。仮称：木槌小鬼）。木槌を投げて敵の後衛（回復役・弓兵など）と拠点だけを狙う。
  // 高火力・高コスト・低HP・長い構え。3段階に進化し、最終形態は2方向に分かれる（EVOLUTIONS）
  mallet: {
    role: '後衛狙撃', attackType: 'sniper', target: 'backline', line: 'back', tier: 1, evolvesTo: 'mallet_2', growth: GROWTH,
    cost: 450, cooldown: 18, hp: 160, atk: 190, range: 330, speed: 30,
    interval: 3.6, windup: 1.4, kb: 2, attack: 'single', projectile: 'hammer', size: 0.8,
  },
};

/* 幹部（切り札）。戦場に出せる幹部は種類を問わず同時に1体まで（battle.js）。
 *   cost         召喚魔力（基本範囲 1200〜2200）
 *   needFurnace  召喚に必要な魔力炉Lv（戦闘中の魔力炉。最大Lv8）。魔力が足りていても、炉Lvが足りなければ召喚できない
 *   cooldown     撃破されてから再召喚できるまでの秒数（60秒）。ほかの幹部への切り替えは CONFIG.bossSwitch 秒待つ
 *   ready        能力・絵がそろって編成できる幹部。false は数値だけの構想（編成画面には「準備中」で出る）
 * 未完成の幹部も、ここに1行足せば編成・召喚・解放の仕組みにそのまま乗る（skills・絵は後から足す）。 */
export const BOSSES = {
  charger: {
    role: '幹部・突進', attackType: 'melee', target: 'front', unique: true, ready: true, growth: GROWTH,
    cost: 1500, needFurnace: 3, cooldown: 60, hp: 7000, atk: 160, range: 46, speed: 30,
    interval: 2.8, windup: 0.7, kb: 6, attack: 'area', size: 1.6,
    skills: [{ id: 'charge', name: '突進', type: 'charge', every: 12, first: 3, windup: 0.9, recover: 0.6, reach: 220, move: 180, mult: 1.8 }],
    anim: { idle: 2, walk: 4, attack: 4, skill: 6 }, // 準備するアニメーションのコマ数（ART_SPEC）
  },
  // ---- 構想（ready: false）。数値は仮。能力（skills）と絵ができたら ready: true にする ----
  trickster: { attackType: 'mid', target: 'front', role: '幹部・罠と身代わり', unique: true, ready: false, cost: 1300, needFurnace: 3, cooldown: 60, hp: 4500, atk: 120, range: 120, speed: 34, interval: 2.6, windup: 0.6, kb: 6, attack: 'single', size: 1.5, growth: GROWTH },
  mist: { attackType: 'mid', target: 'front', role: '幹部・霧', unique: true, ready: false, cost: 1600, needFurnace: 4, cooldown: 60, hp: 7000, atk: 90, range: 100, speed: 28, interval: 2.8, windup: 0.7, kb: 6, attack: 'area', size: 1.6, growth: GROWTH },
  elemental: { attackType: 'mid', target: 'front', role: '幹部・炎と氷', unique: true, ready: false, cost: 1800, needFurnace: 5, cooldown: 60, hp: 5000, atk: 140, range: 160, speed: 28, interval: 3.0, windup: 0.8, kb: 6, attack: 'area', size: 1.5, growth: GROWTH },
  thunder: { attackType: 'long', target: 'front', role: '幹部・落雷', unique: true, ready: false, cost: 2200, needFurnace: 6, cooldown: 60, hp: 6500, atk: 220, range: 140, speed: 30, interval: 3.2, windup: 0.9, kb: 6, attack: 'single', size: 1.6, growth: GROWTH },
};
export const BOSS_ORDER = Object.keys(BOSSES);

/* 大魔王（別枠）。ふだんは祠にいて「魔王の呪文」を使う。真の姿は最終章の特別ユニット（構想） */
export const LORD = {
  lord: { role: '大魔王', inShrine: true },
  lordAwakened: { role: '大魔王（真の姿）', unique: true, planned: true },
};

/* 進化形（UNITS の evolvesTo から参照）。evolvesTo が配列なら分岐。ready: false は数値だけの構想（進化はまだできない）。
 * 名前・絵・詳しい能力はビジュアル制作室で確定する */
export const EVOLUTIONS = {
  mallet_2: { // 第2形態：大きな木槌を遠投
    role: '後衛狙撃', attackType: 'sniper', target: 'backline', line: 'back', tier: 2, evolvesTo: ['mallet_3a', 'mallet_3b'], growth: GROWTH, ready: false,
    cost: 520, cooldown: 18, hp: 200, atk: 260, range: 380, speed: 30, interval: 3.8, windup: 1.5, kb: 3, attack: 'single', projectile: 'hammer', size: 0.9,
  },
  mallet_3a: { // 第3形態A：超巨大木槌の一撃特化
    role: '後衛狙撃（一撃）', attackType: 'sniper', target: 'backline', line: 'back', tier: 3, evolvesTo: null, growth: GROWTH, ready: false,
    cost: 620, cooldown: 20, hp: 240, atk: 560, range: 400, speed: 28, interval: 4.6, windup: 1.9, kb: 5, attack: 'single', projectile: 'hammer', size: 1.0,
  },
  mallet_3b: { // 第3形態B：複数の木槌を連続投擲
    role: '後衛狙撃（連投）', attackType: 'sniper', target: 'backline', line: 'back', tier: 3, evolvesTo: null, growth: GROWTH, ready: false,
    cost: 620, cooldown: 20, hp: 240, atk: 170, range: 380, speed: 30, interval: 4.2, windup: 1.4, kb: 2, attack: 'single', projectile: 'hammer', size: 1.0,
    hits: 3, hitGap: 0.3,
  },
};

export const ALL_DEMONS = { ...UNITS, ...BOSSES, ...EVOLUTIONS };
export const UNIT_ORDER = ['mass', 'vanguard', 'tank', 'ranged', 'fast', 'area', 'healer', 'special', 'mallet'];
