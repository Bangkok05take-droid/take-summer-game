/*
 * audio.js — 効果音はすべて Web Audio で合成(音声ファイルなし)
 * ブラウザの制限により、プレイヤーがボタンを押した後に unlock() で有効化します。
 */
(function (root) {
  'use strict';
  let ctx = null;
  let master = null;
  let muted = false;

  function unlock() {
    try {
      if (!ctx) {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.5;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* 音が出なくてもゲームは続ける */ }
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.02);
  }

  function tone(type, f0, f1, dur, vol, delay) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq, delay) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (delay || 0);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  const SFX = {
    jump() { tone('square', 330, 660, 0.12, 0.12); },
    stomp() { tone('triangle', 520, 180, 0.16, 0.35); tone('square', 900, 1200, 0.06, 0.06, 0.02); },
    melon() { tone('sine', 1046, 1046, 0.08, 0.25); tone('sine', 1568, 1568, 0.16, 0.25, 0.07); },
    checkpoint() { // 風鈴
      tone('sine', 2093, 2093, 1.2, 0.18); tone('sine', 3136, 3136, 0.8, 0.08);
      tone('sine', 2349, 2349, 1.0, 0.12, 0.18);
    },
    miss() { tone('triangle', 520, 140, 0.45, 0.3); tone('square', 260, 90, 0.4, 0.06, 0.05); },
    clear() {
      [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.18, 0.3, i * 0.1));
      tone('square', 1046, 1046, 0.35, 0.08, 0.4); tone('triangle', 1318, 1318, 0.5, 0.25, 0.42);
    },
    land() { noise(0.05, 0.12, 800); },
    pause() { tone('sine', 660, 440, 0.1, 0.15); },
    select() { tone('sine', 880, 1100, 0.07, 0.15); },
    boom() { noise(0.8, 0.35, 500); tone('sine', 90, 50, 0.5, 0.25); },
    ending() {
      // ほのぼのしたメロディ(ペンタトニック)
      const notes = [659, 784, 880, 784, 659, 587, 523, 587, 659, 784, 659, 587, 523];
      const lens = [1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 1, 3];
      let t = 0;
      notes.forEach((f, i) => { tone('triangle', f, f, lens[i] * 0.28, 0.22, t); t += lens[i] * 0.3; });
    },
  };

  function play(name) { try { if (SFX[name]) SFX[name](); } catch (e) { /* ignore */ } }

  root.Sound = { unlock, play, setMuted, isMuted: () => muted };
})(window);
