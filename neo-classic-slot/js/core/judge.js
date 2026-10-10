/*
 * 出目判定（入賞ライン・リーチ目）
 * stops: [左, 中, 右] の停止位置（未停止は -1）
 * order: 停止順の配列
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  var ROLE_IDS = null;

  function roleIds() {
    if (!ROLE_IDS) ROLE_IDS = Object.keys(NCS.ROLES);
    return ROLE_IDS;
  }

  function makeSym(stops) {
    return function (reel, row) { return NCS.symAt(reel, stops[reel], row); };
  }

  // 入賞ライン一覧（全リール停止済みが前提）
  NCS.evalWins = function (stops) {
    var sym = makeSym(stops), wins = [], ids = roleIds();
    for (var li = 0; li < NCS.LINES.length; li++) {
      var rows = NCS.LINES[li].rows;
      var a = sym(0, rows[0]), b = sym(1, rows[1]), c = sym(2, rows[2]);
      for (var k = 0; k < ids.length; k++) {
        var p = NCS.ROLES[ids[k]].pattern;
        if ((p[0] === null || p[0] === a) && (p[1] === null || p[1] === b) && (p[2] === null || p[2] === c)) {
          wins.push({ role: ids[k], line: li });
        }
      }
    }
    return wins;
  };

  NCS.evalReachMe = function (stops, order, wins) {
    var ctx = { sym: makeSym(stops), order: order, wins: wins || NCS.evalWins(stops) };
    var list = [];
    for (var id in NCS.REACHME) if (NCS.REACHME[id].test(ctx)) list.push(id);
    return list;
  };

  // 最終出目の総合判定
  NCS.judge = function (stops, order) {
    var wins = NCS.evalWins(stops);
    return { wins: wins, reachMe: NCS.evalReachMe(stops, order, wins) };
  };

  // 払い出し計算
  NCS.payout = function (wins) {
    var pay = 0, replay = false;
    wins.forEach(function (w) {
      var r = NCS.ROLES[w.role];
      pay += r.pay;
      if (r.replay) replay = true;
    });
    return { pay: pay, replay: replay };
  };
})(typeof window !== 'undefined' ? window : globalThis);
