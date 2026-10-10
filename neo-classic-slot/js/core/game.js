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
 *   bonusGame{type, played, left, pay}     ボーナス中1ゲーム終了
 *   bonusEnd {type, games, got}           ボーナス消化完了（COUNTリセット）
 *   state    {}                           表示更新用
 *
 *   boxComplete {added, boxes, legendary} ドル箱完成（wallet から中継）
 *   boxBreak    {boxes}                    ドル箱取り崩し（wallet から中継）
 *
 * メダルの流れ（js/core/wallet.js）:
 *   払い出し → クレジット(0〜999)。1,000枚ごとにドル箱へ。
 *   BET → クレジットから。不足時はドル箱から必要分を自動補充。
 * 表示用の値:
 *   stats.games     … 前回ボーナス消化完了からのゲーム数（筐体 COUNT）
 *   stats.lastPay   … 現在（直前）のゲームの払い出し枚数（筐体 PAYOUT）
 *   stats.bonusGot  … 消化中／直近ボーナスの合計獲得枚数
 *   stats.totalGames… 総ゲーム数（通常ゲームのみ。データ画面）
 *   stats.bonusPlayed… 消化中ボーナスの消化ゲーム数
 *
 * ボーナス中（inBonus）は内部抽選を行わず、ブドウ揃いで BONUS_PAY 枚の固定払い出し（仮仕様）。
 * BONUS_GAMES ゲーム消化で終了。
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
      in: 0, out: 0,
      lastPay: 0, bonusGot: 0, bonusType: null, bonusPlayed: 0,
      jugrenChances: 0, jugrenHits: 0, revivals: 0,
      roles: {}, reachMe: {}, history: []
    };
    var self = this;
    this.jugren = new NCS.JugRen();
    this.wallet = new NCS.Wallet(function (ev, data) { self.emit(ev, data); });
    // 表示用の互換プロパティ（実体は wallet）
    Object.defineProperty(this.stats, 'credit', { get: function () { return self.wallet.credit; }, enumerable: true });
    Object.defineProperty(this.stats, 'invest', { get: function () { return self.wallet.invest; }, enumerable: true });
    this.inBonus = false;
    this.bet = 0;       // 現在BETされている枚数（レバーONで消費）
    this.lastBet = 0;   // 直前ゲームのBET（リプレイ用）
    this.gameBet = 0;   // 進行中ゲームのBET
  }


  Game.prototype.on = function (ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); };
  Game.prototype.emit = function (ev, data) { (this.listeners[ev] || []).forEach(function (fn) { fn(data); }); };

  // BET 1枚（最大 MAX_BET）。リプレイ中・回転中は不可
  Game.prototype.addBet = function () {
    if (this.phase !== 'IDLE' || this.replayNext || this.bet >= NCS.MAX_BET) return false;
    var st = this.stats;
    if (!this.wallet.spend(1)) return false; // 所持枚数を超えてBETしない（不足時はドル箱から自動補充）
    st.in += 1;
    this.bet++;
    this.emit('bet', { bet: this.bet });
    this.emit('state', {});
    return true;
  };

  // 大きな LEVER ON ボタン: 不足分を追加BETして MAX BET にしてからレバーON
  Game.prototype.leverMax = function () {
    if (this.phase !== 'IDLE') return false;
    if (!this.replayNext) while (this.bet < NCS.MAX_BET && this.addBet()) { /* 追加BET */ }
    return this.lever();
  };

  // レバーON（現在のBET枚数で開始。BET 0枚なら開始しない）
  Game.prototype.lever = function () {
    if (this.phase !== 'IDLE') return false;
    if (this.replayNext) this.bet = this.lastBet; // リプレイは前回と同じBETで自動開始
    if (this.bet < 1) return false;
    var now = Date.now();
    if (now - this.lastLeverAt < NCS.CONFIG.GAME_WAIT_MS) return false;
    this.lastLeverAt = now;

    var st = this.stats;
    this.replayNext = false;
    this.lastBet = this.bet;
    this.gameBet = this.bet;
    this.bet = 0;
    st.lastPay = 0;

    if (this.inBonus) {
      // ボーナスゲーム: 抽選なし（ジャグ連1G目はBIG開始時に先行抽選済み）
      this.flag = { bonus: null, small: 'GRAPE', mode: 'NORMAL', bonusGame: st.bonusType };
      var pre = this.jugren.pre;
      if (st.bonusType === 'BIG' && pre && pre.silentPekaAt === st.bonusPlayed + 1) this.flag.silentPeka = true;
    } else {
      var jr = this.carry ? null : this.jugren.lever();
      this.flag = this.lottery.lever(this.carry, jr);
      if (jr) {
        this.flag.jugren = jr.game;                 // チャンス何ゲーム目か（復活の4G目は 4）
        if (jr.hiddenBonus) this.flag.hiddenBonus = jr.hiddenBonus; // 復活待ち（停止制御には渡さない）
        if (jr.revival) { this.flag.revival = jr.revival; st.revivals++; }
        if (jr.game === 1 && !jr.revival) st.jugrenChances++;
        if ((jr.bonus && !jr.revival) || (jr.hiddenBonus && this.jugren.hidden && jr.game === this.jugren.hidden.at)) st.jugrenHits++;
        if (jr.bonus) this.carryFromJugren = true;
      }
      if (this.flag.bonus) this.carry = this.flag.bonus;
      st.games++;
      st.totalGames++;
    }
    this.flag.lines = NCS.activeLines(this.gameBet);
    this.control.reset(this.flag);
    this.stoppedCount = 0;
    this.animDone = 0;
    this.phase = 'SPINNING';
    // 演出（フリーズ・遅れ）は lever イベント中に startDelay を設定してリール始動を遅らせられる
    this.startDelay = 0;
    this.emit('lever', { flag: this.flag, game: st.games });
    var self = this;
    if (this.startDelay > 0) setTimeout(function () { self.reels.start(); }, this.startDelay);
    else this.reels.start();
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
    var j = NCS.judge(this.control.stops, this.control.order, this.flag.lines);
    var pay = NCS.payout(j.wins);
    var st = this.stats;
    if (this.flag.bonusGame) pay = { pay: NCS.CONFIG.BONUS_PAY[this.flag.bonusGame], replay: false };
    this.wallet.add(pay.pay);
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

    if (this.flag.bonusGame) {
      st.bonusPlayed++;
      var left = NCS.CONFIG.BONUS_GAMES[st.bonusType] - st.bonusPlayed;
      this.emit('bonusGame', { type: st.bonusType, played: st.bonusPlayed, left: left, pay: pay.pay });
      if (left <= 0) this.endBonus();
    } else if (bonusAligned) {
      this.startBonus(bonusAligned);
    }
    this.emit('state', {});
  };

  Game.prototype.startBonus = function (type) {
    var st = this.stats;
    if (type === 'BIG') this.jugren.onBigStart(NCS.CONFIG.BONUS_GAMES.BIG); // チャンス1G目を先行抽選
    st.bonusFromJugren = !!this.carryFromJugren;
    this.carryFromJugren = false;
    if (type === 'BIG') st.big++; else st.reg++;
    this.carry = null;
    this.inBonus = true;
    st.bonusType = type;
    st.bonusGot = 0;
    st.bonusPlayed = 0;
    st.bonusStartGames = st.games; // 当選までのゲーム数（履歴用）
    this.emit('bonus', { type: type });
  };

  // ボーナス消化完了: COUNT（前回ボーナスからのゲーム数）をここで0に戻す
  Game.prototype.endBonus = function () {
    var st = this.stats;
    var rec = { type: st.bonusType, games: st.bonusStartGames, got: st.bonusGot, jugren: !!st.bonusFromJugren };
    st.history.unshift(rec);
    if (st.history.length > 20) st.history.pop();
    st.games = 0;
    this.inBonus = false;
    this.replayNext = false;
    this.jugren.onBonusEnd(st.bonusType);
    this.emit('bonusEnd', rec);
    this.emit('state', {});
  };

  NCS.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
