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
    STAR:   { name: 'スター',         pattern: ['S', 'S', 'S'], pay: 10 },
    REPLAY: { name: 'リプレイ',       pattern: ['R', 'R', 'R'], pay: 0, replay: true }
  };

  NCS.BET = 3;
})(typeof window !== 'undefined' ? window : globalThis);
