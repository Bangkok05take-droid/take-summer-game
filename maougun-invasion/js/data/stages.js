/* 戦闘の共通設定と第1章のステージ（数値はすべて仮）
 *
 * 敵の出し方（spawns）
 *   { who, start, every, max, until? }   start 秒から every 秒ごと。max はこの行で出した敵が同時に何体まで
 *   { trigger: { baseBelow }, wave: [{ who, count }], gap, hero?, line? }
 *                                        拠点HPがその割合以下になったら1回だけ、gap 秒間隔で順に出す
 */
/* テストプレイ用（2026-11-25 ユーザー依頼）：敵の強さの倍率。1/3 にすると、人間軍のHP・攻撃力と拠点HPが 1/3 になる。
 * 本番に戻すときは 1 にする（自動テスト・バランス確認は常に本番の強さで動く） */
export const TEST_ENEMY_POWER = 1 / 3;

export const CONFIG = {
  demonCap: 30,          // 魔王軍の同時出撃上限
  humanCap: 30,          // 人間軍の同時出撃上限（勇者は上限でも出る）
  baseHalfWidth: 50,     // 祠・拠点の当たりの半分の幅
  kbDistance: 70,        // ノックバックで下がる距離
  kbTime: 0.45,
  deathTime: 0.7,        // 撃破の演出の長さ（その間は当たらない）
  furnace: {             // 魔力炉。costs[lv-1] が Lv → Lv+1 の費用
    costs: [150, 250, 350, 450, 550, 650, 750],
    maxAdd: 250,         // 1段ごとの最大魔力の上昇
    regenAdd: 6,         // 1段ごとの回復（毎秒）の上昇
  },
  bossLimit: 1,          // 戦場に同時に出せる幹部の数（種類を問わず）
  bossSwitch: 20,        // 幹部が撃破されたあと、別の幹部を召喚できるまでの秒数（同じ幹部は各幹部の cooldown）
  spell: {               // 魔王の呪文：人間がいちばん密集している地点を中心に範囲攻撃
    name: '魔王の呪文',
    charge: 35,          // ためる秒数（開始時は空）
    damage: 320,
    radius: 170,
  },
};

/* 第1章はチュートリアル（2026-11-25）：1-1 ゲームの説明（負けない）／1-2 コツと対策のヒント／1-3 自分でやってみる。
 * tutorial：'guide'＝手順つきの説明（js/data/tutorial.js）／'hints'＝敵の登場などでヒント／'self'＝ヒントなし
 * 旧 1-4「村の門」・1-5「村の広場（勇者戦）」のデータは第2章（城下町）づくりの素材として下に残す（遊べない）。勇者たけ・サイは最後まで出さない */
export const CHAPTER1 = { id: 1, name: 'はじまりの村を侵略せよ', stages: ['1-1', '1-2', '1-3'], unlockOnClear: 'charger' };
// 第2章（2026-11-25）：城下町。旧 1-4「村の門」の敵構成をもとに、後衛（弓兵・僧侶）が多く、最後に強敵「警備隊長」
export const CHAPTER2 = { id: 2, name: '城下町を制圧せよ', stages: ['2-1', '2-2', '2-3'] };
// 第3章（2026-11-25）：地方王国の城。台本は承認済み。敵編成・ボス・報酬は仮（別途バトル設計）
export const CHAPTER3 = { id: 3, name: '地方王国の城を攻略せよ', stages: ['3-1', '3-2', '3-3'] };
// 第4章（2026-11-25）：港町。台本は承認済み。壊滅した町のイベントが終わると開く（オルドの加入・未加入は問わない）。敵編成・ボス・報酬は仮
export const CHAPTER4 = { id: 4, name: '港町を制圧せよ', stages: ['4-1', '4-2', '4-3'], needsEvent: 'ruin' };
// 第5章（2026-11-25）：鉄鋼の要塞都市（4ステージ）。台本は承認済み。防衛兵器・重装兵でこれまでより難しい。敵編成・ボス・報酬は仮
export const CHAPTER5 = { id: 5, name: '鉄鋼の要塞都市を攻略せよ', stages: ['5-1', '5-2', '5-3', '5-4'] };
// 第6章（2026-11-25）：砂漠の古代王国（3ステージ）。6-3 の初回クリアで「大魔王の魔力回復」と上位進化の解放。敵・ボス・報酬は仮
export const CHAPTER6 = { id: 6, name: '砂漠の古代王国', stages: ['6-1', '6-2', '6-3'] };
// 第7章（2026-11-25）：聖なる都（2ステージ）。聖騎士（聖なる加護で自分を癒やす）・聖騎士団長。敵・ボス・報酬は仮
export const CHAPTER7 = { id: 7, name: '聖なる都を攻略せよ', stages: ['7-1', '7-2'] };
// 第8章（2026-11-25）：魔法都市（4ステージ・背景は全ステージ共通の1枚）。魔導兵（後ろから魔法弾）・精鋭魔導士・魔導士団長・大魔導士。
// 8-4 の初回クリアで特殊イベント「魔王軍の究極進化」（魔力炉のさらなる強化・最上位進化の解放）。敵・ボス・報酬は仮
export const CHAPTER8 = { id: 8, name: '魔法都市', stages: ['8-1', '8-2', '8-3', '8-4'] };
// 第9章（2026-11-25）：人間界の王都（4ステージ・背景は全ステージ共通の1枚）。これまでの人間軍の兵種を総動員。
// 9-3 王国軍指揮官／9-4 ボス：人間軍総司令官。9-4 の初回クリアで「最終章への進軍」→ 最終章解放演出。敵・ボス・報酬は仮
export const CHAPTER9 = { id: 9, name: '人間界の王都', stages: ['9-1', '9-2', '9-3', '9-4'] };
// 第10章・最終章（2026-11-25）：天空・勇者の聖域（5ステージ・背景は全ステージ共通の1枚）。10-3 ボス：聖竜／10-5 最終決戦：たけ・サイ・マスター・ヤナイ。
// 10-5 の初回クリアでエンディング（大魔王復活 → 世界征服達成 → おまけ会話）。敵・ボス・報酬は仮
export const CHAPTER10 = { id: 10, name: '天空・勇者の聖域', stages: ['10-1', '10-2', '10-3', '10-4', '10-5'], final: true };
export const CHAPTERS = [CHAPTER1, CHAPTER2, CHAPTER3, CHAPTER4, CHAPTER5, CHAPTER6, CHAPTER7, CHAPTER8, CHAPTER9, CHAPTER10];
// 全ステージの順番（章をまたいで、前のステージをクリアすると次が開く）
export const STAGE_ORDER = CHAPTERS.flatMap((c) => c.stages);
// 特別（2026-11-25）：特殊イベント「壊滅した町」。ステージ選択の「特別」タブ（イベントのあとだけ出る）。通常の進行（STAGE_ORDER）には入れない
export const CHAPTER_EX = { id: 'ex', name: '壊滅した町', stages: ['ex-1'], special: true };
export const chapterOf = (id) => (id === 'ex-1' ? CHAPTER_EX : CHAPTERS.find((c) => c.stages.includes(id)) || CHAPTER1);

