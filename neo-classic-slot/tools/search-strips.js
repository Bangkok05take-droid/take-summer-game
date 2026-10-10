/*
 * リール配列の自動調整（局所探索）
 *   node tools/search-strips.js [iterations] [seed]
 *
 * 現在の NCS.STRIPS を初期値として、同一リール内の図柄2つを入れ替えながら
 * 以下のペナルティを最小化する配列を探す。図柄の個数は変わらない。
 *   - ブドウ・リプレイの取りこぼし（必ず0にする）
 *   - ハズレ・各小役で停止禁止出目を回避できないケース
 *   - チェリー入賞率（ランダム押しでの期待値）が低すぎる
 *   - 各リーチ目が出目モード時に出現しうるか
 * 制約: 左リールの各BARの直下（番号-1）はチェリー。
 * 結果は標準出力に STRIPS として出力する（reels.js へ手動で反映）。
 */
var path = require('path');
var root = path.join(__dirname, '..', 'js');
['config/symbols.js', 'config/reels.js', 'config/roles.js', 'config/probability.js', 'config/reachme.js',
 'core/judge.js', 'core/reelControl.js'].forEach(function (f) { require(path.join(root, f)); });
var NCS = globalThis.NCS;
var Solver = NCS.ReelControl.Solver;
var ROOT = [[-1, -1, -1], []];

var iters = +process.argv[2] || 300;
var seed = +process.argv[3] || 12345;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; }

function rootValue(flag, mode, score) {
  return new Solver(flag, mode, score).value(ROOT[0], ROOT[1]);
}

var PATTERN_SCORE = { small: 0, bonus: 0, modeReach: 100, offModeReach: 0 };
var REACH_TARGETS = [
  ['BIG', 'CHERRY_MISS'], ['BIG', 'BAR_STEP'], ['BIG', 'YAMAGATA'], ['BIG', 'OYAMA'],
  ['REG', 'KOYAMA'], ['BIG', 'BAR_LINE'], ['BIG', 'REVERSE_7']
];

function evaluate(bestSoFar) {
  NCS.ReelControl.clearCache();
  var pen = 0, detail = {};
  ['GRAPE', 'REPLAY'].forEach(function (r) {
    var v = rootValue({ bonus: null, small: r }, 'NORMAL');
    detail[r] = v.avg.toFixed(2);
    if (v.min < 0) pen += 1e6;
    pen += (100 - v.avg) * 1000;
  });
  if (pen > bestSoFar) return { pen: pen, detail: detail };
  [null, 'BELL', 'PIERROT', 'CHERRY'].forEach(function (r) {
    var v = rootValue({ bonus: null, small: r }, 'NORMAL');
    if (v.min < 0) pen += 1e6;
    if (r === 'CHERRY') { detail.CHERRY = v.avg.toFixed(1); pen += Math.max(0, 45 - v.avg) * 50; }
  });
  if (pen > bestSoFar) return { pen: pen, detail: detail };
  REACH_TARGETS.forEach(function (t) {
    var v = rootValue({ bonus: t[0], small: null }, t[1], PATTERN_SCORE);
    detail[t[1]] = v.avg.toFixed(1);
    pen += Math.max(0, 8 - v.avg) * 30;
  });
  return { pen: pen, detail: detail };
}

function valid(strips) {
  var L = strips[0];
  for (var i = 0; i < 21; i++) if (L[i] === 'B' && L[(i + 20) % 21] !== 'C') return false;
  // 同一図柄の連続は 7/BAR/チェリー のみ禁止（見た目の都合）
  for (var r = 0; r < 3; r++) for (i = 0; i < 21; i++) {
    var a = strips[r][i], b = strips[r][(i + 1) % 21];
    if (a === b && 'C7B'.indexOf(a) >= 0) return false;
  }
  return true;
}

var cur = NCS.STRIPS.map(function (s) { return s.slice(); });
NCS.STRIPS = cur;
var curEval = evaluate(Infinity);
console.log('start', curEval.pen.toFixed(1), JSON.stringify(curEval.detail));

for (var it = 0; it < iters && curEval.pen > 0; it++) {
  var r = Math.floor(rnd() * 3), i = Math.floor(rnd() * 21), j = Math.floor(rnd() * 21);
  if (cur[r][i] === cur[r][j]) continue;
  var cand = cur.map(function (s) { return s.slice(); });
  var t = cand[r][i]; cand[r][i] = cand[r][j]; cand[r][j] = t;
  if (!valid(cand)) continue;
  NCS.STRIPS = cand;
  var e = evaluate(curEval.pen);
  if (e.pen <= curEval.pen) {
    cur = cand; curEval = e;
    console.log('it', it, curEval.pen.toFixed(1), JSON.stringify(curEval.detail));
  } else {
    NCS.STRIPS = cur;
  }
}
NCS.STRIPS = cur;
console.log('final', curEval.pen.toFixed(1), JSON.stringify(curEval.detail));
console.log(JSON.stringify(cur.map(function (s) { return s.join(''); })));
