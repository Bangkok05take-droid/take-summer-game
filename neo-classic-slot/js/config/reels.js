/*
 * リール配列（各21コマ）・有効ライン定義
 *
 * 座標系:
 *   停止位置 x = 中段に止まっている図柄の番号（0〜20）
 *   窓の表示 … 上段 = strip[x+1] / 中段 = strip[x] / 下段 = strip[x-1]
 *   回転中は x が増えていく（番号の大きい図柄が上から降りてくる）
 *   すべり s コマ → 停止位置 = (押下位置 + s) mod 21
 *
 * 行番号: 0 = 上段, 1 = 中段, 2 = 下段
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  NCS.REEL_SIZE = 21;
  NCS.MAX_SLIDE = 4;

  //            0    1    2    3    4    5    6    7    8    9   10   11   12   13   14   15   16   17   18   19   20
  NCS.STRIPS = [
    /* 左 */ ['G', 'R', '7', 'C', 'B', 'G', 'R', 'M', 'S', 'G', 'R', 'L', 'C', 'B', 'G', 'R', '7', 'M', 'G', 'R', 'L'],
    /* 中 */ ['G', 'R', 'C', '7', 'G', 'R', 'B', 'C', 'G', 'R', 'M', 'S', 'C', 'G', 'R', '7', 'L', 'C', 'G', 'R', 'B'],
    /* 右 */ ['G', '7', 'R', 'M', 'G', 'B', 'R', 'L', 'G', '7', 'R', 'S', 'G', 'M', 'R', 'B', 'G', 'L', 'R', 'L', '7']
  ];

  // 有効ライン（3枚掛け5ライン）: 各要素は [左の行, 中の行, 右の行]
  NCS.LINES = [
    { id: 'MID',  name: '中段',     rows: [1, 1, 1] },
    { id: 'TOP',  name: '上段',     rows: [0, 0, 0] },
    { id: 'BOT',  name: '下段',     rows: [2, 2, 2] },
    { id: 'DOWN', name: '右下がり', rows: [0, 1, 2] },
    { id: 'UP',   name: '右上がり', rows: [2, 1, 0] }
  ];

  // 行 row に表示される図柄
  NCS.symAt = function (reel, x, row) {
    var n = NCS.REEL_SIZE;
    return NCS.STRIPS[reel][(((x + 1 - row) % n) + n) % n];
  };
})(typeof window !== 'undefined' ? window : globalThis);
