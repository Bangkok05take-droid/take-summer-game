/*
 * リール描画とアニメーション（加速 → 定速 → 停止）
 * 停止位置の決定は行わない。Game から「絶対位置で止めろ」と指示されるだけ。
 *
 * pos: 中段にある図柄番号（実数・単調増加）。pos が増えると図柄は下へ流れる。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  /*
   * opts（省略時は従来どおりの表示）:
   *   gapRatio   … リール間の隙間 / リール幅（筐体デザインでは 25/220）
   *   symAspect  … 図柄1コマの高さ / リール幅（省略時 0.62）
   *   fixedHeight… true なら canvas の表示高さを変更しない（筐体の枠に合わせる）
   *   pixelScale … 描画解像度の倍率を返す関数（筐体を縮小表示する場合に使用）
   */
  function ReelView(canvas, opts) {
    this.canvas = canvas;
    this.opts = opts || {};
    this.ctx = canvas.getContext('2d');
    this.reels = [0, 1, 2].map(function (i) {
      return { pos: [3, 9, 15][i], speed: 0, phase: 'IDLE', startAt: 0, target: 0, onStop: null, bounceAt: 0 };
    });
    this.winLines = [];
    this.highlight = null; // [[reel,row],...]
    this.dim = false;
    this.last = 0;
    this.resize();
    var self = this;
    window.addEventListener('resize', function () { self.resize(); });
    requestAnimationFrame(function loop(t) { self.tick(t); requestAnimationFrame(loop); });
  }

  ReelView.prototype.resize = function () {
    var o = this.opts;
    var dpr = o.pixelScale ? o.pixelScale() : Math.min(window.devicePixelRatio || 1, 3);
    var cssW = this.canvas.clientWidth || 360;
    var gapR = o.gapRatio || 0;
    this.reelW = Math.floor(cssW * dpr / (3 + 2 * gapR));
    this.gap = Math.floor(this.reelW * gapR);
    this.pitch = this.reelW + this.gap;
    this.symH = Math.floor(this.reelW * (o.symAspect || 0.62));
    this.canvas.width = this.reelW * 3 + this.gap * 2;
    this.canvas.height = this.symH * 3;
    if (!o.fixedHeight) this.canvas.style.height = (this.canvas.height / dpr) + 'px';
  };

  ReelView.prototype.maxSpeed = function () { return NCS.CONFIG.REEL_RPM / 60 * NCS.REEL_SIZE * (this.speedScale || 1); }; // コマ/秒

  // オート消化時の高速化（回転速度・加速時間の倍率）
  ReelView.prototype.setSpeedScale = function (k) { this.speedScale = k; };

  // ---- Game から呼ばれるインターフェース ----
  ReelView.prototype.start = function () {
    var now = performance.now();
    this.winLines = []; this.highlight = null;
    this.reels.forEach(function (r) { r.phase = 'ACCEL'; r.startAt = now; r.speed = 0; r.onStop = null; });
  };

  ReelView.prototype.canStop = function (i) { return this.reels[i].phase === 'SPIN'; };

  // 押下位置: これから中段に到達する図柄（現在位置以上の最小整数）
  ReelView.prototype.press = function (i) {
    var base = Math.ceil(this.reels[i].pos - 1e-6);
    return { base: base, press: base % NCS.REEL_SIZE };
  };

  ReelView.prototype.stop = function (i, absTarget, cb) {
    var r = this.reels[i];
    r.phase = 'STOPPING'; r.target = absTarget; r.onStop = cb;
  };

  ReelView.prototype.isAllStopped = function () {
    return this.reels.every(function (r) { return r.phase === 'IDLE'; });
  };

  ReelView.prototype.showWins = function (wins) {
    this.winLines = wins.map(function (w) { return w.line; });
  };

  // ---- アニメーション ----
  ReelView.prototype.tick = function (t) {
    var dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0;
    this.last = t;
    var vmax = this.maxSpeed(), accel = NCS.CONFIG.ACCEL_MS / (this.speedScale || 1);
    for (var i = 0; i < 3; i++) {
      var r = this.reels[i];
      if (r.phase === 'ACCEL' || r.phase === 'SPIN') {
        var k = Math.min(1, (t - r.startAt) / accel);
        r.speed = vmax * k * k * (3 - 2 * k);
        if (k >= 1) r.phase = 'SPIN';
        r.pos += r.speed * dt;
      } else if (r.phase === 'STOPPING') {
        r.pos += vmax * dt;
        if (r.pos >= r.target) {
          r.pos = r.target;
          r.phase = 'IDLE';
          r.bounceAt = t;
          var cb = r.onStop; r.onStop = null;
          if (cb) cb();
        }
      }
    }
    this.draw(t);
  };

  ReelView.prototype.draw = function (t) {
    var c = this.ctx, W = this.reelW, H = this.symH, n = NCS.REEL_SIZE;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (var i = 0; i < 3; i++) {
      var r = this.reels[i], x0 = i * this.pitch;
      // 停止時の小さなバウンド
      var bounce = 0, bt = t - r.bounceAt;
      if (r.phase === 'IDLE' && bt < 120) bounce = Math.sin(bt / 120 * Math.PI) * H * 0.06;

      var grd = c.createLinearGradient(0, 0, 0, H * 3);
      grd.addColorStop(0, '#cfcfc6'); grd.addColorStop(0.18, '#fbfbf4'); grd.addColorStop(0.82, '#fbfbf4'); grd.addColorStop(1, '#cfcfc6');
      c.fillStyle = grd; c.fillRect(x0 + 2, 0, W - 4, H * 3);

      var base = Math.floor(r.pos);
      var blur = r.speed > this.maxSpeed() * 0.6 && r.phase !== 'IDLE';
      for (var d = -2; d <= 2; d++) {
        var idx = base + d;
        var y = H * 1.5 - (idx - r.pos) * H - H / 2 + bounce;
        if (y > H * 3 || y + H < 0) continue;
        var sym = NCS.STRIPS[i][((idx % n) + n) % n];
        var img = NCS.symbolCanvas(sym, W - 8, H);
        c.globalAlpha = blur ? 0.75 : 1;
        c.drawImage(img, x0 + 4, y);
        if (blur) { c.globalAlpha = 0.25; c.drawImage(img, x0 + 4, y - H * 0.18); }
        c.globalAlpha = 1;
      }
      // 上下の陰影
      var sh = c.createLinearGradient(0, 0, 0, H * 3);
      sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(0.15, 'rgba(0,0,0,0)');
      sh.addColorStop(0.85, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)');
      c.fillStyle = sh; c.fillRect(x0 + 2, 0, W - 4, H * 3);
      c.fillStyle = '#000'; c.fillRect(x0, 0, 2, H * 3); c.fillRect(x0 + W - 2, 0, 2, H * 3);
    }
    // 入賞ライン
    if (this.winLines.length) {
      var blink = Math.floor(t / 250) % 2 === 0, P = this.pitch;
      c.lineWidth = Math.max(3, H * 0.06);
      c.strokeStyle = blink ? 'rgba(255,40,40,0.9)' : 'rgba(255,220,40,0.9)';
      c.lineCap = 'round';
      this.winLines.forEach(function (li) {
        var rows = NCS.LINES[li].rows;
        c.beginPath();
        for (var k = 0; k < 3; k++) c.lineTo(k * P + W / 2, rows[k] * H + H / 2);
        c.stroke();
      });
    }
  };

  NCS.ReelView = ReelView;
})(typeof window !== 'undefined' ? window : globalThis);
