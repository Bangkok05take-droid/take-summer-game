/*
 * 図柄定義
 * img: 画像素材のパス（未配置ならプレースホルダー描画）。Gemini素材はここを差し替える。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  NCS.SYMBOLS = {
    '7': { name: '赤7',     short: '7',  color: '#e8202a', img: 'assets/images/symbols/sym_seven.png' },
    'B': { name: 'BAR',     short: 'BAR',color: '#222222', img: 'assets/images/symbols/sym_bar.png' },
    'C': { name: 'チェリー', short: 'CH', color: '#d0103a', img: 'assets/images/symbols/sym_cherry.png' },
    'G': { name: 'ブドウ',   short: 'GR', color: '#7a2fb8', img: 'assets/images/symbols/sym_grape.png' },
    'L': { name: 'ベル',     short: 'BL', color: '#e8b400', img: 'assets/images/symbols/sym_bell.png' },
    'R': { name: 'リプレイ', short: 'RP', color: '#1a6fd0', img: 'assets/images/symbols/sym_replay.png' },
    'M': { name: '山',       short: '山', color: '#1f8a3a', img: 'assets/images/symbols/sym_mountain.png' },
    'S': { name: 'スター',   short: '★', color: '#ff7a00', img: 'assets/images/symbols/sym_star.png' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
