/*
 * UI（ボタン・表示・タッチ操作）
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function $(id) { return document.getElementById(id); }

  function UI(game, view, sound) {
    this.game = game;
    this.view = view;
    this.sound = sound;
    this.el = {
      lamp: $('lamp'), lever: $('lever'), bet: $('bet'), msg: $('message'),
      stops: [].slice.call(document.querySelectorAll('.stop')),
      medals: $('v-medals'), hold: $('v-hold'), pay: $('v-pay'), games: $('v-games'),
      big: $('v-big'), reg: $('v-reg'), diff: $('v-diff'), total: $('v-total'),
      bonusFlash: $('bonus-flash')
    };
    this.bind();
    var self = this;
    game.on('state', function () { self.update(); });
    game.on('lever', function () { self.message(''); self.el.pay.textContent = '0'; });
    requestAnimationFrame(function loop() { self.refreshButtons(); requestAnimationFrame(loop); });
    this.update();
  }

  UI.prototype.bind = function () {
    var self = this, game = this.game;
    function tap(el, fn) {
      el.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        self.sound.unlock();
        fn();
      });
    }
    tap(this.el.lever, function () { game.leverMax(); }); // MAX BET＋レバーON
    tap(this.el.bet, function () { if (game.addBet()) self.sound.bet(); });
    this.el.stops.forEach(function (b) {
      tap(b, function () { game.stop(+b.dataset.reel); });
    });
    // PC確認用キーボード: Space/↓=レバー, 1/2/3 または J/K/L=停止
    document.addEventListener('keydown', function (e) {
      if (e.repeat || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      self.sound.unlock();
      var k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); game.leverMax(); }
      else if (k === 'arrowdown') { e.preventDefault(); game.lever(); }
      else if (k === 'b') { if (game.addBet()) self.sound.bet(); }
      else if (k === '1' || k === 'j') game.stop(0);
      else if (k === '2' || k === 'k') game.stop(1);
      else if (k === '3' || k === 'l') game.stop(2);
    });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  UI.prototype.refreshButtons = function () {
    var game = this.game, view = this.view;
    this.el.lever.classList.toggle('active', game.phase === 'IDLE');
    this.el.bet.classList.toggle('active', game.phase === 'IDLE' && !game.replayNext && game.bet < NCS.MAX_BET);
    this.el.bet.textContent = 'BET ' + (game.phase === 'IDLE' ? (game.replayNext ? game.lastBet : game.bet) : game.gameBet);
    this.el.stops.forEach(function (b, i) {
      var on = game.phase === 'SPINNING' && game.control.stops[i] < 0 && view.canStop(i);
      b.classList.toggle('active', on);
    });
  };

  UI.prototype.update = function () {
    var s = this.game.stats;
    this.el.medals.textContent = s.credit;
    this.el.hold.textContent = this.game.wallet.holdings();
    this.el.games.textContent = this.game.inBonus ? s.bonusPlayed : s.games;
    this.el.total.textContent = s.totalGames;
    this.el.big.textContent = s.big;
    this.el.reg.textContent = s.reg;
    var diff = s.out - s.in;
    this.el.diff.textContent = (diff > 0 ? '+' : '') + diff;
  };

  UI.prototype.bonusGame = function (e) {
    this.message(e.type + ' ' + e.played + '/' + (e.played + e.left) + 'G  獲得 ' + this.game.stats.bonusGot + '枚');
  };

  UI.prototype.bonusEnd = function (e) {
    this.message(e.type + ' 終了  獲得 ' + e.got + '枚');
  };

  UI.prototype.setLamp = function (on) {
    this.el.lamp.classList.toggle('on', on);
  };

  UI.prototype.message = function (text) { this.el.msg.textContent = text; };

  UI.prototype.showResult = function (e) {
    this.view.showWins(e.wins);
    var st = this.game.stats;
    this.el.pay.textContent = this.game.inBonus && NCS.CONFIG.PAYOUT_ACCUMULATE_IN_BONUS ? st.bonusGot : e.pay;
    var parts = [];
    e.wins.forEach(function (w) {
      var r = NCS.ROLES[w.role];
      if (!r.bonus) parts.push(r.name + (r.replay ? '' : ' ' + r.pay + '枚'));
    });
    if (!this.game.inBonus) this.message(parts.join(' / '));
  };

  UI.prototype.flashBonus = function (type) {
    var el = this.el.bonusFlash;
    el.textContent = type === 'BIG' ? 'BIG BONUS!' : 'REGULAR BONUS!';
    el.className = 'bonus-flash show ' + type.toLowerCase();
    this.message((type === 'BIG' ? 'BIG' : 'REG') + ' 開始（' + NCS.CONFIG.BONUS_GAMES[type] + 'G・AUTOで高速消化）');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(function () { el.className = 'bonus-flash'; }, 1800);
  };

  NCS.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
