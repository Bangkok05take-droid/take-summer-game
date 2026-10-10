/*
 * ゲーム全体の設定
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  NCS.CONFIG = {
    DEBUG_PANEL: true,       // 開発中のみ true。URL に ?debug=0 / ?debug=1 で上書き可
    START_MEDALS: 1000,      // 初期持ちメダル
    LEND_MEDALS: 1000,       // メダル不足時の自動追加（投資として集計）
    GAME_WAIT_MS: 0,         // 1ゲームの最低時間（実機風なら 4100）
    REEL_RPM: 80,            // 定速回転数（80回転/分 = 約28コマ/秒）
    ACCEL_MS: 300,           // 加速時間（定速到達まで停止ボタン無効）
    USE_IMAGE_ASSETS: false, // true で symbols.js / skin.js の画像を読み込む（第5段階）
    USE_SOUND_ASSETS: false  // true で sound.js の音声ファイルを読み込む（第4段階）
  };
})(typeof window !== 'undefined' ? window : globalThis);
