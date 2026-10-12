/*
 * リール配列表（メニューから開く）
 * 3リール×21コマを、ゲームと同じ図柄画像で番号付きの一覧にする。表の上ほど番号が大きい（リールの見た目どおり）。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function ReelChart() {
    var el = document.createElement('div');
    el.className = 'reel-chart';
    el.hidden = true;
    el.innerHTML = '<div class="rc-box"><div class="data-head"><b>リール配列</b><button type="button">閉じる</button></div>' +
      '<p class="rc-note">表の上ほど番号が大きく、リールの見た目と同じ並びです。</p><div class="rc-body"></div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.body = el.querySelector('.rc-body');
    var self = this;
    el.querySelector('.data-head button').addEventListener('click', function () { self.close(); });
    // 開いた直後のタップが下のボタンに届かないように
    el.addEventListener('click', function (e) {
      if (Date.now() - self.openedAt < 400) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  }

  function symCell(id) {
    var w = 110, h = 63, cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(NCS.symbolCanvas(id, w, h), 0, 0);
    var td = document.createElement('td');
    td.appendChild(cv);
    var nm = document.createElement('span');
    nm.textContent = NCS.SYMBOLS[id].name;
    td.appendChild(nm);
    return td;
  }

  ReelChart.prototype.render = function () {
    var table = document.createElement('table');
    table.className = 'rc-table';
    table.innerHTML = '<thead><tr><th>番号</th><th>左</th><th>中</th><th>右</th></tr></thead>';
    var tb = document.createElement('tbody');
    for (var i = NCS.REEL_SIZE - 1; i >= 0; i--) {
      var tr = document.createElement('tr');
      var th = document.createElement('th');
      th.textContent = i;
      tr.appendChild(th);
      for (var r = 0; r < 3; r++) tr.appendChild(symCell(NCS.STRIPS[r][i]));
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    this.body.innerHTML = '';
    this.body.appendChild(table);
  };

  ReelChart.prototype.open = function () { this.openedAt = Date.now(); this.render(); this.el.hidden = false; this.el.scrollTop = 0; };
  ReelChart.prototype.close = function () { this.el.hidden = true; };

  NCS.ReelChart = ReelChart;
})(typeof window !== 'undefined' ? window : globalThis);
