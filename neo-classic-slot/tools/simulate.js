/*
 * 到達時間シミュレーション（実際の抽選・ジャグ連・停止制御を使用）
 *   node tools/simulate.js [試行数=300] [上限時間(時間)=6] [通常1G秒=3.0]
 *
 * 戦略 A: ランダム停止（順押し・タイミング任意）
 * 戦略 B: 左BAR狙い（順押し）。ボーナス内部中（告知後）は全リール赤7狙いで即揃え
 * 時間の仮定: 通常ゲーム n 秒、ボーナス中はオート 0.65 秒/G、フリーズ・復活・遅れの時間を加算
 * 差枚（払い出し−投入）が 1,000 / 5,000 / 10,000 枚に初めて届くまでの時間を集計する。
 */
var path = require('path');
var root = path.join(__dirname, '..', 'js');
['config/game.js', 'config/symbols.js', 'config/reels.js', 'config/roles.js', 'config/probability.js', 'config/reachme.js',
 'core/lottery.js', 'core/judge.js', 'core/reelControl.js', 'core/wallet.js', 'core/jugren.js', 'core/game.js'].forEach(function (f) {
  require(path.join(root, f));
});
var NCS = globalThis.NCS;
NCS.storage.set = function () {}; // セーブしない

var TRIALS = +process.argv[2] || 300, CAP_H = +process.argv[3] || 6, NORMAL_SEC = +process.argv[4] || 3.0;
var BONUS_SEC = 0.65, TARGETS = [1000, 5000, 10000];
var P = NCS.CONFIG.PREMIUM;

var L = NCS.STRIPS[0], barAim = [];
for (var i = 0; i < 21; i++) if (L[i] === 'B') barAim.push((i + 20) % 21, i); // BARが上段〜中段
var sevens = [0, 1, 2].map(function (r) { var a = []; for (var i = 0; i < 21; i++) if (NCS.STRIPS[r][i] === '7') a.push(i); return a; });
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function rnd21() { return Math.floor(Math.random() * 21); }

function trial(strategy) {
  var nextPress = [0, 0, 0];
  var reels = {
    start: function () {}, canStop: function () { return true; },
    press: function (r) { return { base: nextPress[r], press: nextPress[r] }; },
    stop: function (r, abs, cb) { cb(); }
  };
  var g = new NCS.Game({ reels: reels });
  g.wallet.reset();
  var t = 0, cap = CAP_H * 3600, reached = {}, games = 0;
  while (t < cap) {
    var inBonus = g.inBonus, aim7 = strategy === 'B' && !inBonus && g.carry;
    for (var r = 0; r < 3; r++) {
      if (aim7) nextPress[r] = pick(sevens[r]);
      else if (strategy === 'B' && r === 0) nextPress[r] = pick(barAim);
      else nextPress[r] = rnd21();
    }
    g.leverMax();
    var f = g.flag;
    // 演出時間（プレミアの発生率は演出抽選と同じ率で近似）
    if (f.revival) t += P.revivalMs / 1000;
    else if (f.bonus === 'BIG' && f.newBonus) {
      var rr = f.jugren ? P.chance : P.normal, x = Math.random();
      if (x < rr.freeze) t += P.freezeMs / 1000; else if (x < rr.freeze + rr.delay) t += P.delayMs / 1000;
    }
    g.stop(0); g.stop(1); g.stop(2);
    t += inBonus ? BONUS_SEC : NORMAL_SEC;
    games++;
    var net = g.stats.out - g.stats.in;
    for (var k = 0; k < TARGETS.length; k++) if (!reached[TARGETS[k]] && net >= TARGETS[k]) reached[TARGETS[k]] = t;
    if (reached[10000]) break;
  }
  return { reached: reached, stats: g.stats };
}

function summarize(name, strategy) {
  var res = [], big = 0, reg = 0, normalG = 0, inC = 0, outC = 0, jrC = 0, jrH = 0;
  for (var i = 0; i < TRIALS; i++) {
    var r = trial(strategy); res.push(r.reached);
    big += r.stats.big; reg += r.stats.reg; normalG += r.stats.totalGames; inC += r.stats.in; outC += r.stats.out;
    jrC += r.stats.jugrenChances; jrH += r.stats.jugrenHits;
  }
  console.log('\n== 戦略' + strategy + '（' + name + '）  試行 ' + TRIALS + ' / 上限 ' + CAP_H + '時間 / 通常 ' + NORMAL_SEC + '秒/G ==');
  console.log('合算 1/' + (normalG / (big + reg)).toFixed(1) + '（BIG 1/' + (normalG / big).toFixed(1) + '・REG 1/' + (normalG / reg).toFixed(1) +
    '） 機械割 ' + (outC / inC * 100).toFixed(1) + '%  ジャグ連当選率 ' + (jrH / jrC * 100).toFixed(1) + '%');
  console.log('| 目標 | 平均 | 中央値 | 90パーセンタイル | 未到達 |');
  console.log('|---:|---:|---:|---:|---:|');
  TARGETS.forEach(function (T) {
    var ts = res.map(function (x) { return x[T]; }).filter(function (v) { return v !== undefined; }).sort(function (a, b) { return a - b; });
    var fail = TRIALS - ts.length;
    function fmt(s) { if (s === undefined) return '-'; var m = s / 60; return m < 90 ? m.toFixed(1) + '分' : (m / 60).toFixed(2) + '時間'; }
    var mean = ts.reduce(function (a, b) { return a + b; }, 0) / (ts.length || 1);
    console.log('| ' + T.toLocaleString() + '枚 | ' + fmt(mean) + ' | ' + fmt(ts[Math.floor(ts.length / 2)]) + ' | ' + fmt(ts[Math.floor(ts.length * 0.9)]) + ' | ' + (fail / TRIALS * 100).toFixed(1) + '% |');
  });
}

var t0 = Date.now();
summarize('ランダム停止', 'A');
summarize('左BAR狙い・ボーナス即揃え', 'B');
console.log('\n※平均・中央値・90%は到達した試行のみで計算。elapsed ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
