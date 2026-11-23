// 効果音（Web Audio による合成音）。本番音源が届いたら public/assets/sfx/<id>.mp3 に置くと自動で差し替わる。
import { fxBus, type FxEvent } from '../fx/bus';

export type SfxId =
  | 'tap'
  | 'diceRoll'
  | 'diceResult'
  | 'step'
  | 'land'
  | 'branch'
  | 'purchase'
  | 'income'
  | 'turnStart'
  | 'yourTurn'
  | 'gameOver'
  | 'eventOpen'
  | 'eventGood'
  | 'eventBad'
  | 'insolvency';

const MUTE_KEY = 'worldlife.muted';

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();
const files = new Map<SfxId, AudioBuffer | null>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(v: boolean): void {
  muted = v;
  try {
    localStorage.setItem(MUTE_KEY, v ? '1' : '0');
  } catch {
    /* noop */
  }
  if (master && ac) master.gain.setTargetAtTime(v ? 0 : 0.8, ac.currentTime, 0.02);
}

function ctx(): AudioContext | null {
  if (ac) return ac;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ac = new Ctor();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(comp).connect(ac.destination);
  void loadFiles();
  return ac;
}

/** iOS 対策：最初のタップで AudioContext を起こす */
export function unlockAudio(): void {
  const a = ctx();
  if (a && a.state !== 'running') void a.resume();
}

