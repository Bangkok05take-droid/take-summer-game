/*
 * ゲーム進行（状態管理）
 * DOM・描画・音には一切触れず、イベントを発行するだけ。
 *
 * イベント:
 *   lever    {flag, game}                 レバーON（内部抽選済み）
 *   stop     {reel, nth, press, slide, pos, determined}  停止制御決定（描画前）
 *   stopped  {reel, nth, determined}      リール停止アニメ完了
 *   result   {wins, reachMe, pay, replay, bonusAligned} 全停止後
 *   bonus    {type}                       ボーナス図柄揃い（＝ボーナス開始）
 *   bonusEnd {type, games, got}           ボーナス消化完了（COUNTリセット）
 *   state    {}                           表示更新用
 *
 * メダルの流れ（実機準拠）:
 *   持ちメダル(medals) → クレジット(credit, 最大50) → ベット
 *   払い出しはクレジットへ。50を超えた分は持ちメダルへ。
 * 表示用の値:
 *   stats.games     … 前回ボーナス消化完了からのゲーム数（筐体 COUNT）
 *   stats.lastPay   … 現在（直前）のゲームの払い出し枚数（筐体 PAYOUT）
 *   stats.bonusGot  … 消化中／直近ボーナスの合計獲得枚数
 *   stats.totalGames… 総ゲーム数（データ画面）
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function Game(opts) {
    opts = opts || {};
    this.lottery = opts.lottery || new NCS.Lottery();
    this.control = opts.control || new NCS.ReelControl();
    this.reels = opts.reels; // { start(), canStop(r), press(r) -> {press, base}, stop(r, absTarget, cb) }
    this.listeners = {};
    this.phase = 'IDLE';     // IDLE / SPINNING / RESULT
    this.flag = null;
    this.carry = null;       // 持ち越し中のボーナス
    this.replayNext = false;
    this.stoppedCount = 0;
    this.animDone = 0;
    this.lastLeverAt = 0;
    this.stats = {
      games: 0, totalGames: 0, big: 0, reg: 0,
      credit: 0, medals: NCS.CONFIG.START_MEDALS, invest: 0, in: 0, out: 0,
      lastPay: 0, bonusGot: 0, bonusType: null,
      roles: {}, reachMe: {}, history: []
    };
    this.inBonus = false;
  }

  // 持ちメダルをクレジットへ投入（不足時は貸出）
  Game.prototype.insertMedals = function () {
    var st = this.stats, max = NCS.CONFIG.CREDIT_MAX;
    if (st.medals < max - st.credit) { st.medals += NCS.CONFIG.LEND_MEDALS; st.invest += NCS.CONFIG.LEND_MEDALS; }
    var n = max - st.credit;
    st.medals -= n;
    st.credit += n;
  };

  // 払い出しをクレジットへ。上限超過分は持ちメダルへ。
  Game.prototype.addCredit = function (n) {
    var st = this.stats, max = NCS.CONFIG.CREDIT_MAX;
    var toCredit = Math.min(n, max - st.credit);
    st.credit += toCredit;
    st.medals += n - toCredit;
  };

  Game.prototype.on = function (ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); };
  Game.prototype.emit = function (ev, data) { (this.listeners[ev] || []).forEach(function (fn) { fn(data); }); };

  Game.prototype.lever = function () {
    if (this.phase !== 'IDLE') return false;
    var now = Date.now();
    if (now - this.lastLeverAt < NCS.CONFIG.GAME_WAIT_MS) return false;
    this.lastLeverAt = now;

    var st = this.stats;
    if (!this.replayNext) {
      if (st.credit < NCS.BET) this.insertMedals();
      st.credit -= NCS.BET;
      st.in += NCS.BET;
    }
    this.replayNext = false;
    st.lastPay = 0;

    this.flag = this.lottery.lever(this.carry);
    if (this.flag.bonus) this.carry = this.flag.bonus;
    this.control.reset(this.flag);
    this.stoppedCount = 0;
    this.animDone = 0;
    this.phase = 'SPINNING';
    st.games++;
    st.totalGames++;
    this.emit('lever', { flag: this.flag, game: st.games });
    this.reels.start();
    this.emit('state', {});
    return true;
  };

  Game.prototype.stop = function (reel) {
    if (this.phase !== 'SPINNING') return false;
    if (this.control.stops[reel] >= 0) return false;
    if (!this.reels.canStop(reel)) return false;

    var p = this.reels.press(reel);
    var res = this.control.stop(reel, p.press);
    var nth = ++this.stoppedCount;
    var determined = nth < 3 && !!this.flag.bonus && this.control.isDetermined();
    this.emit('stop', { reel: reel, nth: nth, press: p.press, slide: res.slide, pos: res.pos, determined: determined });

    var self = this;
    this.reels.stop(reel, p.base + res.slide, function () {
      self.emit('stopped', { reel: reel, nth: nth, determined: determined });
      if (++self.animDone === 3) self.finish();
    });
    return true;
  };

  Game.prototype.finish = function () {
    var j = NCS.judge(this.control.stops, this.control.order);
    var pay = NCS.payout(j.wins);
    var st = this.stats;
    this.addCredit(pay.pay);
    st.out += pay.pay;
    st.lastPay = pay.pay;
    if (this.inBonus) st.bonusGot += pay.pay;
    this.replayNext = pay.replay;

    j.wins.forEach(function (w) { st.roles[w.role] = (st.roles[w.role] || 0) + 1; });
    j.reachMe.forEach(function (r) { st.reachMe[r] = (st.reachMe[r] || 0) + 1; });

    var bonusAligned = null;
    j.wins.forEach(function (w) { if (NCS.ROLES[w.role].bonus) bonusAligned = w.role; });

    this.phase = 'IDLE';
    this.emit('result', { wins: j.wins, reachMe: j.reachMe, pay: pay.pay, replay: pay.replay, bonusAligned: bonusAligned, flag: this.flag, stops: this.control.stops.slice(), order: this.control.order.slice() });

    if (bonusAligned) {
      this.startBonus(bonusAligned);
      // 第2段階で30Gのボーナスゲームに置き換える。現状は開始直後に消化完了扱い。
      this.endBonus();
    }
    this.emit('state', {});
  };

  Game.prototype.startBonus = function (type) {
    var st = this.stats;
    if (type === 'BIG') st.big++; else st.reg++;
    this.carry = null;
    this.inBonus = true;
    st.bonusType = type;
    st.bonusGot = 0;
    st.bonusStartGames = st.games; // 当選までのゲーム数（履歴用）
    this.emit('bonus', { type: type });
  };

  // ボーナス消化完了: COUNT（前回ボーナスからのゲーム数）をここで0に戻す
  Game.prototype.endBonus = function () {
    var st = this.stats;
    var rec = { type: st.bonusType, games: st.bonusStartGames, got: st.bonusGot };
    st.history.unshift(rec);
    if (st.history.length > 20) st.history.pop();
    st.games = 0;
    this.inBonus = false;
    this.emit('bonusEnd', rec);
  };

  NCS.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
