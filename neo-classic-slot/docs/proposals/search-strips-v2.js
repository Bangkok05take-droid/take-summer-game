var path = require('path');
var root = path.join(__dirname, '..', 'js');
['config/symbols.js','config/reels.js','config/roles.js','config/probability.js','config/reachme.js','core/judge.js','core/reelControl.js'].forEach(function (f) { require(path.join(root, f)); });
var NCS = globalThis.NCS, Solver = NCS.ReelControl.Solver;
var iters = +process.argv[2] || 300, seed = +process.argv[3] || 1;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; }
var PURE = { small: 100, bonus: 50, modeReach: 0, offModeReach: 0, midLine: 0, barBottom: 0 };
function rv(flag, mode, sc) { return new Solver(flag, mode, sc || PURE).value([-1,-1,-1], []); }
var PAT = { small: 0, bonus: 0, modeReach: 100, offModeReach: 0, midLine: 0, barBottom: 0 };
var TARGETS = [['BIG','CHERRY_MISS_7'],['BIG','YAMA_HASAMI'],['BIG','V_SHAPE'],['BIG','OYAMA'],['BIG','TANI'],['REG','KOYAMA'],['BIG','BAR_LINE'],['BIG','REVERSE_7']];
function evaluate(best) {
  NCS.ReelControl.clearCache();
  var pen = 0, d = {};
  ['GRAPE','REPLAY'].forEach(function (r) { var v = rv({bonus:null,small:r},'NORMAL'); d[r]=v.avg.toFixed(1); if (v.min < 0) pen += 1e6; pen += (100 - v.avg) * 1000; });
  if (pen > best) return {pen:pen,d:d};
  [null,'BELL','CHERRY','YAMA'].forEach(function (r) { var v = rv({bonus:null,small:r},'NORMAL'); if (v.min < 0) pen += 1e6;
    if (r) { d[r] = v.avg.toFixed(1); } if (r === 'CHERRY') pen += Math.max(0, 60 - v.avg) * 50; if (r === 'YAMA') pen += Math.max(0, 30 - v.avg) * 50; });
  if (pen > best) return {pen:pen,d:d};
  TARGETS.forEach(function (t) { var v = rv({bonus:t[0],small:null}, t[1], PAT); d[t[1]] = v.avg.toFixed(1); pen += Math.max(0, (t[1] === 'YAMA_HASAMI' ? 3 : 8) - v.avg) * 40; });
  return {pen:pen,d:d};
}
function valid(S) {
  var L = S[0], C = S[1], i;
  for (i = 0; i < 21; i++) if (L[i] === 'B' && (L[(i+20)%21] !== 'C' || L[(i+3)%21] !== 'M')) return false;
  var pairs = 0; for (i = 0; i < 21; i++) if (C[i] === 'C' && C[(i+20)%21] === '7') pairs++;
  if (pairs < 2) return false;
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
  if (e.pen <= ce.pen) { if (e.pen < ce.pen) console.log('it', it, e.pen.toFixed(1), JSON.stringify(e.d)); cur = cand; ce = e; } else NCS.STRIPS = cur;
}
console.log('final', ce.pen.toFixed(1), JSON.stringify(ce.d));
console.log(JSON.stringify(cur.map(function (s) { return s.join(' '); })));
