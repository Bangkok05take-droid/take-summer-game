/*
 * 停止制御（最大4コマすべり）
 *
 * テーブル方式ではなく「探索方式」:
 *   押下位置から 0〜4 コマ先の5候補それぞれについて、
 *   残りリールが「どの順番・どのタイミングで押されても」到達しうる最終出目を評価し、
 *     1) 最悪ケース(min)が最も良い候補  … 停止禁止出目を絶対に出さない／取りこぼし不可役を必ず揃える
 *     2) 平均(avg)が最も良い候補        … 引き込める役・狙いの出目をできるだけ出す
 *     3) すべりコマ数が少ない候補       … 自然な停止
 *   の優先順で選ぶ。
 *
 * 最終出目の評価（terminalScore）:
 *   - 成立していない役が揃う         → 停止禁止
 *   - ボーナス非成立でリーチ目が出る → 停止禁止（allow 外のボーナスでも禁止。大山はREGで禁止）
 *   - 成立小役が揃う +100 / 成立ボーナスが揃う +50 / 出目モードのリーチ目 +30 / モード外のリーチ目 -5
 *
 * 評価値はフラグ×出目モードごとにメモ化する（同じフラグなら2回目以降は即時）。
 * 内部抽選とは独立しており、フラグを受け取るだけ。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  var FORBID = -1e9;
  var N = 21;

  // ---- 最終出目の判定キャッシュ（フラグ非依存） ----
  var judgeCache = new Map();
  function judgeCached(stops, order) {
    // 停止順の依存は「第1停止リール」のみ（逆押しリーチ目）
    var key = ((order[0] * N + stops[0]) * N + stops[1]) * N + stops[2];
    var j = judgeCache.get(key);
    if (!j) { j = NCS.judge(stops, order); judgeCache.set(key, j); }
    return j;
  }

  function hasWin(j, role) {
    for (var i = 0; i < j.wins.length; i++) if (j.wins[i].role === role) return true;
    return false;
  }

  var SCORE = { small: 100, bonus: 50, modeReach: 30, offModeReach: -5 };

  function terminalScore(flag, mode, j, sc) {
    var i;
    for (i = 0; i < j.wins.length; i++) {
      var r = j.wins[i].role;
      if (r !== flag.bonus && r !== flag.small) return FORBID;
    }
    for (i = 0; i < j.reachMe.length; i++) {
      if (!flag.bonus || NCS.REACHME[j.reachMe[i]].allow.indexOf(flag.bonus) < 0) return FORBID;
    }
    var s = 0;
    if (flag.small && hasWin(j, flag.small)) s += sc.small;
    if (flag.bonus && hasWin(j, flag.bonus)) s += sc.bonus;
    // 出目モードのリーチ目は積極的に、それ以外のリーチ目は可能なら避ける（NORMAL はハズレ目寄り）
    for (i = 0; i < j.reachMe.length; i++) s += j.reachMe[i] === mode ? sc.modeReach : sc.offModeReach;
    return s;
  }

  // ---- 1フラグ×1モード分の探索器 ----
  function Solver(flag, mode, score) {
    this.flag = flag;
    this.mode = mode;
    this.score = score || SCORE;
    this.memo = new Map();
  }

  function stateKey(stops, order) {
    var k = 0;
    for (var i = 0; i < order.length; i++) k = k * 4 + order[i] + 1;
    return (k * 22 + stops[0] + 1) * 22 * 22 + (stops[1] + 1) * 22 + (stops[2] + 1);
  }

  function better(a, b, sa, sb) {
    if (a.min !== b.min) return a.min > b.min;
    if (Math.abs(a.avg - b.avg) > 1e-9) return a.avg > b.avg;
    return sa < sb;
  }

  // 状態の評価値 {min, avg}
  Solver.prototype.value = function (stops, order) {
    if (order.length === 3) {
      var s = terminalScore(this.flag, this.mode, judgeCached(stops, order), this.score);
      return { min: s, avg: s };
    }
    var key = stateKey(stops, order);
    var v = this.memo.get(key);
    if (v) return v;
    var min = Infinity, sum = 0, n = 0;
    for (var r = 0; r < 3; r++) {
      if (stops[r] >= 0) continue;
      for (var p = 0; p < N; p++) {
        var c = this.choose(stops, order, r, p);
        if (c.v.min < min) min = c.v.min;
        sum += c.v.avg;
        n++;
      }
    }
    v = { min: min, avg: sum / n };
    this.memo.set(key, v);
    return v;
  };

  // リール r を押下位置 p で止めるときの最良すべり
  Solver.prototype.choose = function (stops, order, r, p) {
    var best = null, bestSlide = -1, bestPos = -1;
    var ns = stops.slice(), no = order.concat([r]);
    for (var s = 0; s <= NCS.MAX_SLIDE; s++) {
      var pos = (p + s) % N;
      ns[r] = pos;
      var v = this.value(ns, no);
      if (!best || better(v, best, s, bestSlide)) { best = v; bestSlide = s; bestPos = pos; }
    }
    return { slide: bestSlide, pos: bestPos, v: best };
  };

  // ---- 公開API ----
  function ReelControl() {
    this.solvers = new Map();
    this.reset(null);
  }

  ReelControl.prototype.solverFor = function (flag) {
    var key = (flag.bonus || '-') + '/' + (flag.small || '-') + '/' + (flag.bonus ? flag.mode : 'NORMAL');
    var s = this.solvers.get(key);
    if (!s) { s = new Solver(flag, flag.bonus ? flag.mode : 'NORMAL'); this.solvers.set(key, s); }
    return s;
  };

  // レバーON時に呼ぶ
  ReelControl.prototype.reset = function (flag) {
    this.flag = flag;
    this.stops = [-1, -1, -1];
    this.order = [];
    this.solver = flag ? this.solverFor(flag) : null;
  };

  // 停止ボタン押下。press = 押下時に中段へ到達している（次の）図柄番号
  ReelControl.prototype.stop = function (reel, press) {
    var c = this.solver.choose(this.stops, this.order, reel, ((press % N) + N) % N);
    this.stops[reel] = c.pos;
    this.order.push(reel);
    return { reel: reel, press: press, slide: c.slide, pos: c.pos };
  };

  // 未停止リールがどこに止まってもリーチ目になるか（= この停止でボーナス確定）
  ReelControl.prototype.isDetermined = function () {
    return NCS.isDeterminedState(this.stops, this.order);
  };

  NCS.isDeterminedState = function (stops, order) {
    if (order.length === 0 || order.length === 3) return false;
    var rest = [0, 1, 2].filter(function (r) { return stops[r] < 0; });
    var st = stops.slice();
    var perms = rest.length === 1 ? [rest] : [[rest[0], rest[1]], [rest[1], rest[0]]];
    for (var pi = 0; pi < perms.length; pi++) {
      var full = order.concat(perms[pi]);
      var ok = (function rec(i) {
        if (i === rest.length) return judgeCached(st, full).reachMe.length > 0;
        for (var x = 0; x < N; x++) { st[rest[i]] = x; if (!rec(i + 1)) return false; }
        return true;
      })(0);
      rest.forEach(function (r) { st[r] = -1; });
      if (!ok) return false;
    }
    return true;
  };

  NCS.ReelControl = ReelControl;
  NCS.ReelControl.Solver = Solver;
  NCS.ReelControl.FORBID = FORBID;
  NCS.ReelControl.SCORE = SCORE;
  NCS.ReelControl.clearCache = function () { judgeCache.clear(); };
})(typeof window !== 'undefined' ? window : globalThis);
