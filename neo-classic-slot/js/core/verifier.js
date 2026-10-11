/*
 * 停止制御の総当たり検証（ブラウザのデバッグパネル / Node の tools/verify.js 共用）
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  var ORDERS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  var ORDER_NAMES = ['順押し', '順挟み(左右中)', '中左右', '中右左', '挟み(右左中)', '逆押し'];
  var MUST_ALIGN = ['GRAPE', 'REPLAY']; // 取りこぼし不可の役

  NCS.CONTROL_ORDERS = ORDERS;
  NCS.CONTROL_ORDER_NAMES = ORDER_NAMES;

  // bets: 検証するBET枚数（既定は3枚のみ）。1・2枚掛けは有効ラインが減る
  function cases(bets) {
    var list = [];
    [null, 'GRAPE', 'CHERRY', 'BELL', 'YAMA', 'REPLAY'].forEach(function (s) {
      list.push({ bonus: null, small: s, mode: 'NORMAL' });
    });
    Object.keys(NCS.SMALL_MODE_WEIGHTS || {}).forEach(function (s) {
      Object.keys(NCS.SMALL_MODE_WEIGHTS[s]).forEach(function (m) { if (m !== 'NORMAL') list.push({ bonus: null, small: s, mode: m }); });
    });
    ['BIG', 'REG'].forEach(function (b) {
      var w = NCS.REACHME_MODE_WEIGHTS[b];
      Object.keys(w).forEach(function (m) { if (w[m] > 0) list.push({ bonus: b, small: null, mode: m }); });
      ['GRAPE', 'CHERRY', 'REPLAY', 'YAMA'].forEach(function (s) { list.push({ bonus: b, small: s, mode: 'NORMAL' }); });
    });
    // ボーナス持ち越し中（次ゲーム以降）: 正しく目押しすれば必ず揃うこと
    ['BIG', 'REG'].forEach(function (b) {
      var w = NCS.REACHME_MODE_WEIGHTS[b];
      Object.keys(w).forEach(function (m) { if (w[m] > 0) list.push({ bonus: b, small: null, mode: m, newBonus: false }); });
      ['GRAPE', 'CHERRY', 'REPLAY', 'YAMA'].forEach(function (s) { list.push({ bonus: b, small: s, mode: 'NORMAL', newBonus: false }); });
    });
    var all = [];
    (bets || [NCS.MAX_BET]).forEach(function (bet) {
      list.forEach(function (f) { var c = Object.assign({}, f); c.lines = NCS.activeLines(bet); c.bet = bet; all.push(c); });
    });
    return all;
  }

  function flagName(f) {
    return (f.bet && f.bet !== NCS.MAX_BET ? f.bet + '枚掛け ' : '') + (f.bonus ? f.bonus + (f.small ? '+' + f.small : '') : (f.small || 'ハズレ')) + (f.mode && f.mode !== 'NORMAL' ? ' [' + f.mode + ']' : '') + (f.newBonus === false ? ' (持ち越し中)' : '');
  }

  NCS.verifyCase = function (flag) {
    var ctrl = new NCS.ReelControl();
    var N = NCS.REEL_SIZE;
    var st = { games: 0, forbidden: 0, small: 0, bonus: 0, aimed: 0, aimedOk: 0, reach: {}, detAt: [0, 0, 0, 0], maxSlide: 0, samples: [] };
    var detMemo = new Map();

    function det(stops, order) {
      var k = order.join('') + ':' + stops.join(',');
      var v = detMemo.get(k);
      if (v === undefined) { v = NCS.isDeterminedState(stops, order, flag.lines); detMemo.set(k, v); }
      return v;
    }

    // 持ち越し中の「正しい目押し」: ボーナス図柄が中段の1〜3コマ上にある時に押す（NCS.CARRY_AIM）
    var carry = flag.bonus && flag.newBonus === false;
    var aimable = [0, 1, 2].map(function (r) {
      var out = [];
      for (var p = 0; p < N; p++) {
        out[p] = false;
        for (var d = NCS.CARRY_AIM[0]; d <= NCS.CARRY_AIM[1]; d++) if (carry && NCS.STRIPS[r][(((p - d) % N) + N) % N] === NCS.ROLES[flag.bonus].pattern[r]) out[p] = true;
      }
      return out;
    });

    for (var oi = 0; oi < ORDERS.length; oi++) {
      var ord = ORDERS[oi];
      for (var a = 0; a < N; a++) for (var b = 0; b < N; b++) for (var c = 0; c < N; c++) {
        var press = [a, b, c];
        var aimed = carry && aimable[ord[0]][a] && aimable[ord[1]][b] && aimable[ord[2]][c];
        ctrl.reset(flag);
        var determinedAt = 0;
        for (var i = 0; i < 3; i++) {
          var res = ctrl.stop(ord[i], press[i]);
          if (res.slide > st.maxSlide) st.maxSlide = res.slide;
          if (!determinedAt && i < 2 && flag.bonus && det(ctrl.stops, ctrl.order)) determinedAt = i + 1;
        }
        var j = NCS.judge(ctrl.stops, ctrl.order, flag.lines);
        st.games++;
        var bad = false;
        j.wins.forEach(function (w) { if (w.role !== flag.bonus && w.role !== flag.small) bad = true; });
        j.reachMe.forEach(function (r) {
          st.reach[r] = (st.reach[r] || 0) + 1;
          var rm = NCS.REACHME[r];
          var ok = (flag.bonus && rm.allow.indexOf(flag.bonus) >= 0) || (flag.small && rm.allowSmall && rm.allowSmall.indexOf(flag.small) >= 0);
          if (!ok) bad = true;
        });
        if (bad) {
          st.forbidden++;
          if (st.samples.length < 5) st.samples.push({ order: ord, press: press, stops: ctrl.stops.slice(), wins: j.wins, reachMe: j.reachMe });
        }
        if (flag.small && j.wins.some(function (w) { return w.role === flag.small; })) st.small++;
        var bonusWin = flag.bonus && j.wins.some(function (w) { return w.role === flag.bonus; });
        if (bonusWin) st.bonus++;
        if (aimed) { st.aimed++; if (bonusWin) st.aimedOk++; }
        if (j.reachMe.length) st.detAt[determinedAt || 3]++;
      }
    }
    return st;
  };

  NCS.verifyControl = function (onProgress, bets) {
    var list = cases(bets), out = [], ok = true;
    list.forEach(function (flag, idx) {
      var st = NCS.verifyCase(flag);
      var errors = [];
      if (st.forbidden) errors.push('停止禁止出目 ' + st.forbidden + '件');
      if (st.maxSlide > NCS.MAX_SLIDE) errors.push('すべり超過');
      // 取りこぼし無しの保証は MAX BET（5ライン）のみ。1・2枚掛けは有効ラインが少ないため対象外
      if (st.aimed && st.aimedOk !== st.aimed) errors.push('目押ししても揃わない ' + (st.aimed - st.aimedOk) + '件');
      // 持ち越し中は目押しされたボーナスを小役より優先するため、取りこぼし無し保証の対象外
      if (flag.newBonus !== false && flag.bet === NCS.MAX_BET && flag.small && MUST_ALIGN.indexOf(flag.small) >= 0 && st.small !== st.games) errors.push(flag.small + ' 取りこぼし ' + (st.games - st.small) + '件');
      if (errors.length) ok = false;
      out.push({ flag: flag, name: flagName(flag), stats: st, errors: errors });
      if (onProgress) onProgress(idx + 1, list.length);
    });
    return { ok: ok, results: out };
  };

  function pct(n, d) { return (100 * n / d).toFixed(1) + '%'; }

  NCS.formatControlReport = function (rep) {
    var lines = [];
    lines.push('== 停止制御 総当たり検証 (6停止順 × 21^3押下位置 = 55566通り/フラグ) ==');
    rep.results.forEach(function (r) {
      var s = r.stats, parts = [];
      if (r.flag.small) parts.push(r.flag.small + '入賞 ' + pct(s.small, s.games));
      if (r.flag.bonus) parts.push(r.flag.bonus + '揃い ' + pct(s.bonus, s.games));
      if (s.aimed) parts.push('目押し時の揃い ' + s.aimedOk + '/' + s.aimed);
      var rm = Object.keys(s.reach).map(function (k) { return k + ' ' + pct(s.reach[k], s.games); });
      if (rm.length) parts.push('リーチ目: ' + rm.join(', '));
      if (r.flag.bonus) parts.push('確定停止 1st/2nd/3rd: ' + s.detAt[1] + '/' + s.detAt[2] + '/' + s.detAt[3]);
      lines.push((r.errors.length ? 'NG ' : 'OK ') + r.name + ' : ' + parts.join(' | ') + (r.errors.length ? '  << ' + r.errors.join(', ') : ''));
      s.samples.forEach(function (x) { lines.push('    例: order=' + x.order + ' press=' + x.press + ' stops=' + x.stops + ' wins=' + JSON.stringify(x.wins) + ' rm=' + x.reachMe); });
    });
    lines.push(rep.ok ? '結果: すべてOK' : '結果: NGあり');
    return lines.join('\n');
  };
})(typeof window !== 'undefined' ? window : globalThis);
