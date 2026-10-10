/*
 * 起動・各モジュールの接続
 *   抽選(Lottery) / 停止制御(ReelControl) / 進行(Game) … js/core
 *   描画(ReelView, UI) … js/view   演出(Effects) … js/effects   音(Sound) … js/audio
 */
(function () {
  var NCS = window.NCS;

  var q = new URLSearchParams(location.search);
  if (q.has('debug')) NCS.CONFIG.DEBUG_PANEL = q.get('debug') !== '0';

  NCS.loadSymbolImages();

  var view = new NCS.ReelView(document.getElementById('reels'));
  var sound = new NCS.Sound();
  var game = new NCS.Game({ reels: view });
  var ui = new NCS.UI(game, view, sound);
  var effects = new NCS.Effects(game, ui, sound);

  var data = new NCS.DataScreen(game);
  document.getElementById('data-open').addEventListener('click', function () { data.open(); });

  var dbgBtn = document.getElementById('debug-toggle');
  if (NCS.CONFIG.DEBUG_PANEL) {
    var panel = new NCS.DebugPanel(game, effects);
    dbgBtn.hidden = false;
    dbgBtn.addEventListener('click', function () { panel.toggle(); });
    NCS.debug = panel;
  }

  NCS.app = { game: game, view: view, ui: ui, effects: effects, sound: sound };
})();
