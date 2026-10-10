/*
 * サウンド管理（第1段階: Web Audio による仮の合成音）
 *
 * チャンネル: bgm / se（レバー・停止）/ pay（払い出し）/ jingle（告知）
 * 各チャンネルに個別の音量・ミュート。muteAll() で全停止（無音ペカリ用）。
 * CONFIG.USE_SOUND_ASSETS が true で FILES の音声ファイルがあればそちらを優先（第4段階）。
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  var FILES = {
    lever: 'assets/sounds/lever.mp3',
    stop: 'assets/sounds/stop.mp3',
    pay: 'assets/sounds/pay.mp3',
    lamp: 'assets/sounds/lamp.mp3',
    bgmNormal: 'assets/sounds/bgm_normal.mp3',
    bgmBonus: 'assets/sounds/bgm_bonus.mp3'
  };

  function Sound() {
    this.ctx = null;
    this.buffers = {};
    this.channels = {};
    this.enabled = true;
    this.silent = false;   // 無音ペカリ中は true
    this.payTimer = null;
  }

  Sound.prototype.unlock = function () {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    var AC = g.AudioContext || g.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    var master = this.ctx.createGain();
    master.gain.value = 0.6;
    master.connect(this.ctx.destination);
    this.master = master;
    var self = this;
    ['bgm', 'se', 'pay', 'jingle'].forEach(function (ch) {
      var gn = self.ctx.createGain();
      gn.gain.value = { bgm: 0.5, se: 0.8, pay: 0.7, jingle: 0.9 }[ch];
      gn.connect(master);
      self.channels[ch] = gn;
    });
    if (NCS.CONFIG.USE_SOUND_ASSETS) this.loadFiles();
  };

  Sound.prototype.loadFiles = function () {
    var self = this;
    Object.keys(FILES).forEach(function (k) {
      fetch(FILES[k]).then(function (r) { return r.ok ? r.arrayBuffer() : null; })
        .then(function (ab) { return ab && self.ctx.decodeAudioData(ab); })
        .then(function (buf) { if (buf) self.buffers[k] = buf; })
        .catch(function () {});
    });
  };

  Sound.prototype.ready = function () { return this.enabled && !this.silent && this.ctx; };

  Sound.prototype.playFile = function (key, ch) {
    if (!this.buffers[key]) return false;
    var s = this.ctx.createBufferSource();
    s.buffer = this.buffers[key];
    s.connect(this.channels[ch]);
    s.start();
    return true;
  };

  // 短い合成音
  // ch はチャンネル名、または出力先の AudioNode
  Sound.prototype.dest = function (ch) { return typeof ch === 'string' ? this.channels[ch] : ch; };

  Sound.prototype.tone = function (ch, type, f0, f1, dur, vol, delay) {
    var t = this.ctx.currentTime + (delay || 0);
    var o = this.ctx.createOscillator(), gn = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(this.dest(ch));
    o.start(t); o.stop(t + dur + 0.02);
  };

  Sound.prototype.noise = function (ch, dur, vol, hp, delay) {
    var t = this.ctx.currentTime + (delay || 0);
    var len = Math.floor(this.ctx.sampleRate * dur);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), gn = this.ctx.createGain();
    s.buffer = buf; f.type = 'highpass'; f.frequency.value = hp || 3000; gn.gain.value = vol;
    s.connect(f); f.connect(gn); gn.connect(this.dest(ch));
    s.start(t);
  };

  Sound.prototype.lever = function () {
    if (!this.ready()) return;
    if (this.playFile('lever', 'se')) return;
    this.noise('se', 0.05, 0.5, 1500);
    this.tone('se', 'square', 220, 110, 0.06, 0.15);
  };

  Sound.prototype.reelStop = function () {
    if (!this.ready()) return;
    if (this.playFile('stop', 'se')) return;
    this.tone('se', 'square', 160, 60, 0.07, 0.35);
    this.noise('se', 0.03, 0.4, 2500);
  };

  // 払い出し: 電子音＋金属音を枚数分。新しい払い出しが始まったら前回分は素早くフェードアウト（重なり防止）
  // fast: オート消化用に間隔を詰める
  Sound.prototype.payout = function (n, fast) {
    if (!this.ready() || n <= 0) return;
    if (this.playFile('pay', 'pay')) return;
    var now = this.ctx.currentTime;
    if (this.payBus) {
      this.payBus.gain.setTargetAtTime(0, now, 0.02);
      var old = this.payBus;
      setTimeout(function () { old.disconnect(); }, 300);
    }
    var bus = this.ctx.createGain();
    bus.connect(this.channels.pay);
    this.payBus = bus;
    var interval = fast ? 0.03 : 0.055;
    for (var i = 0; i < Math.min(n, 15); i++) {
      var d = i * interval;
      this.tone(bus, 'square', 1760 + (i % 2) * 220, null, 0.045, 0.12, d);
      this.tone(bus, 'triangle', 3520, 2900, 0.06, 0.08, d);
      this.noise(bus, 0.04, 0.12, 6000, d);
    }
  };

  Sound.prototype.lamp = function () {
    if (!this.ready()) return;
    if (this.playFile('lamp', 'jingle')) return;
    this.tone('jingle', 'sawtooth', 880, 1760, 0.12, 0.15);
  };

  Sound.prototype.bonusJingle = function () {
    if (!this.ready()) return;
    var notes = [523, 659, 784, 1047, 784, 1047];
    for (var i = 0; i < notes.length; i++) this.tone('jingle', 'square', notes[i], null, 0.14, 0.12, i * 0.12);
  };

  // 無音ペカリ等: すべての音を止める
  Sound.prototype.muteAll = function (on) {
    this.silent = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0 : 0.6, this.ctx.currentTime, 0.005);
  };

  NCS.Sound = Sound;
})(typeof window !== 'undefined' ? window : globalThis);
