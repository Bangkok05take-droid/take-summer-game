/*
 * オート消化（ボーナス中のみ動作）
 * ON の間、ボーナスゲームを自動でレバーON → 第1〜第3停止まで進める。
 * リールの回転・停止は通常どおり表示し、速度だけ CONFIG.AUTO_SPEED 倍にする。
 * いつでも OFF にでき、OFF にした時点の残りゲームは手動で消化できる。
 * ON のまま通常時に戻った場合は待機し、次のボーナス開始で再び動き出す。
 *
 * イベント（game 経由ではなく autoPlay.on で購読）:
 *   change {enabled, running}
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function AutoPlay(game, reels) {
    this.game = game;
    this.reels = reels;
    this.enabled = false;
    this.running = false;
    this.timer = null;
    this.listeners = [];
    var self = this;
    game.on('bonus', function () { self.kick(NCS.CONFIG.AUTO_LEVER_DELAY_MS * 4); });
    game.on('result', function () { self.kick(NCS.CONFIG.AUTO_LEVER_DELAY_MS); });
    game.on('bonusEnd', function () { self.setRunning(false); });
  }

  AutoPlay.prototype.on = function (fn) { this.listeners.push(fn); };
  AutoPlay.prototype.notify = function () {
    var e = { enabled: this.enabled, running: this.running };
    this.listeners.forEach(function (fn) { fn(e); });
  };

  AutoPlay.prototype.setEnabled = function (on) {
    this.enabled = on;
    if (on) this.kick(NCS.CONFIG.AUTO_LEVER_DELAY_MS);
    else this.setRunning(false);
    this.notify();
  };
  AutoPlay.prototype.toggle = function () { this.setEnabled(!this.enabled); };

  AutoPlay.prototype.setRunning = function (on) {
    if (this.running === on) return;
    this.running = on;
    if (this.reels.setSpeedScale) this.reels.setSpeedScale(on ? NCS.CONFIG.AUTO_SPEED : 1);
    if (!on) { clearTimeout(this.timer); this.timer = null; }
    this.notify();
  };

  // 次のゲームを予約（ボーナス中・オートON・待機中の時だけ）
  AutoPlay.prototype.kick = function (delay) {
    var self = this;
    if (!this.enabled || !this.game.inBonus) return;
    this.setRunning(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(function () { self.step(); }, delay);
  };

  AutoPlay.prototype.step = function () {
    var self = this, game = this.game;
    if (!this.enabled || !game.inBonus) { this.setRunning(false); return; }
    if (game.phase === 'IDLE') {
      if (!game.lever()) { this.timer = setTimeout(function () { self.step(); }, 100); return; }
    }
    // 順押しで、定速になり次第一定間隔で停止
    var next = [0, 1, 2].filter(function (r) { return game.control.stops[r] < 0; })[0];
    if (next === undefined) return; // 全停止 → result で次を予約
    if (game.phase === 'SPINNING' && self.reels.canStop(next)) {
      game.stop(next);
      this.timer = setTimeout(function () { self.step(); }, NCS.CONFIG.AUTO_STOP_INTERVAL_MS);
    } else {
      this.timer = setTimeout(function () { self.step(); }, 30);
    }
  };

  NCS.AutoPlay = AutoPlay;
})(typeof window !== 'undefined' ? window : globalThis);
