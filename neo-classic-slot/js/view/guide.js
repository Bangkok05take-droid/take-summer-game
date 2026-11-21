/*
 * 遊び方ガイド（メニューから開く）
 * ページ: 基本 / チャンス目（提供画像）/ ボーナス / ジャグ連 / プレミア / メニュー機能
 * 確率などの数字は設定（CONFIG・確率テーブル）から作るので、設定を変えても表示がずれない。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function pct(x) { var v = Math.round(x * 1000) / 10; return (v % 1 ? v.toFixed(1) : String(v)) + '%'; }

  function pages() {
    var C = NCS.CONFIG, J = C.JUGREN, B = C.BONUS_MAX_PAY || {};
    var miss = J.rates.reduce(function (m, r) { return m * (1 - r); }, 1);
    return [
      { id: 'basic', tab: '基本', html:
        '<h3>遊び方</h3>' +
        '<ol class="gd-steps">' +
          '<li><b>LEVER ON</b> を押すと3枚BETしてリールが回ります（メダルが足りない時はドル箱から自動で補充）。</li>' +
          '<li><b>STOP</b> ボタンで左・中・右のリールを止めます。止める順番は自由です。</li>' +
          '<li>ボーナスに当たると、中央の <b>LUCKY CHANCE</b> が光ります。赤7・BARを揃えるとボーナス開始！</li>' +
        '</ol>' +
        '<h3>光るタイミング</h3>' +
        '<ul class="gd-list">' +
          '<li><b>先ペカ</b> … レバーONで光る</li>' +
          '<li><b>後ペカ</b> … 第3停止ボタンを<b>離した瞬間</b>に光る。押しっぱなしにしてドキドキを楽しもう</li>' +
          '<li><b>リーチ目</b> … ボーナス確定の出目が出た停止で光る</li>' +
        '</ul>' +
        '<h3>小役</h3>' +
        '<table class="pt-table"><tbody>' +
          '<tr><th>ブドウ</th><td>8枚</td><td>一番よく揃う小役</td></tr>' +
          '<tr><th>チェリー</th><td>2枚</td><td>左リールにチェリー。<b>' + '約20%でボーナス</b>と同時当選</td></tr>' +
          '<tr><th>山</th><td>3枚</td><td>左右に山が出たらハサミ打ちで狙おう</td></tr>' +
          '<tr><th>ベル</th><td>14枚</td><td>めったに揃わないレア役</td></tr>' +
          '<tr><th>リプレイ</th><td>再遊技</td><td>次のゲームはメダルを使わない</td></tr>' +
        '</tbody></table>' +
        '<p class="rc-note">左下の <b>× ○ BOX</b> をタップすると、ドル箱コレクションが見られます（1箱＝1,000枚）。</p>' },
      { id: 'chance', tab: 'チャンス目', html:
        '<img class="gd-img" src="assets/images/guide/guide_chance.webp" alt="チャンス目を知ればもっと面白い！ 順押し・ハサミ打ち・逆押しの楽しみ方">' +
        '<h3>目押しのコツ</h3>' +
        '<ul class="gd-list">' +
          '<li><b>順押し</b> … 左リールの15番BARを狙う。BARが下段に止まれば基本形</li>' +
          '<li><b>逆押し</b> … 右リールの赤7を狙う。上ブドウ・中赤7・下BARはブドウ・チェリー・ボーナスのチャンス</li>' +
          '<li><b>ハサミ打ち</b> … 左右に山が出たら、最後に中リールのBARを狙う（BARのすぐ上が山）</li>' +
          '<li>メニューの<b>目押しサポート</b>をONにすると、狙うタイミングで両端のひし形が赤く光ります</li>' +
        '</ul>' },
      { id: 'bonus', tab: 'ボーナス', html:
        '<h3>ボーナス</h3>' +
        '<table class="pt-table"><tbody>' +
          '<tr class="pt-bonus"><th>BIG</th><td>赤7・赤7・赤7</td><td>' + (B.BIG || '') + '枚</td></tr>' +
          '<tr><th>REG</th><td>赤7・赤7・BAR</td><td>' + (B.REG || '') + '枚</td></tr>' +
        '</tbody></table>' +
        '<ul class="gd-list">' +
          '<li>ボーナスに当たったら、揃えるまで次のゲーム以降も持ち越されます。</li>' +
          '<li>赤7が中段の少し上（3コマ上〜中段）に来た時に押せば、必ず揃います。</li>' +
          '<li>目押しサポートを「ボーナス時」にすると、左→中→右の順に赤7のタイミングでリール枠全体が光ります。</li>' +
          '<li>ボーナス中は <b>AUTO PLAY</b> ボタンで自動消化できます。</li>' +
        '</ul>' },
      { id: 'jugren', tab: 'ジャグ連', html:
        '<img class="gd-img gd-panel" src="assets/images/effects/jugren_panel.webp" alt="JUG REN CHANCE">' +
        '<h3>ジャグ連チャンス</h3>' +
        '<ul class="gd-list">' +
          '<li><b>BIG終了後</b>に突入する、3ゲームの特別な状態です。上のパネルが切り替わります。</li>' +
          '<li>ボーナス当選率は 1G目 ' + pct(J.rates[0]) + '・2G目 ' + pct(J.rates[1]) + '・3G目 ' + pct(J.rates[2]) + '（3G以内に ' + pct(1 - miss) + '）。</li>' +
          '<li>当たった時の振り分けは BIG ' + pct(J.bigShare) + '・REG ' + pct(1 - J.bigShare) + '。</li>' +
          '<li><b>BIG</b>ならBIG後にジャグ連がもう一度！ <b>REG</b>ならジャグ連終了。3G外れても終了。</li>' +
          '<li>BIGかREGかは、ボーナス図柄を<b>揃えるまで分かりません</b>。</li>' +
        '</ul>' },
      { id: 'premium', tab: 'プレミア', html:
        '<h3>プレミア演出（BIG確定）</h3>' +
        '<table class="pt-table"><tbody>' +
          '<tr><th>プチュンフリーズ</th><td>レバーONで画面が暗転し、LUCKY CHANCEが紫に光る</td></tr>' +
          '<tr><th>遅れ</th><td>レバーONからリールが回り出すのが少し遅れる</td></tr>' +
          '<tr><th>第2停止プレミア</th><td>第2停止で特別な告知</td></tr>' +
          '<tr><th>スマホ振動</th><td>レバーONでスマホがブルブル（Androidのみ）→第3停止を離すと光る</td></tr>' +
          '<tr><th>GOGO!ランプ</th><td>LUCKY CHANCEが「GOGO!」の特別な絵柄で光る</td></tr>' +
          '<tr><th>左中段チェリー</th><td>左リールの中段にチェリーが止まればBIG確定</td></tr>' +
        '</tbody></table>' +
        '<p class="rc-note">ジャグ連中はプレミア演出が出やすくなります。発生率はメニューの「確率一覧」で確認できます。</p>' },
      { id: 'menu', tab: 'メニュー', html:
        '<h3>MENUボタンでできること</h3>' +
        '<table class="pt-table gd-menu"><tbody>' +
          '<tr><th>遊び方ガイド</th><td>このページ</td></tr>' +
          '<tr><th>リール配列を確認</th><td>3つのリールの図柄の並び（21コマ）を一覧で見られます</td></tr>' +
          '<tr><th>確率一覧</th><td>小役・ボーナス・ジャグ連・プレミア演出の確率</td></tr>' +
          '<tr><th>リール速度</th><td>リールの回転の速さを選べます（遅いほど目押ししやすい）</td></tr>' +
          '<tr><th>目押しサポート</th><td>狙うタイミングでランプが光ります。<br>通常時: 左15番BAR・右赤7・中BAR（左右停止後）<br>ボーナス時: 赤7でリール枠全体<br>両方: 両方とも</td></tr>' +
          '<tr><th>当選役表示</th><td>ONにすると、第3停止の後に何が当たっていたかを上のパネルに表示（練習用）</td></tr>' +
          '<tr><th>成立履歴</th><td>過去10ゲームに何が当たっていて、揃ったか取りこぼしたか</td></tr>' +
          '<tr><th>データ確認</th><td>ゲーム数・ボーナス回数・出玉などの記録</td></tr>' +
          '<tr><th>サウンド</th><td>音のON/OFF</td></tr>' +
        '</tbody></table>' }
    ];
  }

  function Guide() {
    var el = document.createElement('div');
    el.className = 'reel-chart prob-table guide';
    el.hidden = true;
    el.innerHTML = '<div class="rc-box"><div class="data-head"><b>遊び方ガイド</b><button type="button">閉じる</button></div>' +
      '<div class="gd-tabs"></div><div class="gd-body"></div><div class="gd-nav"><button type="button" class="gd-prev">‹ 前へ</button><button type="button" class="gd-next">次へ ›</button></div></div>';
    document.body.appendChild(el);
    this.el = el;
    this.pages = pages();
    var self = this, tabs = el.querySelector('.gd-tabs');
    this.pages.forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = p.tab;
      b.addEventListener('click', function () { self.show(i); });
      tabs.appendChild(b);
    });
    el.querySelector('.data-head button').addEventListener('click', function () { self.close(); });
    el.querySelector('.gd-prev').addEventListener('click', function () { self.show(self.index - 1); });
    el.querySelector('.gd-next').addEventListener('click', function () { self.show(self.index + 1); });
    el.addEventListener('click', function (e) { if (Date.now() - self.openedAt < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

  Guide.prototype.show = function (i) {
    var n = this.pages.length;
    this.index = Math.max(0, Math.min(n - 1, i));
    this.el.querySelector('.gd-body').innerHTML = this.pages[this.index].html;
    var tabs = this.el.querySelectorAll('.gd-tabs button');
    for (var k = 0; k < tabs.length; k++) tabs[k].classList.toggle('on', k === this.index);
    this.el.querySelector('.gd-prev').disabled = this.index === 0;
    this.el.querySelector('.gd-next').disabled = this.index === n - 1;
    this.el.scrollTop = 0;
  };

  Guide.prototype.open = function () { this.openedAt = Date.now(); this.show(this.index || 0); this.el.hidden = false; };
  Guide.prototype.close = function () { this.el.hidden = true; };

  NCS.Guide = Guide;
})(typeof window !== 'undefined' ? window : globalThis);
