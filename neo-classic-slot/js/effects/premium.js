/*
 * プレミア演出（すべてBIG確定）— 演出抽選は内部抽選と分離。フラグを見て「どう見せるか」だけを決める。
 *
 *   プチュンフリーズ … レバーONで「プチュン」→ 照明・画面が暗転し約1秒の完全な静寂 →
 *                      LUCKY CHANCE が紫に激しく発光 → 金色の光と「PREMIUM BIG BONUS」→ 通常のBIG確定状態へ（約4秒）
 *                      （NEO独自の演出。音はすべて合成音、映像はCSS）
 *   遅れ             … リール始動がわずかに遅れる（告知は通常タイミング）
 *   第2停止プレミア  … 第2停止で特殊告知（リーチ目に関係なく点灯）
 *   振動             … 告知時に長い振動（Vibration API 対応端末のみ）
 *   復活フリーズ     … ジャグ連で隠していたBIGを4G目のレバーONで「復活！ nGAME目でBIG当選！」
 *   無音先ペカ       … BIG消化中、レバーONでBGM・効果音がすべて止まり告知ランプ点灯。次のレバーONで音が戻る
 *
 * 発生率は CONFIG.PREMIUM（ジャグ連チャンス中は chance の率）。
 * デバッグ: premium.force = 'freeze' | 'delay' | 'stop2' | 'vibe'（次のBIG成立ゲームで発生）
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function Premium(effects) {
    this.fx = effects;
    this.force = null;
    this.current = null;   // このゲームの演出
    this.silent = false;   // 無音先ペカ中
    this.buildOverlay();
  }

  Premium.prototype.buildOverlay = function () {
    if (typeof document === 'undefined') return;
    var el = document.createElement('div');
    el.className = 'premium-overlay';
    el.innerHTML = '<div class="pm-text"><div class="pm-l1"></div><div class="pm-l2"></div></div>';
    document.body.appendChild(el);
    this.el = el;
  };

  Premium.prototype.show = function (kind, l1, l2, ms) {
    if (!this.el) return;
    var el = this.el;
    el.querySelector('.pm-l1').textContent = l1 || '';
    el.querySelector('.pm-l2').textContent = l2 || '';
    el.className = 'premium-overlay show ' + kind;
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(function () { el.className = 'premium-overlay'; }, ms);
  };

  // 演出抽選（BIG成立ゲームのみ）。戻り値: 'freeze' | 'delay' | 'stop2' | null、vibe は別抽選
  Premium.prototype.pick = function (flag) {
    var P = NCS.CONFIG.PREMIUM, r = flag.jugren ? P.chance : P.normal;
    var pick = { main: null, vibe: Math.random() < r.vibe };
    var x = Math.random();
    if (x < r.freeze) pick.main = 'freeze';
    else if (x < r.freeze + r.delay) pick.main = 'delay';
    else if (x < r.freeze + r.delay + r.stop2) pick.main = 'stop2';
    if (this.force) {
      if (this.force === 'vibe') pick.vibe = true; else pick.main = this.force;
      this.force = null;
    }
    return pick;
  };

  /*
   * レバーON時（Effects から呼ばれる）。戻り値 true のとき通常の先ペカ判定を行わない。
   */
  Premium.prototype.onLever = function (e, game) {
    var f = e.flag, P = NCS.CONFIG.PREMIUM, fx = this.fx, self = this;
    this.current = null;

    // 無音先ペカの解除（次のレバーONで音が戻る）
    if (this.silent) { this.silent = false; fx.sound.muteAll(false); }

    // BIG消化中の無音先ペカ
    if (f.silentPeka) {
      this.silent = true;
      fx.sound.muteAll(true);
      fx.lightSilent();
      return true;
    }

    // 復活フリーズ（4G目のレバーON）
    if (f.revival) {
      game.startDelay = P.revivalMs;
      fx.sound.premium('revival');
      NCS.vibrate([120, 60, 120, 60, 300]);
      this.show('revival', '復活！', f.revival.at + ' GAME目でBIG当選！', P.revivalMs);
      setTimeout(function () { fx.light('REVIVAL', true); }, P.revivalMs - 600);
      return true;
    }

    if (f.bonus !== 'BIG' || !f.newBonus) return false;
    var pick = this.pick(f);
    this.current = pick;
    if (pick.main === 'freeze') {
      this.puchun(game, pick);
      return true;
    }
    if (pick.main === 'delay') game.startDelay = P.delayMs; // 告知は通常タイミング
    if (pick.main === 'stop2') return true;                 // 告知は第2停止で
    return false;
  };

  // プチュンフリーズ（約4秒・リール始動を止める）
  Premium.prototype.puchun = function (game, pick) {
    var P = NCS.CONFIG.PREMIUM, T = P.puchun, fx = this.fx, self = this;
    game.startDelay = P.freezeMs;
    fx.sound.premium('puchun');                       // ① プチュン！
    var r = fx.ui.lampRect ? fx.ui.lampRect() : null; // 紫に光るランプの画面上の位置
    if (this.el && r) {
      this.el.style.setProperty('--lx', (r.left + r.width / 2) + 'px');
      this.el.style.setProperty('--ly', (r.top + r.height / 2) + 'px');
    }
    this.show('puchun', '', '', P.freezeMs);          // ② 暗転
    if (fx.ui.blackout) fx.ui.blackout(true);
    setTimeout(function () { fx.sound.muteAll(true); }, T.silentAt); // ③ 完全な静寂
    setTimeout(function () {                          // ④ LUCKY CHANCE が紫に発光
      fx.sound.muteAll(false);
      fx.sound.premium('puchunLamp');
      if (fx.ui.setLampPremium) fx.ui.setLampPremium();
      NCS.vibrate([150, 60, 150]);
    }, T.lampAt);
    setTimeout(function () {                          // ⑤ 金色の光と PREMIUM BIG BONUS
      fx.sound.premium('puchunGold');
      if (self.el) {
        self.el.querySelector('.pm-l1').textContent = 'PREMIUM';
        self.el.querySelector('.pm-l2').textContent = 'BIG BONUS';
        self.el.classList.add('gold');
      }
    }, T.textAt);
    setTimeout(function () {                          // ⑥ 通常のBIG確定状態へ
      if (fx.ui.blackout) fx.ui.blackout(false);
      fx.lampOn = false;
      fx.light('PUCHUN', pick.vibe);
    }, P.freezeMs - 250);
  };

  // 停止時（Effects から呼ばれる）。戻り値 true で通常の告知処理を行わない
  Premium.prototype.onStopped = function (e) {
    if (!this.current || this.current.main !== 'stop2' || e.nth !== 2) return false;
    this.fx.sound.premium('stop2');
    this.show('stop2', 'PREMIUM', '', 900);
    this.fx.light('STOP2_PREMIUM', this.current.vibe);
    return true;
  };

  Premium.prototype.wantsVibe = function () { return !!(this.current && this.current.vibe); };

  NCS.Premium = Premium;
})(typeof window !== 'undefined' ? window : globalThis);
