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
      { role: 'STAR',   weight: 64 },    // 1/1024
      { role: 'REPLAY', weight: 8978 }   // 1/7.3
    ],
    // ボーナス内部中（持ち越し中）: ボーナスは抽選しない
    CARRY: [
      { role: 'CHERRY', weight: 1820 },
      { role: 'GRAPE',  weight: 10923 },
      { role: 'BELL',   weight: 64 },
      { role: 'STAR',   weight: 64 },
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
    BIG: { NORMAL: 50, CHERRY_MISS: 14, BAR_STEP: 6, YAMAGATA: 8, OYAMA: 10, KOYAMA: 3, BAR_LINE: 4, REVERSE_7: 5 },
    REG: { NORMAL: 50, CHERRY_MISS: 14, BAR_STEP: 6, YAMAGATA: 8, OYAMA: 0,  KOYAMA: 13, BAR_LINE: 4, REVERSE_7: 5 }
  };

  // ペカリ（GOGOランプ）タイミング: ボーナス成立ゲームでの先ペカ（レバーON告知）率
  NCS.LAMP = {
    leverOnRate: 0.25 // 残りは第3停止後（後ペカ）。リーチ目確定時はその停止で点灯。
  };
})(typeof window !== 'undefined' ? window : globalThis);
