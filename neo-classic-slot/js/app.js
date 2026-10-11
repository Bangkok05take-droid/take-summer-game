/*
 * 正式筐体アプリの組み立て（index.html / cabinet-preview.html 共通）
 *
 *   var app = NCS.startCabinetApp(document.getElementById('host'), { reserveHeight: 0 });
 *
 * 抽選・停止制御・進行（core）、筐体パーツ（Cabinet）、演出（Effects / Premium）、音（Sound / Bgm）、
 * オート、ドル箱、データ画面をつなぐ。各パーツの見た目は skin.js の画像で個別に差し替えられる。
 */
(function () {
  var NCS = window.NCS;

  NCS.startCabinetApp = function (host, opts) {
    opts = opts || {};
    var q = new URLSearchParams(location.search);
    if (q.get('images') === '1') NCS.CONFIG.USE_IMAGE_ASSETS = true;
    if (q.get('sounds') === '1') NCS.CONFIG.USE_SOUND_ASSETS = true;
    if (q.has('debug')) NCS.CONFIG.DEBUG_PANEL = q.get('debug') !== '0';
    NCS.loadSymbolImages();

    var cab = new NCS.Cabinet(host, NCS.SKIN, { reserveHeight: opts.reserveHeight || 0 });
    var view = cab.createReelView();
    var sound = new NCS.Sound();
    var game = new NCS.Game({ reels: view });
    var data = new NCS.DataScreen(game);
    var showBonusGot = false; // ボーナス獲得枚数表示（終了後は次のレバーONまで残す）

    // Effects が呼ぶ表示インターフェースを筐体パーツへ割り当てるアダプタ
    var ui = {
      setLamp: function (on) { cab.setState('luckyLamp', on ? 'on' : 'off'); },
      setLampPremium: function () { cab.setState('luckyLamp', 'premium'); },  // プチュン: 紫に激しく発光
      lampRect: function () { return cab.el('luckyLamp').getBoundingClientRect(); },
      blackout: function (on) { cab.wrap.classList.toggle('blackout', on); },
      showResult: function (e) { view.showWins(e.wins); },
      flashBonus: function (type) {
        var k = type.toLowerCase();
        cab.setState('bonusEffect', k);
        cab.el('bonusEffect').querySelector('.cab-label').textContent = type === 'BIG' ? 'BIG BONUS!' : 'REG BONUS!';
        cab.setState('bonusPanel', k); // ボーナス消化中は点灯したまま
        setTimeout(function () { cab.setState('bonusEffect', 'none'); }, 2000);
      },
      bonusEnd: function () { cab.setState('bonusPanel', 'off'); }
    };
    var effects = new NCS.Effects(game, ui, sound);
    var auto = new NCS.AutoPlay(game, view);
    var bgm = new NCS.Bgm(sound);
    bgm.attach(game);
    sound.onUnlock = function () { bgm.update(); };
    sound.onToggle = function (on) { if (on) { bgm.current = null; bgm.update(); } else bgm.play(null); };

    // ドル箱: 完成演出・専用画面。筐体下部のカウンターをタップで開く
    var dbx = new NCS.DollarBoxView(game, sound);
    var boxEl = cab.el('boxCounter');
    boxEl.insertAdjacentHTML('beforeend', '<div class="box-counter"><canvas width="172" height="144"></canvas><span>× 0 BOX</span></div>');
    NCS.drawDollarBox(boxEl.querySelector('canvas').getContext('2d'), 14, 34, 130, 1);
    cab.onTap('boxCounter', function () { dbx.openCollection(); });

    auto.on(function (e) {
      effects.autoRunning = e.running;
      cab.setState('autoPlay', e.enabled ? 'on' : 'off');
    });
    game.on('lever', function () { if (!game.inBonus) showBonusGot = false; });
    game.on('bonus', function () { showBonusGot = true; });

    function press(id, state, back, ms) {
      cab.setState(id, state);
      setTimeout(function () { cab.setState(id, back()); }, ms || 120);
    }
    function knob() { press('leverKnob', 'down', function () { return 'idle'; }, 180); }
    function lever() { sound.unlock(); if (game.lever()) knob(); }
    function leverMax() { sound.unlock(); if (game.leverMax()) knob(); }
    function bet() { sound.unlock(); if (game.addBet()) { sound.bet(); press('betButton', 'pressed', function () { return 'off'; }, 120); } }
    function stop(i) { sound.unlock(); if (game.stop(i)) press('stop' + i, 'pressed', function () { return 'off'; }, 150); }

    // 大きな LEVER ON: MAX BET＋レバーON / 左の物理レバー: 現在のBETでレバーON / BET: 1枚ずつ
    cab.onTap('leverOn', function () { cab.setState('leverOn', 'pressed'); leverMax(); });
    cab.onTap('leverKnob', lever);
    cab.onTap('betButton', bet);
    [0, 1, 2].forEach(function (i) { cab.onTap('stop' + i, function () { stop(i); }); });
    cab.onTap('autoPlay', function () { sound.unlock(); auto.toggle(); }); // ボーナス中のみ動作
    cab.onTap('menu', function () { press('menu', 'pressed', function () { return 'off'; }); data.open(); });

    // PC確認用キーボード: Space=LEVER ON / ↓=レバー / B=BET / 1・2・3 または J・K・L=停止
    document.addEventListener('keydown', function (e) {
      if (e.repeat || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      var k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); leverMax(); }
      else if (k === 'arrowdown') { e.preventDefault(); lever(); }
      else if (k === 'b') bet();
      else if (k === '1' || k === 'j') stop(0);
      else if (k === '2' || k === 'k') stop(1);
      else if (k === '3' || k === 'l') stop(2);
    });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // データ画面の設定ボタン
    data.addButton(function () { return 'サウンド: ' + (sound.enabled ? 'ON' : 'OFF'); }, function () { sound.unlock(); sound.setEnabled(!sound.enabled); });
    var panel = null;
    if (NCS.CONFIG.DEBUG_PANEL && document.getElementById('debug') && NCS.DebugPanel) {
      panel = new NCS.DebugPanel(game, effects);
      data.addButton('デバッグパネルを開く', function () { data.close(); panel.toggle(true); });
    }

    // 毎フレーム: ボタン・ランプ・数字表示をゲーム状態に同期
    requestAnimationFrame(function loop() {
      var idle = game.phase === 'IDLE' && !auto.running, s = game.stats;
      if (cab.getState('leverOn') !== 'pressed' || !idle) cab.setState('leverOn', idle ? 'on' : 'off');
      [0, 1, 2].forEach(function (i) {
        if (cab.getState('stop' + i) === 'pressed') return;
        var on = game.phase === 'SPINNING' && game.control.stops[i] < 0 && view.canStop(i);
        cab.setState('stop' + i, on ? 'on' : 'off');
      });
      // 3・2・1 ランプ = BET枚数（回転中はそのゲームのBET、リプレイ中は前回BET）
      var betNow = game.phase !== 'IDLE' ? game.gameBet : (game.replayNext ? game.lastBet : game.bet);
      [1, 2, 3].forEach(function (n) { cab.setState('betLamp' + n, betNow >= n ? 'on' : 'off'); });
      if (cab.getState('betButton') !== 'pressed') cab.setState('betButton', idle && !game.replayNext && game.bet < NCS.MAX_BET ? 'on' : 'off');
      cab.setState('lampStart', idle && (game.bet > 0 || game.replayNext) ? 'on' : 'off');
      cab.setState('lampReplay', game.replayNext ? 'on' : 'off');
      cab.setState('lampWait', idle && Date.now() - game.lastLeverAt < NCS.CONFIG.GAME_WAIT_MS ? 'on' : 'off');
      cab.setState('lampInsert', idle && !game.replayNext && game.bet === 0 ? 'on' : 'off');
      cab.setDisplay('creditDisplay', s.credit);
      boxEl.querySelector('.box-counter span').textContent = '× ' + game.wallet.boxes() + ' BOX';
      cab.setDisplay('countDisplay', game.inBonus ? s.bonusPlayed : s.games); // ボーナス中は消化ゲーム数
      cab.setDisplay('payoutDisplay', game.inBonus && NCS.CONFIG.PAYOUT_ACCUMULATE_IN_BONUS ? s.bonusGot : s.lastPay);
      cab.setVisible('bonusGotDisplay', showBonusGot);
      cab.setDisplay('bonusGotDisplay', s.bonusGot);
      if (opts.onFrame) opts.onFrame();
      requestAnimationFrame(loop);
    });

    var app = { cab: cab, view: view, game: game, effects: effects, auto: auto, dbx: dbx, sound: sound, bgm: bgm, data: data, debug: panel,
      setShowBonusGot: function (on) { showBonusGot = on; } };
    NCS.app = app;
    return app;
  };
})();
