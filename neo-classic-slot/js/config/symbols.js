/*
 * 図柄定義
 * img: 画像素材のパス（未配置ならプレースホルダー描画）。画像素材はここを差し替える。
 * 図柄コード（'7','B' など）は配列・役で使う内部IDなので変更しないこと。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  NCS.SYMBOLS = {
    '7': { name: '赤7',     short: '7',  color: '#e8202a', img: 'assets/images/symbols/sym_red7.png', bundled: true },
    'B': { name: 'BAR',     short: 'BAR',color: '#222222', img: 'assets/images/symbols/sym_bar.png', bundled: true },
    'C': { name: 'チェリー', short: 'CH', color: '#d0103a', img: 'assets/images/symbols/sym_cherry.png', bundled: true },
    'G': { name: 'ブドウ',   short: 'GR', color: '#7a2fb8', img: 'assets/images/symbols/sym_grape.png', bundled: true },
    'L': { name: 'ベル',     short: 'BL', color: '#e8b400', img: 'assets/images/symbols/sym_bell.png', bundled: true },
    'R': { name: 'リプレイ', short: 'RP', color: '#1a6fd0', img: 'assets/images/symbols/sym_replay.png', bundled: true },
    'M': { name: '山',       short: '山', color: '#1f8a3a', img: 'assets/images/symbols/sym_mountain.png', bundled: true }
  };
})(typeof window !== 'undefined' ? window : globalThis);
