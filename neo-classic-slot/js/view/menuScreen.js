/*
 * メニュー画面（筐体の MENU ボタンで開くウィンドウ）
 *
 *   var menu = new NCS.MenuScreen();
 *   menu.addItem('データ確認', function () { ... });                       // 押すと処理（メニューは閉じる）
 *   menu.addToggle(function () { return 'サウンド: ON'; }, function () { ... }); // 押すと切替（メニューは開いたまま）
 *   menu.addChoice('リール速度', [{ value: 45, label: '45回転' }, ...], get, set); // 選択式の子画面
 *   menu.open();
 *
 * 今後の設定（パネル変更など）も addItem / addChoice で1行ずつ追加できる。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function MenuScreen() {
    var el = document.createElement('div');
    el.className = 'menu-screen';
    el.hidden = true;
    el.innerHTML = '<div class="menu-box"><div class="data-head"><b class="menu-title">MENU</b><button type="button" class="menu-close">閉じる</button></div>' +
      '<div class="menu-list"></div><div class="menu-sub" hidden></div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.list = el.querySelector('.menu-list');
    this.sub = el.querySelector('.menu-sub');
    this.title = el.querySelector('.menu-title');
    this.items = [];
    var self = this;
    el.querySelector('.menu-close').addEventListener('click', function () {
      if (!self.sub.hidden) self.back(); else self.close();
    });
    // 開いた直後のタップが下のボタンに届かないように。背景タップで閉じる
    el.addEventListener('click', function (e) {
      if (Date.now() - self.openedAt < 400) { e.stopPropagation(); e.preventDefault(); return; }
      if (e.target === el) self.close();
    }, true);
  }

  MenuScreen.prototype.button = function (cls) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'menu-item' + (cls ? ' ' + cls : '');
    return b;
  };

  // 押すと処理してメニューを閉じる項目
  MenuScreen.prototype.addItem = function (label, fn) {
    var self = this, b = this.button();
    b.textContent = label;
    b.addEventListener('click', function () { self.close(); fn(); });
    this.list.appendChild(b);
    return b;
  };

  // 押すたびに切り替わる項目（ラベルは関数で現在の状態を表示）
  MenuScreen.prototype.addToggle = function (label, fn) {
    var b = this.button('menu-toggle');
    var txt = function () { b.textContent = label(); };
    txt();
    b.addEventListener('click', function () { fn(); txt(); });
    this.items.push(txt);
    this.list.appendChild(b);
    return b;
  };

  // 選択式の子画面を開く項目。options: [{ value, label, note? }]
  MenuScreen.prototype.addChoice = function (title, options, get, set) {
    var self = this, b = this.button('menu-choice');
    var txt = function () {
      var cur = options.filter(function (o) { return o.value === get(); })[0];
      b.innerHTML = '<span>' + title + '</span><em>' + (cur ? cur.label : '') + ' ›</em>';
    };
    txt();
    this.items.push(txt);
    b.addEventListener('click', function () { self.openChoice(title, options, get, function (v) { set(v); txt(); }); });
    this.list.appendChild(b);
    return b;
  };

  MenuScreen.prototype.openChoice = function (title, options, get, set) {
    var self = this;
    this.sub.innerHTML = '';
    options.forEach(function (o) {
      var b = self.button('menu-option' + (o.value === get() ? ' selected' : ''));
      b.innerHTML = '<span class="mark">' + (o.value === get() ? '●' : '○') + '</span><span>' + o.label + '</span>' + (o.note ? '<small>' + o.note + '</small>' : '');
      b.addEventListener('click', function () { set(o.value); self.openChoice(title, options, get, set); });
      self.sub.appendChild(b);
    });
    var back = this.button('menu-back');
    back.textContent = '‹ メニューに戻る';
    back.addEventListener('click', function () { self.back(); });
    this.sub.appendChild(back);
    this.title.textContent = title;
    this.list.hidden = true;
    this.sub.hidden = false;
  };

  MenuScreen.prototype.back = function () {
    this.sub.hidden = true;
    this.list.hidden = false;
    this.title.textContent = 'MENU';
  };

  MenuScreen.prototype.open = function () {
    this.openedAt = Date.now();
    this.back();
    this.items.forEach(function (t) { t(); });
    this.el.hidden = false;
  };
  MenuScreen.prototype.close = function () { this.el.hidden = true; };
  MenuScreen.prototype.isOpen = function () { return !this.el.hidden; };

  NCS.MenuScreen = MenuScreen;
})(typeof window !== 'undefined' ? window : globalThis);
