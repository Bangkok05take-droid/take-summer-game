/*
 * input.js — タッチボタンとキーボード
 *
 * タッチは「指ごと」に、いまどのボタンの上にあるかを毎回判定します。
 *  - 指がボタンの外に出たら、その指の入力はなくなる(押しっぱなしにならない)
 *  - 指を ◀ から ▶ へすべらせると、そのまま向きが変わる
 *  - 移動とジャンプは別の指で同時に押せる
 *  - reset() すると、押されている指はいったん無効になり、離すまで反応しない
 *    (一時停止や画面切り替えのあとに入力が残らないように)
 */
(function (root) {
  'use strict';
  const pointers = new Map(); // pointerId -> { zone, stale }
  const keys = { left: false, right: false, jump: false };
  let layer = null;
  let btns = null;
  let rects = null;
  let virtual = null; // テスト用の入力上書き

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', KeyK: 'jump',
  };

  function measure() {
    if (!btns) return;
    const pad = 14; // 見た目より少し広く反応させる
    const grow = (r, p) => ({ l: r.left - p, r: r.right + p, t: r.top - p, b: r.bottom + p });
    const L = btns.left.getBoundingClientRect();
    const R = btns.right.getBoundingClientRect();
    const J = btns.jump.getBoundingClientRect();
    rects = { move: grow({ left: L.left, right: R.right, top: Math.min(L.top, R.top), bottom: Math.max(L.bottom, R.bottom) }, pad), mid: (L.right + R.left) / 2, jump: grow(J, pad + 6) };
  }

  function zoneAt(x, y) {
    if (!rects) measure();
    if (!rects) return null;
    const inR = (r) => x >= r.l && x <= r.r && y >= r.t && y <= r.b;
    if (inR(rects.jump)) return 'jump';
    if (inR(rects.move)) return x < rects.mid ? 'left' : 'right';
    return null;
  }

  function refreshVisual() {
    if (!btns) return;
    const s = state();
    btns.left.classList.toggle('on', s.left);
    btns.right.classList.toggle('on', s.right);
    btns.jump.classList.toggle('on', s.jump);
  }

  function onDown(e) {
    e.preventDefault();
    try { layer.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    pointers.set(e.pointerId, { zone: zoneAt(e.clientX, e.clientY), stale: false });
    refreshVisual();
  }
  function onMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    p.zone = zoneAt(e.clientX, e.clientY);
    refreshVisual();
  }
  function onUp(e) {
    if (pointers.delete(e.pointerId)) refreshVisual();
  }

  function init(layerEl, buttons) {
    layer = layerEl;
    btns = buttons;
    layer.addEventListener('pointerdown', onDown);
    layer.addEventListener('pointermove', onMove);
    layer.addEventListener('pointerup', onUp);
    layer.addEventListener('pointercancel', onUp);
    layer.addEventListener('lostpointercapture', onUp);
    layer.addEventListener('contextmenu', (e) => e.preventDefault());
    root.addEventListener('resize', () => setTimeout(measure, 50));
    root.addEventListener('orientationchange', () => setTimeout(measure, 300));

    root.addEventListener('keydown', (e) => {
      const k = KEYMAP[e.code];
      if (k) {
        e.preventDefault();
        if (!e.repeat) keys[k] = true;
      }
    });
    root.addEventListener('keyup', (e) => {
      const k = KEYMAP[e.code];
      if (k) keys[k] = false;
    });
    root.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
    measure();
  }

  function state() {
    if (virtual) return virtual;
    const s = { left: keys.left, right: keys.right, jump: keys.jump };
    for (const p of pointers.values()) {
      if (p.stale || !p.zone) continue;
      s[p.zone] = true;
    }
    if (s.left && s.right) {
      // 両方押されたら、あとから触った方…ではなく安全に止める
      s.left = s.right = false;
    }
    return s;
  }

  function reset() {
    keys.left = keys.right = keys.jump = false;
    for (const p of pointers.values()) p.stale = true;
    refreshVisual();
  }

  root.Input = {
    init, state, reset, measure,
    setVirtual(v) { virtual = v; },
    _debug: () => ({ pointers: Array.from(pointers.entries()), keys: Object.assign({}, keys), rects }),
  };
})(window);
