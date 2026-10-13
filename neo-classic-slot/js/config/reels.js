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
    /* 左 */ ['R', 'M', 'R', 'G', 'B', 'C', 'R', 'G', 'M', 'R', '7', 'R', 'G', 'L', 'C', 'B', 'G', 'R', 'M', 'G', '7'],
    /* 中 */ ['L', 'R', 'C', 'G', 'B', 'M', 'C', 'R', 'G', 'R', 'C', 'G', 'B', 'M', 'C', 'R', 'G', 'R', 'C', 'G', '7'],
    /* 右 */ ['G', 'R', 'M', 'R', 'L', 'G', 'L', 'G', 'R', 'M', 'L', 'G', 'R', 'G', 'R', 'M', 'L', 'G', 'R', 'B', '7']
  ];

  // 有効ライン（3枚掛け5ライン）: 各要素は [左の行, 中の行, 右の行]
  // 左リールBAR狙いのハズレ時の基本停止形（中段の図柄番号）
  //   16 … 上リプレイ／中ブドウ／下BAR(15)   3 … 上BAR(4)／中ブドウ／下リプレイ
  NCS.LEFT_BAR_AIM_STOPS = [16, 3];
  // 目押しサポートランプが光る図柄番号（中段に来た瞬間）: 左=15番のBAR / 右=赤7（20番）
  NCS.AIM_ASSIST_POS = { 0: 15, 2: 20 };

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
