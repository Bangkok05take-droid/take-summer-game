/* 人間軍（調整用の数値。すべて仮）。項目は js/core/battle.js の先頭。
 * line：'back' は後衛（魔王軍の後衛狙撃型に狙われる）。無ければ前衛。
 * note：偵察報告の特徴（危険な能力）／counter：対抗のヒント（編成画面の敵軍情報に出す）。
 * mana：倒したときに魔王軍が得る魔力。guard：受けるダメージの軽減率。
 * ステージごとの強さは stages.js の enemyScale（HP・攻撃にかける倍率）。 */
export const HUMANS = {
  militia: {
    name: '自警団', role: '量産',
    note: '数が多い。1体は弱い', counter: '範囲攻撃でまとめて倒す',
    hp: 110, atk: 11, range: 28, speed: 40, interval: 1.3, windup: 0.4, kb: 3, attack: 'single', mana: 25, size: 0.85, // 2026-11-25：130 → 110（しぶといので弱く）
  },
  swordsman: {
    name: '見習い剣士', role: '前衛',
    note: '打たれ強い前衛', counter: '前衛・高HPで受け止める',
    hp: 325, atk: 26, range: 34, speed: 36, interval: 1.5, windup: 0.45, kb: 3, attack: 'single', mana: 55, size: 0.95, // 2026-11-25：380 → 325（しぶといので弱く）
  },
  archer: {
    name: '弓兵', role: '遠距離', line: 'back',
    note: '柵の後ろから矢を撃つ', counter: '足の速い魔物で近づく',
    hp: 130, atk: 22, range: 180, speed: 32, interval: 2.4, windup: 0.5, kb: 2, attack: 'single', projectile: 'arrow', mana: 45, size: 0.9, // 2026-11-25：150 → 130（しぶといので弱く）
  },
  shield: {
    name: '盾兵', role: 'タンク',
    note: '受けるダメージを減らす（硬い）', counter: '強い一撃・範囲攻撃',
    hp: 640, atk: 12, range: 26, speed: 22, interval: 2.2, windup: 0.5, kb: 2, attack: 'single', guard: 0.2, mana: 80, size: 1.05, // 2026-11-25：750 → 640（しぶといので弱く）
  },
  priest: {
    name: '見習い僧侶', role: '支援', line: 'back',
    note: 'まわりの仲間を回復する', counter: '遠くから先に倒す',
    hp: 170, atk: 6, range: 110, speed: 30, interval: 2.0, windup: 0.4, kb: 2, attack: 'single', projectile: 'bubble', mana: 70, size: 0.9, // 2026-11-25：200 → 170（しぶといので弱く）
    heal: { every: 5, ratio: 0.1, radius: 150 },
  },
  rider: {
    name: '子馬の騎兵', role: '高速',
    note: '足が速く、一気に祠へ迫る', counter: '前衛で足止め',
    hp: 270, atk: 26, range: 34, speed: 88, interval: 1.1, windup: 0.3, kb: 2, attack: 'single', mana: 60, size: 1.0, // 2026-11-25：320 → 270（しぶといので弱く）
  },
  // ---- 第2章のボス（2026-11-25・仮）。拠点HP60%で1回だけ登場。絵は届くまで見習い剣士の絵を大きくして使う ----
  captain: {
    name: '警備隊長', role: '強敵', hero: true, noKbFromSmall: true,
    note: '2連撃と飛ぶ斬撃。小さな魔物では押し返せない', counter: '岩男で受け止め、魔法使い・呪文・幹部で押し切る',
    hp: 2800, atk: 42, range: 40, speed: 32, interval: 1.6, windup: 0.4, kb: 6, attack: 'single', mana: 350, size: 1.3,
    hits: 2, hitGap: 0.2,
    skills: [{ id: 'wave', name: '鋭い一閃', type: 'wave', every: 8, first: 4, windup: 0.8, recover: 0.4, reach: 280, mult: 1.8 }],
  },
  // ---- 第3章（2026-11-25・仮）。絵は届くまで既存の兵士の絵を大きくして使う ----
  knight: {
    name: '王国騎士', role: '重装前衛',
    note: 'よく訓練された硬い騎士。小さな魔物では押し返せない', counter: '岩男で受け止め、魔法使いの範囲・木槌小鬼の重い一撃で崩す',
    hp: 900, atk: 34, range: 36, speed: 26, interval: 1.7, windup: 0.45, kb: 3, attack: 'single', guard: 0.15, noKbFromSmall: true, mana: 110, size: 1.1,
  },
  king: {
    name: '国王', role: '強敵', hero: true, noKbFromSmall: true,
    note: '号令で仲間を回復し、王家の剣で前方の魔物を吹き飛ばす', counter: '後衛（僧侶）を木槌小鬼で先に倒し、呪文と幹部で押し切る',
    hp: 2800, atk: 34, range: 44, speed: 24, interval: 1.8, windup: 0.5, kb: 6, attack: 'single', mana: 400, size: 1.35,
    skills: [
      { id: 'heal', name: '王の号令', type: 'heal', every: 14, first: 6, windup: 0.6, recover: 0.4, radius: 220, ratio: 0.1 },
      { id: 'wave', name: '王家の剣', type: 'wave', every: 9, first: 6, windup: 0.9, recover: 0.4, reach: 240, mult: 1.6 },
    ],
  },
  // ---- 第4章のボス（2026-11-25・仮）。絵は届くまで警備隊長と同じ代用（見習い剣士の絵を大きく） ----
  harbor_captain: {
    name: '港の守備隊長', role: '強敵', hero: true, noKbFromSmall: true,
    note: '錨の一撃で前方の魔物を吹き飛ばす', counter: '岩男で受け止め、ワニ将軍の突進と呪文で押し返す',
    hp: 3000, atk: 40, range: 46, speed: 26, interval: 1.8, windup: 0.5, kb: 6, attack: 'single', mana: 450, size: 1.4,
    skills: [{ id: 'wave', name: '錨の一撃', type: 'wave', every: 9, first: 4, windup: 0.9, recover: 0.4, reach: 260, mult: 1.8 }],
  },
  // ---- 第5章（2026-11-25・仮）。兵器・重装兵のデザインは未承認なので、絵は既存の兵士の絵で代用 ----
  turret: {
    name: '防衛砲台', role: '防衛兵器・後衛', line: 'back',
    note: '動かない。とても遠くから砲弾を撃ち、まとめて吹き飛ばす', counter: 'こうもりで一気に近づくか、木槌小鬼で後ろから壊す',
    hp: 800, atk: 22, range: 260, speed: 0, interval: 4.0, windup: 0.9, kb: 2, attack: 'area', projectile: 'orb', noKbFromSmall: true, mana: 120, size: 1.1,
  },
  heavy: {
    name: '重装兵', role: '重装前衛',
    note: '魔物との戦いのために作られた鎧。受けるダメージを大きく減らす', counter: '魔法使いの範囲・木槌小鬼の重い一撃・ワニ将軍の突進で崩す',
    hp: 1100, atk: 30, range: 34, speed: 22, interval: 1.8, windup: 0.5, kb: 3, attack: 'single', guard: 0.35, noKbFromSmall: true, mana: 130, size: 1.15,
  },
  commander: {
    name: '要塞司令官', role: '強敵', hero: true, noKbFromSmall: true,
    note: '号令で仲間を回復し、砲撃の合図で前方の魔物を吹き飛ばす', counter: '防衛砲台と僧侶を先に壊し、呪文と幹部で押し切る',
    hp: 2600, atk: 34, range: 44, speed: 22, interval: 1.8, windup: 0.5, kb: 6, attack: 'single', mana: 500, size: 1.4,
    skills: [
      { id: 'heal', name: '司令官の号令', type: 'heal', every: 20, first: 8, windup: 0.6, recover: 0.4, radius: 200, ratio: 0.06 },
      { id: 'wave', name: '一斉砲撃', type: 'wave', every: 11, first: 5, windup: 1.0, recover: 0.4, reach: 260, mult: 1.5 },
    ],
  },
  // ---- 第6章（2026-11-25・仮）。守護者・古代王のデザインは未承認なので、絵は既存の兵士の代用 ----
  guardian: {
    name: '守護者', role: '古代の守り手',
    note: '何百年も宝を守り続ける古代王国の兵。硬く、倒れるまで退かない', counter: '魔法使いの範囲と木槌小鬼の重い一撃、ワニ将軍の突進で崩す',
    hp: 1000, atk: 32, range: 36, speed: 20, interval: 1.9, windup: 0.5, kb: 2, attack: 'single', guard: 0.25, noKbFromSmall: true, mana: 140, size: 1.15,
  },
  ancient_king: {
    name: '古代王', role: '強敵', hero: true, noKbFromSmall: true,
    note: '魔力結晶を守る古代王国の王。守護者を癒やし、古代の魔力で前方の魔物をなぎ払う', counter: '回復役を先に倒し、呪文と幹部で一気に押し切る',
    hp: 2600, atk: 34, range: 44, speed: 18, interval: 2.0, windup: 0.6, kb: 6, attack: 'single', mana: 600, size: 1.45,
    skills: [
      { id: 'heal', name: '古代の加護', type: 'heal', every: 18, first: 8, windup: 0.6, recover: 0.4, radius: 220, ratio: 0.08 },
      { id: 'wave', name: '古代の魔力', type: 'wave', every: 10, first: 5, windup: 1.0, recover: 0.4, reach: 280, mult: 1.6 },
    ],
  },
  // ---- 特殊イベント「壊滅した町」（2026-11-25・仮）。絵はビジュアル制作室の納品待ち（それまでは仮の絵） ----
  ord: {
    name: '竜人オルド', role: '竜の戦士', hero: true, noKbFromSmall: true,
    note: 'たった一人で町を滅ぼした竜の戦士。まわりの魔物をまとめてなぎ払う', counter: '岩男と森のお化けで持ちこたえ、ワニ将軍の突進と呪文で押し返す',
    hp: 6500, atk: 80, range: 60, speed: 22, interval: 1.8, windup: 0.5, kb: 8, attack: 'area', mana: 600, size: 1.6,
    blowAway: true,
    skills: [{ id: 'wave', name: '竜の一閃', type: 'wave', every: 8, first: 3, windup: 0.9, recover: 0.4, reach: 300, mult: 2.0 }],
  },
  // ---- 勇者（1-5 のボス）。拠点HPの割合で1回だけ登場。倒すと撤退 ----
  take: {
    name: '勇者たけ', role: '勇者', hero: true, noKbFromSmall: true,
    note: '2連撃と飛ぶ斬撃。小さな魔物では押し返せない', counter: '回復役と高HPで持ちこたえ、呪文や幹部で押す',
    hp: 3840, atk: 70, range: 40, speed: 34, interval: 1.5, windup: 0.35, kb: 6, attack: 'single', mana: 400, size: 1.35, // 2026-11-25：4800 → 3840（しぶといので弱く）
    hits: 2, hitGap: 0.2,          // 近接の2連撃
    blowAway: true,                // 通常攻撃でも当てた魔物を吹き飛ばす
    skills: [{ id: 'wave', name: '飛ぶ斬撃', type: 'wave', every: 7, first: 3, windup: 0.8, recover: 0.4, reach: 340, mult: 2.2 }],
  },
  sai: {
    name: '勇者サイ', role: '勇者', hero: true, noKbFromSmall: true, line: 'back',
    note: '仲間を回復し、光で魔物を気絶させる', counter: '遠距離で狙い、まとめて押し切る',
    hp: 2560, atk: 42, range: 190, speed: 30, interval: 2.0, windup: 0.45, kb: 5, attack: 'single', projectile: 'orb', mana: 300, size: 1.3, // 2026-11-25：3200 → 2560（しぶといので弱く）
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