async function loadFiles(): Promise<void> {
  const ids: SfxId[] = ['tap', 'diceRoll', 'diceResult', 'step', 'land', 'branch', 'purchase', 'income', 'turnStart', 'yourTurn', 'gameOver', 'eventOpen', 'eventGood', 'eventBad', 'insolvency'];
  await Promise.all(
    ids.map(async (id) => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}assets/sfx/${id}.mp3`);
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || !type.startsWith('audio/')) return files.set(id, null);
        files.set(id, await ac!.decodeAudioData(await res.arrayBuffer()));
      } catch {
        files.set(id, null);
      }
    }),
  );
}

// ---------- 合成用の部品 ----------
function tone(freq: number, start: number, dur: number, opts: { type?: OscillatorType; vol?: number; glideTo?: number; attack?: number } = {}): void {
  const a = ac!;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, start);
  if (opts.glideTo) o.frequency.exponentialRampToValueAtTime(opts.glideTo, start + dur);
  const vol = opts.vol ?? 0.2;
  const atk = opts.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(master!);
  o.start(start);
  o.stop(start + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(start: number, dur: number, opts: { vol?: number; freq?: number; q?: number; type?: BiquadFilterType; sweepTo?: number } = {}): void {
  const a = ac!;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 1, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.frequency.setValueAtTime(opts.freq ?? 2000, start);
  if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, start + dur);
  f.Q.value = opts.q ?? 1.5;
  const g = a.createGain();
  const vol = opts.vol ?? 0.2;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(start, Math.random() * 0.5);
  src.stop(start + dur + 0.02);
}

// ペンタトニック（歩数が進むほど音が上がる）
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const semitone = (base: number, n: number) => base * Math.pow(2, n / 12);

export function play(id: SfxId, param = 0): void {
  if (muted) return;
  const a = ctx();
  if (!a || a.state !== 'running') return;
  const buf = files.get(id);
  if (buf) {
    const s = a.createBufferSource();
    s.buffer = buf;
    s.connect(master!);
    s.start();
    return;
  }
  const t = a.currentTime + 0.005;
  switch (id) {
    case 'tap':
      tone(1100, t, 0.06, { type: 'triangle', vol: 0.08, glideTo: 700 });
      break;
    case 'diceRoll': {
      // カラカラ…と転がる音。param = 演出時間(ms)
      const total = Math.max(0.12, param / 1000);
      let x = 0;
      let gap = 0.035;
      while (x < total) {
        noise(t + x, 0.03, { vol: 0.18, freq: 2500 + Math.random() * 2500, q: 6 });
        tone(300 + Math.random() * 200, t + x, 0.03, { type: 'square', vol: 0.02 });
        x += gap;
        gap *= 1.08;
      }
      break;
    }
    case 'diceResult':
      noise(t, 0.05, { vol: 0.2, freq: 1200, q: 2 });
      tone(1318.5, t + 0.02, 0.35, { type: 'triangle', vol: 0.16 });
      tone(1975.5, t + 0.05, 0.4, { type: 'sine', vol: 0.1 });
      break;
    case 'step': {
      const f = semitone(523.25, PENTA[Math.min(param, PENTA.length - 1)]);
      tone(f, t, 0.12, { type: 'triangle', vol: 0.12 });
      tone(f * 2, t, 0.06, { type: 'sine', vol: 0.04 });
      noise(t, 0.025, { vol: 0.05, freq: 3000, q: 3 });
      break;
    }
    case 'land':
      [523.25, 659.25, 783.99, 987.77].forEach((f, i) => tone(f, t + i * 0.045, 0.45, { type: 'triangle', vol: 0.09 }));
      tone(130.8, t, 0.4, { type: 'sine', vol: 0.12 });
      break;
    case 'branch':
      tone(659.25, t, 0.16, { type: 'sine', vol: 0.12 });
      tone(987.77, t + 0.12, 0.3, { type: 'sine', vol: 0.12 });
      tone(1318.5, t + 0.12, 0.3, { type: 'triangle', vol: 0.04 });
      break;
    case 'purchase':
      // レジ＋コインのきらめき
      noise(t, 0.08, { vol: 0.25, freq: 900, q: 1 });
      tone(2093, t + 0.04, 0.5, { type: 'triangle', vol: 0.12 });
      tone(2637, t + 0.1, 0.55, { type: 'triangle', vol: 0.1 });
      tone(3136, t + 0.16, 0.6, { type: 'sine', vol: 0.08 });
      for (let i = 0; i < 6; i++) tone(3000 + Math.random() * 2000, t + 0.2 + i * 0.05, 0.12, { type: 'sine', vol: 0.03 });
      tone(98, t, 0.35, { type: 'sine', vol: 0.18 });
      break;
    case 'income':
      tone(1567.98, t, 0.18, { type: 'square', vol: 0.03 });
      tone(2093, t + 0.07, 0.35, { type: 'triangle', vol: 0.09 });
      break;
    case 'turnStart':
      noise(t, 0.6, { vol: 0.12, freq: 300, sweepTo: 4000, q: 0.8, type: 'lowpass' });
      [261.63, 392, 523.25].forEach((f) => tone(f, t + 0.15, 0.9, { type: 'sawtooth', vol: 0.025, attack: 0.08 }));
      tone(65.4, t + 0.1, 0.8, { type: 'sine', vol: 0.2 });
      break;
    case 'yourTurn':
      [783.99, 1046.5, 1567.98].forEach((f, i) => tone(f, t + i * 0.08, 0.4, { type: 'triangle', vol: 0.1 }));
      break;
    case 'eventOpen':
      // 幕が開くようなきらめき
      noise(t, 0.5, { vol: 0.1, freq: 800, sweepTo: 6000, q: 1.2 });
      [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => tone(f, t + 0.05 + i * 0.05, 0.6, { type: 'sine', vol: 0.07 }));
      tone(98, t, 0.5, { type: 'sine', vol: 0.15 });
      break;
    case 'eventGood':
      [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => tone(f, t + i * 0.07, 0.5, { type: 'triangle', vol: 0.1 }));
      break;
    case 'insolvency':
      // 警報音
      for (let i = 0; i < 3; i++) {
        tone(880, t + i * 0.28, 0.14, { type: 'square', vol: 0.05 });
        tone(622.25, t + i * 0.28 + 0.14, 0.14, { type: 'square', vol: 0.05 });
      }
      tone(55, t, 0.9, { type: 'sawtooth', vol: 0.06 });
      noise(t + 0.85, 0.5, { vol: 0.12, freq: 400, sweepTo: 120, q: 1, type: 'lowpass' });
      break;
    case 'eventBad':
      tone(392, t, 0.35, { type: 'sawtooth', vol: 0.05, glideTo: 330 });
      tone(311.13, t + 0.18, 0.5, { type: 'sawtooth', vol: 0.05, glideTo: 233 });
      tone(65.4, t, 0.5, { type: 'sine', vol: 0.18 });
      break;
    case 'gameOver':
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => tone(f, t + i * 0.1, 0.9, { type: 'triangle', vol: 0.1 }));
      [130.8, 196].forEach((f) => tone(f, t + 0.5, 1.6, { type: 'sawtooth', vol: 0.03, attack: 0.1 }));
      break;
  }
}

function vibrate(ms: number | number[]): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* noop */
  }
}

/** バス購読：演出イベント → 効果音・振動 */
export function initSfx(): () => void {
  const onDown = () => unlockAudio();
  window.addEventListener('pointerdown', onDown, { capture: true });
  const off = fxBus.on((e: FxEvent) => {
    switch (e.type) {
      case 'tap':
        play('tap');
        break;
      case 'diceRoll':
        play('diceRoll', e.durationMs);
        if (e.human) vibrate(15);
        break;
      case 'diceResult':
        play('diceResult');
        break;
      case 'step':
        play('step', e.index);
        if (e.human) vibrate(8);
        break;
      case 'land':
        play('land');
        if (e.human) vibrate(20);
        break;
      case 'branchPrompt':
        play('branch');
        break;
      case 'purchase':
        play('purchase');
        vibrate([20, 40, 30]);
        break;
      case 'income':
        play('income');
        break;
      case 'turnStart':
        play('turnStart');
        break;
      case 'yourTurn':
        play('yourTurn');
        break;
      case 'gameOver':
        play('gameOver');
        break;
      case 'eventOpen':
        play('eventOpen');
        break;
      case 'insolvency':
        play('insolvency');
        vibrate([60, 40, 60, 40, 120]);
        break;
      case 'eventResult':
        play(e.good ? 'eventGood' : 'eventBad');
        if (e.good) vibrate(15);
        else vibrate([30, 30, 30]);
        break;
    }
  });
  return () => {
    off();
    window.removeEventListener('pointerdown', onDown, { capture: true });
  };
}
