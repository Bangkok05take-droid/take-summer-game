/*
 * メダル管理（クレジット＋ドル箱）
 *
 *   総所持枚数 = クレジット(0〜999) + ドル箱内枚数
 *   完成箱数   = floor(ドル箱内枚数 / 1000)
 *
 * - 払い出しでクレジットが1,000枚以上になったら、1,000枚ずつドル箱へ移す（一度に複数箱にも対応）。
 * - BETに必要なクレジットが足りない時は、ドル箱から必要な枚数だけ自動補充する。
 *   取り崩しで1,000枚を割ると完成箱数も減る（端数は「作りかけの箱」）。
 * - ドル箱も空の時は CONFIG.LEND_MEDALS 枚をクレジットへ貸し出す（投資として集計）。
 * - 最高到達枚数・最高ドル箱数・累計獲得枚数は別に記録する（減っても残る）。
 * - 状態は NCS.storage に保存し、再起動後に復元する。
 *
 * DOM非依存。イベントは onEvent(name, data) で通知する:
 *   boxComplete {added, boxes, legendary}  ドル箱が完成した（legendary = 初めて10箱到達）
 *   boxBreak    {boxes}                    取り崩しで完成箱数が減った
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  var SAVE_KEY = 'ncs.wallet.v1';

  function Wallet(onEvent) {
    this.onEvent = onEvent || function () {};
    var C = NCS.CONFIG;
    this.boxSize = C.BOX_SIZE;
    this.credit = C.START_CREDIT;
    this.boxMedals = 0;
    this.invest = 0;
    this.totalWon = 0;      // 累計獲得枚数（払い出しの合計）
    this.maxHoldings = this.credit;
    this.maxBoxes = 0;
    this.load();
  }

  Wallet.prototype.boxes = function () { return Math.floor(this.boxMedals / this.boxSize); };
  Wallet.prototype.holdings = function () { return this.credit + this.boxMedals; };

  // 払い出し: クレジットへ加算し、1,000枚ごとにドル箱へ移す
  Wallet.prototype.add = function (n) {
    if (n <= 0) return;
    var before = this.boxes();
    this.totalWon += n;
    this.credit += n;
    while (this.credit >= this.boxSize) {
      this.credit -= this.boxSize;
      this.boxMedals += this.boxSize;
    }
    var added = this.boxes() - before;
    this.updateMax();
    if (added > 0) {
      var legendary = this.boxes() >= NCS.CONFIG.LEGEND_BOXES && !this.legendDone;
      if (legendary) this.legendDone = true;
      this.onEvent('boxComplete', { added: added, boxes: this.boxes(), legendary: legendary });
    }
    this.save();
  };

  // BETに必要な枚数を確保（クレジット → ドル箱 → 貸出の順）。確保できたら true
  Wallet.prototype.ensure = function (need) {
    if (this.credit >= need) return true;
    var short = need - this.credit;
    if (this.boxMedals > 0) {
      var before = this.boxes();
      var take = Math.min(short, this.boxMedals);
      this.boxMedals -= take;
      this.credit += take;
      short -= take;
      if (this.boxes() < before) this.onEvent('boxBreak', { boxes: this.boxes() });
    }
    if (short > 0 && NCS.CONFIG.LEND_MEDALS > 0) {
      this.credit += NCS.CONFIG.LEND_MEDALS;
      this.invest += NCS.CONFIG.LEND_MEDALS;
    }
    this.save();
    return this.credit >= need;
  };

  // BET: クレジットから消費
  Wallet.prototype.spend = function (n) {
    if (!this.ensure(n)) return false;
    this.credit -= n;
    this.save();
    return true;
  };

  Wallet.prototype.updateMax = function () {
    if (this.holdings() > this.maxHoldings) this.maxHoldings = this.holdings();
    if (this.boxes() > this.maxBoxes) this.maxBoxes = this.boxes();
  };

  // ---- セーブ／ロード ----
  Wallet.prototype.snapshot = function () {
    return {
      credit: this.credit, boxes: this.boxes(), boxMedals: this.boxMedals, holdings: this.holdings(),
      maxHoldings: this.maxHoldings, maxBoxes: this.maxBoxes, totalWon: this.totalWon, invest: this.invest, legendDone: !!this.legendDone
    };
  };

  Wallet.prototype.save = function () {
    NCS.storage.set(SAVE_KEY, this.snapshot());
  };

  Wallet.prototype.load = function () {
    var d = NCS.storage.get(SAVE_KEY);
    if (!d || typeof d.credit !== 'number') return false;
    this.credit = d.credit;
    this.boxMedals = d.boxMedals;
    this.maxHoldings = d.maxHoldings || 0;
    this.maxBoxes = d.maxBoxes || 0;
    this.invest = d.invest || 0;
    this.totalWon = d.totalWon || 0;
    this.legendDone = !!d.legendDone;
    return true;
  };

  Wallet.prototype.reset = function () {
    NCS.storage.remove(SAVE_KEY);
    this.credit = NCS.CONFIG.START_CREDIT;
    this.boxMedals = 0;
    this.invest = 0;
    this.totalWon = 0;
    this.maxHoldings = this.credit;
    this.maxBoxes = 0;
    this.legendDone = false;
    this.save();
  };

  NCS.Wallet = Wallet;

  // ---- 保存先（localStorage が使えない環境ではメモリ保存） ----
  var mem = {};
  NCS.storage = {
    get: function (k) {
      try { var v = g.localStorage && g.localStorage.getItem(k); return v ? JSON.parse(v) : (mem[k] || null); }
      catch (e) { return mem[k] || null; }
    },
    set: function (k, v) {
      mem[k] = v;
      try { if (g.localStorage) g.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存不可 */ }
    },
    remove: function (k) {
      delete mem[k];
      try { if (g.localStorage) g.localStorage.removeItem(k); } catch (e) { /* 保存不可 */ }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