const MANA = { start: 200, max: 1000, regen: 28 };

/* 戦場の横幅の倍率。元の長さ（L(…) の中の数字）に掛ける。
 * 2026-11-23：「横が長い」とのことで 0.7 に短縮（1-1 は 2200 → 1540、約1.6画面）。元に戻すときは 1 にする */
export const FIELD_SCALE = 0.7;
const L = (len) => Math.round(len * FIELD_SCALE);

export const STAGES = {
  '1-1': {
    id: '1-1', chapter: 1, name: '見張り小屋', theme: 'watch', tutorial: 'guide', noLose: true,
    length: L(2200), shrineHp: 5000, baseHp: 4000, enemyScale: 1.0, mana: MANA,
    spawns: [
      { who: 'militia', start: 3, every: 6, max: 6 },
      { who: 'militia', start: 40, every: 4, max: 8 },
      { who: 'swordsman', start: 25, every: 16, max: 3 },
      { who: 'swordsman', start: 90, every: 9, max: 4 },
      { who: 'militia', start: 150, every: 2.5, max: 8 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'swordsman', count: 2 }, { who: 'militia', count: 4 }], gap: 0.7 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'swordsman', count: 3 }, { who: 'militia', count: 5 }], gap: 0.6 },
    ],
    reward: { stones: 120 },
    talk: [
      { who: 'ティウ', text: 'た、大変だー！ 見張り小屋のほうに魔物の群れが来てるぞー！' },
      { who: 'モッ', text: '落ち着け、ティウ。自警団はクワを持って小屋の前に集まれ！' },
    ],
  },
  '1-2': {
    id: '1-2', chapter: 1, name: '村の自警団', theme: 'wheat', tutorial: 'hints',
    length: L(2300), shrineHp: 5500, baseHp: 7500, enemyScale: 1.05, mana: MANA,
    spawns: [
      { who: 'militia', start: 3, every: 5, max: 7 },
      { who: 'swordsman', start: 15, every: 12, max: 3 },
      { who: 'archer', start: 30, every: 14, max: 3 },
      { who: 'militia', start: 70, every: 3, max: 8 },
      { who: 'swordsman', start: 110, every: 8, max: 4 },
      { who: 'archer', start: 160, every: 9, max: 4 },
      { who: 'priest', start: 75, every: 35, max: 1 }, // 2026-11-25：回復役（後衛狙撃の木槌小鬼の出番を教える）
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'archer', count: 2 }, { who: 'swordsman', count: 2 }, { who: 'militia', count: 4 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'swordsman', count: 4 }, { who: 'archer', count: 3 }], gap: 0.6 },
    ],
    reward: { stones: 160 },
  },
  '1-3': {
    id: '1-3', chapter: 1, name: '村の最終防衛戦', theme: 'river', tutorial: 'self', boss: true,
    length: L(2400), shrineHp: 6000, baseHp: 3500, enemyScale: 1.1, /* 2026-11-25：1.15 → 1.1 */ mana: MANA,
    spawns: [
      { who: 'militia', start: 3, every: 5, max: 6 },
      { who: 'swordsman', start: 10, every: 11, max: 3 },
      { who: 'archer', start: 20, every: 13, max: 3 },
      { who: 'rider', start: 35, every: 18, max: 2 },
      { who: 'shield', start: 60, every: 30, max: 1 },
      { who: 'militia', start: 90, every: 3, max: 8 },
      { who: 'rider', start: 130, every: 10, max: 3 },
      { who: 'swordsman', start: 150, every: 7, max: 4 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'rider', count: 3 }, { who: 'swordsman', count: 3 }], gap: 0.6 },
      { trigger: { baseBelow: 0.5 }, hero: 'militia_captain', wave: [{ who: 'militia_captain', count: 1 }, { who: 'militia', count: 2 }], gap: 0.8 }, // 2026-11-25：ボス・自警団長
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'shield', count: 1 }, { who: 'archer', count: 3 }, { who: 'rider', count: 3 }], gap: 0.6 },
    ],
    reward: { stones: 250, unlock: 'charger' }, // 第1章クリア：幹部・突進（第2章で使う）
  },
  '1-4': {
    id: '1-4', chapter: 2, reserve: true, name: '村の門', theme: 'gate', // 保留（第2章の素材）
    length: L(2400), shrineHp: 6500, baseHp: 7000, enemyScale: 1.2, /* 2026-11-25：1.3 → 1.2 */ mana: MANA,
    spawns: [
      { who: 'militia', start: 3, every: 4.5, max: 6 },
      { who: 'shield', start: 8, every: 26, max: 2 },
      { who: 'swordsman', start: 12, every: 10, max: 4 },
      { who: 'archer', start: 20, every: 12, max: 3 },
      { who: 'priest', start: 40, every: 28, max: 1 },
      { who: 'rider', start: 60, every: 16, max: 2 },
      { who: 'priest', start: 120, every: 22, max: 2 },
      { who: 'militia', start: 120, every: 3.5, max: 7 },
      { who: 'shield', start: 160, every: 22, max: 2 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'shield', count: 1 }, { who: 'swordsman', count: 3 }, { who: 'priest', count: 1 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'shield', count: 2 }, { who: 'archer', count: 3 }, { who: 'rider', count: 2 }], gap: 0.6 },
    ],
    reward: { stones: 250 },
    talk: [
      { who: 'モッ', text: '門を閉めろ！ 盾兵は前へ、僧侶さんはそのうしろで手当てを！' },
      { who: 'コイ', text: '盾は分厚く打っておいた。そう簡単には抜かれないぞ。' },
    ],
  },
  '1-5': {
    id: '1-5', chapter: 2, reserve: true, /* 保留（第2章の素材・勇者戦） */ name: '村の広場', theme: 'plaza', boss: true,
    length: L(2500), shrineHp: 7000, baseHp: 6500, enemyScale: 1.25, /* 2026-11-25：1.4 → 1.25 */ mana: { ...MANA, start: 500 },
    spawns: [
      { who: 'militia', start: 2, every: 4, max: 7 },
      { who: 'swordsman', start: 8, every: 9, max: 4 },
      { who: 'archer', start: 15, every: 11, max: 3 },
      { who: 'shield', start: 25, every: 24, max: 2 },
      { who: 'priest', start: 45, every: 26, max: 2 },
      { who: 'rider', start: 55, every: 14, max: 3 },
      { who: 'militia', start: 110, every: 3.5, max: 7 },
      { who: 'swordsman', start: 140, every: 9, max: 4 },
      { trigger: { baseBelow: 0.7 }, hero: 'take', wave: [{ who: 'take', count: 1 }, { who: 'swordsman', count: 2 }], gap: 0.8 },
      { trigger: { baseBelow: 0.4 }, hero: 'sai', wave: [{ who: 'sai', count: 1 }, { who: 'priest', count: 1 }, { who: 'shield', count: 1 }], gap: 0.8 },
      { trigger: { baseBelow: 0.15 }, wave: [{ who: 'rider', count: 3 }, { who: 'swordsman', count: 3 }, { who: 'archer', count: 2 }], gap: 0.5 },
    ],
    reward: { stones: 400 },
    talk: [
      { who: 'ワーン', text: 'みんな、広場まで下がって！ 勇者さまたちが来てくれるまで、ふんばるよ！' },
      { who: 'ティウ', text: '勇者たけとサイが帰ってきたら、魔物なんてあっという間さ！ ……たぶん。' },
    ],
  },
  // ---------------- 第2章 城下町 ----------------
  '2-1': {
    id: '2-1', chapter: 2, name: '城下町の門', theme: 'gate',
    length: L(2400), shrineHp: 6500, baseHp: 6500, enemyScale: 1.2, mana: MANA,
    spawns: [
      { who: 'militia', start: 3, every: 4.5, max: 6 },
      { who: 'shield', start: 10, every: 26, max: 2 },
      { who: 'swordsman', start: 14, every: 10, max: 4 },
      { who: 'archer', start: 22, every: 12, max: 3 },
      { who: 'priest', start: 45, every: 28, max: 1 },
      { who: 'rider', start: 60, every: 16, max: 2 },
      { who: 'militia', start: 120, every: 3.5, max: 7 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'shield', count: 1 }, { who: 'swordsman', count: 3 }, { who: 'priest', count: 1 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'shield', count: 2 }, { who: 'archer', count: 3 }, { who: 'rider', count: 2 }], gap: 0.6 },
    ],
    reward: { stones: 280 },
    talk: [
      { who: '門番', text: '魔物の軍勢だ！ 門を閉めろ！ 盾兵は前へ！' },
    ],
  },
  '2-2': {
    id: '2-2', chapter: 2, name: '城下町の守備隊', theme: 'market',
    length: L(2400), shrineHp: 7000, baseHp: 7000, enemyScale: 1.25, mana: MANA,
    spawns: [
      { who: 'militia', start: 3, every: 4, max: 6 },
      { who: 'archer', start: 8, every: 9, max: 4 },
      { who: 'swordsman', start: 12, every: 10, max: 3 },
      { who: 'priest', start: 25, every: 20, max: 2 },
      { who: 'archer', start: 70, every: 7, max: 4 },
      { who: 'rider', start: 90, every: 14, max: 3 },
      { who: 'priest', start: 110, every: 18, max: 2 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'archer', count: 3 }, { who: 'priest', count: 1 }, { who: 'swordsman', count: 2 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'rider', count: 3 }, { who: 'archer', count: 3 }, { who: 'priest', count: 1 }], gap: 0.6 },
    ],
    reward: { stones: 300 },
  },
  '2-3': {
    id: '2-3', chapter: 2, name: '城下町の最終防衛戦', theme: 'plaza', boss: true,
    length: L(2500), shrineHp: 7500, baseHp: 6500, enemyScale: 1.25, mana: { ...MANA, start: 400 },
    spawns: [
      { who: 'militia', start: 2, every: 4, max: 6 },
      { who: 'swordsman', start: 8, every: 9, max: 4 },
      { who: 'archer', start: 15, every: 11, max: 3 },
      { who: 'shield', start: 25, every: 24, max: 2 },
      { who: 'priest', start: 45, every: 26, max: 2 },
      { who: 'rider', start: 55, every: 14, max: 3 },
      { who: 'militia', start: 110, every: 3.5, max: 7 },
      { trigger: { baseBelow: 0.6 }, hero: 'captain', wave: [{ who: 'captain', count: 1 }, { who: 'shield', count: 1 }, { who: 'swordsman', count: 2 }], gap: 0.8 },
      { trigger: { baseBelow: 0.25 }, wave: [{ who: 'rider', count: 3 }, { who: 'swordsman', count: 3 }, { who: 'priest', count: 1 }], gap: 0.5 },
    ],
    reward: { stones: 400 },
  },
  // ---------------- 第3章 地方王国の城（敵編成・ボス・報酬は仮） ----------------
  '3-1': {
    id: '3-1', chapter: 3, name: '王国の城門', theme: 'gate',
    length: L(2400), shrineHp: 7500, baseHp: 7000, enemyScale: 1.3, mana: MANA,
    spawns: [
      { who: 'militia', start: 3, every: 4.5, max: 6 },
      { who: 'swordsman', start: 8, every: 9, max: 4 },
      { who: 'shield', start: 15, every: 20, max: 2 },
      { who: 'archer', start: 20, every: 11, max: 3 },
      { who: 'knight', start: 50, every: 30, max: 1 },
      { who: 'priest', start: 60, every: 26, max: 1 },
      { who: 'court_mage', start: 35, every: 24, max: 1 }, // 2026-11-25：宮廷魔導士
      { who: 'rider', start: 80, every: 15, max: 2 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'knight', count: 1 }, { who: 'swordsman', count: 3 }, { who: 'archer', count: 2 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'shield', count: 2 }, { who: 'rider', count: 3 }, { who: 'priest', count: 1 }], gap: 0.6 },
    ],
    reward: { stones: 320 },
  },
  '3-2': {
    id: '3-2', chapter: 3, name: '王国騎士団', theme: 'gate',
    length: L(2400), shrineHp: 8000, baseHp: 7500, enemyScale: 1.35, mana: MANA,
    spawns: [
      { who: 'swordsman', start: 3, every: 7, max: 4 },
      { who: 'knight', start: 10, every: 18, max: 2 },
      { who: 'archer', start: 15, every: 10, max: 3 },
      { who: 'priest', start: 30, every: 22, max: 2 },
      { who: 'court_mage', start: 22, every: 20, max: 1 }, // 2026-11-25：宮廷魔導士
      { who: 'rider', start: 40, every: 14, max: 3 },
      { who: 'knight', start: 110, every: 14, max: 3 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'knight', count: 2 }, { who: 'priest', count: 1 }, { who: 'archer', count: 2 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'knight', count: 2 }, { who: 'rider', count: 3 }], gap: 0.6 },
    ],
    reward: { stones: 340 },
  },
  '3-3': {
    id: '3-3', chapter: 3, name: '王国の最終決戦', theme: 'plaza', boss: true,
    length: L(2500), shrineHp: 8500, baseHp: 7000, enemyScale: 1.3, mana: { ...MANA, start: 400 },
    spawns: [
      { who: 'swordsman', start: 2, every: 7, max: 4 },
      { who: 'knight', start: 12, every: 20, max: 2 },
      { who: 'archer', start: 15, every: 11, max: 3 },
      { who: 'shield', start: 25, every: 24, max: 2 },
      { who: 'priest', start: 40, every: 24, max: 2 },
      { who: 'rider', start: 55, every: 14, max: 3 },
      { trigger: { baseBelow: 0.6 }, hero: 'knight_commander', wave: [{ who: 'knight_commander', count: 1 }, { who: 'knight', count: 2 }, { who: 'court_mage', count: 1 }] /* 2026-11-25：ボスを国王から王国騎士団長へ */, gap: 0.8 },
      { trigger: { baseBelow: 0.25 }, wave: [{ who: 'knight', count: 2 }, { who: 'rider', count: 3 }, { who: 'archer', count: 2 }], gap: 0.5 },
    ],
    reward: { stones: 450 },
  },
  // ---------------- 第4章 港町（敵編成・ボス・報酬は仮） ----------------
  '4-1': {
    id: '4-1', chapter: 4, name: '港町の防衛線', theme: 'harbor',
    length: L(2400), shrineHp: 8500, baseHp: 7500, enemyScale: 1.4, mana: MANA,
    spawns: [
      { who: 'militia', start: 3, every: 4, max: 7 },
      { who: 'swordsman', start: 8, every: 9, max: 2 },
      { who: 'naval_soldier', start: 6, every: 8, max: 3 }, // 2026-11-25：海兵
      { who: 'archer', start: 14, every: 10, max: 3 },
      { who: 'rider', start: 30, every: 12, max: 3 },
      { who: 'shield', start: 45, every: 22, max: 2 },
      { who: 'priest', start: 60, every: 24, max: 1 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'rider', count: 3 }, { who: 'swordsman', count: 3 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'knight', count: 1 }, { who: 'archer', count: 3 }, { who: 'priest', count: 1 }], gap: 0.6 },
    ],
    reward: { stones: 360 },
  },
  '4-2': {
    id: '4-2', chapter: 4, name: '港町の守備隊', theme: 'harbor',
    length: L(2400), shrineHp: 9000, baseHp: 8000, enemyScale: 1.45, mana: MANA,
    spawns: [
      { who: 'swordsman', start: 3, every: 8, max: 2 },
      { who: 'naval_soldier', start: 5, every: 8, max: 3 }, // 2026-11-25：海兵
      { who: 'archer', start: 8, every: 8, max: 4 },
      { who: 'priest', start: 20, every: 20, max: 2 },
      { who: 'shield', start: 30, every: 20, max: 2 },
      { who: 'knight', start: 50, every: 24, max: 2 },
      { who: 'rider', start: 70, every: 13, max: 3 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'archer', count: 3 }, { who: 'priest', count: 1 }, { who: 'shield', count: 1 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'knight', count: 2 }, { who: 'rider', count: 3 }], gap: 0.6 },
    ],
    reward: { stones: 380 },
  },
  '4-3': {
    id: '4-3', chapter: 4, name: '港町の最終決戦', theme: 'harbor', boss: true,
    length: L(2500), shrineHp: 9500, baseHp: 7500, enemyScale: 1.3, mana: { ...MANA, start: 400 },
    spawns: [
      { who: 'swordsman', start: 2, every: 8, max: 2 },
      { who: 'naval_soldier', start: 4, every: 12, max: 1 }, // 2026-11-25：海兵
      { who: 'archer', start: 10, every: 10, max: 3 },
      { who: 'knight', start: 15, every: 22, max: 2 },
      { who: 'priest', start: 35, every: 24, max: 2 },
      { who: 'rider', start: 50, every: 13, max: 3 },
      { who: 'shield', start: 60, every: 24, max: 2 },
      { trigger: { baseBelow: 0.6 }, hero: 'harbor_captain', wave: [{ who: 'harbor_captain', count: 1 }, { who: 'knight', count: 1 }, { who: 'archer', count: 2 }], gap: 0.8 },
      { trigger: { baseBelow: 0.25 }, wave: [{ who: 'rider', count: 3 }, { who: 'knight', count: 2 }, { who: 'priest', count: 1 }], gap: 0.5 },
    ],
    reward: { stones: 500 },
  },
  // ---------------- 第5章 鉄鋼の要塞都市（敵編成・ボス・報酬は仮）。防衛砲台（動かない・遠くから範囲）・重装兵（とても硬い） ----------------
  '5-1': {
    id: '5-1', chapter: 5, name: '鉄鋼都市の外壁', theme: 'fortress',
    length: L(2400), shrineHp: 9500, baseHp: 8000, enemyScale: 1.4, mana: MANA,
    spawns: [
      { who: 'turret', start: 1, every: 9999, max: 1 },
      { who: 'swordsman', start: 4, every: 7, max: 4 },
      { who: 'archer', start: 10, every: 10, max: 2 },
      { who: 'engineer', start: 16, every: 16, max: 2 }, // 2026-11-25：兵器技師
      { who: 'shield', start: 20, every: 20, max: 2 },
      { who: 'heavy', start: 45, every: 28, max: 1 },
      { who: 'rider', start: 60, every: 14, max: 3 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'swordsman', count: 3 }, { who: 'heavy', count: 1 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'heavy', count: 1 }, { who: 'archer', count: 3 }, { who: 'rider', count: 2 }], gap: 0.6 },
    ],
    reward: { stones: 420 },
  },
  '5-2': {
    id: '5-2', chapter: 5, name: '新型兵器の反撃', theme: 'fortress',
    length: L(2400), shrineHp: 10000, baseHp: 8500, enemyScale: 1.45, mana: MANA,
    spawns: [
      { who: 'turret', start: 1, every: 9999, max: 1 },
      { who: 'swordsman', start: 4, every: 7, max: 4 },
      { who: 'archer', start: 8, every: 9, max: 2 },
      { who: 'engineer', start: 14, every: 16, max: 2 }, // 2026-11-25：兵器技師
      { who: 'priest', start: 25, every: 24, max: 1 },
      { who: 'heavy', start: 35, every: 24, max: 2 },
      { who: 'rider', start: 70, every: 13, max: 3 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'heavy', count: 1 }, { who: 'archer', count: 2 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'knight', count: 2 }, { who: 'rider', count: 3 }], gap: 0.6 },
    ],
    reward: { stones: 440 },
  },
  '5-3': {
    id: '5-3', chapter: 5, name: '重装兵団', theme: 'fortress',
    length: L(2400), shrineHp: 10000, baseHp: 8500, enemyScale: 1.45, mana: MANA,
    spawns: [
      { who: 'heavy', start: 4, every: 16, max: 2 },
      { who: 'swordsman', start: 6, every: 8, max: 3 },
      { who: 'archer', start: 12, every: 10, max: 2 },
      { who: 'engineer', start: 18, every: 16, max: 2 }, // 2026-11-25：兵器技師
      { who: 'priest', start: 30, every: 22, max: 2 },
      { who: 'knight', start: 50, every: 24, max: 2 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'heavy', count: 2 }, { who: 'priest', count: 1 }], gap: 0.6 },
      { trigger: { baseBelow: 0.45 }, hero: 'heavy_captain', wave: [{ who: 'heavy_captain', count: 1 }, { who: 'heavy', count: 1 }], gap: 0.8 }, // 2026-11-25：重装兵団長（重装兵の強化個体・暫定）
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'heavy', count: 2 }, { who: 'knight', count: 1 }, { who: 'archer', count: 2 }], gap: 0.6 },
    ],
    reward: { stones: 460 },
  },
  '5-4': {
    id: '5-4', chapter: 5, name: '鉄鋼都市の最終決戦', theme: 'fortress', boss: true,
    length: L(2500), shrineHp: 10500, baseHp: 8000, enemyScale: 1.35, mana: { ...MANA, start: 400 },
    spawns: [
      { who: 'turret', start: 1, every: 9999, max: 1 },
      { who: 'swordsman', start: 3, every: 7, max: 4 },
      { who: 'archer', start: 10, every: 10, max: 2 },
      { who: 'engineer', start: 16, every: 16, max: 2 }, // 2026-11-25：兵器技師
      { who: 'heavy', start: 20, every: 22, max: 2 },
      { who: 'priest', start: 35, every: 24, max: 2 },
      { who: 'rider', start: 50, every: 13, max: 3 },
      { trigger: { baseBelow: 0.6 }, hero: 'commander', wave: [{ who: 'commander', count: 1 }, { who: 'heavy', count: 1 }], gap: 0.8 },
      { trigger: { baseBelow: 0.25 }, wave: [{ who: 'heavy', count: 2 }, { who: 'rider', count: 3 }, { who: 'archer', count: 2 }], gap: 0.5 },
    ],
    reward: { stones: 600 },
  },
  // ---------------- 第6章 砂漠の古代王国（敵編成・ボス・報酬は仮）。守護者（古代の石像兵）・古代王 ----------------
  '6-1': {
    id: '6-1', chapter: 6, name: '砂漠の古代遺跡', theme: 'desert',
    length: L(2400), shrineHp: 10500, baseHp: 8500, enemyScale: 1.4, mana: MANA,
    spawns: [
      { who: 'ancient_soldier', start: 3, every: 7, max: 4 } /* 2026-11-25：見習い剣士 → 古代兵士 */,
      { who: 'archer', start: 8, every: 9, max: 3 },
      { who: 'guardian', start: 15, every: 20, max: 2 },
      { who: 'rider', start: 30, every: 13, max: 3 },
      { who: 'ancient_priest', start: 45, every: 24, max: 1 } /* 2026-11-25：見習い僧侶 → 古代神官 */,
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'guardian', count: 2 }, { who: 'archer', count: 2 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'guardian', count: 1 }, { who: 'rider', count: 3 }, { who: 'ancient_priest', count: 1 }], gap: 0.6 },
    ],
    reward: { stones: 480 },
  },
  '6-2': {
    id: '6-2', chapter: 6, name: '古代王国の守護者', theme: 'desert',
    length: L(2400), shrineHp: 11000, baseHp: 9000, enemyScale: 1.45, mana: MANA,
    spawns: [
      { who: 'guardian', start: 3, every: 14, max: 3 },
      { who: 'ancient_soldier', start: 6, every: 8, max: 3 } /* 2026-11-25：見習い剣士 → 古代兵士 */,
      { who: 'archer', start: 10, every: 10, max: 3 },
      { who: 'ancient_priest', start: 30, every: 22, max: 2 } /* 2026-11-25：見習い僧侶 → 古代神官 */,
      { who: 'heavy', start: 50, every: 26, max: 1 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'guardian', count: 2 }, { who: 'ancient_priest', count: 1 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'guardian', count: 2 }, { who: 'archer', count: 3 }], gap: 0.6 },
    ],
    reward: { stones: 500 },
  },
  '6-3': {
    id: '6-3', chapter: 6, name: '古代王の復活', theme: 'desert', boss: true,
    length: L(2500), shrineHp: 11500, baseHp: 9500, enemyScale: 1.5, mana: { ...MANA, start: 400 },
    spawns: [
      { who: 'guardian', start: 3, every: 16, max: 2 },
      { who: 'ancient_soldier', start: 5, every: 8, max: 3 } /* 2026-11-25：見習い剣士 → 古代兵士 */,
      { who: 'archer', start: 12, every: 11, max: 3 },
      { who: 'ancient_priest', start: 35, every: 24, max: 1 } /* 2026-11-25：見習い僧侶 → 古代神官 */,
      { who: 'rider', start: 50, every: 14, max: 3 },
      { trigger: { baseBelow: 0.6 }, hero: 'ancient_king', wave: [{ who: 'ancient_king', count: 1 }, { who: 'guardian', count: 1 }], gap: 0.8 },
      { trigger: { baseBelow: 0.25 }, wave: [{ who: 'guardian', count: 2 }, { who: 'rider', count: 3 }], gap: 0.5 },
    ],
    reward: { stones: 650 },
  },
  // ---------------- 第7章 聖なる都（敵編成・ボス・報酬は仮） ----------------
  '7-1': {
    id: '7-1', chapter: 7, name: '聖都の防衛線', theme: 'holy',
    length: L(2400), shrineHp: 12000, baseHp: 16000, enemyScale: 2.49 /* 2026-11-25 進化に合わせて ×1.78（元 9000・1.4） */, mana: MANA,
    spawns: [
      { who: 'swordsman', start: 3, every: 7, max: 4 },
      { who: 'paladin', start: 8, every: 14, max: 3 },
      { who: 'archer', start: 12, every: 10, max: 3 },
      { who: 'high_priest', start: 25, every: 20, max: 2 } /* 2026-11-25：見習い僧侶 → 高位神官 */,
      { who: 'heavy', start: 50, every: 26, max: 1 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'paladin', count: 2 }, { who: 'high_priest', count: 1 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'paladin', count: 2 }, { who: 'archer', count: 3 }], gap: 0.6 },
    ],
    reward: { stones: 560 },
  },
  '7-2': {
    id: '7-2', chapter: 7, name: '聖騎士団との決戦', theme: 'holy', boss: true,
    length: L(2500), shrineHp: 12500, baseHp: 17400, enemyScale: 2.56 /* 2026-11-25 進化に合わせて ×1.83（元 9500・1.4） */, mana: { ...MANA, start: 400 },
    spawns: [
      { who: 'paladin', start: 3, every: 13, max: 3 },
      { who: 'swordsman', start: 6, every: 8, max: 3 },
      { who: 'archer', start: 12, every: 10, max: 3 },
      { who: 'high_priest', start: 30, every: 22, max: 2 } /* 2026-11-25：見習い僧侶 → 高位神官 */,
      { who: 'rider', start: 45, every: 14, max: 2 },
      { trigger: { baseBelow: 0.6 }, hero: 'holy_captain', wave: [{ who: 'holy_captain', count: 1 }, { who: 'paladin', count: 2 }], gap: 0.8 },
      { trigger: { baseBelow: 0.25 }, wave: [{ who: 'paladin', count: 2 }, { who: 'high_priest', count: 1 }, { who: 'archer', count: 2 }], gap: 0.5 },
    ],
    reward: { stones: 750 },
  },
  // ---------------- 第8章 魔法都市（敵編成・ボス・報酬は仮。背景は4ステージとも同じ） ----------------
  '8-1': {
    id: '8-1', chapter: 8, name: '魔法都市の防衛線', theme: 'magic',
    length: L(2400), shrineHp: 12500, baseHp: 19700, enemyScale: 2.63 /* 2026-11-25 進化に合わせて ×1.88（元 10500・1.4） */, mana: MANA,
    spawns: [
      { who: 'magic_knight', start: 3, every: 7, max: 4 } /* 2026-11-25：魔法騎士 */,
      { who: 'knight', start: 8, every: 14, max: 2 },
      { who: 'mage', start: 10, every: 12, max: 2 },
      { who: 'archer', start: 16, every: 11, max: 2 },
      { who: 'priest', start: 30, every: 22, max: 1 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'mage', count: 2 }, { who: 'knight', count: 1 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'paladin', count: 1 }, { who: 'mage', count: 1 }, { who: 'ice_mage', count: 1 }], gap: 0.6 },
    ],
    reward: { stones: 600 },
  },
  '8-2': {
    id: '8-2', chapter: 8, name: '魔法都市の反撃', theme: 'magic',
    length: L(2400), shrineHp: 12500, baseHp: 17800, enemyScale: 2.38 /* 2026-11-25 進化に合わせて ×1.7（元 10500・1.4） */, mana: MANA,
    spawns: [
      { who: 'magic_knight', start: 3, every: 7, max: 3 } /* 2026-11-25：魔法騎士 */,
      { who: 'mage', start: 6, every: 10, max: 3 },
      { who: 'paladin', start: 12, every: 15, max: 2 },
      { who: 'ice_mage', start: 18, every: 11, max: 2 } /* 2026-11-25：氷結魔導士 */,
      { who: 'priest', start: 28, every: 22, max: 1 },
      { who: 'rider', start: 45, every: 15, max: 2 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'mage', count: 3 }, { who: 'heavy', count: 1 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'elite_mage', count: 1 }, { who: 'mage', count: 2 }, { who: 'knight', count: 1 }], gap: 0.6 },
    ],
    reward: { stones: 650 },
  },
  '8-3': {
    id: '8-3', chapter: 8, name: '精鋭魔導士団', theme: 'magic',
    length: L(2500), shrineHp: 13000, baseHp: 17500, enemyScale: 2.58 /* 2026-11-25 進化に合わせて ×1.84（元 9500・1.4） */, mana: { ...MANA, start: 300 },
    spawns: [
      { who: 'elite_mage', start: 6, every: 18, max: 1 },
      { who: 'magic_knight', start: 3, every: 7, max: 3 } /* 2026-11-25：魔法騎士 */,
      { who: 'paladin', start: 10, every: 15, max: 2 },
      { who: 'mage', start: 14, every: 12, max: 2 },
      { who: 'ice_mage', start: 30, every: 22, max: 1 } /* 2026-11-25：氷結魔導士 */,
      { trigger: { baseBelow: 0.5 }, hero: 'mage_captain', wave: [{ who: 'mage_captain', count: 1 }, { who: 'elite_mage', count: 1 }], gap: 0.8 },
      { trigger: { baseBelow: 0.25 }, wave: [{ who: 'paladin', count: 2 }, { who: 'mage', count: 2 }], gap: 0.5 },
    ],
    reward: { stones: 700 },
  },
  '8-4': {
    id: '8-4', chapter: 8, name: '魔法都市の最終決戦', theme: 'magic', boss: true,
    length: L(2500), shrineHp: 13500, baseHp: 18900, enemyScale: 2.65 /* 2026-11-25 進化に合わせて ×1.89（元 10000・1.4） */, mana: { ...MANA, start: 400 },
    spawns: [
      { who: 'paladin', start: 3, every: 16, max: 1 },
      { who: 'magic_knight', start: 5, every: 8, max: 3 } /* 2026-11-25：魔法騎士 */,
      { who: 'elite_mage', start: 10, every: 18, max: 1 },
      { who: 'mage', start: 14, every: 12, max: 2 },
      { who: 'ice_mage', start: 32, every: 24, max: 1 } /* 2026-11-25：氷結魔導士 */,
      { who: 'rider', start: 50, every: 15, max: 2 },
      { trigger: { baseBelow: 0.6 }, hero: 'archmage', wave: [{ who: 'archmage', count: 1 }, { who: 'elite_mage', count: 1 }], gap: 0.8 },
      { trigger: { baseBelow: 0.25 }, wave: [{ who: 'paladin', count: 1 }, { who: 'mage', count: 2 }, { who: 'archer', count: 1 }], gap: 0.5 },
    ],
    reward: { stones: 850 },
  },
  // ---------------- 第9章 人間界の王都（敵編成・ボス・報酬は仮。背景は4ステージとも同じ。人間軍の兵種を総動員） ----------------
  '9-1': {
    id: '9-1', chapter: 9, name: '人間軍の連合部隊', theme: 'capital',
    length: L(2500), shrineHp: 13500, baseHp: 19400, enemyScale: 2.68 /* 2026-11-25 進化に合わせて ×1.85（元 10500・1.45） */, mana: MANA,
    spawns: [
      { who: 'royal_guard', start: 3, every: 9, max: 2 } /* 2026-11-25：王国近衛兵 */,
      { who: 'shield', start: 6, every: 14, max: 1 },
      { who: 'knight', start: 9, every: 15, max: 2 },
      { who: 'archer', start: 14, every: 11, max: 2 },
      { who: 'mage', start: 20, every: 14, max: 1 },
      { who: 'priest', start: 32, every: 24, max: 1 },
      { who: 'royal_guard_cavalry', start: 45, every: 15, max: 2 } /* 2026-11-25：王国近衛騎兵 */,
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'guardian', count: 1 }, { who: 'knight', count: 1 }, { who: 'naval_soldier', count: 1 }, { who: 'engineer', count: 1 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'heavy', count: 1 }, { who: 'mage', count: 1 }, { who: 'swordsman', count: 1 }, { who: 'rider', count: 2 }], gap: 0.6 },
    ],
    reward: { stones: 800 },
  },
  '9-2': {
    id: '9-2', chapter: 9, name: '人間軍の総攻撃', theme: 'capital',
    length: L(2500), shrineHp: 14000, baseHp: 21400, enemyScale: 2.83 /* 2026-11-25 進化に合わせて ×1.95（元 11000・1.45） */, mana: MANA,
    spawns: [
      { who: 'royal_guard', start: 3, every: 9, max: 2 } /* 2026-11-25：王国近衛兵 */,
      { who: 'heavy', start: 8, every: 20, max: 1 },
      { who: 'mage', start: 12, every: 13, max: 2 },
      { who: 'paladin', start: 18, every: 18, max: 1 },
      { who: 'archer', start: 22, every: 11, max: 2 },
      { who: 'priest', start: 34, every: 24, max: 1 },
      { trigger: { baseBelow: 0.65 }, wave: [{ who: 'heavy', count: 1 }, { who: 'elite_mage', count: 1 }, { who: 'paladin', count: 1 }], gap: 0.6 },
      { trigger: { baseBelow: 0.35 }, wave: [{ who: 'knight', count: 1 }, { who: 'ancient_soldier', count: 1 }, { who: 'mage', count: 1 }, { who: 'ice_mage', count: 1 }, { who: 'royal_guard_cavalry', count: 2 }], gap: 0.5 },
    ],
    reward: { stones: 850 },
  },
  '9-3': {
    id: '9-3', chapter: 9, name: '王国最強の軍団', theme: 'capital',
    length: L(2500), shrineHp: 14000, baseHp: 20600, enemyScale: 2.84 /* 2026-11-25 進化に合わせて ×1.96（元 10500・1.45） */, mana: { ...MANA, start: 300 },
    spawns: [
      { who: 'knight', start: 3, every: 14, max: 1 },
      { who: 'royal_guard', start: 5, every: 10, max: 2 } /* 2026-11-25：王国近衛兵 */,
      { who: 'elite_mage', start: 10, every: 18, max: 1 },
      { who: 'guardian', start: 16, every: 20, max: 1 },
      { who: 'archer', start: 20, every: 11, max: 2 },
      { who: 'priest', start: 32, every: 24, max: 1 },
      { trigger: { baseBelow: 0.5 }, hero: 'royal_commander', wave: [{ who: 'royal_commander', count: 1 }, { who: 'knight', count: 1 }], gap: 0.8 },
      { trigger: { baseBelow: 0.25 }, wave: [{ who: 'paladin', count: 1 }, { who: 'heavy', count: 1 }, { who: 'court_mage', count: 1 }, { who: 'high_priest', count: 1 }], gap: 0.5 },
    ],
    reward: { stones: 900 },
  },
  '9-4': {
    id: '9-4', chapter: 9, name: '人間界の最終決戦', theme: 'capital', boss: true,
    length: L(2600), shrineHp: 14500, baseHp: 21000, enemyScale: 2.8 /* 2026-11-25 進化に合わせて ×2（元 10500・1.4） */, mana: { ...MANA, start: 400 },
    spawns: [
      { who: 'royal_guard', start: 3, every: 9, max: 2 } /* 2026-11-25：王国近衛兵 */,
      { who: 'knight', start: 6, every: 14, max: 2 },
      { who: 'mage', start: 10, every: 13, max: 2 },
      { who: 'archer', start: 20, every: 11, max: 2 },
      { who: 'shield', start: 30, every: 22, max: 1 },
      { who: 'royal_guard_cavalry', start: 50, every: 15, max: 2 } /* 2026-11-25：王国近衛騎兵 */,
      { trigger: { baseBelow: 0.6 }, hero: 'supreme_commander', wave: [{ who: 'supreme_commander', count: 1 }, { who: 'heavy', count: 1 }], gap: 0.8 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'guardian', count: 1 }, { who: 'magic_knight', count: 1 }, { who: 'paladin', count: 1 }, { who: 'rider', count: 2 }], gap: 0.5 },
    ],
    reward: { stones: 1000 },
  },
  // ---------------- 第10章 天空・勇者の聖域（敵編成・ボス・報酬は仮。背景は5ステージとも同じ） ----------------
  '10-1': {
    id: '10-1', chapter: 10, name: '天空の守護兵', theme: 'sky',
    length: L(2500), shrineHp: 14500, baseHp: 27300, enemyScale: 3.16 /* 2026-11-25 進化に合わせて ×2.18（元 12500・1.45） */, mana: MANA,
    spawns: [
      { who: 'sky_guard', start: 3, every: 10, max: 2 },
      { who: 'swordsman', start: 6, every: 8, max: 2 },
      { who: 'archer', start: 12, every: 11, max: 2 },
      { who: 'knight', start: 18, every: 16, max: 1 },
      { who: 'priest', start: 34, every: 24, max: 1 },
      { trigger: { baseBelow: 0.6 }, wave: [{ who: 'sky_guard', count: 2 }, { who: 'mage', count: 2 }], gap: 0.6 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'sky_guard', count: 2 }, { who: 'rider', count: 2 }], gap: 0.6 },
    ],
    reward: { stones: 1000 },
  },
  '10-2': {
    id: '10-2', chapter: 10, name: '天空の精鋭部隊', theme: 'sky',
    length: L(2500), shrineHp: 15000, baseHp: 29400, enemyScale: 3.28 /* 2026-11-25 進化に合わせて ×2.26（元 13000・1.45） */, mana: MANA,
    spawns: [
      { who: 'sky_guard', start: 3, every: 10, max: 2 },
      { who: 'celestial_mage', start: 8, every: 16, max: 1 } /* 2026-11-25：天空の魔導士 */,
      { who: 'archer', start: 18, every: 11, max: 2 },
      { who: 'celestial_knight', start: 24, every: 24, max: 1 } /* 2026-11-25：天空の守護騎士 */,
      { trigger: { baseBelow: 0.5 }, hero: 'sky_commander', wave: [{ who: 'sky_commander', count: 1 }, { who: 'sky_guard', count: 1 }], gap: 0.8 },
      { trigger: { baseBelow: 0.25 }, wave: [{ who: 'sky_guard', count: 2 }, { who: 'celestial_mage', count: 2 }], gap: 0.5 },
    ],
    reward: { stones: 1050 },
  },
  '10-3': {
    id: '10-3', chapter: 10, name: '聖竜降臨', theme: 'sky', boss: true,
    length: L(2600), shrineHp: 15500, baseHp: 25700, enemyScale: 3.28 /* 2026-11-25 進化に合わせて ×2.34（元 11000・1.4） */, mana: { ...MANA, start: 400 },
    spawns: [
      { who: 'sky_guard', start: 3, every: 11, max: 2 },
      { who: 'archer', start: 10, every: 12, max: 2 },
      { who: 'celestial_mage', start: 16, every: 14, max: 1 } /* 2026-11-25：天空の魔導士 */,
      { who: 'rider', start: 40, every: 16, max: 2 },
      { trigger: { baseBelow: 0.6 }, hero: 'holy_dragon', wave: [{ who: 'holy_dragon', count: 1 }], gap: 0.8 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'sky_guard', count: 2 }, { who: 'knight', count: 1 }, { who: 'mage', count: 1 }], gap: 0.5 },
    ],
    reward: { stones: 1200 },
  },
  '10-4': {
    id: '10-4', chapter: 10, name: '最後の守護者たち', theme: 'sky',
    length: L(2600), shrineHp: 15500, baseHp: 22900, enemyScale: 2.89 /* 2026-11-25 進化に合わせて ×1.99（元 11500・1.45） */, mana: { ...MANA, start: 300 },
    spawns: [
      { who: 'sky_guard', start: 3, every: 10, max: 2 },
      { who: 'guardian', start: 8, every: 20, max: 1 },
      { who: 'celestial_mage', start: 12, every: 18, max: 1 } /* 2026-11-25：天空の魔導士 */,
      { who: 'archer', start: 18, every: 11, max: 2 },
      { who: 'celestial_knight', start: 26, every: 22, max: 1 } /* 2026-11-25：天空の守護騎士 */,
      { trigger: { baseBelow: 0.5 }, hero: 'sky_guardian', wave: [{ who: 'sky_guardian', count: 1 }, { who: 'sky_guard', count: 1 }], gap: 0.8 },
      { trigger: { baseBelow: 0.25 }, wave: [{ who: 'paladin', count: 1 }, { who: 'heavy', count: 1 }, { who: 'mage', count: 2 }], gap: 0.5 },
    ],
    reward: { stones: 1200 },
  },
  // 最終決戦：たけ・サイは最初から、マスター・ヤナイは拠点HP60%で。勇者は倒されると「撤退」（死亡の描写なし）
  '10-5': {
    id: '10-5', chapter: 10, name: '勇者たちとの最終決戦', theme: 'sky', boss: true, final: true,
    length: L(2700), shrineHp: 16000, baseHp: 23500, enemyScale: 2.62 /* 2026-11-25 進化に合わせて ×1.81（元 13000・1.45） */, mana: { ...MANA, start: 500 },
    spawns: [
      { trigger: { baseBelow: 1.0 }, hero: 'take', wave: [{ who: 'take', count: 1 }, { who: 'sai', count: 1 }], gap: 1.5 },
      { who: 'sky_guard', start: 6, every: 11, max: 2 },
      { who: 'archer', start: 12, every: 12, max: 2 },
      { who: 'celestial_mage', start: 20, every: 15, max: 1 } /* 2026-11-25：天空の魔導士 */,
      { who: 'rider', start: 45, every: 16, max: 2 },
      { trigger: { baseBelow: 0.6 }, hero: 'yanai', wave: [{ who: 'yanai', count: 1 }, { who: 'sky_guard', count: 1 }], gap: 0.8 },
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'sky_guard', count: 2 }, { who: 'knight', count: 1 }, { who: 'elite_mage', count: 1 }], gap: 0.5 },
    ],
    reward: { stones: 2000 },
  },
  // ---------------- 特別：壊滅した町（竜人オルド）。能力・報酬は仮（別途調整） ----------------
  // forced：初戦は強制敗北（main.js が台本の秒数で終わらせる）。再戦は通常の勝敗で、勝つとオルドが加入（reward.unlock）
  'ex-1': {
    id: 'ex-1', chapter: 'ex', name: '壊滅した町', theme: 'ruin', boss: true,
    length: L(2300), shrineHp: 8000, baseHp: 6000, enemyScale: 1.0, mana: { ...MANA, start: 500 },
    spawns: [
      { trigger: { baseBelow: 1.0 }, hero: 'ord', wave: [{ who: 'ord', count: 1 }], gap: 0.6 }, // 始まってすぐ登場（帯：竜人オルド 参上！）
    ],
    reward: { stones: 500, unlock: 'ord' },
  },
};