/*
 * ジャグ連チャンス専用パネル（上部の NEO CLASSIC ロゴパネルの上に重ねる）
 *
 *   var panel = new NCS.JugRenPanel(stage);
 *   panel.show(n)        … チャンス n ゲーム目（1〜3）の表示に切り替え（フェードイン）
 *   panel.flash('BIG')   … BIG当選: 金色フラッシュ「BIG BONUS! / JUG REN CONTINUES!」
 *   panel.flash('REG')   … REG当選: 赤フラッシュ「REG BONUS / JUG REN FINISHED」
 *   panel.hide()         … フェードアウトして NEO CLASSIC ロゴに戻す
 *
 * 表示する確率は CONFIG.JUGREN（内部抽選と同じ値）から作る。ゲーム進行には関与しない。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function pct(x) { var v = Math.round(x * 1000) / 10; return (v % 1 ? v.toFixed(1) : String(v)) + '%'; }

  function JugRenPanel(stage) {
    var J = NCS.CONFIG.JUGREN;
    this.rates = J.rates.map(pct);                         // ['20%', '25%', '33.3%']
    this.big = pct(J.bigShare);                            // 66.7%
    this.reg = pct(1 - J.bigShare);                        // 33.3%
    var miss = J.rates.reduce(function (m, r) { return m * (1 - r); }, 1);
    this.total = pct(1 - miss);                            // 60%
    this.messages = [
      'ジャグ連中はボーナス高確率！',
      '1G目' + this.rates[0] + '・2G目' + this.rates[1] + '・3G目' + this.rates[2],
      '3G以内のボーナス期待度' + this.total + '！',
      'BIG当選ならジャグ連継続！',
      'REG当選でジャグ連終了！',
      'BIG ' + this.big + ' / REG ' + this.reg
    ];

    var el = document.createElement('div');
    el.className = 'jr-panel';
    el.innerHTML =
      '<div class="jr-frame">' +
        '<i class="jr-star s1">★</i><i class="jr-star s2">✦</i><i class="jr-star s3">★</i><i class="jr-star s4">✦</i>' +
        '<div class="jr-head"><div class="jr-title">JUG REN CHANCE</div><div class="jr-sub">ジャグ連チャンス</div></div>' +
        '<div class="jr-mid">' +
          '<div class="jr-game"><b class="jr-gname"></b><span>BONUS CHANCE <em class="jr-rate"></em></span></div>' +
          '<div class="jr-lamps"><i>1</i><i>2</i><i>3</i></div>' +
          '<div class="jr-share"><small>当選時の振り分け</small><span class="b">BIG ' + this.big + '</span><span class="r">REG ' + this.reg + '</span></div>' +
        '</div>' +
        '<div class="jr-board"><span class="jr-msg"></span></div>' +
        '<div class="jr-flash"><b></b><span></span></div>' +
      '</div>';
    stage.appendChild(el);
    this.el = el;
    this.mode = 'off';
    this.msgIndex = 0;
    this.timer = null;
  }

  JugRenPanel.prototype.rotate = function () {
    var self = this, m = this.el.querySelector('.jr-msg');
    m.textContent = this.messages[this.msgIndex % this.messages.length];
    m.classList.remove('in'); void m.offsetWidth; m.classList.add('in'); // スクロールして入ってくる
    this.msgIndex++;
    clearTimeout(this.timer);
    this.timer = setTimeout(function () { self.rotate(); }, 3200);
  };

  JugRenPanel.prototype.show = function (n) {
    var names = ['1st GAME', '2nd GAME', 'FINAL GAME'];
    n = Math.max(1, Math.min(3, n));
    this.el.querySelector('.jr-gname').textContent = names[n - 1];
    this.el.querySelector('.jr-rate').textContent = this.rates[n - 1];
    var lamps = this.el.querySelectorAll('.jr-lamps i');
    for (var i = 0; i < lamps.length; i++) lamps[i].className = i + 1 === n ? (n === 3 ? 'last' : 'on') : (i + 1 < n ? 'done' : '');
    this.el.classList.toggle('is-final', n === 3);
    this.el.classList.remove('flash-big', 'flash-reg');
    this.game = n;
    if (this.mode === 'off') { this.msgIndex = 0; this.rotate(); }
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
    clearTimeout(this.timer);
  };

  NCS.JugRenPanel = JugRenPanel;
})(typeof window !== 'undefined' ? window : globalThis);
