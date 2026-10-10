/*
 * ゲーム全体の設定
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  NCS.CONFIG = {
    DEBUG_PANEL: true,       // 開発中のみ true。URL に ?debug=0 / ?debug=1 で上書き可
    START_MEDALS: 1000,      // 初期持ちメダル
    CREDIT_MAX: 50,          // クレジット上限
    PAYOUT_ACCUMULATE_IN_BONUS: true, // ボーナス消化中は PAYOUT 表示を加算表示にする
    BONUS_GAMES: { BIG: 30, REG: 30 },   // ボーナスのゲーム数
    BONUS_PAY: { BIG: 15, REG: 5 },      // ボーナス中1ゲームの払い出し（仮）
    AUTO_SPEED: 2.5,         // オート消化時のリール速度倍率
    AUTO_LEVER_DELAY_MS: 250, // オート: 結果表示からレバーONまで
    AUTO_STOP_INTERVAL_MS: 90, // オート: 停止ボタンの間隔
    LEND_MEDALS: 1000,       // メダル不足時の自動追加（投資として集計）
    GAME_WAIT_MS: 0,         // 1ゲームの最低時間（実機風なら 4100）
    REEL_RPM: 80,            // 定速回転数（80回転/分 = 約28コマ/秒）
    ACCEL_MS: 300,           // 加速時間（定速到達まで停止ボタン無効）
    USE_IMAGE_ASSETS: false, // true で symbols.js / skin.js の画像を読み込む（第5段階）
    USE_SOUND_ASSETS: false  // true で sound.js の音声ファイルを読み込む（第4段階）
  };
})(typeof window !== 'undefined' ? window : globalThis);
