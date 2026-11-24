/* 人間軍（調整用の数値。すべて仮）。項目は js/core/battle.js の先頭。
 * note：偵察報告の特徴（危険な能力）／counter：対抗のヒント（編成画面の敵軍情報に出す）。
 * mana：倒したときに魔王軍が得る魔力。guard：受けるダメージの軽減率。
 * ステージごとの強さは stages.js の enemyScale（HP・攻撃にかける倍率）。 */
export const HUMANS = {
  militia: {
    name: '自警団', role: '量産',
    note: '数が多い。1体は弱い', counter: '範囲攻撃でまとめて倒す',
    hp: 130, atk: 11, range: 28, speed: 40, interval: 1.3, windup: 0.4, kb: 3, attack: 'single', mana: 25, size: 0.85,
  },
  swordsman: {
    name: '見習い剣士', role: '前衛',
    note: '打たれ強い前衛', counter: '前衛・高HPで受け止める',
    hp: 380, atk: 26, range: 34, speed: 36, interval: 1.5, windup: 0.45, kb: 3, attack: 'single', mana: 55, size: 0.95,
  },
  archer: {
    name: '弓兵', role: '遠距離',
    note: '柵の後ろから矢を撃つ', counter: '足の速い魔物で近づく',
    hp: 150, atk: 22, range: 180, speed: 32, interval: 2.4, windup: 0.5, kb: 2, attack: 'single', projectile: 'arrow', mana: 45, size: 0.9,
  },
  shield: {
    name: '盾兵', role: 'タンク',
    note: '受けるダメージを減らす（硬い）', counter: '強い一撃・範囲攻撃',
    hp: 750, atk: 12, range: 26, speed: 22, interval: 2.2, windup: 0.5, kb: 2, attack: 'single', guard: 0.2, mana: 80, size: 1.05,
  },
  priest: {
    name: '見習い僧侶', role: '支援',
    note: 'まわりの仲間を回復する', counter: '遠くから先に倒す',
    hp: 200, atk: 6, range: 110, speed: 30, interval: 2.0, windup: 0.4, kb: 2, attack: 'single', projectile: 'bubble', mana: 70, size: 0.9,
    heal: { every: 5, ratio: 0.1, radius: 150 },
  },
  rider: {
    name: '子馬の騎兵', role: '高速',
    note: '足が速く、一気に祠へ迫る', counter: '前衛で足止め',
    hp: 320, atk: 26, range: 34, speed: 88, interval: 1.1, windup: 0.3, kb: 2, attack: 'single', mana: 60, size: 1.0,
  },
  // ---- 勇者（1-5 のボス）。拠点HPの割合で1回だけ登場。倒すと撤退 ----
  take: {
    name: '勇者たけ', role: '勇者', hero: true, noKbFromSmall: true,
    note: '2連撃と飛ぶ斬撃。小さな魔物では押し返せない', counter: '回復役と高HPで持ちこたえ、呪文や幹部で押す',
    hp: 4800, atk: 70, range: 40, speed: 34, interval: 1.5, windup: 0.35, kb: 6, attack: 'single', mana: 400, size: 1.35,
    hits: 2, hitGap: 0.2,          // 近接の2連撃
    blowAway: true,                // 通常攻撃でも当てた魔物を吹き飛ばす
    skills: [{ id: 'wave', name: '飛ぶ斬撃', type: 'wave', every: 7, first: 3, windup: 0.8, recover: 0.4, reach: 340, mult: 2.2 }],
  },
  sai: {
    name: '勇者サイ', role: '勇者', hero: true, noKbFromSmall: true,
    note: '仲間を回復し、光で魔物を気絶させる', counter: '遠距離で狙い、まとめて押し切る',
    hp: 3200, atk: 42, range: 190, speed: 30, interval: 2.0, windup: 0.45, kb: 5, attack: 'single', projectile: 'orb', mana: 300, size: 1.3,
    skills: [
      { id: 'heal', name: '回復の光', type: 'heal', every: 9, first: 3, windup: 0.6, recover: 0.4, radius: 260, ratio: 0.2 },
      { id: 'stun', name: 'まばゆい光', type: 'stun', every: 9, first: 5, windup: 0.9, recover: 0.4, reach: 260, duration: 2.5 },
    ],
  },
};

// 勇者の登場の一言（ボス戦は少しシリアスに）
export const HERO_LINES = {
  take: { who: '勇者たけ', text: 'これ以上、村には近づけさせない！' },
  sai: { who: '勇者サイ', text: 'たけ、うしろは任せて。みんなはわたしが守る！' },
};
