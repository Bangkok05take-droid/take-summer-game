/*
 * 筐体レイヤー
 * NCS.SKIN の定義から各パーツを独立した要素として生成し、状態（画像）を個別に切り替える。
 *
 * - 筐体は 1080×1920 のデザイン座標で組み立て、transform: scale() で画面に合わせて等倍縮小する。
 *   パーツは同じ座標系に乗っているので、どの画面サイズでも相対位置はずれない。
 * - タッチ判定はブラウザが変形後の座標で行うため、縮小しても押した位置とボタンは一致する。
 * - 画像が無いパーツはプレースホルダー表示（後から画像を置くだけで差し替わる）。
 *
 * API:
 *   cab.el(id)                … パーツのDOM要素
 *   cab.setState(id, state)   … 画像状態の切替（例: setState('luckyLamp', 'on')）
 *   cab.setDisplay(id, value) … CREDIT/COUNT/PAYOUT の数字
 *   cab.onTap(id, fn)         … タップ時の処理（pointerdown）
 *   cab.scale                 … 現在の縮小率
 *   cab.setGuide(opacity)     … 正式デザイン画像を重ねて位置合わせ確認（0で非表示）
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function Cabinet(host, skin, opts) {
    this.host = host;
    this.skin = skin || NCS.SKIN;
    this.opts = opts || {};
    this.parts = {};
    this.available = {}; // 読み込めた画像ファイル
    this.scale = 1;
    this.onScale = [];
    this.build();
    var self = this;
    this.fit();
    window.addEventListener('resize', function () { self.fit(); });
    window.addEventListener('orientationchange', function () { setTimeout(function () { self.fit(); }, 200); });
  }

  Cabinet.prototype.build = function () {
    var s = this.skin, self = this;
    var wrap = document.createElement('div');
    wrap.className = 'cab-wrap';
    var stage = document.createElement('div');
    stage.className = 'cab-stage';
    stage.style.width = s.designWidth + 'px';
    stage.style.height = s.designHeight + 'px';
    wrap.appendChild(stage);
    this.host.appendChild(wrap);
    this.wrap = wrap;
    this.stage = stage;

    s.parts.forEach(function (p) {
      var el = document.createElement(p.type === 'reels' ? 'canvas' : 'div');
      el.className = 'cab-part cab-' + p.type + (p.passThrough ? ' pass' : '');
      el.dataset.part = p.id;
      el.style.left = p.rect[0] + 'px';
      el.style.top = p.rect[1] + 'px';
      el.style.width = p.rect[2] + 'px';
      el.style.height = p.rect[3] + 'px';
      el.style.zIndex = p.z || 0;
      if (p.type !== 'reels') {
        var ph = document.createElement('span');
        ph.className = 'cab-label';
        ph.textContent = p.label || p.id;
        el.appendChild(ph);
      }
      if (p.type === 'display') {
        var d = document.createElement('span');
        d.className = 'cab-digits';
        el.appendChild(d);
      }
      if (p.hit) {
        var hit = document.createElement('i');
        hit.className = 'cab-hit';
        hit.style.inset = (-p.hit) + 'px';
        el.appendChild(hit);
      }
      stage.appendChild(el);
      self.parts[p.id] = { def: p, el: el, state: null };
      if (p.states) self.setState(p.id, Object.keys(p.states)[0]);
    });

    var guide = document.createElement('img');
    guide.className = 'cab-guide';
    guide.alt = '';
    guide.style.width = s.designWidth + 'px';
    guide.style.height = s.designHeight + 'px';
    guide.style.display = 'none';
    stage.appendChild(guide);
    this.guide = guide;

    this.preload();
  };

  // 画像の存在確認。CONFIG.USE_IMAGE_ASSETS が false の間は読み込まずプレースホルダーのまま。
  Cabinet.prototype.preload = function () {
    if (!NCS.CONFIG || !NCS.CONFIG.USE_IMAGE_ASSETS) return;
    var self = this, files = {};
    this.skin.parts.forEach(function (p) {
      if (p.states) Object.keys(p.states).forEach(function (k) { if (p.states[k]) files[p.states[k]] = true; });
    });
    Object.keys(files).forEach(function (f) {
      var img = new Image();
      img.onload = function () {
        self.available[f] = true;
        Object.keys(self.parts).forEach(function (id) { var pt = self.parts[id]; if (pt.state) self.setState(id, pt.state); });
      };
      img.src = self.skin.imageBase + f;
    });
  };

  Cabinet.prototype.el = function (id) { return this.parts[id] && this.parts[id].el; };

  Cabinet.prototype.setState = function (id, state) {
    var pt = this.parts[id];
    if (!pt || !pt.def.states) return;
    var file = pt.def.states[state];
    var prev = pt.state;
    pt.state = state;
    pt.el.dataset.state = state;
    var has = file && this.available[file];
    pt.el.style.backgroundImage = has ? 'url("' + this.skin.imageBase + file + '")' : '';
    pt.el.classList.toggle('has-img', !!has);
    if (pt.def.anim && prev !== state) {
      pt.el.classList.remove('anim-' + pt.def.anim);
      void pt.el.offsetWidth; // アニメーションを再始動
      if (file !== null && state !== 'off' && state !== 'none') pt.el.classList.add('anim-' + pt.def.anim);
    }
  };

  Cabinet.prototype.getState = function (id) { return this.parts[id] && this.parts[id].state; };

  Cabinet.prototype.setDisplay = function (id, value) {
    var pt = this.parts[id];
    if (!pt) return;
    var n = pt.def.digits || 2;
    var max = Math.pow(10, n) - 1;
    var v = Math.max(0, Math.min(max, Math.floor(value)));
    pt.el.querySelector('.cab-digits').textContent = String(v);
  };

  Cabinet.prototype.onTap = function (id, fn) {
    var el = this.el(id);
    if (!el) return;
    el.addEventListener('pointerdown', function (e) { e.preventDefault(); fn(e); });
  };

  // 画面に収まる最大の縮小率（縦画面は横幅基準、縦が足りなければ高さ基準）
  Cabinet.prototype.fit = function () {
    var s = this.skin;
    var vw = this.host.clientWidth || window.innerWidth;
    var vh = this.opts.fitHeight === false ? Infinity : (window.innerHeight - (this.opts.reserveHeight || 0));
    var k = Math.min(vw / s.designWidth, vh / s.designHeight);
    this.scale = k;
    this.stage.style.transform = 'scale(' + k + ')';
    this.wrap.style.width = Math.floor(s.designWidth * k) + 'px';
    this.wrap.style.height = Math.floor(s.designHeight * k) + 'px';
    this.onScale.forEach(function (fn) { fn(k); });
  };

  Cabinet.prototype.setGuide = function (opacity) {
    this.guide.style.display = opacity > 0 ? 'block' : 'none';
    if (opacity > 0 && !this.guide.src) this.guide.src = this.skin.reference;
    this.guide.style.opacity = opacity;
  };

  Cabinet.prototype.setLabels = function (on) {
    this.stage.classList.toggle('show-labels', on);
  };

  // リールパーツ用の ReelView を生成（隙間・図柄比率はスキン定義から）
  Cabinet.prototype.createReelView = function () {
    var p = this.parts.reels.def, self = this;
    var r = p.reel;
    var view = new NCS.ReelView(this.parts.reels.el, {
      gapRatio: r.gap / r.width,
      symAspect: p.rect[3] / r.rows / r.width,
      fixedHeight: true,
      pixelScale: function () { return Math.min(window.devicePixelRatio || 1, 3) * self.scale; }
    });
    this.onScale.push(function () { view.resize(); });
    view.resize();
    return view;
  };

  NCS.Cabinet = Cabinet;
})(typeof window !== 'undefined' ? window : globalThis);
