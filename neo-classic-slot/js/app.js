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

  // 不具合の表示（確認用）: 例外が起きてもゲームは続け、画面上部に短く表示する（スクショで報告できるように）
  var errEl = null, errTimer = null, errCount = 0;
  NCS.reportError = function (err, where) {
    errCount++;
    if (window.console) console.error('[NCS]', where, err);
    if (!document.body) return;
    if (!errEl) { errEl = document.createElement('div'); errEl.className = 'ncs-error'; document.body.appendChild(errEl); }
    var msg = err && (err.message || String(err)) || '不明';
    var at = err && err.stack ? String(err.stack).split('\n').filter(function (l) { return /\.js/.test(l); })[0] || '' : '';
    errEl.textContent = '不具合が起きました（' + errCount + '）' + (where ? ' [' + where + ']' : '') + '：' + msg + (at ? '  ' + at.replace(/^\s*at\s*/, '').replace(/.*\/js\//, 'js/') : '');
    errEl.classList.add('show');
    clearTimeout(errTimer);
    errTimer = setTimeout(function () { errEl.classList.remove('show'); }, 8000);
  };
  window.addEventListener('error', function (e) { NCS.reportError(e.error || e.message, 'window'); });
  window.addEventListener('unhandledrejection', function (e) { NCS.reportError(e.reason, 'promise'); });

  NCS.startCabinetApp = function (host, opts) {
    opts = opts || {};
    // リール速度（メニューで選択・端末に保存）
    var RPM_CHOICES = [35, 40, 45, 50, 60];
    try { var savedRpm = +localStorage.getItem('ncs.rpm.v1'); if (RPM_CHOICES.indexOf(savedRpm) >= 0) NCS.CONFIG.REEL_RPM = savedRpm; } catch (e) { /* 保存不可 */ }
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
      setLamp: function (on) { cab.setState('luckyLamp', on === 'gogo' ? 'gogo' : (on ? 'on' : 'off')); }, // 'gogo' = GOGO!プレミアランプ
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
    function drawBoxCounter() {
      var cv = boxEl.querySelector('canvas'), c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      NCS.drawDollarBox(c, 22, 26, 128, 1);
    }
    drawBoxCounter();
    window.addEventListener('ncs-boximg', drawBoxCounter); // カチ盛り画像が読み込めたら描き直す
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
    function unlock() { try { sound.unlock(); } catch (err) { NCS.reportError(err, 'sound'); } }
    function lever() { unlock(); if (game.lever()) knob(); }
    function leverMax() { unlock(); if (game.leverMax()) knob(); }
    function bet() { unlock(); if (game.addBet()) { sound.bet(); press('betButton', 'pressed', function () { return 'off'; }, 120); } }
    // 第3停止のボタンを離した瞬間（LUCKY CHANCE の後ペカ）
    function thirdRelease(i) { if (game.stoppedCount === 3 && game.control.stops[i] >= 0 && game.control.order[2] === i) effects.onThirdRelease(); }
    function stop(i) { unlock(); if (game.stop(i)) press('stop' + i, 'pressed', function () { return 'off'; }, 150); }

    // 大きな LEVER ON: MAX BET＋レバーON / 左の物理レバー: 現在のBETでレバーON / BET: 1枚ずつ
    cab.onTap('leverOn', function () { cab.setState('leverOn', 'pressed'); leverMax(); });
    cab.onTap('leverKnob', lever);
    cab.onTap('betButton', bet);
    [0, 1, 2].forEach(function (i) {
      cab.onTap('stop' + i, function () { stop(i); });
      cab.onRelease('stop' + i, function () { thirdRelease(i); });
    });
    cab.onTap('autoPlay', function () { sound.unlock(); auto.toggle(); }); // ボーナス中のみ動作
    cab.onTap('menu', function () { press('menu', 'pressed', function () { return 'off'; }); menu.open(); });

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
    document.addEventListener('keyup', function (e) {
      var k = e.key.toLowerCase(), i = { '1': 0, j: 0, '2': 1, k: 1, '3': 2, l: 2 }[k];
      if (i !== undefined) thirdRelease(i);
    });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // データ画面の設定ボタン
    // メニュー画面（MENU ボタン）: リール配列確認・速度設定・データ確認・サウンド。今後の設定もここに追加
    var chart = new NCS.ReelChart();
    var menu = new NCS.MenuScreen();
    menu.addItem('リール配列を確認', function () { chart.open(); });
    var probs = new NCS.ProbTable();
    menu.addItem('確率一覧', function () { probs.open(); });
    menu.addChoice('リール速度', RPM_CHOICES.map(function (v) {
      return { value: v, label: v + '回転', note: v === 45 ? '標準' : (v < 45 ? 'ゆっくり（目押ししやすい）' : '速い') };
    }), function () { return NCS.CONFIG.REEL_RPM; }, function (v) {
      NCS.CONFIG.REEL_RPM = v;
      try { localStorage.setItem('ncs.rpm.v1', String(v)); } catch (e) { /* 保存不可 */ }
    });
    // 目押しサポート
    //   normal 通常時   … 左リールの15番BARが中段に来た瞬間に左のひし形、右リールの赤7で右のひし形が赤く光る
    //   bonus  ボーナス時 … 左→中→右の順に、まだ回っている一番左のリールの赤7が中段に来た瞬間にリール枠全体が光る
    //   all    両方     … 通常時とボーナス時を同時に
    var AIM_MODES = ['off', 'normal', 'bonus', 'all'];
    var OLD_AIM = { seq: 'normal', rev: 'normal', both: 'normal' }; // Ver.21〜22 の保存値
    var aimMode = 'normal';
    try {
      var savedAim = localStorage.getItem('ncs.aimAssist.v2');
      if (OLD_AIM[savedAim]) savedAim = OLD_AIM[savedAim];
      if (AIM_MODES.indexOf(savedAim) >= 0) aimMode = savedAim;
      else if (localStorage.getItem('ncs.aimAssist.v1') === '0') aimMode = 'off';
    } catch (e) { /* 保存不可 */ }
    menu.addChoice('目押しサポート', [
      { value: 'off', label: 'OFF' },
      { value: 'normal', label: '通常時', note: '左リール15番のBARで左、右リールの赤7で右が光る' },
      { value: 'bonus', label: 'ボーナス時', note: '左→中→右の赤7でリール枠全体が光る' },
      { value: 'all', label: '両方', note: '通常時とボーナス時のサポートを同時に' }
    ], function () { return aimMode; }, function (v) {
      aimMode = v;
      try { localStorage.setItem('ncs.aimAssist.v2', v); } catch (e) { /* 保存不可 */ }
    });
    var SEVENS = NCS.STRIPS.map(function (strip) { return strip.map(function (y, i) { return y === '7' ? i : -1; }).filter(function (i) { return i >= 0; }); });
    function reelAt(i, positions) { // リール i が回転中で、positions のどれかが中段の前後0.5コマにある
      var r = view.reels[i];
      if (game.phase !== 'SPINNING' || r.phase !== 'SPIN' || game.control.stops[i] >= 0) return false;
      return positions.some(function (x) { var d = (((r.pos - x) % NCS.REEL_SIZE) + NCS.REEL_SIZE) % NCS.REEL_SIZE; return d < 0.5 || d > NCS.REEL_SIZE - 0.5; });
    }
    function aimLamps() { // [左ひし形, 右ひし形, リール枠]
      var normal = aimMode === 'normal' || aimMode === 'all', bonus = aimMode === 'bonus' || aimMode === 'all';
      var L = normal && reelAt(0, [NCS.AIM_ASSIST_POS[0]]);
      var R = normal && reelAt(2, [NCS.AIM_ASSIST_POS[2]]);
      var F = false;
      if (bonus) for (var i = 0; i < 3; i++) if (game.control.stops[i] < 0) { F = reelAt(i, SEVENS[i]); break; }
      return [L, R, F];
    }

    // 当選役表示（確認用）: レバーON時の内部当選・出目モード・プレミア抽選を NEO CLASSIC パネルに表示
    var flagView = false;
    try { flagView = localStorage.getItem('ncs.flagView.v1') === '1'; } catch (e) { /* 保存不可 */ }
    var flagEl = document.createElement('div');
    flagEl.className = 'flag-view';
    flagEl.hidden = true;
    cab.stage.appendChild(flagEl);
    var MODE_NAMES = { CHERRY_MISS_7: 'チェリー外れ系', YAMA_HASAMI: '左山＋右山なし', V_SHAPE: '山V字', OYAMA: '大山', TANI: '谷', KOYAMA: '小山',
      BAR_LINE: 'BAR一直線', REV_GRAPE_MISS: '逆押しブドウ否定系', REG_R7_TOP: '逆押し右上段7', R7_MID: '逆押し右中段7' };
    var PREMIUM_NAMES = { freeze: 'プチュンフリーズ', delay: '遅れ', stop2: '第2停止プレミア' };
    function showFlag(e) {
      var f = e.flag, main, sub = [];
      if (f.bonusGame) main = f.bonusGame + ' 消化中';
      else {
        var parts = [];
        if (f.bonus) parts.push(f.bonus + (f.newBonus === false ? '（持ち越し中）' : ''));
        if (f.small) parts.push(NCS.ROLES[f.small].name);
        main = parts.length ? parts.join(' ＋ ') : 'ハズレ';
      }
      if (f.mode && f.mode !== 'NORMAL' && MODE_NAMES[f.mode]) sub.push('出目: ' + MODE_NAMES[f.mode]);
      var pm = effects.premium.current;
      if (pm) {
        if (pm.main) sub.push(PREMIUM_NAMES[pm.main] || pm.main);
        if (pm.gogo) sub.push('GOGO!ランプ');
        if (pm.vibe) sub.push('振動');
      }
      if (f.jugren) sub.push('ジャグ連チャンス' + f.jugren + 'G目');
      if (f.revival) sub.push('復活フリーズ');
      if (f.silentPeka) sub.push('無音先ペカ');
      flagEl.innerHTML = '<b></b><small></small>';
      flagEl.querySelector('b').textContent = main;
      flagEl.querySelector('small').textContent = sub.join(' / ');
      flagEl.classList.toggle('is-bonus', !!f.bonus);
    }
    game.on('lever', function (e) { if (flagView) { showFlag(e); flagEl.hidden = false; } });
    menu.addToggle(function () { return '当選役表示（確認用）: ' + (flagView ? 'ON' : 'OFF'); }, function () {
      flagView = !flagView;
      if (!flagView) flagEl.hidden = true;
      else if (game.flag && game.phase !== 'IDLE') { showFlag({ flag: game.flag }); flagEl.hidden = false; }
      try { localStorage.setItem('ncs.flagView.v1', flagView ? '1' : '0'); } catch (e) { /* 保存不可 */ }
    });
    menu.addItem('データ確認', function () { data.open(); });
    menu.addToggle(function () { return 'サウンド: ' + (sound.enabled ? 'ON' : 'OFF'); }, function () { sound.unlock(); sound.setEnabled(!sound.enabled); });
    var panel = null;
    if (NCS.CONFIG.DEBUG_PANEL && document.getElementById('debug') && NCS.DebugPanel) {
      panel = new NCS.DebugPanel(game, effects);
      menu.addItem('デバッグパネル', function () { panel.toggle(true); });
    }

    // 毎フレーム: ボタン・ランプ・数字表示をゲーム状態に同期
    requestAnimationFrame(function loop() {
      try { frame(); } catch (err) { NCS.reportError(err, 'frame'); }
      requestAnimationFrame(loop);
    });
    function frame() {
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
      var aim = aimLamps();
      cab.setState('aimMarkL', aim[0] ? 'on' : 'off');
      cab.setState('aimMarkR', aim[1] ? 'on' : 'off');
      cab.setState('aimFrame', aim[2] ? 'on' : 'off');
      cab.setDisplay('creditDisplay', s.credit);
      boxEl.querySelector('.box-counter span').textContent = '× ' + game.wallet.boxes() + ' BOX';
      cab.setDisplay('countDisplay', game.inBonus ? s.bonusPlayed : s.games); // ボーナス中は消化ゲーム数
      cab.setDisplay('payoutDisplay', game.inBonus && NCS.CONFIG.PAYOUT_ACCUMULATE_IN_BONUS ? s.bonusGot : s.lastPay);
      cab.setVisible('bonusGotDisplay', showBonusGot);
      cab.setDisplay('bonusGotDisplay', s.bonusGot);
      if (opts.onFrame) opts.onFrame();
    }

    // LUCKY CHANCE 点灯画像と下皿の映り込みを先に読み込む。初回点灯で映り込みだけ先に見えないよう、両方そろうまで映り込みは出さない
    var luckyImgs = ['lucky_on_skin.png', 'lucky_reflect.png', 'lucky_gogo_skin.webp', 'lucky_gogo_reflect.webp'].map(function (f) {
      var img = new Image(); img.src = 'assets/images/cabinet/lamps/' + f;
      return img.decode ? img.decode() : new Promise(function (ok) { img.onload = ok; });
    });
    Promise.all(luckyImgs).then(function () { cab.stage.classList.add('lucky-ready'); }, function () { /* 読込失敗時は映り込みなし */ });

    // ジャグ連チャンス専用パネル: BIG終了後に出現 → チャンス中のゲーム数を表示 → 3G非当選でロゴへ戻る
    // BIG/REG の画像は「ボーナス図柄が揃った時」に出す（ランプ点灯時に出すとどちらが成立したか分かってしまうため）
    var jrPanel = new NCS.JugRenPanel(cab.stage);
    game.on('bonusEnd', function (rec) { if (rec.type === 'BIG' && game.jugren.active) jrPanel.show(1); else jrPanel.hide(); });
    game.on('lever', function (e) {
      var f = e.flag;
      if (f.jugren >= 1 && f.jugren <= 3) jrPanel.show(f.jugren);
      // ジャグ連で当選したボーナスの持ち越し中（揃えるまで）はパネルをそのまま残す
      else if (!f.bonusGame && !f.jugren && !game.carryFromJugren && jrPanel.mode === 'chance') jrPanel.hide();
    });
    game.on('result', function (e) { // 非当選なら次のゲーム数へ（3G目なら終了してロゴに戻す）。復活待ちの当選は非当選に見せる
      var f = e.flag;
      if (!f.jugren || f.jugren > 3 || f.bonus) return;
      if (f.jugren < 3) jrPanel.show(f.jugren + 1); else jrPanel.hide();
    });
    game.on('bonus', function (e) { if (game.stats.bonusFromJugren) jrPanel.flash(e.type); });

    var app = { cab: cab, jrPanel: jrPanel, view: view, game: game, effects: effects, auto: auto, dbx: dbx, sound: sound, bgm: bgm, data: data, menu: menu, chart: chart, aimMode: function () { return aimMode; }, debug: panel,
      setShowBonusGot: function (on) { showBonusGot = on; } };
    NCS.app = app;
    return app;
  };
})();
