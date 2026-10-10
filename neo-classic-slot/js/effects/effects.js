/*
 * 演出（告知ランプ・振動など）
 * Game のイベントを購読し、いつ・どう告知するかだけを決める。抽選や停止制御には関与しない。
 *
 * 告知タイミング（第1段階）:
 *   - 先ペカ: ボーナス成立ゲームのレバーON時（LAMP.leverOnRate）
 *   - 確定停止: リーチ目で確定した停止（第1/第2停止）で点灯
 *   - 後ペカ: 第3停止後
 *   - 持ち越し中は点灯したまま。ボーナス図柄が揃ったら消灯。
 * 第4段階でプレミア演出（フリーズ・遅れ・振動など）をここに追加する。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function Effects(game, ui, sound) {
    this.game = game;
    this.ui = ui;
    this.sound = sound;
    this.lampOn = false;
    this.pending = false; // このゲームで点灯予定（ボーナス内部中で未点灯）
    this.lampTiming = null;
    this.forceLeverLamp = false;

    var self = this;
    game.on('lever', function (e) { self.onLever(e); });
    game.on('stopped', function (e) { self.onStopped(e); });
    game.on('result', function (e) { self.onResult(e); });
    game.on('bonus', function (e) { self.onBonus(e); });
    game.on('bonusEnd', function (e) { if (self.ui.bonusEnd) self.ui.bonusEnd(e); });
    game.on('bonusGame', function (e) { if (self.ui.bonusGame) self.ui.bonusGame(e); });
  }

  Effects.prototype.light = function (timing) {
    if (this.lampOn) return;
    this.lampOn = true;
    this.pending = false;
    this.lampTiming = timing;
    this.ui.setLamp(true);
    this.sound.lamp();
    if (timing !== 'LEVER') NCS.vibrate([40]);
  };

  Effects.prototype.onLever = function (e) {
    if (!this.autoRunning) this.sound.lever();
    var f = e.flag;
    if (f.bonus && !this.lampOn) {
      this.pending = true;
      var lever = this.forceLeverLamp || (f.newBonus && Math.random() < NCS.LAMP.leverOnRate);
      this.forceLeverLamp = false;
      if (lever) this.light('LEVER');
    }
  };

  Effects.prototype.onStopped = function (e) {
    if (!this.autoRunning || e.nth === 3) this.sound.reelStop();
    if (this.pending && e.determined) this.light('STOP' + e.nth);
  };

  Effects.prototype.onResult = function (e) {
    if (this.pending) this.light('AFTER');
    this.ui.showResult(e);
    if (e.pay) this.sound.payout(e.pay, this.autoRunning);
  };

  Effects.prototype.onBonus = function (e) {
    this.sound.bonusJingle();
    this.ui.flashBonus(e.type);
    this.lampOn = false;
    this.ui.setLamp(false);
  };

  // Vibration API 対応環境のみ
  NCS.vibrate = function (pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (err) { /* 未対応 */ }
  };

  NCS.Effects = Effects;
})(typeof window !== 'undefined' ? window : globalThis);
