/*
 * ジャグ連チャンス（第3段階）— 内部抽選側。演出の判断は js/effects/premium.js
 *
 * - BIG 終了後のみ突入。最大3ゲーム（CONFIG.JUGREN.rates = 1G目20% / 2G目25% / 3G目1/3、累計60%）。
 *   当選時の振り分けは BIG 2/3・REG 1/3。未当選の時だけ次ゲームの抽選へ進む。
 *   チャンス中の小役は通常どおり抽選（ボーナスはジャグ連抽選のみで決まる）。
 * - REG 終了後は通常へ。BIG 終了後は新たなジャグ連チャンス。
 * - 先行抽選: BIG 開始時に「チャンス1G目」の当否を抽選して保持し、1G目で再抽選しない。
 *   1G目BIG当選の一部で、BIG消化中の無音先ペカ（silentPekaAt = 何ゲーム目のレバーONで告知するか）。
 * - 復活: チャンス中のBIG当選の一部で、当選を隠して1〜3G目をハズレに見せ、4G目のレバーONで復活フリーズ。
 *   隠している間は停止制御にボーナスを渡さない（確定目・ボーナス揃いが出ない）。内部当選後は再抽選しない。
 *
 * DOM非依存。Game から呼ばれる。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function JugRen(rng) {
    this.rng = rng || Math.random;
    this.reset();
  }

  JugRen.prototype.reset = function () {
    this.active = false;    // ジャグ連チャンス中
    this.game = 0;          // チャンス中の消化ゲーム数（1〜3）。復活待ちの間は4G目まで数える
    this.pre = null;        // 先行抽選の結果（BIG 開始時に決定）{ type: 'BIG'|'REG'|null, revival, silentPekaAt }
    this.hidden = null;     // 復活待ちの内部当選 { type: 'BIG', at: 当選したゲーム }
    this.forced = null;     // デバッグ: { at: n, type, revival }
  };

  // チャンス1ゲームのボーナス抽選（当選なら 'BIG' / 'REG'）
  JugRen.prototype.draw = function (n) {
    var J = NCS.CONFIG.JUGREN;
    if (this.rng() >= J.rates[n - 1]) return null;
    return this.rng() < J.bigShare ? 'BIG' : 'REG';
  };

  // BIG 開始時: チャンス1G目を先行抽選
  JugRen.prototype.onBigStart = function (bonusGames) {
    var P = NCS.CONFIG.PREMIUM;
    var f = this.forced && this.forced.at === 1 ? this.forced : null;
    var type = f ? f.type : this.draw(1);
    var pre = { type: type, revival: false, silentPekaAt: 0 };
    if (type === 'BIG') {
      var silent = f ? f.silentPeka : this.rng() < P.silentPekaRate;
      if (silent) pre.silentPekaAt = 2 + Math.floor(this.rng() * (bonusGames - 3)); // 2〜(n-2)G目のどこか
      else pre.revival = f ? !!f.revival : this.rng() < P.revivalRate;
    }
    if (f) this.forced = null;
    this.pre = pre;
  };

  JugRen.prototype.onBonusEnd = function (type) {
    this.active = type === 'BIG';
    this.game = 0;
    this.hidden = null;
    if (!this.active) this.pre = null;
  };

  /*
   * 通常時レバーON（ボーナス持ち越し中でない時）に呼ぶ。
   * 戻り値: null（ジャグ連の対象外＝通常抽選）または
   *   { bonus: 'BIG'|'REG'|null, hiddenBonus, revival: { at } | null, game: n }
   */
  JugRen.prototype.lever = function () {
    if (this.hidden) {
      this.game++;
      if (this.game <= NCS.CONFIG.JUGREN.rates.length) return { bonus: null, hiddenBonus: this.hidden.type, game: this.game };
      // 4G目: 復活
      var h = this.hidden;
      this.hidden = null;
      this.active = false;
      return { bonus: h.type, revival: { at: h.at }, game: this.game };
    }
    if (!this.active) return null;
    this.game++;
    var n = this.game, type, revival = false;
    if (n === 1 && this.pre) {
      type = this.pre.type; revival = this.pre.revival;
    } else {
      var f = this.forced && this.forced.at === n ? this.forced : null;
      type = f ? f.type : this.draw(n);
      if (type === 'BIG') revival = f ? !!f.revival : this.rng() < NCS.CONFIG.PREMIUM.revivalRate;
      if (f) this.forced = null;
    }
    this.pre = null;
    if (type && revival && type === 'BIG') {
      this.hidden = { type: type, at: n };
      return { bonus: null, hiddenBonus: type, game: n };
    }
    if (type || n >= NCS.CONFIG.JUGREN.rates.length) this.active = false;
    return { bonus: type, game: n };
  };

  NCS.JugRen = JugRen;
})(typeof window !== 'undefined' ? window : globalThis);
