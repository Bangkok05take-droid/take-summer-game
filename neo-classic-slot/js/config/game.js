/*
 * ゲーム全体の設定
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  NCS.CONFIG = {
    DEBUG_PANEL: true,       // 開発中のみ true。URL に ?debug=0 / ?debug=1 で上書き可
    START_CREDIT: 500,       // 初回起動時のクレジット（セーブデータがあればそちらを復元）
    CREDIT_MAX: 999,         // クレジット表示上限（3桁）。1,000枚でドル箱へ
    BOX_SIZE: 1000,          // ドル箱1箱の枚数
    LEGEND_BOXES: 10,        // 万枚（10箱）達成演出
    BOX_FLASH_MS: 1600,      // ドル箱完成演出の長さ（テンポ重視で短め）

    // ジャグ連チャンス（BIG終了後のみ・最大3G）。累計 1-(0.8×0.75×2/3) = 60%
    JUGREN: { rates: [0.20, 0.25, 1 / 3], bigShare: 2 / 3 },

    // プレミア演出（すべてBIG確定）。内部抽選とは別に、BIG成立ゲームのレバーONで演出抽選する
    PREMIUM: {
      revivalRate: 0.10,     // ジャグ連中BIG当選のうち復活フリーズになる割合（無音先ペカと同時発生しない）
      silentPekaRate: 0.10,  // 先行抽選で1G目BIG当選時、BIG消化中に無音先ペカする割合
      // 各演出の発生率（BIG成立ゲーム）: 通常時 / ジャグ連チャンス中
      normal: { freeze: 0.02, delay: 0.05, stop2: 0.03, vibe: 0.05 },
      chance: { freeze: 0.05, delay: 0.12, stop2: 0.10, vibe: 0.12 },
      freezeMs: 4000,        // プチュンフリーズ（レバーONフリーズ）全体の長さ
      puchun: { silentAt: 150, lampAt: 1200, textAt: 1900 }, // プチュン音→無音→紫ランプ→PREMIUM BIG BONUS（ms）
      delayMs: 450,          // 遅れ（リール始動の遅れ）
      revivalMs: 3800        // 復活フリーズ
    },
    PAYOUT_ACCUMULATE_IN_BONUS: true, // ボーナス消化中は PAYOUT 表示を加算表示にする
    BONUS_GAMES: { BIG: 30, REG: 30 },   // ボーナスのゲーム数
    BONUS_PAY: { BIG: 15, REG: 5 },      // ボーナス中1ゲームの払い出し（仮）
    AUTO_SPEED: 2.5,         // オート消化時のリール速度倍率
    AUTO_LEVER_DELAY_MS: 250, // オート: 結果表示からレバーONまで
    AUTO_STOP_INTERVAL_MS: 90, // オート: 停止ボタンの間隔
    LEND_MEDALS: 500,        // クレジットもドル箱も空の時の貸出（投資として集計。0で貸出なし）
    GAME_WAIT_MS: 0,         // 1ゲームの最低時間（実機風なら 4100）
    REEL_RPM: 76,            // 定速回転数（76回転/分 = 約26.6コマ/秒。80から約5%減速してBARを狙いやすく）
    ACCEL_MS: 300,           // 加速時間（定速到達まで停止ボタン無効）
    USE_IMAGE_ASSETS: false, // true で symbols.js / skin.js の画像を読み込む（第5段階）
    USE_SOUND_ASSETS: false, // true で sound.js / bgm.js の音声ファイルを読み込む
    NORMAL_BGM: true         // 通常時のBGM（控えめ）を流す
  };
})(typeof window !== 'undefined' ? window : globalThis);
