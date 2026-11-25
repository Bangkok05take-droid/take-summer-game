/* 戦闘の共通設定と第1章のステージ（数値はすべて仮）
 *
 * 敵の出し方（spawns）
 *   { who, start, every, max, until? }   start 秒から every 秒ごと。max はこの行で出した敵が同時に何体まで
 *   { trigger: { baseBelow }, wave: [{ who, count }], gap, hero?, line? }
 *                                        拠点HPがその割合以下になったら1回だけ、gap 秒間隔で順に出す
 */
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
    id: '1-2', chapter: 1, name: '麦畑の柵', theme: 'wheat', tutorial: 'hints',
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
    talk: [
      { who: 'ワーン', text: 'うちの麦畑だけは渡さないよ！ 弓の得意な人、柵の後ろへ！' },
      { who: 'ティウ', text: '魔物って、近くで見ると意外とかわいい……いや、こわい！' },
    ],
  },
  '1-3': {
    id: '1-3', chapter: 1, name: '小川の橋', theme: 'river', tutorial: 'self',
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
      { trigger: { baseBelow: 0.3 }, wave: [{ who: 'shield', count: 1 }, { who: 'archer', count: 3 }, { who: 'rider', count: 3 }], gap: 0.6 },
    ],
    reward: { stones: 250, unlock: 'charger' }, // 第1章クリア：幹部・突進（第2章で使う）
    talk: [
      { who: 'コイ', text: '橋は鍛冶屋のおれが直したばかりなんだ。こわされてたまるか！' },
      { who: 'ティウ', text: '子馬の騎兵隊、出発！ ……はやっ！' },
    ],
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
};
