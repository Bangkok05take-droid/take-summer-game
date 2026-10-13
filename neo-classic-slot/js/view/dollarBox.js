/*
 * ドル箱の表示（完成演出・コレクション画面・万枚達成演出・BOXカウンター）
 * 画像: assets/images/boxes/dollar_box.webp（カチ盛りデザイン。赤い透明ケースにメダル山盛り）。
 * 作りかけの箱は同じ画像のメダルの山を量に応じて隠して描く。画像の読み込み前は canvas の仮グラフィック。
 *
 *   var dbx = new NCS.DollarBoxView(game, sound);
 *   dbx.openCollection();   // ドル箱専用画面
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  var IMG = {
    box: 'assets/images/boxes/dollar_box.webp'          // カチ盛りのドル箱（同梱素材）
  };
  var images = {};
  var BOX_MOUND = 0.44;   // 画像の上から何割がメダルの山（箱のふちより上）か
  var BOX_SCALE = 1.25;   // 仮グラフィックの幅 w に対する画像の幅

  // 読み込んだら window に 'ncs-boximg' を通知（BOXカウンターなどを描き直す）
  function loadImages() {
    Object.keys(IMG).forEach(function (k) {
      var im = new Image();
      im.onload = function () { images[k] = im; try { window.dispatchEvent(new Event('ncs-boximg')); } catch (e) { /* 古い環境 */ } };
      im.src = IMG[k];
    });
  }
  loadImages();

  // 画像のドル箱。底辺の位置は仮グラフィック（高さ 0.9w）と同じ。fill < 1 はメダルの山を上から隠す
  function drawBoxImage(c, x, y, w, fill) {
    var im = images.box, iw = w * BOX_SCALE, ih = iw * im.height / im.width;
    var ix = x + (w - iw) / 2, iy = y + w * 0.9 - ih;
    var hide = (1 - Math.max(0, Math.min(1, fill))) * BOX_MOUND * 0.85; // 空でも箱の中のメダルは少し見える
    if (hide <= 0) { c.drawImage(im, ix, iy, iw, ih); return; }
    var sy = hide * im.height;
    c.drawImage(im, 0, sy, im.width, im.height - sy, ix, iy + hide * ih, iw, ih - hide * ih);
  }

  // ---- 仮グラフィック: 斜め上から見た立体のドル箱（fill 0〜1 = メダルの量） ----
  function drawBox(c, x, y, w, fill) {
    if (images.box) { drawBoxImage(c, x, y, w, fill); return; }
    var h = w * 0.62, d = w * 0.28;           // 箱の高さ・奥行き
    var top = y, front = y + d;
    // 天面（奥）
    c.fillStyle = '#5a0a12';
    c.beginPath(); c.moveTo(x + d, top); c.lineTo(x + w, top); c.lineTo(x + w - d, front); c.lineTo(x, front); c.closePath(); c.fill();
    // メダルの山
    if (fill > 0) {
      var rows = Math.max(1, Math.round(6 * Math.min(1, fill)));
      for (var r = 0; r < rows; r++) {
        var cy = front - r * w * 0.045 - w * 0.02;
        var span = (w - d) * (1 - r * 0.12);
        for (var i = 0; i < 7 - r; i++) {
          var cx = x + d * 0.5 + (w - d) * 0.5 - span / 2 + (i + 0.5) * span / (7 - r);
          var gr = c.createRadialGradient(cx - w * 0.02, cy - w * 0.02, 1, cx, cy, w * 0.07);
          gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.5, '#f2c94c'); gr.addColorStop(1, '#8a6410');
          c.fillStyle = gr;
          c.beginPath(); c.ellipse(cx, cy, w * 0.07, w * 0.035, 0, 0, Math.PI * 2); c.fill();
        }
      }
    }
    // 正面
    var gf = c.createLinearGradient(0, front, 0, front + h);
    gf.addColorStop(0, '#d0182a'); gf.addColorStop(1, '#6a0812');
    c.fillStyle = gf; c.fillRect(x, front, w - d, h);
    // 側面
    c.fillStyle = '#7a0a16';
    c.beginPath(); c.moveTo(x + w - d, front); c.lineTo(x + w, top); c.lineTo(x + w, top + h); c.lineTo(x + w - d, front + h); c.closePath(); c.fill();
    // 金のふち・ラベル
    c.strokeStyle = '#f2c94c'; c.lineWidth = Math.max(1.5, w * 0.025);
    c.strokeRect(x, front, w - d, h);
    c.fillStyle = '#f2c94c';
    c.font = '900 ' + Math.round(w * 0.16) + 'px "Arial Black", Impact, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(fill >= 1 ? '1000' : Math.floor(fill * 1000), x + (w - d) / 2, front + h * 0.55);
  }
  NCS.drawDollarBox = drawBox;

  function DollarBoxView(game, sound) {
    this.game = game;
    this.sound = sound;
    this.buildOverlay();
    this.buildCollection();
    var self = this;
    game.on('boxComplete', function (e) { self.complete(e); });
  }

  // ---- 完成演出（ゲームを止めない・タッチを邪魔しない） ----
  DollarBoxView.prototype.buildOverlay = function () {
    var el = document.createElement('div');
    el.className = 'dbx-flash';
    el.innerHTML = '<div class="dbx-shine"></div><canvas width="360" height="300"></canvas>' +
      '<div class="dbx-title">DOLLAR BOX<br>COMPLETE!</div><div class="dbx-sub"></div>';
    document.body.appendChild(el);
    this.flash = el;
  };

  DollarBoxView.prototype.complete = function (e) {
    var el = this.flash, self = this;
    var cv = el.querySelector('canvas'), c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    var n = Math.min(e.added, 3);
    var bw = n > 1 ? 150 : 210; // 横に並べる（カチ盛り画像は幅 1.25倍で描かれる）
    for (var i = 0; i < n; i++) drawBox(c, 180 + (i - (n - 1) / 2) * bw * 0.95 - bw / 2, 150 - bw * 0.9 + (n > 1 ? 40 : 0), bw, 1);
    el.querySelector('.dbx-sub').textContent = (e.added > 1 ? '+' + e.added + ' BOX  ' : '') + '× ' + e.boxes + ' BOX';
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(function () { el.classList.remove('show'); }, NCS.CONFIG.BOX_FLASH_MS);
    if (this.sound && this.sound.boxComplete) this.sound.boxComplete();
    NCS.vibrate([30, 40, 60]);
    if (e.legendary) setTimeout(function () { self.legendary(); }, NCS.CONFIG.BOX_FLASH_MS);
    if (this.collectionOpen) this.renderCollection();
  };

  // ---- 万枚達成演出 ----
  DollarBoxView.prototype.legendary = function () {
    var el = document.createElement('div');
    el.className = 'dbx-legend';
    el.innerHTML = '<canvas></canvas><div class="dbx-legend-text"><div class="l1">🏆 10,000 MEDALS</div><div class="l2">LEGENDARY WIN!</div><div class="l3">タップで閉じる</div></div>';
    document.body.appendChild(el);
    var cv = el.querySelector('canvas');
    cv.width = window.innerWidth * 2; cv.height = window.innerHeight * 2;
    var c = cv.getContext('2d'), w = cv.width / 6;
    for (var col = 0; col < 5; col++) for (var r = 0; r < 2; r++) {
      drawBox(c, col * w * 1.05 + w * 0.3, cv.height - (r + 1) * w * 0.95 - w * 0.2, w, 1);
    }
    if (this.sound && this.sound.legendary) this.sound.legendary();
    NCS.vibrate([80, 60, 80, 60, 200]);
    el.addEventListener('click', function () { el.remove(); });
    setTimeout(function () { if (el.parentNode) el.classList.add('fade'); }, 6000);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 7000);
  };

  // ---- ドル箱専用画面 ----
  DollarBoxView.prototype.buildCollection = function () {
    var el = document.createElement('div');
    el.className = 'dbx-collection';
    el.hidden = true;
    el.innerHTML = '<div class="dbx-panel">' +
      '<div class="dbx-head"><b>DOLLAR BOX COLLECTION</b><button type="button">閉じる</button></div>' +
      '<div class="dbx-count"></div><canvas class="dbx-stack"></canvas><div class="dbx-stats"></div></div>';
    document.body.appendChild(el);
    this.coll = el;
    var self = this;
    // ゴーストクリック対策（開いたタップの click で即閉じないように）
    el.addEventListener('click', function (e) { if (Date.now() - self.openedAt < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
    el.querySelector('button').addEventListener('click', function () { self.closeCollection(); });
    this.game.on('state', function () { if (self.collectionOpen) self.renderCollection(); });
  };

  DollarBoxView.prototype.openCollection = function () {
    this.openedAt = Date.now();
    this.collectionOpen = true;
    this.coll.hidden = false;
    this.renderCollection();
  };
  DollarBoxView.prototype.closeCollection = function () { this.collectionOpen = false; this.coll.hidden = true; };

  DollarBoxView.prototype.renderCollection = function () {
    var w = this.game.wallet, boxes = w.boxes(), partial = (w.boxMedals % w.boxSize) / w.boxSize;
    var el = this.coll;
    el.querySelector('.dbx-count').innerHTML = '<span class="n">' + boxes + '</span> BOX' +
      (boxes >= NCS.CONFIG.LEGEND_BOXES ? '<div class="legend">🏆 10,000 MEDALS — LEGENDARY WIN!</div>' : '');
    var cv = el.querySelector('canvas');
    var cssW = el.querySelector('.dbx-panel').clientWidth - 24;
    var perCol = 5, total = boxes + (partial > 0 ? 1 : 0);
    var cols = Math.max(2, Math.ceil(Math.max(total, 1) / perCol));
    var bw = Math.min(110, (cssW - 20) / cols / 1.05);
    var cssH = Math.max(perCol, Math.min(total, perCol)) * bw * 0.72 + bw * 0.6;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = cssW * dpr; cv.height = cssH * dpr;
    cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cssW, cssH);
    // 床
    var floor = c.createLinearGradient(0, cssH - 20, 0, cssH);
    floor.addColorStop(0, 'rgba(242,201,76,0)'); floor.addColorStop(1, 'rgba(242,201,76,0.25)');
    c.fillStyle = floor; c.fillRect(0, cssH - 20, cssW, 20);
    var x0 = (cssW - cols * bw * 1.05) / 2;
    // 下から積み上げる（列ごとに5箱）
    for (var i = 0; i < total; i++) {
      var col = Math.floor(i / perCol), row = i % perCol;
      var fill = i < boxes ? 1 : partial;
      drawBox(c, x0 + col * bw * 1.05, cssH - (row + 1) * bw * 0.72 - bw * 0.3, bw, fill);
    }
    if (total === 0) {
      c.fillStyle = '#7a6a40'; c.font = '14px system-ui'; c.textAlign = 'center';
      c.fillText('まだドル箱はありません（1箱＝1,000枚）', cssW / 2, cssH / 2);
    }
    var next = w.boxSize - (w.credit % w.boxSize);
    var rows = [
      ['完成ドル箱', boxes + ' 箱'],
      ['ドル箱内の枚数', w.boxMedals.toLocaleString() + ' 枚'],
      ['クレジット', w.credit + ' 枚（次の箱まで ' + next + ' 枚）'],
      ['総所持枚数', w.holdings().toLocaleString() + ' 枚'],
      ['最高到達枚数', w.maxHoldings.toLocaleString() + ' 枚'],
      ['最高ドル箱数', w.maxBoxes + ' 箱'],
      ['累計獲得枚数', w.totalWon.toLocaleString() + ' 枚']
    ];
    el.querySelector('.dbx-stats').innerHTML = '<table>' + rows.map(function (r) { return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>'; }).join('') + '</table>' +
      '<div class="dbx-goal">目標 10箱（10,000枚）まで あと ' + Math.max(0, NCS.CONFIG.LEGEND_BOXES - boxes) + ' 箱</div>';
  };

  NCS.DollarBoxView = DollarBoxView;
})(typeof window !== 'undefined' ? window : globalThis);
