/*
 * デバッグパネル（開発中のみ表示）
 *   - 次ゲームの内部当選・出目モードを強制
 *   - 内部フラグ／停止情報の表示
 *   - 抽選確率の検証・停止制御の総当たり検証
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  // 強制項目: role = 成立させる役, mode = 出目モード, leverLamp = 先ペカ
  var FORCE_ITEMS = [
    { label: 'BIG', role: 'BIG' },
    { label: 'REG', role: 'REG' },
    { label: 'チェリー外れ', role: 'RANDOM_BONUS', mode: 'CHERRY_MISS', hint: '左BAR狙い→中で外れれば2確' },
    { label: '2確(BAR段違い)', role: 'RANDOM_BONUS', mode: 'BAR_STEP', hint: '左中段BAR＋中上段BAR' },
    { label: '先ペカ', role: 'RANDOM_BONUS', leverLamp: true },
    { label: '大山', role: 'BIG', mode: 'OYAMA', hint: '山図柄を 左下段・中上段・右下段' },
    { label: '小山', role: 'REG', mode: 'KOYAMA', hint: '山図柄を 左中段・中上段・右中段' },
    { label: '山型', role: 'RANDOM_BONUS', mode: 'YAMAGATA', hint: '7/BARを 左下段・中上段・右下段' },
    { label: 'BAR一直線', role: 'RANDOM_BONUS', mode: 'BAR_LINE', hint: 'BARを各リール狙う' },
    { label: '逆押し7', role: 'RANDOM_BONUS', mode: 'REVERSE_7', hint: '右から停止・右中段7' },
    { label: 'ブドウ', role: 'GRAPE' },
    { label: 'チェリー', role: 'CHERRY', hint: '左BAR狙い' },
    { label: 'ベル', role: 'BELL' },
    { label: 'スター', role: 'STAR' },
    { label: 'リプレイ', role: 'REPLAY' },
    { label: 'ハズレ', role: null }
  ];

  var FUTURE_ITEMS = ['遅れ', 'ジャグ連1G目当選', 'ジャグ連2G目当選', 'ジャグ連3G目当選', '復活フリーズ', 'ボーナス中無音ペカリ'];

  function DebugPanel(game, effects) {
    this.game = game;
    this.effects = effects;
    this.root = document.getElementById('debug');
    this.build();
    var self = this;
    game.on('lever', function (e) { self.showFlag(e.flag); self.stopLog = []; self.renderStops(); });
    game.on('stop', function (e) { self.stopLog.push(e); self.renderStops(); });
    game.on('result', function (e) { self.showResult(e); });
    this.stopLog = [];
  }

  DebugPanel.prototype.build = function () {
    var self = this, r = this.root;
    r.innerHTML =
      '<div class="dbg-head"><b>DEBUG</b><button id="dbg-close">閉じる</button></div>' +
      '<div class="dbg-sec"><div class="dbg-title">次ゲーム強制 <span id="dbg-forced" class="dbg-forced"></span></div><div id="dbg-force" class="dbg-grid"></div>' +
      '<div class="dbg-title">今後の段階で実装</div><div id="dbg-future" class="dbg-grid"></div></div>' +
      '<div class="dbg-sec"><div class="dbg-title">内部状態</div><pre id="dbg-state"></pre></div>' +
      '<div class="dbg-sec"><div class="dbg-title">検証</div>' +
      '<div class="dbg-grid"><button id="dbg-lot">抽選確率 100万G</button><button id="dbg-ctl">停止制御 総当たり</button>' +
      '<label><input type="checkbox" id="dbg-wait"> ウェイト4.1秒</label></div>' +
      '<pre id="dbg-out"></pre></div>' +
      '<div class="dbg-sec"><div class="dbg-title">リール配列（番号:左/中/右）</div><pre id="dbg-strips"></pre></div>';

    var grid = r.querySelector('#dbg-force');
    FORCE_ITEMS.forEach(function (it) {
      var b = document.createElement('button');
      b.textContent = it.label;
      if (it.hint) b.title = it.hint;
      b.addEventListener('click', function () { self.force(it); });
      grid.appendChild(b);
    });
    var fut = r.querySelector('#dbg-future');
    FUTURE_ITEMS.forEach(function (t) {
      var b = document.createElement('button'); b.textContent = t; b.disabled = true; fut.appendChild(b);
    });
    r.querySelector('#dbg-close').addEventListener('click', function () { self.toggle(false); });
    r.querySelector('#dbg-lot').addEventListener('click', function () { self.runLottery(); });
    r.querySelector('#dbg-ctl').addEventListener('click', function () { self.runControl(); });
    r.querySelector('#dbg-wait').addEventListener('change', function (e) { NCS.CONFIG.GAME_WAIT_MS = e.target.checked ? 4100 : 0; });

    var lines = [];
    for (var i = NCS.REEL_SIZE - 1; i >= 0; i--) {
      lines.push(('0' + i).slice(-2) + ': ' + [0, 1, 2].map(function (k) { return pad(NCS.SYMBOLS[NCS.STRIPS[k][i]].name, 5); }).join(' '));
    }
    r.querySelector('#dbg-strips').textContent = lines.join('\n');
  };

  function pad(s, n) { while (s.length < n) s += '　'; return s; }

  DebugPanel.prototype.toggle = function (on) {
    var hide = on === undefined ? !this.root.classList.contains('hidden') : !on;
    this.root.classList.toggle('hidden', hide);
    if (!hide) this.root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  DebugPanel.prototype.force = function (it) {
    var role = it.role;
    if (role === 'RANDOM_BONUS') {
      role = Math.random() < 0.5 ? 'BIG' : 'REG';
      if (it.mode && NCS.REACHME_MODE_WEIGHTS[role][it.mode] === 0) role = 'BIG';
    }
    this.game.lottery.forced = { role: role, mode: it.mode || null };
    if (it.leverLamp) this.effects.forceLeverLamp = true;
    var label = it.label + (it.role === 'RANDOM_BONUS' ? '（' + role + '）' : '') + (it.hint ? ' … ' + it.hint : '');
    this.root.querySelector('#dbg-forced').textContent = '→ ' + label;
    if (this.game.carry && role && NCS.ROLES[role] && NCS.ROLES[role].bonus) {
      this.root.querySelector('#dbg-forced').textContent += '（持ち越し中のため無効）';
    }
  };

  DebugPanel.prototype.showFlag = function (f) {
    this.root.querySelector('#dbg-forced').textContent = '';
    this.flagText = 'フラグ: ' + (f.bonus ? f.bonus + (f.newBonus ? '(新規成立)' : '(持ち越し)') : '-') +
      ' / 小役: ' + (f.small || 'ハズレ') + (f.bonus ? ' / 出目モード: ' + f.mode : '');
    this.renderStops();
  };

  DebugPanel.prototype.renderStops = function () {
    var names = ['左', '中', '右'];
    var txt = (this.flagText || '') + '\n' + this.stopLog.map(function (s) {
      return '第' + s.nth + '停止 ' + names[s.reel] + ' 押下' + s.press + ' → すべり' + s.slide + 'コマ → 停止' + s.pos + (s.determined ? ' ★確定' : '');
    }).join('\n') + (this.resultText ? '\n' + this.resultText : '');
    this.root.querySelector('#dbg-state').textContent = txt;
  };

  DebugPanel.prototype.showResult = function (e) {
    var rm = e.reachMe.map(function (id) { return NCS.REACHME[id].name; });
    this.resultText = '入賞: ' + (e.wins.map(function (w) { return w.role + '(' + NCS.LINES[w.line].name + ')'; }).join(', ') || 'なし') +
      '\nリーチ目: ' + (rm.join(', ') || 'なし');
    this.renderStops();
    this.resultText = '';
  };

  DebugPanel.prototype.runLottery = function () {
    var out = this.root.querySelector('#dbg-out');
    out.textContent = '計算中...';
    setTimeout(function () {
      var n = 1000000, rows = NCS.verifyLottery(n);
      out.textContent = '抽選 ' + n + '回\n役        理論      実測     回数\n' + rows.map(function (r) {
        return pad2(r.role, 9) + ' 1/' + r.expected.toFixed(2).padEnd(8) + ' 1/' + r.observed.toFixed(2).padEnd(8) + ' ' + r.count;
      }).join('\n');
    }, 30);
  };

  function pad2(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

  DebugPanel.prototype.runControl = function () {
    var out = this.root.querySelector('#dbg-out');
    out.textContent = '総当たり検証中...（数秒〜数十秒）';
    setTimeout(function () {
      var rep = NCS.verifyControl();
      out.textContent = NCS.formatControlReport(rep);
    }, 30);
  };

  NCS.DebugPanel = DebugPanel;
})(typeof window !== 'undefined' ? window : globalThis);
