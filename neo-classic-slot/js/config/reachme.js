/*
 * チャンス目・リーチ目の定義
 *
 * test(c) は全リール停止後の出目で評価する。
 *   c.sym(reel, row) … 図柄（reel 0=左 1=中 2=右 / row 0=上 1=中 2=下）
 *   c.order          … 停止順（例 [2,1,0] = 逆押し、[0,2,1] = 挟み打ち）
 *   c.wins           … 有効ライン上の入賞一覧 [{role, line}]
 * allow      : 停止を許可するボーナス（ボーナス非成立時は停止禁止）
 * allowSmall : kind='chance' のチャンス目で、停止を許可する小役
 * kind       : 'chance' = チャンス目（確定ではない。ランプ点灯の対象外）
 *
 * 「第n停止で確定」は停止制御側で自動判定する（残りのリールがどこに止まっても確定目になる状態）。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});
  function cherryWin(c) { for (var i = 0; i < c.wins.length; i++) if (c.wins[i].role === 'CHERRY') return true; return false; }
  function leftHas(c, s) { return c.sym(0, 0) === s || c.sym(0, 1) === s || c.sym(0, 2) === s; }
  var BONUS = ['BIG', 'REG'];
  NCS.REACHME = {
    // ---- チャンス目（確定ではない。指定の小役かボーナスでのみ停止） ----
    LEFT_CHERRY: { kind: 'chance', name: '左チェリー出現', allow: BONUS, allowSmall: ['CHERRY'],
      test: function (c) { return leftHas(c, 'C'); } },
    // 左リール第1停止（BAR狙いからの滑り）で山が見えた時のみチャンス目扱い
    LEFT_YAMA: { kind: 'chance', name: '左山出現', allow: BONUS, allowSmall: ['YAMA'],
      test: function (c) { return c.order[0] === 0 && leftHas(c, 'M'); } },
    // ---- 確定リーチ目 ----
    CHERRY_MISS: { name: 'チェリー外れ', allow: BONUS,
      test: function (c) { return leftHas(c, 'C') && !cherryWin(c); } },
    CHERRY_MISS_7: { name: 'チェリー外れ＋中段7', allow: BONUS,
      test: function (c) { return leftHas(c, 'C') && !cherryWin(c) && c.sym(1, 1) === '7'; } },
    YAMA_HASAMI_MISS: { name: '挟み打ち山否定', allow: BONUS,
      test: function (c) { return c.order[0] === 0 && c.order[1] === 2 && c.sym(0, 2) === 'M' && c.sym(2, 0) !== 'M'; } },
    V_SHAPE: { name: '山V字', allow: BONUS,
      test: function (c) { return c.sym(0, 0) === 'M' && c.sym(1, 2) === 'M' && c.sym(2, 0) === 'M'; } },
    OYAMA: { name: '大山（中山上段）', allow: ['BIG'],
      test: function (c) { return c.sym(0, 2) === 'M' && c.sym(1, 0) === 'M' && c.sym(2, 2) === 'M'; } },
    TANI: { name: '谷（中山下段）', allow: ['BIG'],
      test: function (c) { return c.sym(0, 1) === 'M' && c.sym(1, 2) === 'M' && c.sym(2, 1) === 'M'; } },
    KOYAMA: { name: '小山', allow: BONUS,
      test: function (c) { return c.sym(0, 1) === 'M' && c.sym(1, 0) === 'M' && c.sym(2, 1) === 'M'; } },
    BAR_LINE: { name: 'BAR一直線', allow: BONUS,
      test: function (c) {
        for (var i = 0; i < NCS.LINES.length; i++) { var r = NCS.LINES[i].rows;
          if (c.sym(0, r[0]) === 'B' && c.sym(1, r[1]) === 'B' && c.sym(2, r[2]) === 'B') return true; }
        return false; } },
    // ---- 逆押し（右第1停止） ----
    RIGHT_7_MID: { kind: 'chance', name: '逆押し右中段7', allow: BONUS, allowSmall: ['GRAPE'],
      test: function (c) { return c.order[0] === 2 && c.sym(2, 1) === '7'; } },
    REV_GRAPE_MISS: { name: '逆押し右中段7・ブドウ否定', allow: BONUS,
      test: function (c) { return c.order[0] === 2 && c.sym(2, 1) === '7' && !c.wins.some(function (w) { return w.role === 'GRAPE'; }); } },
    // 中リール（第2停止）でブドウの成立ラインが全て消えた形 = 第2停止で確定
    REV_GRAPE_MISS_2: { name: '逆押し右中段7・中でブドウ否定', allow: BONUS,
      test: function (c) {
        if (c.order[0] !== 2 || c.order[1] !== 1 || c.sym(2, 1) !== '7') return false;
        for (var i = 0; i < NCS.LINES.length; i++) {
          var r = NCS.LINES[i].rows;
          if (c.sym(1, r[1]) === 'G' && c.sym(2, r[2]) === 'G') return false;
        }
        return true;
      } },
    REG_R7_TOP: { name: '逆押し右上段7', allow: ['REG'],
      test: function (c) { return c.order[0] === 2 && c.sym(2, 0) === '7'; } }
  };
})(typeof window !== 'undefined' ? window : globalThis);
