/*
 * 停止制御・配列の総当たり検証（Node.js）
 *   node tools/verify.js
 *
 * 全フラグ × 全停止順(6) × 全押下位置(21^3) を実際に停止制御へ通し、
 *   - 非成立役の入賞が無いこと
 *   - ボーナス非成立時にリーチ目が出ないこと
 *   - 大山がREGで出ないこと
 *   - ブドウ・リプレイが取りこぼし無しであること
 * を確認し、各役の引き込み率・リーチ目出現率を表示する。
 */
var path = require('path');
var root = path.join(__dirname, '..', 'js');
['config/symbols.js', 'config/reels.js', 'config/roles.js', 'config/probability.js', 'config/reachme.js',
 'core/lottery.js', 'core/judge.js', 'core/reelControl.js', 'core/verifier.js'].forEach(function (f) {
  require(path.join(root, f));
});
var NCS = globalThis.NCS;

var t0 = Date.now();
// node tools/verify.js all … 1・2枚掛けも検証
var bets = process.argv[2] === 'all' ? [3, 2, 1] : [3];
var report = NCS.verifyControl(null, bets);
console.log(NCS.formatControlReport(report));
console.log('elapsed', ((Date.now() - t0) / 1000).toFixed(1) + 's');
process.exit(report.ok ? 0 : 1);
