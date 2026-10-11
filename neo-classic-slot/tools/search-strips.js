/*
 * リール配列の自動調整（局所探索）
 *   node tools/search-strips.js [反復回数] [乱数シード] ['["左","中","右"]' 初期配列（空白区切り）]
 *
 * 同一リール内の図柄2つを入れ替えながら、停止制御の評価値から作ったペナルティを最小化する。
 *   - ブドウ・リプレイの取りこぼし（0にする）／ハズレ・各小役で停止禁止出目を回避できないケース
 *   - チェリー・山小役の入賞率、各リーチ目・チャンス目の出現しやすさ
 *   - ボーナス持ち越し中の目押し保証（NCS.CARRY_AIM の範囲で押せば1〜3枚掛け・全押し順で必ず揃う）
 * 構造の制約（valid）: 左=各BARの直下チェリー・3コマ上に山 / 中=赤7の真上チェリー2組以上 /
 *   右=「BAR・赤7・ブドウ」（画面の上からブドウ・赤7・BAR）1組以上、赤7とBARの隣接2組以上（GROUPS / PAIRS で変更可）、
 *   赤7の上下ともブドウ1組以上、リプレイ以外の連続は4コマまで。図柄の個数は変わらない。
 * 改善するたびに配列を出力する。結果は js/config/reels.js へ手動で反映し、tools/verify.js で検証すること。
 */
var path = require('path');
var root = path.join(__dirname, '..', 'js');
['config/symbols.js','config/reels.js','config/roles.js','config/probability.js','config/reachme.js','core/judge.js','core/reelControl.js'].forEach(function (f) { require(path.join(root, f)); });
var NCS = globalThis.NCS, Solver = NCS.ReelControl.Solver;
var iters = +process.argv[2] || 300, seed = +process.argv[3] || 1;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; }
var PURE = { small: 100, bonus: 50, modeReach: 0, offModeReach: 0, midLine: 0, barBottom: 0 };
function rv(flag, mode, sc) { return new Solver(flag, mode, sc || PURE).value([-1,-1,-1], []); }
var PAT = { small: 0, bonus: 0, modeReach: 100, offModeReach: 0, midLine: 0, barBottom: 0 };
var TARGETS = [['BIG','CHERRY_MISS_7'],['BIG','YAMA_HASAMI'],['BIG','V_SHAPE'],['BIG','OYAMA'],['BIG','TANI'],['REG','KOYAMA'],['BIG','BAR_LINE'],['BIG','REV_GRAPE_MISS'],['REG','REG_R7_TOP'],[null,'R7_MID']];
function evaluate(best) {
  NCS.ReelControl.clearCache();
  var pen = 0, d = {};
  var cg = carryG(); d.carryMiss = cg.toFixed(3); pen += cg * 3000;
  ['GRAPE','REPLAY'].forEach(function (r) { var v = rv({bonus:null,small:r},'NORMAL'); d[r]=v.avg.toFixed(1); if (v.min < 0) pen += 1e6; pen += (100 - v.avg) * 1000; });
  if (pen > best) return {pen:pen,d:d};
  [null,'BELL','CHERRY','YAMA'].forEach(function (r) { var v = rv({bonus:null,small:r},'NORMAL'); if (v.min < 0) pen += 1e6;
    if (r) { d[r] = v.avg.toFixed(1); } if (r === 'CHERRY') pen += Math.max(0, 60 - v.avg) * 50; if (r === 'YAMA') pen += Math.max(0, 30 - v.avg) * 50; });
  if (pen > best) return {pen:pen,d:d};
  TARGETS.forEach(function (t) { var v = rv({bonus:t[0],small:t[0]?null:'GRAPE'}, t[1], PAT); d[t[1]] = v.avg.toFixed(1); pen += Math.max(0, (({YAMA_HASAMI:3, REV_GRAPE_MISS:3, REG_R7_TOP:3, R7_MID:4})[t[1]] || 8) - v.avg) * (t[1] === 'R7_MID' ? 600 : 40); });
  return {pen:pen,d:d};
}

