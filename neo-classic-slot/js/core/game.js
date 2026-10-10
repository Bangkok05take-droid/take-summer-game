/*
 * ゲーム進行（状態管理）
 * DOM・描画・音には一切触れず、イベントを発行するだけ。
 *
 * イベント:
 *   lever    {flag, game}                 レバーON（内部抽選済み）
 *   stop     {reel, nth, press, slide, pos, determined}  停止制御決定（描画前）
 *   stopped  {reel, nth, determined}      リール停止アニメ完了
 *   result   {wins, reachMe, pay, replay, bonusAligned} 全停止後
 *   bonus    {type}                       ボーナス図柄揃い
 *   state    {}                           表示更新用
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
      medals: NCS.CONFIG.START_MEDALS, invest: 0, in: 0, out: 0,
      roles: {}, reachMe: {}, history: []
    };
  }

  Game.prototype.on = function (ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); };
  Game.prototype.emit = function (ev, data) { (this.listeners[ev] || []).forEach(function (fn) { fn(data); }); };

  Game.prototype.lever = function () {
    if (this.phase !== 'IDLE') return false;
    var now = Date.now();
    if (now - this.lastLeverAt < NCS.CONFIG.GAME_WAIT_MS) return false;
    this.lastLeverAt = now;

    var st = this.stats;
    if (!this.replayNext) {
      if (st.medals < NCS.BET) { st.medals += NCS.CONFIG.LEND_MEDALS; st.invest += NCS.CONFIG.LEND_MEDALS; }
      st.medals -= NCS.BET;
      st.in += NCS.BET;
    }
    this.replayNext = false;

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
    st.medals += pay.pay;
    st.out += pay.pay;
    this.replayNext = pay.replay;

    j.wins.forEach(function (w) { st.roles[w.role] = (st.roles[w.role] || 0) + 1; });
    j.reachMe.forEach(function (r) { st.reachMe[r] = (st.reachMe[r] || 0) + 1; });

    var bonusAligned = null;
    j.wins.forEach(function (w) { if (NCS.ROLES[w.role].bonus) bonusAligned = w.role; });

    this.phase = 'IDLE';
    this.emit('result', { wins: j.wins, reachMe: j.reachMe, pay: pay.pay, replay: pay.replay, bonusAligned: bonusAligned, flag: this.flag, stops: this.control.stops.slice(), order: this.control.order.slice() });

    if (bonusAligned) {
      // 第2段階でボーナスゲーム（30G）に置き換える。現状は即終了扱い。
      if (bonusAligned === 'BIG') st.big++; else st.reg++;
      st.history.unshift({ type: bonusAligned, games: st.games });
      if (st.history.length > 20) st.history.pop();
      st.games = 0;
      this.carry = null;
      this.emit('bonus', { type: bonusAligned });
    }
    this.emit('state', {});
  };

  NCS.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
