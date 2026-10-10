/*
 * リーチ目定義
 *
 * test(ctx) は全リール停止後の出目で評価する。
 *   ctx.sym(reel, row) … 図柄（reel 0=左 1=中 2=右 / row 0=上 1=中 2=下）
 *   ctx.order          … 停止順（例 [2,1,0] = 逆押し）
 *   ctx.wins           … 入賞ライン一覧 [{role, line}]
 * allow: このリーチ目の停止を許可するボーナス。ボーナス非成立時は常に停止禁止。
 *
 * 「第n停止で確定」は停止制御側で自動判定する：
 *   未停止リールがどこに止まっても必ずリーチ目になる状態 = 確定（その停止でペカリ）。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function isBonusSym(s) { return s === '7' || s === 'B'; }

  NCS.REACHME = {
    CHERRY_MISS: {
      name: 'チェリー外れ',
      desc: '左リールにチェリーが停止し、中リールに対応チェリーが無い（2確／順押し時）',
      allow: ['BIG', 'REG'],
      test: function (c) {
        var leftCherry = c.sym(0, 0) === 'C' || c.sym(0, 1) === 'C' || c.sym(0, 2) === 'C';
        if (!leftCherry) return false;
        for (var i = 0; i < c.wins.length; i++) if (c.wins[i].role === 'CHERRY') return false;
        return true;
      }
    },
    BAR_STEP: {
      name: 'BAR段違い',
      desc: '左中段BAR＋中上段BAR（右リール不問・2確）',
      allow: ['BIG', 'REG'],
      test: function (c) { return c.sym(0, 1) === 'B' && c.sym(1, 0) === 'B'; }
    },
    YAMAGATA: {
      name: '山型（ボーナス図柄）',
      desc: '左下段・中上段・右下段に 7/BAR が山型に停止',
      allow: ['BIG', 'REG'],
      test: function (c) { return isBonusSym(c.sym(0, 2)) && isBonusSym(c.sym(1, 0)) && isBonusSym(c.sym(2, 2)); }
    },
    OYAMA: {
      name: '大山',
      desc: '山図柄が 左下段・中上段・右下段 の大きな山型（BIG確定）',
      allow: ['BIG'],
      test: function (c) { return c.sym(0, 2) === 'M' && c.sym(1, 0) === 'M' && c.sym(2, 2) === 'M'; }
    },
    KOYAMA: {
      name: '小山',
      desc: '山図柄が 左中段・中上段・右中段 の小さな山型（ボーナス確定・REG期待度高）',
      allow: ['BIG', 'REG'],
      test: function (c) { return c.sym(0, 1) === 'M' && c.sym(1, 0) === 'M' && c.sym(2, 1) === 'M'; }
    },
    BAR_LINE: {
      name: 'BAR一直線',
      desc: 'BAR-BAR-BAR が有効ライン上に揃う（非入賞・確定目）',
      allow: ['BIG', 'REG'],
      test: function (c) {
        for (var i = 0; i < NCS.LINES.length; i++) {
          var r = NCS.LINES[i].rows;
          if (c.sym(0, r[0]) === 'B' && c.sym(1, r[1]) === 'B' && c.sym(2, r[2]) === 'B') return true;
        }
        return false;
      }
    },
    REVERSE_7: {
      name: '逆押し 右中段7',
      desc: '右リール第1停止で中段に赤7（逆押し・右第1停止専用／1確）',
      allow: ['BIG', 'REG'],
      test: function (c) { return c.order[0] === 2 && c.sym(2, 1) === '7'; }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