function carryG() {
  var R = 21, tot = 0;
  [3, 2, 1].forEach(function (bet) { ['BIG', 'REG'].forEach(function (b) {
    var lines = NCS.activeLines(bet), pat = NCS.ROLES[b].pattern;
    var aim = [0, 1, 2].map(function (r) { var o = []; for (var p = 0; p < R; p++) { o[p] = false; for (var d = NCS.CARRY_AIM[0]; d <= NCS.CARRY_AIM[1]; d++) if (NCS.STRIPS[r][((p - d) % R + R) % R] === pat[r]) o[p] = true; } return o; });
    var memo = new Map(), fin = new Map();
    function clean(st) { var k = st.join(); if (fin.has(k)) return fin.get(k); var j = NCS.judge(st, [0, 1, 2], lines);
      var v = j.wins.some(function (w) { return w.role === b; }) && !j.wins.some(function (w) { return w.role !== b; }) ? 1 : 0; fin.set(k, v); return v; }
    function val(st) { var rest = [0, 1, 2].filter(function (r) { return st[r] < 0; }); if (!rest.length) return clean(st);
      var k = st.join(); if (memo.has(k)) return memo.get(k); var v = 1;
      rest.forEach(function (r) { var s = 0, n = 0; for (var p = 0; p < R; p++) { if (!aim[r][p]) continue; var best = 0;
        for (var x = 0; x <= 4 && best < 1; x++) { var ns = st.slice(); ns[r] = (p + x) % R; best = Math.max(best, val(ns)); } s += best; n++; } v = Math.min(v, s / n); });
      memo.set(k, v); return v; }
    tot += 1 - val([-1, -1, -1]);
  }); });
  return tot;
}
function valid(S) {
  var L = S[0], C = S[1], i;
  for (i = 0; i < 21; i++) if (L[i] === 'B' && (L[(i+20)%21] !== 'C' || L[(i+3)%21] !== 'M')) return false;
  var pairs = 0; for (i = 0; i < 21; i++) if (C[i] === 'C' && C[(i+20)%21] === '7') pairs++;
  if (pairs < 2) return false;
  var R = S[2], groups = 0, pairs7b = 0;
  // 画面の上から ブドウ・赤7・BAR・ベル・山 の並び（配列番号の昇順では 山・ベル・BAR・赤7・ブドウ）
  for (i = 0; i < 21; i++) if (R[i] === 'B' && R[(i+1)%21] === '7' && R[(i+2)%21] === 'G') groups++; // 画面上から ブドウ・赤7・BAR
  var run = 0, maxRun = 0; for (i = 0; i < 42; i++) { if (R[i%21] === 'R') run = 0; else maxRun = Math.max(maxRun, ++run); }
  if (maxRun > 4) return false; // リプレイ取りこぼし防止（4コマすべりで必ず届く）
  if (groups < +(process.env.GROUPS || 1)) return false;
  for (i = 0; i < 21; i++) { var x = R[i], y = R[(i+1)%21]; if ((x === '7' && y === 'B') || (x === 'B' && y === '7')) pairs7b++; }
  if (pairs7b < +(process.env.PAIRS || 2)) return false;
  var both = 0; for (i = 0; i < 21; i++) if (R[i] === '7' && R[(i+20)%21] === 'G' && R[(i+1)%21] === 'G') both++;
  if (both < 1) return false;
  for (var r = 0; r < 3; r++) for (i = 0; i < 21; i++) { var a = S[r][i], b = S[r][(i+1)%21]; if (a === b && 'C7BM'.indexOf(a) >= 0) return false; }
  return true;
}
var cur = process.argv[4] ? JSON.parse(process.argv[4]).map(function (s) { return s.split(' '); }) : NCS.STRIPS.map(function (s) { return s.slice(); });
NCS.STRIPS = cur;
if (!valid(cur)) { console.log('initial invalid'); process.exit(1); }
var ce = evaluate(Infinity); console.log('start', ce.pen.toFixed(1), JSON.stringify(ce.d));
for (var it = 0; it < iters && ce.pen > 0; it++) {
  var r = Math.floor(rnd()*3), i = Math.floor(rnd()*21), j = Math.floor(rnd()*21);
  if (cur[r][i] === cur[r][j]) continue;
  var cand = cur.map(function (s) { return s.slice(); }); var t = cand[r][i]; cand[r][i] = cand[r][j]; cand[r][j] = t;
  if (!valid(cand)) continue;
  NCS.STRIPS = cand; var e = evaluate(ce.pen);
  if (e.pen <= ce.pen) { if (e.pen < ce.pen) console.log('it', it, e.pen.toFixed(1), JSON.stringify(e.d), JSON.stringify(cand.map(function (s) { return s.join(' '); }))); cur = cand; ce = e; } else NCS.STRIPS = cur;
}
console.log('final', ce.pen.toFixed(1), JSON.stringify(ce.d));
console.log(JSON.stringify(cur.map(function (s) { return s.join(' '); })));
