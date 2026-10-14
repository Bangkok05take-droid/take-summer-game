/*
 * ジャグ連チャンス専用パネル（上部の NEO CLASSIC ロゴパネルの上に重ねる）
 *
 *   var panel = new NCS.JugRenPanel(stage);
 *   panel.show(n)        … チャンス n ゲーム目（1〜3）の箱を点灯（フェードイン）
 *   panel.flash('BIG')   … BIG当選: 提供画像「BIG BONUS! / JUG REN CONTINUES!」（jugren_big.webp）がフラッシュして出る
 *   panel.flash('REG')   … REG当選: 提供画像「REG BONUS / JUG REN FINISHED」（jugren_reg.webp）
 *   panel.hide()         … フェードアウトして NEO CLASSIC ロゴに戻す
 *
 * 絵柄はユーザー提供のパネル画像（assets/images/effects/jugren_panel.webp）をそのまま使い、
 * 1回目・2回目・3回目の箱の上に光（現在のゲーム）と影（それ以外）を重ねる。ゲーム進行には関与しない。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function JugRenPanel(stage) {
    var el = document.createElement('div');
    el.className = 'jr-panel';
    el.innerHTML =
      '<div class="jr-art" role="img" aria-label="JUG REN CHANCE ジャグ連チャンス 1回目1/5 2回目1/4 3回目1/3"></div>' +
      '<i class="jr-box b1"></i><i class="jr-box b2"></i><i class="jr-box b3"></i>' +
      '<div class="jr-big" role="img" aria-label="BIG BONUS! JUG REN CONTINUES!"></div>' +
      '<div class="jr-reg" role="img" aria-label="REG BONUS JUG REN FINISHED ジャグ連チャンス終了"></div>' +
      '<div class="jr-flash"><b></b><span></span></div>';
    stage.appendChild(el);
    this.el = el;
    this.mode = 'off';
  }

  JugRenPanel.prototype.show = function (n) {
    n = Math.max(1, Math.min(3, n));
    var boxes = this.el.querySelectorAll('.jr-box');
    for (var i = 0; i < boxes.length; i++) {
      boxes[i].classList.toggle('cur', i + 1 === n);
      boxes[i].classList.toggle('done', i + 1 < n);
    }
    this.el.classList.toggle('is-final', n === 3);
    this.el.classList.remove('flash-big', 'flash-reg');
    this.game = n;
    this.mode = 'chance';
    this.el.classList.add('show');
  };

  JugRenPanel.prototype.flash = function (type) {
    var big = type === 'BIG';
    this.el.querySelector('.jr-flash b').textContent = big ? 'BIG BONUS!' : 'REG BONUS';
    this.el.querySelector('.jr-flash span').textContent = big ? 'JUG REN CONTINUES!' : 'JUG REN FINISHED';
    this.el.classList.remove('flash-big', 'flash-reg');
    void this.el.offsetWidth;
    this.el.classList.add(big ? 'flash-big' : 'flash-reg', 'show');
    this.mode = 'flash';
  };

  JugRenPanel.prototype.hide = function () {
    this.el.classList.remove('show');
    this.mode = 'off';
  };

  NCS.JugRenPanel = JugRenPanel;
})(typeof window !== 'undefined' ? window : globalThis);
