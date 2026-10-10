/*
 * 図柄の描画（仮素材）
 * CONFIG.USE_IMAGE_ASSETS が true で画像が読み込めた図柄は画像を使い、
 * それ以外はここで描くベクター図柄を使う。描画結果は図柄サイズごとにキャッシュする。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  var images = {};
  var cache = {};

  NCS.loadSymbolImages = function (onDone) {
    if (!NCS.CONFIG.USE_IMAGE_ASSETS) { if (onDone) onDone(); return; }
    var ids = Object.keys(NCS.SYMBOLS), left = ids.length;
    ids.forEach(function (id) {
      var img = new Image();
      img.onload = function () { images[id] = img; cache = {}; if (--left === 0 && onDone) onDone(); };
      img.onerror = function () { if (--left === 0 && onDone) onDone(); };
      img.src = NCS.SYMBOLS[id].img;
    });
  };

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawStar(c, cx, cy, ro, ri) {
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 ? ri : ro, a = -Math.PI / 2 + i * Math.PI / 5;
      c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    c.closePath();
  }

  var painters = {
    '7': function (c, w, h) {
      c.font = '900 ' + Math.round(h * 0.95) + 'px "Arial Black", Impact, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = h * 0.08; c.strokeStyle = '#5a0006'; c.strokeText('7', w / 2, h * 0.54);
      var gr = c.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#ff6a5a'); gr.addColorStop(0.5, '#e8202a'); gr.addColorStop(1, '#a00010');
      c.fillStyle = gr; c.fillText('7', w / 2, h * 0.54);
    },
    'B': function (c, w, h) {
      var bw = w * 0.78, bh = h * 0.42;
      roundRect(c, (w - bw) / 2, (h - bh) / 2, bw, bh, bh * 0.18);
      c.fillStyle = '#111'; c.fill();
      c.lineWidth = h * 0.04; c.strokeStyle = '#d8d8d8'; c.stroke();
      c.font = '900 ' + Math.round(bh * 0.72) + 'px "Arial Black", Impact, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
      c.fillText('BAR', w / 2, h / 2 + bh * 0.04);
    },
    'C': function (c, w, h) {
      c.strokeStyle = '#2d8a2d'; c.lineWidth = h * 0.05; c.lineCap = 'round';
      c.beginPath(); c.moveTo(w * 0.36, h * 0.6); c.quadraticCurveTo(w * 0.45, h * 0.2, w * 0.62, h * 0.14); c.stroke();
      c.beginPath(); c.moveTo(w * 0.64, h * 0.6); c.quadraticCurveTo(w * 0.62, h * 0.3, w * 0.62, h * 0.14); c.stroke();
      [[0.36, 0.66], [0.64, 0.66]].forEach(function (p) {
        var gr = c.createRadialGradient(w * p[0] - h * 0.05, h * p[1] - h * 0.05, h * 0.02, w * p[0], h * p[1], h * 0.17);
        gr.addColorStop(0, '#ff8a9a'); gr.addColorStop(1, '#b0001e');
        c.fillStyle = gr; c.beginPath(); c.arc(w * p[0], h * p[1], h * 0.17, 0, Math.PI * 2); c.fill();
      });
    },
    'G': function (c, w, h) {
      var r = h * 0.1, rows = [3, 3, 2, 1], y = h * 0.28;
      rows.forEach(function (n, ri) {
        for (var i = 0; i < n; i++) {
          var x = w / 2 + (i - (n - 1) / 2) * r * 2.05;
          var gr = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
          gr.addColorStop(0, '#c58cff'); gr.addColorStop(1, '#4b1585');
          c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        }
        y += r * 1.75;
      });
      c.fillStyle = '#3c9a3c'; c.beginPath(); c.ellipse(w / 2 + r, h * 0.14, r * 1.2, r * 0.5, -0.4, 0, Math.PI * 2); c.fill();
    },
    'L': function (c, w, h) {
      var cx = w / 2;
      var gr = c.createLinearGradient(cx - h * 0.3, 0, cx + h * 0.3, 0);
      gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.5, '#f2c200'); gr.addColorStop(1, '#a87a00');
      c.fillStyle = gr;
      c.beginPath();
      c.moveTo(cx, h * 0.12);
      c.bezierCurveTo(cx + h * 0.24, h * 0.12, cx + h * 0.22, h * 0.5, cx + h * 0.36, h * 0.72);
      c.lineTo(cx - h * 0.36, h * 0.72);
      c.bezierCurveTo(cx - h * 0.22, h * 0.5, cx - h * 0.24, h * 0.12, cx, h * 0.12);
      c.fill();
      c.lineWidth = h * 0.025; c.strokeStyle = '#7a5600'; c.stroke();
      c.fillStyle = '#7a5600'; c.beginPath(); c.arc(cx, h * 0.8, h * 0.07, 0, Math.PI * 2); c.fill();
    },
    'R': function (c, w, h) {
      var bw = w * 0.8, bh = h * 0.4;
      roundRect(c, (w - bw) / 2, (h - bh) / 2, bw, bh, bh * 0.5);
      c.fillStyle = '#1a6fd0'; c.fill();
      c.font = '800 ' + Math.round(bh * 0.5) + 'px Arial, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
      c.fillText('REPLAY', w / 2, h / 2 + 1);
    },
    'M': function (c, w, h) {
      c.fillStyle = '#1f8a3a';
      c.beginPath(); c.moveTo(w * 0.14, h * 0.8); c.lineTo(w * 0.5, h * 0.14); c.lineTo(w * 0.86, h * 0.8); c.closePath(); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.moveTo(w * 0.5, h * 0.14); c.lineTo(w * 0.61, h * 0.34); c.lineTo(w * 0.53, h * 0.3); c.lineTo(w * 0.47, h * 0.36); c.lineTo(w * 0.39, h * 0.34); c.closePath(); c.fill();
      c.lineWidth = h * 0.03; c.strokeStyle = '#0d4a1d';
      c.beginPath(); c.moveTo(w * 0.14, h * 0.8); c.lineTo(w * 0.5, h * 0.14); c.lineTo(w * 0.86, h * 0.8); c.closePath(); c.stroke();
    },
    'S': function (c, w, h) {
      var gr = c.createRadialGradient(w / 2, h / 2, h * 0.05, w / 2, h / 2, h * 0.4);
      gr.addColorStop(0, '#fff2a0'); gr.addColorStop(1, '#ff7a00');
      c.fillStyle = gr; drawStar(c, w / 2, h * 0.52, h * 0.4, h * 0.17); c.fill();
      c.lineWidth = h * 0.03; c.strokeStyle = '#a04400'; c.stroke();
    }
  };

  // 図柄1コマ分の画像（キャッシュ済みcanvas）を返す
  NCS.symbolCanvas = function (id, w, h) {
    var key = id + ':' + w + 'x' + h;
    if (cache[key]) return cache[key];
    var cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(w, h) : document.createElement('canvas');
    cv.width = w; cv.height = h;
    var c = cv.getContext('2d');
    if (images[id]) {
      var img = images[id], s = Math.min(w / img.width, h / img.height);
      c.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
    } else {
      painters[id](c, w, h);
    }
    cache[key] = cv;
    return cv;
  };
})(typeof window !== 'undefined' ? window : globalThis);
