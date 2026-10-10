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
    { label: '先ペカ', role: 'RANDOM_BONUS', leverLamp: true },
    { label: 'チェリー外れ(2確)', role: 'RANDOM_BONUS', mode: 'CHERRY_MISS_7', hint: '順押し・左BAR狙い→中で外れて2確（中段7は約半分）' },
    { label: '挟み打ち山否定', role: 'RANDOM_BONUS', mode: 'YAMA_HASAMI', hint: '左→右→中。左BAR中段付近を押して山を下段へ' },
    { label: '山V字', role: 'RANDOM_BONUS', mode: 'V_SHAPE', hint: '左上・中下・右上に山' },
    { label: '大山(BIG)', role: 'BIG', mode: 'OYAMA', hint: '左下・中上・右下に山' },
    { label: '谷(BIG)', role: 'BIG', mode: 'TANI', hint: '左中・中下・右中に山' },
    { label: '小山(REG寄り)', role: 'REG', mode: 'KOYAMA', hint: '左中・中上・右中に山' },
    { label: 'BAR一直線', role: 'RANDOM_BONUS', mode: 'BAR_LINE', hint: 'BARを各リール狙う' },
    { label: '逆押し右中段7→2確', role: 'RANDOM_BONUS', mode: 'REV_GRAPE_MISS', hint: '右→中→左。右7狙い→中でブドウ否定' },
    { label: '逆押し右上段7(REG)', role: 'REG', mode: 'REG_R7_TOP', hint: '右から。右7を上段付近で押す' },
    { label: 'ブドウ', role: 'GRAPE' },
    { label: 'ブドウ(右中段7)', role: 'GRAPE', mode: 'R7_MID', hint: '逆押し右7狙いで右中段7のチャンス目' },
    { label: 'チェリー', role: 'CHERRY', hint: '左BAR狙い' },
    { label: '山小役', role: 'YAMA', hint: '左BAR狙いで山が滑って出現' },
    { label: 'ベル', role: 'BELL' },
    { label: 'リプレイ', role: 'REPLAY' },
    { label: 'ハズレ', role: null }
  ];

  // プレミア・ジャグ連の強制（第3段階）
  //   premium: 次のBIG成立ゲームで発生させる演出 / jugren: ジャグ連の当選を予約（BIG後のチャンスで発生）
  var PREMIUM_ITEMS = [
    { label: 'レバーONフリーズ', premium: 'freeze', hint: '次ゲームBIG成立＋フリーズ' },
    { label: '遅れ', premium: 'delay', hint: '次ゲームBIG成立＋リール始動遅れ' },
    { label: '第2停止プレミア', premium: 'stop2', hint: '次ゲームBIG成立＋第2停止で特殊告知' },
    { label: 'スマホ振動', premium: 'vibe', hint: '次ゲームBIG成立＋告知時に長い振動' },
    { label: 'ジャグ連1G目当選', jugren: { at: 1, type: 'BIG' }, hint: '次のBIG開始時の先行抽選で1G目BIG（BIGを引いて消化）' },
    { label: 'ジャグ連2G目当選', jugren: { at: 2, type: 'BIG' }, hint: 'BIG後チャンス2G目でBIG' },
    { label: 'ジャグ連3G目当選', jugren: { at: 3, type: 'BIG' }, hint: 'BIG後チャンス3G目でBIG' },
    { label: '復活フリーズ', jugren: { at: 2, type: 'BIG', revival: true }, hint: 'チャンス2G目で内部当選→4G目レバーONで復活' },
    { label: 'ボーナス中無音ペカリ', jugren: { at: 1, type: 'BIG', silentPeka: true }, hint: '次のBIG消化中に無音先ペカ（1G目BIGの先告知）' },
    { label: '内部ボーナスを即開始', startNow: true, hint: '持ち越し中のボーナスを揃えた扱いで開始（確認用）' }
  ];

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
      '<div class="dbg-title">プレミア・ジャグ連（第3段階）</div><div id="dbg-future" class="dbg-grid"></div></div>' +
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
    PREMIUM_ITEMS.forEach(function (it) {
      var b = document.createElement('button'); b.textContent = it.label; if (it.hint) b.title = it.hint;
      b.addEventListener('click', function () { self.forcePremium(it); });
      fut.appendChild(b);
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

  DebugPanel.prototype.forcePremium = function (it) {
    var g = this.game, msg = '→ ' + it.label + (it.hint ? ' … ' + it.hint : '');
    if (it.premium) {
      this.effects.premium.force = it.premium;
      if (!g.carry) g.lottery.forced = { role: 'BIG' };
    } else if (it.jugren) {
      g.jugren.forced = Object.assign({}, it.jugren);
    } else if (it.startNow) {
      if (g.carry && g.phase === 'IDLE' && !g.inBonus) { var t = g.carry; g.carry = null; g.startBonus(t); g.emit('state', {}); }
      else msg += '（持ち越し中のボーナスがありません）';
    }
    this.root.querySelector('#dbg-forced').textContent = msg;
  };

  DebugPanel.prototype.force = function (it) {
    var role = it.role;
    if (role === 'RANDOM_BONUS') {
      role = Math.random() < 0.5 ? 'BIG' : 'REG';
      if (it.mode && !NCS.REACHME_MODE_WEIGHTS[role][it.mode]) role = role === 'BIG' ? 'REG' : 'BIG';
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
      ' / 小役: ' + (f.small || 'ハズレ') + (f.mode && f.mode !== 'NORMAL' ? ' / 出目モード: ' + f.mode : '') +
      ' / 有効' + (f.lines ? f.lines.length : 5) + 'ライン' + (f.bonusGame ? ' / ボーナスゲーム' : '') +
      (f.jugren ? '\nジャグ連チャンス ' + f.jugren + 'G目' + (f.hiddenBonus ? '（内部' + f.hiddenBonus + '・復活待ち）' : '') + (f.revival ? '（復活！' + f.revival.at + 'G目当選）' : '') : '') +
      (f.silentPeka ? '\n無音先ペカ' : '') +
      (this.game.jugren.pre && this.game.inBonus ? '\n先行抽選(チャンス1G目): ' + (this.game.jugren.pre.type || 'ハズレ') + (this.game.jugren.pre.silentPekaAt ? '（' + this.game.jugren.pre.silentPekaAt + 'G目に無音先ペカ）' : '') + (this.game.jugren.pre.revival ? '（復活）' : '') : '');
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
