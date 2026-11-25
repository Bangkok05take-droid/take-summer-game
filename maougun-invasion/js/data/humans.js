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
  // ---- 第1〜3章の追加キャラクター（2026-11-25・ビジュアル制作室の承認済みデザイン 11528.png） ----
  militia_captain: {
    name: '自警団長', role: '強敵', hero: true, noKbFromSmall: true,
    note: '村の自警団をまとめる力自慢。大きな斧で前の魔物をまとめて押し返す', counter: '岩男で受け止め、魔法使いと呪文で押し切る',
    hp: 1300, atk: 26, range: 40, speed: 30, interval: 1.6, windup: 0.45, kb: 5, attack: 'single', mana: 200, size: 1.25,
    skills: [{ id: 'wave', name: '大斧の一撃', type: 'wave', every: 12, first: 5, windup: 1.0, recover: 0.4, reach: 170, mult: 1.3 }],
  },
  court_mage: {
    name: '宮廷魔導士', role: '後衛（魔法）', line: 'back',
    note: '王国に仕える魔導士。後ろから魔法弾を撃つ。打たれ弱い', counter: '木槌小鬼で後ろから倒すか、こうもりで一気に近づく',
    hp: 320, atk: 24, range: 180, speed: 26, interval: 2.4, windup: 0.6, kb: 2, attack: 'single', projectile: 'orb', mana: 90, size: 1.0,
  },
  knight_commander: {
    name: '王国騎士団長', role: '強敵', hero: true, noKbFromSmall: true,
    note: '王国騎士団を率いる歴戦の騎士。号令で仲間を回復し、大剣で前方の魔物を吹き飛ばす', counter: '宮廷魔導士と僧侶を木槌小鬼で先に倒し、呪文と幹部で押し切る',
    hp: 2800, atk: 34, range: 44, speed: 24, interval: 1.8, windup: 0.5, kb: 6, attack: 'single', guard: 0.1, mana: 400, size: 1.4,
    skills: [
      { id: 'heal', name: '騎士団の号令', type: 'heal', every: 14, first: 6, windup: 0.6, recover: 0.4, radius: 220, ratio: 0.1 },
      { id: 'wave', name: '騎士団長の大剣', type: 'wave', every: 9, first: 6, windup: 0.9, recover: 0.4, reach: 240, mult: 1.6 },
    ],
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
    note: '大きな剣の一撃で前方の魔物を吹き飛ばす', counter: '岩男で受け止め、ワニ将軍の突進と呪文で押し返す',
    hp: 3000, atk: 40, range: 46, speed: 26, interval: 1.8, windup: 0.5, kb: 6, attack: 'single', mana: 450, size: 1.4,
    skills: [{ id: 'wave', name: '大剣の一撃', type: 'wave', every: 9, first: 4, windup: 0.9, recover: 0.4, reach: 260, mult: 1.8 }],
  },
  // ---- 第5章（2026-11-25・仮）。兵器・重装兵のデザインは未承認なので、絵は既存の兵士の絵で代用 ----
  turret: {
    name: '移動式大砲', role: '兵器・後衛', line: 'back', // 2026-11-25：防衛砲台から名前を変更（キーはそのまま）
    note: 'ゆっくり前に出ながら、とても遠くから砲弾を撃ち、まとめて吹き飛ばす', counter: 'こうもりで一気に近づくか、木槌小鬼で後ろから壊す',
    hp: 800, atk: 22, range: 260, speed: 8, interval: 4.0, windup: 0.9, kb: 2, attack: 'area', projectile: 'orb', noKbFromSmall: true, mana: 120, size: 1.1,
  },
  heavy: {
    name: '重装兵', role: '重装前衛',
    note: '魔物との戦いのために作られた鎧とハンマー。受けるダメージを大きく減らす', counter: '魔法使いの範囲・木槌小鬼の重い一撃・ワニ将軍の突進で崩す',
    hp: 1100, atk: 30, range: 34, speed: 22, interval: 1.8, windup: 0.5, kb: 3, attack: 'single', guard: 0.35, noKbFromSmall: true, mana: 130, size: 1.15,
  },
  commander: {
    name: '要塞司令官', role: '強敵', hero: true, noKbFromSmall: true,
    note: '号令で仲間を回復し、巨大な機械の拳で前方の魔物を吹き飛ばす', counter: '移動式大砲と僧侶を先に壊し、呪文と幹部で押し切る',
    hp: 2600, atk: 34, range: 44, speed: 22, interval: 1.8, windup: 0.5, kb: 6, attack: 'single', mana: 500, size: 1.4,
    skills: [
      { id: 'heal', name: '司令官の号令', type: 'heal', every: 20, first: 8, windup: 0.6, recover: 0.4, radius: 200, ratio: 0.06 },
      { id: 'wave', name: '機械の鉄拳', type: 'wave', every: 11, first: 5, windup: 1.0, recover: 0.4, reach: 260, mult: 1.5 },
    ],
  },
  // ---- 第4〜5章の追加キャラクター（2026-11-25・承認済みデザイン。個別の透過PNGが届くまで絵は既存の兵士の代用） ----
  naval_soldier: {
    name: '海兵', role: '前衛',
    note: '港を守る海の兵。湾曲した剣で斬りかかる', counter: '闇の騎士と岩男で受け止める',
    hp: 300, atk: 20, range: 34, speed: 34, interval: 1.3, windup: 0.3, kb: 2, attack: 'single', mana: 70, size: 1.0,
  },
  engineer: {
    name: '兵器技師', role: '遠距離', line: 'back',
    note: '機械式のクロスボウで、後ろから太い矢を撃つ', counter: 'こうもりで近づくか、木槌小鬼で後ろから倒す',
    hp: 260, atk: 30, range: 200, speed: 28, interval: 2.4, windup: 0.5, kb: 2, attack: 'single', projectile: 'arrow', mana: 80, size: 1.0,
  },
  // 重装兵団長（5-3）：専用デザインが無いので、重装兵の強化個体で暫定対応（絵は重装兵を大きく）
  heavy_captain: {
    name: '重装兵団長', role: '強敵', hero: true, noKbFromSmall: true,
    note: '重装兵団を率いる。特別に固い鎧と大きなハンマーで前の魔物をまとめて押し返す', counter: '魔法使いの範囲・木槌小鬼の重い一撃・ワニ将軍の突進で崩す',
    hp: 1800, atk: 34, range: 38, speed: 20, interval: 1.9, windup: 0.55, kb: 5, attack: 'single', guard: 0.3, mana: 450, size: 1.35,
    skills: [{ id: 'wave', name: '重装の大槌', type: 'wave', every: 12, first: 6, windup: 1.0, recover: 0.4, reach: 200, mult: 1.4 }],
  },
  // ---- 第6章（2026-11-25・仮）。守護者・古代王のデザインは未承認なので、絵は既存の兵士の代用 ----
  guardian: {
    name: '古代の守護者', role: '古代の守り手', // 2026-11-25：守護者から名前を変更（キーはそのまま）
    note: '何百年も宝を守り続ける古代王国の兵。大きな槍を持ち、硬く、倒れるまで退かない', counter: '魔法使いの範囲と木槌小鬼の重い一撃、ワニ将軍の突進で崩す',
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
  // ---- 第7章（2026-11-25・仮）。聖騎士・聖騎士団長のデザインは未承認なので、絵は既存の兵士の代用 ----
  paladin: {
    name: '聖騎士', role: '聖なる前衛',
    note: '剣と盾で戦う聖なる騎士。聖なる加護で、自分とまわりの仲間を少しずつ癒やす。硬い', counter: '魔法使いの範囲と木槌小鬼の重い一撃で一気に削る',
    hp: 950, atk: 34, range: 36, speed: 26, interval: 1.7, windup: 0.45, kb: 3, attack: 'single', guard: 0.2, noKbFromSmall: true, mana: 140, size: 1.15,
    heal: { every: 7, ratio: 0.06, radius: 90 },
  },
  holy_captain: {
    name: '聖騎士団長', role: '強敵', hero: true, noKbFromSmall: true,
    note: '聖なる光で仲間を回復し、聖なる大剣で前方の魔物をなぎ払う', counter: '回復役を先に倒し、呪文と幹部で押し切る',
    hp: 2800, atk: 40, range: 44, speed: 24, interval: 1.7, windup: 0.45, kb: 6, attack: 'single', guard: 0.1, mana: 650, size: 1.45,
    skills: [
      { id: 'heal', name: '聖なる光', type: 'heal', every: 16, first: 6, windup: 0.6, recover: 0.4, radius: 220, ratio: 0.08 },
      { id: 'wave', name: '聖なる大剣', type: 'wave', every: 15, first: 8, windup: 1.1, recover: 0.4, reach: 220, mult: 1.3 },
    ],
  },
  // ---- 第6〜7章の追加キャラクター（2026-11-25・承認済みデザイン。個別の透過PNGが届くまで絵は既存の兵士の代用） ----
  ancient_soldier: {
    name: '古代兵士', role: '前衛',
    note: '古代王国の兵士。湾曲した剣で斬りかかる', counter: '闇の騎士と岩男で受け止める',
    hp: 360, atk: 28, range: 34, speed: 34, interval: 1.4, windup: 0.4, kb: 3, attack: 'single', mana: 65, size: 1.0,
  },
  ancient_priest: {
    name: '古代神官', role: '後衛（魔法）', line: 'back',
    note: '古代の魔法を操る神官。後ろから魔法弾を撃つ', counter: '木槌小鬼で後ろから倒すか、こうもりで一気に近づく',
    hp: 280, atk: 24, range: 180, speed: 26, interval: 2.4, windup: 0.6, kb: 2, attack: 'single', projectile: 'orb', mana: 90, size: 1.0,
  },
  high_priest: {
    name: '高位神官', role: '支援（聖魔法）', line: 'back',
    note: '聖なる魔法で攻撃し、まわりの仲間を回復する', counter: '遠くから先に倒す（木槌小鬼・呪文）',
    hp: 300, atk: 18, range: 170, speed: 28, interval: 2.4, windup: 0.5, kb: 2, attack: 'single', projectile: 'orb', mana: 110, size: 1.0,
    heal: { every: 8, ratio: 0.06, radius: 140 },
  },
  // ---- 第8章（2026-11-25・仮）。魔導兵・魔導士団長・大魔導士のデザインは未承認なので、絵は既存の兵士（見習い僧侶）の代用 ----
  mage: {
    name: '火炎魔導士', // 2026-11-25：魔導兵から名前を変更（キーはそのまま） role: '後衛（魔法）', line: 'back',
    note: '後ろから炎の魔法を撃つ。打たれ弱い', counter: '木槌小鬼で後ろから倒すか、こうもりで一気に近づく',
    hp: 420, atk: 30, range: 200, speed: 26, interval: 2.4, windup: 0.6, kb: 2, attack: 'single', projectile: 'orb', mana: 110, size: 1.0,
  },
  elite_mage: {
    name: '精鋭魔導士', role: '後衛（魔法）', line: 'back', noKbFromSmall: true,
    note: '魔力を増幅した強い魔法弾を2連続で撃つ。結界で受けるダメージを減らす', counter: '木槌小鬼と呪文で先に倒す',
    hp: 700, atk: 32, range: 220, speed: 24, interval: 2.8, windup: 0.7, kb: 3, attack: 'single', hits: 2, hitGap: 0.25, projectile: 'orb', guard: 0.15, mana: 170, size: 1.1,
  },
  mage_captain: {
    name: '魔導士団長', role: '強敵', hero: true, noKbFromSmall: true, line: 'back',
    note: '精鋭魔導士団を率いる。後ろから強い魔法弾を撃ち、魔導砲で前方の魔物をなぎ払う', counter: '前衛で持ちこたえ、木槌小鬼・こうもり・呪文で後ろから崩す',
    hp: 2400, atk: 40, range: 180, speed: 22, interval: 2.4, windup: 0.6, kb: 5, attack: 'single', projectile: 'orb', guard: 0.1, mana: 600, size: 1.35,
    skills: [{ id: 'wave', name: '魔導砲', type: 'wave', every: 15, first: 6, windup: 1.2, recover: 0.4, reach: 240, mult: 1.3 }],
  },
  archmage: {
    name: '大魔導士', role: '強敵', hero: true, noKbFromSmall: true,
    note: '魔法都市の最高位の魔導士。仲間を癒やし、大魔法でなぎ払い、魔物を気絶させる', counter: '回復役を先に倒し、呪文と幹部で一気に押し切る',
    hp: 3000, atk: 46, range: 50, speed: 20, interval: 2.0, windup: 0.6, kb: 6, attack: 'single', projectile: 'orb', guard: 0.1, mana: 800, size: 1.5,
    skills: [
      { id: 'heal', name: '魔力の再生', type: 'heal', every: 22, first: 10, windup: 0.6, recover: 0.4, radius: 220, ratio: 0.05 },
      { id: 'wave', name: '大魔法', type: 'wave', every: 18, first: 6, windup: 1.3, recover: 0.4, reach: 240, mult: 1.3 },
      { id: 'stun', name: '束縛の魔法', type: 'stun', every: 14, first: 9, windup: 0.9, recover: 0.4, reach: 220, duration: 1.8 },
    ],
  },
  // ---- 第8〜9章の追加キャラクター（2026-11-25・承認済みデザイン。個別の透過PNGが届くまで絵は既存の兵士の代用） ----
  ice_mage: {
    name: '氷結魔導士', role: '後衛（魔法）', line: 'back',
    note: '後ろから氷の魔法を撃ち、ときどき凍らせて足を止める', counter: '木槌小鬼で後ろから倒すか、こうもりで一気に近づく',
    hp: 300, atk: 20, range: 190, speed: 26, interval: 2.6, windup: 0.6, kb: 2, attack: 'single', projectile: 'orb', mana: 110, size: 1.0,
    skills: [{ id: 'stun', name: '凍てつく氷', type: 'stun', every: 14, first: 8, windup: 0.8, recover: 0.4, reach: 200, duration: 1.0 }],
  },
  magic_knight: {
    name: '魔法騎士', role: '前衛',
    note: '魔力を宿した剣で斬りかかる騎士', counter: '闇の騎士と岩男で受け止め、魔法使いで崩す',
    hp: 520, atk: 32, range: 36, speed: 30, interval: 1.5, windup: 0.4, kb: 3, attack: 'single', guard: 0.1, mana: 110, size: 1.05,
  },
  royal_guard: {
    name: '王国近衛兵', role: '重装前衛',
    note: '王都を守る近衛兵。剣と盾で守りを固め、とても打たれ強い', counter: '魔法使いの範囲と木槌小鬼の重い一撃で崩す',
    hp: 440, atk: 26, range: 36, speed: 28, interval: 1.6, windup: 0.45, kb: 3, attack: 'single', guard: 0.15, noKbFromSmall: true, mana: 120, size: 1.05,
  },
  royal_guard_cavalry: {
    name: '王国近衛騎兵', role: '高速',
    note: '大きなランスを構えて一気に突っ込んでくる', counter: '岩男で受け止め、まとめて倒す',
    hp: 520, atk: 38, range: 40, speed: 80, interval: 1.4, windup: 0.35, kb: 4, attack: 'single', noKbFromSmall: true, mana: 120, size: 1.15,
  },
  // ---- 第9章（2026-11-25・仮）。王国軍指揮官・人間軍総司令官のデザインは未承認なので、絵は見習い剣士の代用 ----
  royal_commander: {
    name: '王国軍指揮官', role: '強敵', hero: true, noKbFromSmall: true,
    note: '王都直属の精鋭部隊を率いる。号令で仲間を回復し、鋭い突きで前方の魔物を吹き飛ばす', counter: '岩男で受け止め、呪文と幹部で押し切る',
    hp: 2800, atk: 44, range: 44, speed: 24, interval: 1.7, windup: 0.45, kb: 6, attack: 'single', guard: 0.15, mana: 700, size: 1.45,
    skills: [
      { id: 'heal', name: '精鋭の号令', type: 'heal', every: 22, first: 10, windup: 0.6, recover: 0.4, radius: 200, ratio: 0.05 },
      { id: 'wave', name: '王国の槍', type: 'wave', every: 15, first: 6, windup: 1.1, recover: 0.4, reach: 240, mult: 1.4 },
    ],
  },
  supreme_commander: {
    name: '人間軍総司令官', role: '強敵', hero: true, noKbFromSmall: true,
    note: '人間軍の全軍を率いる。号令で仲間を回復し、巨大な大剣でなぎ払い、威圧で魔物を気絶させる', counter: '回復役を先に倒し、最上位の魔物・呪文・幹部で一気に押し切る',
    hp: 3400, atk: 48, range: 46, speed: 22, interval: 1.8, windup: 0.5, kb: 6, attack: 'single', guard: 0.2, mana: 1000, size: 1.6,
    skills: [
      { id: 'heal', name: '総司令官の号令', type: 'heal', every: 24, first: 10, windup: 0.6, recover: 0.4, radius: 220, ratio: 0.05 },
      { id: 'wave', name: '巨大な大剣', type: 'wave', every: 16, first: 6, windup: 1.2, recover: 0.4, reach: 250, mult: 1.4 },
      { id: 'stun', name: '威圧', type: 'stun', every: 15, first: 9, windup: 0.9, recover: 0.4, reach: 200, duration: 1.6 },
    ],
  },
  // ---- 第10章（2026-11-25・仮）。天空の兵・聖竜・マスター・ヤナイのデザインは未承認なので、絵は既存の兵士の代用 ----
  sky_guard: {
    name: '天空の守護兵', role: '聖なる前衛',
    note: '天空の聖域を守る兵。硬く、聖なる槍で突く', counter: '岩男で受け止め、魔法使いと木槌小鬼で崩す',
    hp: 720, atk: 32, range: 38, speed: 28, interval: 1.6, windup: 0.4, kb: 3, attack: 'single', guard: 0.1, noKbFromSmall: true, mana: 130, size: 1.15,
  },
  sky_commander: {
    name: '天空の指揮官', role: '強敵', hero: true, noKbFromSmall: true,
    note: '天空の精鋭部隊を率いる。聖なる号令で仲間を癒やし、光の槍でなぎ払う', counter: '岩男で受け止め、呪文と幹部で押し切る',
    hp: 3000, atk: 46, range: 44, speed: 24, interval: 1.7, windup: 0.45, kb: 6, attack: 'single', guard: 0.15, mana: 900, size: 1.5,
    skills: [
      { id: 'heal', name: '聖なる号令', type: 'heal', every: 22, first: 10, windup: 0.6, recover: 0.4, radius: 200, ratio: 0.05 },
      { id: 'wave', name: '光の槍', type: 'wave', every: 15, first: 6, windup: 1.1, recover: 0.4, reach: 240, mult: 1.4 },
    ],
  },
  // ---- 第10章の追加キャラクター（2026-11-25・承認済みデザイン。個別の透過PNGが届くまで絵は既存の兵士の代用） ----
  celestial_mage: {
    name: '天空の魔導士', role: '後衛（光の魔法）', line: 'back',
    note: '光の魔法を後ろから撃つ、天空の魔導士', counter: '木槌小鬼で後ろから倒すか、こうもりで一気に近づく',
    hp: 340, atk: 28, range: 200, speed: 26, interval: 2.4, windup: 0.6, kb: 2, attack: 'single', projectile: 'orb', mana: 130, size: 1.0,
  },
  celestial_knight: {
    name: '天空の守護騎士', role: '聖なる前衛',
    note: '白い翼の騎士。聖なる大剣で前の魔物をまとめて斬る', counter: '岩男で受け止め、魔法使いと木槌小鬼で崩す',
    hp: 820, atk: 38, range: 42, speed: 26, interval: 1.8, windup: 0.5, kb: 4, attack: 'area', guard: 0.15, noKbFromSmall: true, mana: 170, size: 1.2,
  },
  holy_dragon: {
    name: '聖竜', role: '世界の守護者', hero: true, noKbFromSmall: true,
    note: '世界を守護する伝説の竜。聖なる息吹で前方の魔物をまとめてなぎ払い、光で気絶させる', counter: '岩男と森のお化けで持ちこたえ、最上位の魔物・呪文・幹部で一気に削る',
    hp: 4400, atk: 44, range: 70, speed: 18, interval: 2.2, windup: 0.6, kb: 7, attack: 'area', guard: 0.1, mana: 1500, size: 1.9,
    skills: [
      { id: 'wave', name: '聖なる息吹', type: 'wave', every: 14, first: 5, windup: 1.3, recover: 0.5, reach: 280, mult: 1.5 },
      { id: 'stun', name: '天の光', type: 'stun', every: 16, first: 9, windup: 1.0, recover: 0.4, reach: 220, duration: 1.6 },
    ],
  },
  sky_guardian: {
    name: '天空の守護者', role: '強敵', hero: true, noKbFromSmall: true,
    note: '勇者たちを信じて戦う最後の守り手。盾で守りを固め、仲間を癒やす', counter: '回復役を先に倒し、重い一撃と呪文で押し切る',
    hp: 3400, atk: 42, range: 44, speed: 22, interval: 1.8, windup: 0.5, kb: 6, attack: 'single', guard: 0.25, mana: 1000, size: 1.5,
    skills: [
      { id: 'heal', name: '守護の祈り', type: 'heal', every: 22, first: 10, windup: 0.6, recover: 0.4, radius: 220, ratio: 0.05 },
      { id: 'wave', name: '聖盾の一撃', type: 'wave', every: 16, first: 6, windup: 1.1, recover: 0.4, reach: 230, mult: 1.3 },
    ],
  },
  yanai: {
    name: 'マスター・ヤナイ', role: '勇者の師', hero: true, noKbFromSmall: true,
    note: 'たけとサイの師匠。大魔王を封印した勇者。鋭い剣技でなぎ払い、魔物を気絶させる', counter: 'たけ・サイを先に退け、最上位の魔物・呪文・幹部で総攻撃',
    hp: 4400, atk: 60, range: 46, speed: 26, interval: 1.6, windup: 0.4, kb: 7, attack: 'single', guard: 0.15, mana: 2000, size: 1.55,
    hits: 2, hitGap: 0.2,
    skills: [
      { id: 'wave', name: '師匠の一閃', type: 'wave', every: 13, first: 5, windup: 1.0, recover: 0.4, reach: 280, mult: 1.6 },
      { id: 'stun', name: '封印の剣気', type: 'stun', every: 17, first: 10, windup: 0.9, recover: 0.4, reach: 220, duration: 1.6 },
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
    hp: 3400, atk: 56, range: 40, speed: 30, interval: 1.6, windup: 0.35, kb: 6, attack: 'single', mana: 1200, size: 1.35, // 2026-11-25：最終決戦（10-5）用に調整（旧 1-5 は保留）
    hits: 2, hitGap: 0.2,          // 近接の2連撃
    skills: [{ id: 'wave', name: '飛ぶ斬撃', type: 'wave', every: 11, first: 4, windup: 0.9, recover: 0.4, reach: 280, mult: 1.6 }],
  },
  sai: {
    name: '勇者サイ', role: '勇者', hero: true, noKbFromSmall: true, line: 'back',
    note: '仲間を回復し、光で魔物を気絶させる', counter: '遠距離で狙い、まとめて押し切る',
    hp: 2400, atk: 36, range: 190, speed: 28, interval: 2.2, windup: 0.45, kb: 5, attack: 'single', projectile: 'orb', mana: 1000, size: 1.3, // 2026-11-25：最終決戦（10-5）用に調整
    skills: [
      { id: 'heal', name: '回復の光', type: 'heal', every: 16, first: 6, windup: 0.6, recover: 0.4, radius: 240, ratio: 0.08 },
      { id: 'stun', name: 'まばゆい光', type: 'stun', every: 14, first: 7, windup: 0.9, recover: 0.4, reach: 240, duration: 1.6 },
    ],
  },
};

// 勇者の登場の一言（ボス戦は少しシリアスに）
export const HERO_LINES = {
  take: { who: '勇者たけ', text: 'これ以上、村には近づけさせない！' },
  sai: { who: '勇者サイ', text: 'たけ、うしろは任せて。みんなはわたしが守る！' },
};
