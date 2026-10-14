/*
 * 確率一覧（メニューから開く）
 * 内部抽選テーブル（probability.js）・役（roles.js）・ゲーム設定（game.js）の実データから表を作る。
 * 数値を変えれば表も自動で変わる。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function oneIn(w) { return w > 0 ? '1/' + (NCS.LOTTERY_DENOM / w).toFixed(1) : '—'; }
  function pct(x) { var v = Math.round(x * 1000) / 10; return (v % 1 ? v.toFixed(1) : String(v)) + '%'; }
  function row(cells, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + cells.map(function (c, i) { return (i ? '<td>' : '<th>') + c + (i ? '</td>' : '</th>'); }).join('') + '</tr>'; }
  function table(head, rows) {
    return '<table class="pt-table"><thead><tr>' + head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
  }

  function ProbTable() {
    var el = document.createElement('div');
    el.className = 'reel-chart prob-table';
    el.hidden = true;
    el.innerHTML = '<div class="rc-box"><div class="data-head"><b>確率一覧</b><button type="button">閉じる</button></div><div class="pt-body"></div></div>';
    document.body.appendChild(el);
    this.el = el;
    var self = this;
    el.querySelector('.data-head button').addEventListener('click', function () { self.close(); });
    el.addEventListener('click', function (e) { // 開いた直後のタップが下のボタンに届かないように
      if (Date.now() - self.openedAt < 400) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  }

  ProbTable.prototype.render = function () {
    var C = NCS.CONFIG, T = NCS.LOTTERY_TABLES.NORMAL, R = NCS.ROLES, html = '';
    var w = {}; T.forEach(function (e) { w[e.role] = e.weight; });
    var used = T.reduce(function (s, e) { return s + e.weight; }, 0);
    var pay = function (id) { var r = R[id]; return r.replay ? '再遊技' : r.bonus ? (C.BONUS_MAX_PAY ? C.BONUS_MAX_PAY[id] + '枚' : '—') : r.pay + '枚'; };
    var sym = { BIG: '赤7・赤7・赤7', REG: '赤7・赤7・BAR', GRAPE: 'ブドウ×3', CHERRY: '左・中チェリー', BELL: 'ベル×3', YAMA: '山×3（中段を通る3ライン）', REPLAY: 'リプレイ×3' };

    // 通常時
    var rows = [];
    ['BIG', 'REG'].forEach(function (id) { rows.push(row([id === 'BIG' ? 'BIG' : 'REG', oneIn(w[id]), pay(id), sym[id]], 'pt-bonus')); });
    rows.push(row(['ボーナス合算', oneIn((w.BIG || 0) + (w.REG || 0)), '', ''], 'pt-sum'));
    ['GRAPE', 'CHERRY', 'BELL', 'YAMA', 'REPLAY'].forEach(function (id) { if (w[id]) rows.push(row([R[id].name, oneIn(w[id]), pay(id), sym[id]])); });
    rows.push(row(['ハズレ', oneIn(NCS.LOTTERY_DENOM - used), '', ''], 'pt-sum'));
    html += '<h3>通常時（内部抽選）</h3>' + table(['役', '確率', '払い出し', '図柄'], rows) +
      '<p class="rc-note">3枚掛け。ボーナス当選後は揃えるまで持ち越し（持ち越し中は小役のみ抽選）。小役は取りこぼすことがあります。</p>';

    // ボーナス
    var B = C.BONUS_MAX_PAY || {};
    html += '<h3>ボーナス</h3>' + table(['種類', '獲得枚数', 'ゲーム数', '1G払い出し'], [
      row(['BIG', (B.BIG || '—') + '枚', C.BONUS_GAMES.BIG + 'G', C.BONUS_PAY.BIG + '枚'], 'pt-bonus'),
      row(['REG', (B.REG || '—') + '枚', C.BONUS_GAMES.REG + 'G', C.BONUS_PAY.REG + '枚'])
    ]);

    // ジャグ連
    var J = C.JUGREN, miss = 1, jr = [];
    J.rates.forEach(function (r, i) { jr.push(row([(i + 1) + 'G目', pct(r), '1/' + +(1 / r).toFixed(1)])); miss *= 1 - r; });
    jr.push(row(['3G以内', pct(1 - miss), ''], 'pt-sum'));
    html += '<h3>ジャグ連チャンス（BIG終了後）</h3>' + table(['ゲーム', '当選確率', '分数'], jr) +
      '<p class="rc-note">当選時の振り分け: BIG ' + pct(J.bigShare) + '（ジャグ連継続）／ REG ' + pct(1 - J.bigShare) + '（終了）。3G非当選で終了。</p>';

    // プレミア
    var P = C.PREMIUM, N = P.normal, CH = P.chance;
    html += '<h3>プレミア演出（BIG当選時）</h3>' + table(['演出', '通常時', 'ジャグ連中'], [
      row(['プチュンフリーズ', pct(N.freeze), pct(CH.freeze)]),
      row(['遅れ', pct(N.delay), pct(CH.delay)]),
      row(['第2停止プレミア', pct(N.stop2), pct(CH.stop2)]),
      row(['スマホ振動', pct(N.vibe), pct(CH.vibe)]),
      row(['GOGO!ランプ', '1/' + Math.round(1 / P.gogoLamp), '1/' + Math.round(1 / P.gogoLamp)])
    ]) + '<p class="rc-note">ボーナス成立時の先ペカ（レバーON）: ' + pct(NCS.LAMP.leverOnRate) + '。ジャグ連中BIGの復活フリーズ: ' + pct(P.revivalRate) + '。</p>';

    this.el.querySelector('.pt-body').innerHTML = html;
  };

  ProbTable.prototype.open = function () { this.openedAt = Date.now(); this.render(); this.el.hidden = false; this.el.scrollTop = 0; };
  ProbTable.prototype.close = function () { this.el.hidden = true; };

  NCS.ProbTable = ProbTable;
})(typeof window !== 'undefined' ? window : globalThis);
