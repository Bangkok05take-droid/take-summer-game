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
  // lines: 有効ライン（BET枚数で 1/3/5 ライン）。キャッシュはライン数でも区別する
  function judgeCached(stops, order, lines) {
    // 停止順は第1・第2停止リールまで区別する（逆押し・挟み打ちリーチ目）
    var key = ((((lines ? lines.length : 5) * 9 + order[0] * 3 + order[1]) * N + stops[0]) * N + stops[1]) * N + stops[2];
    var j = judgeCache.get(key);
    if (!j) { j = NCS.judge(stops, order, lines); judgeCache.set(key, j); }
    return j;
  }

  function hasWin(j, role) {
    for (var i = 0; i < j.wins.length; i++) if (j.wins[i].role === role) return true;
    return false;
  }

  var SCORE = { small: 100, bonus: 50, modeReach: 80, offModeReach: -5, midLine: 3, barBottom: 1 };

  function terminalScore(flag, mode, j, sc) {
    var i;
    for (i = 0; i < j.wins.length; i++) {
      var r = j.wins[i].role;
      if (r !== flag.bonus && r !== flag.small) return FORBID;
    }
    for (i = 0; i < j.reachMe.length; i++) {
      var rm = NCS.REACHME[j.reachMe[i]];
      var ok = (flag.bonus && rm.allow.indexOf(flag.bonus) >= 0) || (flag.small && rm.allowSmall && rm.allowSmall.indexOf(flag.small) >= 0);
      if (!ok) return FORBID;
    }
    var s = 0;
    if (flag.small && hasWin(j, flag.small)) s += sc.small;
    if (flag.bonus && hasWin(j, flag.bonus)) s += sc.bonus;
    // 出目モードのリーチ目は積極的に、それ以外のリーチ目は可能なら避ける（NORMAL はハズレ目寄り）
    // MODE_TARGETS[mode] = { リーチ目ID: 重み(0〜1) }。最も重いものを採用
    var targets = (NCS.MODE_TARGETS && NCS.MODE_TARGETS[mode]) || {};
    var hit = 0;
    for (i = 0; i < j.reachMe.length; i++) {
      var w = targets[j.reachMe[i]];
      if (w) hit = Math.max(hit, w);
      else if (NCS.REACHME[j.reachMe[i]].kind !== 'chance') s += sc.offModeReach;
    }
    s += hit * sc.modeReach;
    // 見た目の基本形: 小役は中段ライン優先 / 左BARは下段停止優先
    if (flag.small) for (i = 0; i < j.wins.length; i++) if (j.wins[i].role === flag.small && j.wins[i].line === 0) { s += sc.midLine || 0; break; }
    if (j.leftBarBottom) s += sc.barBottom || 0;
    if (j.rightSevenBottom) s += sc.barBottom || 0; // 逆押しの基本形: 右7下段
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
      var j = judgeCached(stops, order, this.flag.lines);
      var soft = terminalScore(this.flag, this.mode, j, this.score);
      // min（最悪ケース）は「停止禁止」と「成立小役が揃うか」だけで評価。見た目の好みは avg のみに効かせる
      var hard = soft === FORBID ? FORBID : (this.flag.small && hasWin(j, this.flag.small) ? 100 : 0);
      return { min: hard, avg: soft };
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
    var mode = flag.mode || 'NORMAL';
    var key = (flag.bonus || '-') + '/' + (flag.small || '-') + '/' + mode + '/' + (flag.lines ? flag.lines.length : 5);
    var s = this.solvers.get(key);
    if (!s) { s = new Solver(flag, mode); this.solvers.set(key, s); }
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
    var p = ((press % N) + N) % N;
    var c = this.carryChoice(reel, p) || this.solver.choose(this.stops, this.order, reel, p);
    this.stops[reel] = c.pos;
    this.order.push(reel);
    return { reel: reel, press: press, slide: c.slide, pos: c.pos };
  };

  /*
   * ボーナス持ち越し中（成立ゲームの次ゲーム以降 = flag.newBonus === false）の目押し保証。
   *
   * 「正しい目押し」= ボーナス図柄（BIG 7・7・7 / REG 7・7・BAR）が中段の 1〜3コマ上にある時に押す
   *   （= 図柄が上段〜枠のすぐ上に見えている時に押す）。各リールをこの範囲で押せば、押し順・BET枚数に
   *   かかわらず必ず揃う（verify.js で総当たり確認）。
   * 揃い方は「残りリールを正しく目押しされた時に揃えられる確率」が最大になる位置を先読みで選ぶ。
   * 7の下にブドウが並ぶ配列のため、ブドウなど非成立役が同時に揃う停止は使わない。
   * 目押しされたボーナスは同時成立の小役より優先する。成立ゲームは従来どおりリーチ目優先の探索に任せる。
   */
  NCS.CARRY_AIM = [-3, -1]; // 押下位置 − ボーナス図柄の位置（コマ）

  var carryTables = new Map();
  function carryTable(bonus, lines) {
    var key = bonus + '/' + (lines ? lines.join('') : '01234');
    var t = carryTables.get(key);
    if (t) return t;
    var pat = NCS.ROLES[bonus].pattern;
    var aim = [0, 1, 2].map(function (r) {
      var out = [];
      for (var p = 0; p < N; p++) {
        out[p] = false;
        for (var d = NCS.CARRY_AIM[0]; d <= NCS.CARRY_AIM[1]; d++) if (NCS.STRIPS[r][(((p - d) % N) + N) % N] === pat[r]) out[p] = true;
      }
      return out;
    });
    t = { bonus: bonus, lines: lines, aim: aim, memo: [new Map(), new Map()], final: new Map() };
    carryTables.set(key, t);
    return t;
  }

  // 最終出目にボーナスがきれいに揃うか（他の役が揃わず、リーチ目もどの押し順で見ても許可されたもの）
  var ALL_ORDERS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  function carryClean(t, stops) {
    var key = (stops[0] * N + stops[1]) * N + stops[2];
    var v = t.final.get(key);
    if (v !== undefined) return v;
    v = 0;
    var j0 = judgeCached(stops, ALL_ORDERS[0], t.lines);
    if (hasWin(j0, t.bonus) && j0.wins.every(function (w) { return w.role === t.bonus; })) {
      v = ALL_ORDERS.every(function (o) {
        return judgeCached(stops, o, t.lines).reachMe.every(function (id) { return NCS.REACHME[id].allow.indexOf(t.bonus) >= 0; });
      }) ? 1 : 0;
    }
    t.final.set(key, v);
    return v;
  }

  // 残りリールを（aimOnly なら正しい目押しで / そうでなければ任意の位置で）押された時に揃えられる確率
  // 次に押されるリールは分からないので最悪の押し順で評価する
  function carryValue(t, stops, aimOnly) {
    var rest = [0, 1, 2].filter(function (r) { return stops[r] < 0; });
    if (!rest.length) return carryClean(t, stops);
    var memo = t.memo[aimOnly ? 1 : 0], key = (stops[0] + 1) * 484 + (stops[1] + 1) * 22 + (stops[2] + 1);
    var v = memo.get(key);
    if (v !== undefined) return v;
    v = 1;
    var ns = stops.slice();
    rest.forEach(function (r) {
      var sum = 0, n = 0;
      for (var p = 0; p < N; p++) {
        if (aimOnly && !t.aim[r][p]) continue;
        var best = 0;
        for (var s = 0; s <= NCS.MAX_SLIDE && best < 1; s++) { ns[r] = (p + s) % N; best = Math.max(best, carryValue(t, ns, aimOnly)); }
        ns[r] = -1;
        sum += best; n++;
      }
      v = Math.min(v, n ? sum / n : 0);
    });
    memo.set(key, v);
    return v;
  }

  ReelControl.prototype.carryChoice = function (reel, p) {
    var f = this.flag;
    if (!f || !f.bonus || f.newBonus !== false) return null;
    var t = carryTable(f.bonus, f.lines);
    var best = null, ns = this.stops.slice(), no = this.order.concat([reel]);
    for (var s = 0; s <= NCS.MAX_SLIDE; s++) {
      var pos = (p + s) % N;
      ns[reel] = pos;
      var v = this.solver.value(ns, no);
      if (v.min === FORBID) continue;
      var c = { slide: s, pos: pos, v: v, a: carryValue(t, ns, true), b: carryValue(t, ns, false) };
      if (no.length === 3 && !c.a) continue; // 最終停止は揃う位置のみ
      if (!best || c.a > best.a + 1e-12 || (Math.abs(c.a - best.a) <= 1e-12 &&
          (c.b > best.b + 1e-12 || (Math.abs(c.b - best.b) <= 1e-12 && better(v, best.v, s, best.slide))))) best = c;
    }
    return best && (best.a > 0 || best.b > 0) ? best : null;
  };

  // 未停止リールがどこに止まってもリーチ目になるか（= この停止でボーナス確定）
  ReelControl.prototype.isDetermined = function () {
    return NCS.isDeterminedState(this.stops, this.order, this.flag && this.flag.lines);
  };

  NCS.isDeterminedState = function (stops, order, lines) {
    if (order.length === 0 || order.length === 3) return false;
    var rest = [0, 1, 2].filter(function (r) { return stops[r] < 0; });
    var st = stops.slice();
    var perms = rest.length === 1 ? [rest] : [[rest[0], rest[1]], [rest[1], rest[0]]];
    for (var pi = 0; pi < perms.length; pi++) {
      var full = order.concat(perms[pi]);
      var ok = (function rec(i) {
        if (i === rest.length) return judgeCached(st, full, lines).reachMe.some(function (id) { return NCS.REACHME[id].kind !== 'chance'; });
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
  NCS.ReelControl.clearCache = function () { judgeCache.clear(); carryTables.clear(); };
})(typeof window !== 'undefined' ? window : globalThis);
