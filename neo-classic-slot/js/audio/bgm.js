/*
 * BGM（第4段階・Web Audio による合成。音声ファイルを置けばそちらを優先）
 *
 *   通常時（控えめ） / BIG中 / REG中 / ジャグ連チャンス中 の4曲。状態が変わるとクロスフェードで切替。
 *   無音先ペカでは Sound.muteAll(true) で全体が止まり、次のレバーONで再開する（BGMは裏で進行）。
 *
 * 曲データ: 16分音符単位のステップシーケンス。音名は MIDI 番号（60 = C4）、null は休符。
 * ファイル差し替え: assets/sounds/bgm_normal.mp3 / bgm_big.mp3 / bgm_reg.mp3 / bgm_chance.mp3
 */
(function (g) {
  var NCS = (g.NCS = g.NCS || {});

  function chordArp(roots, pattern) { // ルート列から 16ステップ×小節 のアルペジオを作る
    var out = [];
    roots.forEach(function (r) { pattern.forEach(function (p) { out.push(p === null ? null : r + p); }); });
    return out;
  }
  function bassLine(roots, pattern) {
    var out = [];
    roots.forEach(function (r) { pattern.forEach(function (p) { out.push(p === null ? null : r - 24 + p); }); });
    return out;
  }

  // ---- 曲 ----
  var TRACKS = {
    normal: { // 落ち着いたホールの空気。小さめの音量で
      bpm: 96, vol: 0.22,
      lead: { wave: 'triangle', notes: chordArp([69, 65, 60, 67], [0, null, 7, null, 12, null, 7, null, 3, null, 7, null, 12, null, 7, null]), len: 0.18, gain: 0.08 },
      bass: { wave: 'sine', notes: bassLine([69, 65, 60, 67], [0, null, null, null, null, null, null, null, 7, null, null, null, null, null, null, null]), len: 0.5, gain: 0.18 }
    },
    big: { // 明るく速い。払い出し音が気持ちよく乗るように中域を空ける
      bpm: 152, vol: 0.5,
      lead: { wave: 'square', notes: [72, null, 76, 79, 84, null, 79, 76, 74, null, 77, 81, 86, null, 81, 77,
                                       76, null, 79, 84, 88, null, 84, 79, 77, 79, 81, 83, 84, null, null, null], len: 0.11, gain: 0.07 },
      chord: { wave: 'sawtooth', notes: chordArp([60, 67, 69, 65], [0, null, 4, null, 7, null, 4, null, 0, null, 4, null, 7, null, 4, null]), len: 0.09, gain: 0.035 },
      bass: { wave: 'square', notes: bassLine([60, 67, 69, 65], [0, null, 12, null, 0, null, 12, null, 0, null, 12, null, 0, 7, 12, null]), len: 0.12, gain: 0.12 },
      drum: [1, 0, 2, 0, 1, 0, 2, 3, 1, 0, 2, 0, 1, 3, 2, 3]
    },
    reg: { // 軽快・少し控えめ
      bpm: 132, vol: 0.42,
      lead: { wave: 'triangle', notes: [79, null, 76, null, 72, null, 76, null, 77, null, 74, null, 71, null, 74, null], len: 0.16, gain: 0.09 },
      bass: { wave: 'square', notes: bassLine([60, 65, 67, 60], [0, null, null, null, 7, null, null, null, 0, null, null, null, 7, null, 12, null]), len: 0.14, gain: 0.1 },
      drum: [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 3]
    },
    chance: { // ジャグ連チャンス: 短調・心拍のような低音で緊張感
      bpm: 140, vol: 0.45,
      lead: { wave: 'square', notes: [81, null, null, 80, 81, null, 84, null, 83, null, null, 81, 80, null, 76, null], len: 0.1, gain: 0.06 },
      chord: { wave: 'sawtooth', notes: chordArp([57, 53, 52, 52], [0, 3, 7, 3, 0, 3, 7, 3, 0, 3, 7, 3, 0, 3, 7, 3]), len: 0.06, gain: 0.03 },
      bass: { wave: 'sine', notes: bassLine([57, 53, 52, 52], [0, null, 0, null, null, null, null, null, 0, null, 0, null, null, null, null, null]), len: 0.18, gain: 0.25 },
      drum: [1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 1, 0, 2, 0, 0, 3]
    }
  };

  var FILES = { normal: 'assets/sounds/bgm_normal.mp3', big: 'assets/sounds/bgm_big.mp3', reg: 'assets/sounds/bgm_reg.mp3', chance: 'assets/sounds/bgm_chance.mp3' };

  function Bgm(sound) {
    this.sound = sound;
    this.current = null;   // 再生中の曲名
    this.want = null;
    this.bus = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.buffers = {};
  }

  Bgm.prototype.ensure = function () {
    var s = this.sound;
    if (!s.ctx) return false;
    if (!this.loaded && NCS.CONFIG.USE_SOUND_ASSETS) {
      this.loaded = true;
      var self = this;
      Object.keys(FILES).forEach(function (k) {
        fetch(FILES[k]).then(function (r) { return r.ok ? r.arrayBuffer() : null; })
          .then(function (ab) { return ab && s.ctx.decodeAudioData(ab); })
          .then(function (b) { if (b) self.buffers[k] = b; }).catch(function () {});
      });
    }
    return true;
  };

  // 曲を切り替える（同じ曲なら何もしない）。null で停止
  Bgm.prototype.play = function (name) {
    this.want = name;
    if (!this.ensure()) return;
    if (!this.sound.enabled) name = null; // サウンドOFF中は停止
    if (name === this.current) return;
    var ctx = this.sound.ctx, now = ctx.currentTime;
    if (this.bus) { // フェードアウト
      var old = this.bus, oldSrc = this.fileSrc;
      old.gain.setTargetAtTime(0, now, 0.15);
      setTimeout(function () { try { if (oldSrc) oldSrc.stop(); old.disconnect(); } catch (e) { /* 停止済み */ } }, 900);
    }
    this.fileSrc = null;
    clearInterval(this.timer); this.timer = null;
    this.current = name;
    if (!name) { this.bus = null; return; }
    var t = TRACKS[name];
    var bus = ctx.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(t.vol, now + 0.4);
    bus.connect(this.sound.channels.bgm);
    this.bus = bus;
    if (this.buffers[name]) { // 音声ファイル
      var src = ctx.createBufferSource();
      src.buffer = this.buffers[name]; src.loop = true; src.connect(bus); src.start();
      this.fileSrc = src;
      return;
    }
    this.track = t; this.step = 0; this.nextTime = now + 0.05;
    var self = this;
    this.timer = setInterval(function () { self.schedule(); }, 25);
  };

  // 先読みスケジューラ（0.15秒先まで予約）
  Bgm.prototype.schedule = function () {
    var ctx = this.sound.ctx, t = this.track, dur = 60 / t.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.15) {
      var st = this.step, time = this.nextTime;
      ['lead', 'chord', 'bass'].forEach(function (k) {
        var part = t[k]; if (!part) return;
        var n = part.notes[st % part.notes.length];
        if (n !== null && n !== undefined) this.note(part, n, time);
      }, this);
      if (t.drum) this.drum(t.drum[st % t.drum.length], time);
      this.step++;
      this.nextTime += dur;
    }
  };

  Bgm.prototype.note = function (part, midi, time) {
    var ctx = this.sound.ctx, o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = part.wave;
    o.frequency.setValueAtTime(440 * Math.pow(2, (midi - 69) / 12), time);
    gn.gain.setValueAtTime(0.0001, time);
    gn.gain.exponentialRampToValueAtTime(part.gain, time + 0.008);
    gn.gain.exponentialRampToValueAtTime(0.0001, time + part.len);
    o.connect(gn); gn.connect(this.bus);
    o.start(time); o.stop(time + part.len + 0.02);
  };

  // 1=キック 2=ハット 3=スネア
  Bgm.prototype.drum = function (kind, time) {
    if (!kind) return;
    var ctx = this.sound.ctx;
    if (kind === 1) {
      var o = ctx.createOscillator(), gn = ctx.createGain();
      o.frequency.setValueAtTime(120, time); o.frequency.exponentialRampToValueAtTime(40, time + 0.12);
      gn.gain.setValueAtTime(0.35, time); gn.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
      o.connect(gn); gn.connect(this.bus); o.start(time); o.stop(time + 0.16);
      return;
    }
    var len = kind === 2 ? 0.03 : 0.1, buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g2 = ctx.createGain();
    s.buffer = buf; f.type = 'highpass'; f.frequency.value = kind === 2 ? 8000 : 1800; g2.gain.value = kind === 2 ? 0.08 : 0.16;
    s.connect(f); f.connect(g2); g2.connect(this.bus); s.start(time);
  };

  /*
   * ゲーム状態からBGMを決める。
   *   ボーナス中 → BIG / REG、ジャグ連チャンス中（復活待ち含む）→ chance、それ以外 → normal
   */
  Bgm.prototype.attach = function (game) {
    var self = this;
    function update() {
      var name;
      if (game.inBonus) name = game.stats.bonusType === 'BIG' ? 'big' : 'reg';
      else if (game.jugren.active || game.jugren.hidden) name = 'chance';
      else name = NCS.CONFIG.NORMAL_BGM ? 'normal' : null;
      self.play(name);
    }
    ['lever', 'bonus', 'bonusEnd', 'result'].forEach(function (ev) { game.on(ev, update); });
    this.update = update;
  };

  NCS.Bgm = Bgm;
})(typeof window !== 'undefined' ? window : globalThis);
