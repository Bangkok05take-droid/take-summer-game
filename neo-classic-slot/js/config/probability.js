/*
 * 内部抽選テーブル（分母 65536）
 * 値は「置数」。合計が 65536 未満の残りはハズレ。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  NCS.LOTTERY_DENOM = 65536;

  NCS.LOTTERY_TABLES = {
    // 通常時
    NORMAL: [
      { role: 'BIG',    weight: 655 },   // 1/100.05
      { role: 'REG',    weight: 655 },   // 1/100.05  （合算 1/50.03）
      { role: 'CHERRY', weight: 1820 },  // 1/36.0
      { role: 'GRAPE',  weight: 10923 }, // 1/6.0
      { role: 'BELL',   weight: 64 },    // 1/1024
      { role: 'YAMA',   weight: 3277 },  // 1/20.0
      { role: 'REPLAY', weight: 8978 }   // 1/7.3
    ],
    // ボーナス内部中（持ち越し中）: ボーナスは抽選しない
    CARRY: [
      { role: 'CHERRY', weight: 1820 },
      { role: 'GRAPE',  weight: 10923 },
      { role: 'BELL',   weight: 64 },
      { role: 'YAMA',   weight: 3277 },
      { role: 'REPLAY', weight: 8978 }
    ]
  };

  /*
   * ボーナス成立時の「出目モード」振り分け（停止制御が狙う出目の傾向）
   * 抽選結果とは独立。成立ゲームのレバーON時に選択する。
   * 小山は REG 側の振り分けを厚くして「REG期待度が高い」目にしている。
   * 大山は BIG のみ（REG では停止禁止）。
   */
  NCS.REACHME_MODE_WEIGHTS = {
    BIG: { NORMAL: 40, CHERRY_MISS_7: 14, YAMA_HASAMI: 10, V_SHAPE: 8, OYAMA: 7, TANI: 7, KOYAMA: 3, BAR_LINE: 4, REV_GRAPE_MISS: 6, REG_R7_TOP: 0 },
    REG: { NORMAL: 40, CHERRY_MISS_7: 14, YAMA_HASAMI: 10, V_SHAPE: 8, OYAMA: 0, TANI: 0, KOYAMA: 14, BAR_LINE: 6, REV_GRAPE_MISS: 5, REG_R7_TOP: 6 }
  };
  // 小役の出目モード（チャンス目の見せ方）。ブドウの一部で逆押し右中段7を見せる
  NCS.SMALL_MODE_WEIGHTS = {
    GRAPE: { NORMAL: 75, R7_MID: 25 }
  };

  NCS.MODE_TARGETS = {
    CHERRY_MISS_7: { CHERRY_MISS_7: 1, CHERRY_MISS: 0.6 },
    YAMA_HASAMI: { YAMA_HASAMI_MISS: 1 },
    V_SHAPE: { V_SHAPE: 1 }, OYAMA: { OYAMA: 1 }, TANI: { TANI: 1 }, KOYAMA: { KOYAMA: 1 },
    BAR_LINE: { BAR_LINE: 1 },
    REV_GRAPE_MISS: { REV_GRAPE_MISS_2: 1, REV_GRAPE_MISS: 0.5, RIGHT_7_MID: 0.2 }, REG_R7_TOP: { REG_R7_TOP: 1 },
    R7_MID: { RIGHT_7_MID: 1 }
  };

  // ペカリ（GOGOランプ）タイミング: ボーナス成立ゲームでの先ペカ（レバーON告知）率
  NCS.LAMP = {
    leverOnRate: 0.25 // 残りは第3停止後（後ペカ）。リーチ目確定時はその停止で点灯。
  };
})(typeof window !== 'undefined' ? window : globalThis);
