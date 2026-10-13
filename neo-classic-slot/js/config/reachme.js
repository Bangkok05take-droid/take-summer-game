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
  function rightHas(c, s) { return c.sym(2, 0) === s || c.sym(2, 1) === s || c.sym(2, 2) === s; }
  function leftHas(c, s) { return c.sym(0, 0) === s || c.sym(0, 1) === s || c.sym(0, 2) === s; }
  var BONUS = ['BIG', 'REG'];
  NCS.REACHME = {
    // ---- チャンス目（確定ではない。指定の小役かボーナスでのみ停止） ----
    LEFT_CHERRY: { kind: 'chance', name: '左チェリー出現', allow: BONUS, allowSmall: ['CHERRY'],
      test: function (c) { return leftHas(c, 'C'); } },
    // 左リール第1停止で左上段に山（BAR狙いからBARが滑って山）の時のみチャンス目扱い
    LEFT_YAMA: { kind: 'chance', name: '左山出現（上段・下段）', allow: BONUS, allowSmall: ['YAMA'],
      test: function (c) { return c.order[0] === 0 && (c.sym(0, 0) === 'M' || c.sym(0, 2) === 'M'); } },
    // ---- 確定リーチ目 ----
    CHERRY_MISS: { name: 'チェリー外れ', allow: BONUS,
      test: function (c) { return leftHas(c, 'C') && !cherryWin(c); } },
    CHERRY_MISS_7: { name: 'チェリー外れ＋中段7', allow: BONUS,
      test: function (c) { return leftHas(c, 'C') && !cherryWin(c) && c.sym(1, 1) === '7'; } },
    // 左に山（上段・下段）→ 右に山が出ない = 山小役が外れ（ボーナス濃厚）。山小役で右の山に届かない時も出るのでチャンス目扱い
    YAMA_HASAMI_MISS: { kind: 'chance', name: '左山＋右山なし', allow: BONUS, allowSmall: ['YAMA'],
      test: function (c) { return c.order[0] === 0 && (c.sym(0, 0) === 'M' || c.sym(0, 2) === 'M') && !rightHas(c, 'M'); } },
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
    // 逆押しでブドウ・チェリー成立時は右リールが「上ブドウ・中段赤7・下BAR」で止まる（目押し時）
    RIGHT_7_MID: { kind: 'chance', name: '逆押し右中段7', allow: BONUS, allowSmall: ['GRAPE', 'CHERRY'],
      test: function (c) { return c.order[0] === 2 && c.sym(2, 1) === '7'; } },
    // チェリーでも右中段7が出るため、左にBARが見えている（左BAR狙いでチェリーも否定）時だけ確定
    REV_GRAPE_MISS: { name: '逆押し右中段7・ブドウ否定（左BARでチェリー否定）', allow: BONUS,
      test: function (c) { return c.order[0] === 2 && c.sym(2, 1) === '7' && leftHas(c, 'B') && !cherryWin(c) && !c.wins.some(function (w) { return w.role === 'GRAPE'; }); } },
    // 中リール（第2停止）でブドウの成立ラインが全て消えた形。チェリー成立時も出るのでチャンス目（ボーナスかチェリー）
    REV_GRAPE_MISS_2: { kind: 'chance', name: '逆押し右中段7・中でブドウ否定', allow: BONUS, allowSmall: ['CHERRY'],
      test: function (c) {
        if (c.order[0] !== 2 || c.order[1] !== 1 || c.sym(2, 1) !== '7') return false;
        for (var i = 0; i < NCS.LINES.length; i++) {
          var r = NCS.LINES[i].rows;
          if (c.sym(1, r[1]) === 'G' && c.sym(2, r[2]) === 'G') return false;
        }
        return true;
      } },
    // 右中段7の上がBAR・下がリプレイ（右リール番号13の赤7）: 右窓にブドウが無くブドウを否定 = 第1停止でボーナス確定
    REV_BAR7_1K: { name: '逆押し 上BAR・中段赤7・下リプレイ', allow: BONUS,
      test: function (c) { return c.order[0] === 2 && c.sym(2, 0) === 'B' && c.sym(2, 1) === '7' && c.sym(2, 2) === 'R'; } },
    // 右上段BAR・右窓に赤7なし … REG確定
    REG_BAR_TOP: { name: '逆押し右上段BAR（赤7なし）', allow: ['REG'],
      test: function (c) { return c.order[0] === 2 && c.sym(2, 0) === 'B' && !rightHas(c, '7'); } },
    // 逆押し2確: 右窓に赤7とBARが両方 → 中リール中段に赤7・BAR
    REV_7BAR_2K: { name: '逆押し 右7・BAR＋中段7・BAR', allow: BONUS,
      test: function (c) { return c.order[0] === 2 && c.order[1] === 1 && rightHas(c, '7') && rightHas(c, 'B') && (c.sym(1, 1) === '7' || c.sym(1, 1) === 'B'); } },
    // 順押し2確: 左チェリー（非入賞）＋中段BAR（中段7は CHERRY_MISS_7）
    CHERRY_MISS_BAR: { name: 'チェリー外れ＋中段BAR', allow: BONUS,
      test: function (c) { return leftHas(c, 'C') && !cherryWin(c) && c.sym(1, 1) === 'B'; } },
    // どのラインでも赤7・BARだけで3つ並んだら（7・7・BAR、BAR・7・7、BAR・BAR・BAR など）ボーナス確定
    BONUS_SYMBOL_LINE: { name: 'ボーナス図柄揃い（赤7・BARの組み合わせ）', allow: BONUS,
      test: function (c) {
        for (var i = 0; i < NCS.LINES.length; i++) { var r = NCS.LINES[i].rows, ok = true;
          for (var k = 0; k < 3; k++) { var y = c.sym(k, r[k]); if (y !== '7' && y !== 'B') { ok = false; break; } }
          if (ok) return true; }
        return false; } },
    // 左リール中段チェリー … BIG確定（チェリー成立時・REG時は滑って上段か下段）
    LEFT_MID_CHERRY: { name: '左中段チェリー', allow: ['BIG'],
      test: function (c) { return c.sym(0, 1) === 'C'; } },
    REG_R7_TOP: { name: '逆押し右上段7', allow: ['REG'],
      test: function (c) { return c.order[0] === 2 && c.sym(2, 0) === '7'; } }
  };
})(typeof window !== 'undefined' ? window : globalThis);
