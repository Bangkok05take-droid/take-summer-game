/*
 * データ画面（総ゲーム数・ボーナス履歴など）
 * 筐体の外に全画面で重ねる表示。MENU などから open() で開く。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function prob(n, games) { return n ? '1/' + (games / n).toFixed(1) : '-'; }

  function DataScreen(game) {
    this.game = game;
    var el = document.createElement('div');
    el.className = 'data-screen';
    el.hidden = true;
    el.innerHTML = '<div class="data-box"><div class="data-head"><b>DATA</b><button type="button">閉じる</button></div><div class="data-body"></div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.body = el.querySelector('.data-body');
    var self = this;
    el.querySelector('button').addEventListener('click', function () { self.close(); });
    el.addEventListener('click', function (e) { if (e.target === el) self.close(); });
    game.on('state', function () { if (!el.hidden) self.render(); });
  }

  DataScreen.prototype.open = function () { this.render(); this.el.hidden = false; };
  DataScreen.prototype.close = function () { this.el.hidden = true; };
  DataScreen.prototype.isOpen = function () { return !this.el.hidden; };

  DataScreen.prototype.render = function () {
    var s = this.game.stats, T = s.totalGames, diff = s.out - s.in;
    var rows = [
      ['総ゲーム数', T],
      ['現在のゲーム数 (COUNT)', s.games],
      ['BIG', s.big + '回 (' + prob(s.big, T) + ')'],
      ['REG', s.reg + '回 (' + prob(s.reg, T) + ')'],
      ['ボーナス合算', prob(s.big + s.reg, T)],
      ['直近ボーナス獲得枚数', s.history.length ? s.history[0].got + '枚' : '-'],
      ['クレジット', s.credit],
      ['持ちメダル', s.medals],
      ['差枚数', (diff > 0 ? '+' : '') + diff],
      ['投資（貸出）', s.invest]
    ];
    var html = '<table class="data-table">' + rows.map(function (r) {
      return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>';
    }).join('') + '</table>';
    html += '<div class="data-sub">ボーナス履歴（新しい順）</div>';
    html += s.history.length ? '<table class="data-table hist"><tr><th>#</th><th>種類</th><th>ゲーム数</th><th>獲得</th></tr>' +
      s.history.map(function (h, i) {
        return '<tr><td>' + (i + 1) + '</td><td class="' + h.type.toLowerCase() + '">' + h.type + '</td><td>' + h.games + 'G</td><td>' + h.got + '枚</td></tr>';
      }).join('') + '</table>' : '<p class="data-none">まだありません</p>';
    this.body.innerHTML = html;
  };

  NCS.DataScreen = DataScreen;
})(typeof window !== 'undefined' ? window : globalThis);
