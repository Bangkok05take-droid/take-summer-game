/*
 * 役（入賞図柄組み合わせ）と払い出し
 * pattern: [左, 中, 右]。null は「何でもよい」。
 * 判定は有効5ライン上で行う。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  NCS.ROLES = {
    BIG:    { name: 'BIG BONUS',     pattern: ['7', '7', '7'], pay: 0, bonus: true },
    REG:    { name: 'REGULAR BONUS', pattern: ['7', '7', 'B'], pay: 0, bonus: true },
    GRAPE:  { name: 'ブドウ',         pattern: ['G', 'G', 'G'], pay: 8 },
    CHERRY: { name: 'チェリー',       pattern: ['C', 'C', null], pay: 2 },
    BELL:   { name: 'ベル',           pattern: ['L', 'L', 'L'], pay: 14 },
    YAMA:   { name: '山',             pattern: ['M', 'M', 'M'], pay: 3, lines: [0, 3, 4] }, // 成立は中リール中段を通る3ラインのみ
    REPLAY: { name: 'リプレイ',       pattern: ['R', 'R', 'R'], pay: 0, replay: true }
  };

  NCS.BET = 3;     // 基本のBET（MAX BET）
  NCS.MAX_BET = 3;

  // BET枚数ごとの有効ライン（NCS.LINES の番号）: 1枚=中段 / 2枚=中段・上段・下段 / 3枚=5ライン
  NCS.BET_LINES = { 1: [0], 2: [0, 1, 2], 3: [0, 1, 2, 3, 4] };
  NCS.activeLines = function (bet) { return NCS.BET_LINES[bet] || NCS.BET_LINES[NCS.MAX_BET]; };
})(typeof window !== 'undefined' ? window : globalThis);
