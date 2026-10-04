/*
 * main.js — 画面の切り替え、ゲームの進行、セーブ
 */
(function () {
  'use strict';
  const T = Engine.TILE;
  const STEP = 1 / 120; // 物理の固定ステップ
  const $ = (id) => document.getElementById(id);

  // ===== セーブ =====
  const SAVE_KEY = 'take-natsuyasumi-save-v1';
  function defaultSave() { return { unlocked: 1, cleared: [], best: {}, muted: false, resume: null }; }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && typeof s.unlocked === 'number') return Object.assign(defaultSave(), s);
    } catch (e) { /* 壊れていたら初期化 */ }
    return defaultSave();
  }
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 保存できない環境でも遊べる */ }
  }
  let save = loadSave();
  Sound.setMuted(save.muted);

  // ===== キャンバス =====
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  let dpr = 1, scale = 1, vw = 800, vh = Engine.VIEW_ROWS * T;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    vh = Engine.VIEW_ROWS * T;
    scale = canvas.height / vh;
    vw = canvas.width / scale;
    checkOrientation();
    Input.measure();
  }

  // ===== 状態 =====
  let screen = 'title';
  let game = null;
  let titleTime = 0;
  let endingFw = null;
  let endingTime = 0;
  let frozen = false; // テスト用: 自動更新を止める

  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || /[?&]touch/.test(location.search);

  function showScreen(name) {
    ['title', 'select', 'howto', 'pause', 'clear', 'ending'].forEach((n) => { $('scr-' + n).hidden = n !== name; });
  }

  function setScreen(name) {
    screen = name;
    Input.reset(); // 画面が変わったら、押していた入力はいったん無効に
    const playing = name === 'play';
    const inGame = playing || name === 'pause' || name === 'clear';
    $('hud').hidden = !inGame;
    $('touch').hidden = !playing;
    $('controls').hidden = !(inGame && isTouch);
    if (name === 'play') showScreen(null);
    else showScreen(name);
    if (name === 'title') refreshTitle();
    if (name === 'select') buildSelect();
    if (playing) setTimeout(Input.measure, 0);
  }

  // ===== 音ボタン =====
  const ICON_ON = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke-width="2" stroke-linecap="round"/></svg>';
  function refreshMute() {
    const html = save.muted ? ICON_OFF : ICON_ON;
    $('btn-mute').innerHTML = html;
    $('btn-mute-title').innerHTML = html;
  }
  function toggleMute() {
    save.muted = !save.muted;
    Sound.unlock();
    Sound.setMuted(save.muted);
    writeSave();
    refreshMute();
    if (!save.muted) Sound.play('select');
  }

  // ===== タイトル =====
  function refreshTitle() {
    const b = $('btn-continue');
    const r = save.resume;
    if (r && r.stage >= 0 && r.stage < STAGES.length) {
      b.hidden = false;
      b.textContent = `つづきから (${r.stage + 1}面${r.cp >= 0 ? '・チェックポイント' : ''})`;
    } else {
      b.hidden = true;
    }
    $('btn-new').classList.toggle('primary', b.hidden);
  }

  function firstTouch() {
    Sound.unlock();
    if (isTouch && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => {
        if (window.screen.orientation && window.screen.orientation.lock) window.screen.orientation.lock('landscape').catch(() => {});
      }).catch(() => {});
    }
  }

  // ===== ステージ選択 =====
  function buildSelect() {
    const grid = $('stage-grid');
    grid.innerHTML = '';
    STAGES.forEach((st, i) => {
      const unlocked = i < save.unlocked;
      const b = document.createElement('button');
      b.className = 'stage-card' + (save.cleared[i] ? ' cleared' : '') + (unlocked ? '' : ' locked');
      const total = countMelons(i);
      const best = save.best[i] || 0;
      b.innerHTML = `<span class="n">${i + 1}</span><span class="nm">${unlocked ? st.name : '???'}</span>` +
        `<span class="m">${save.cleared[i] ? '🍉 ' + best + '/' + total : unlocked ? 'あそべる' : 'まだ'}</span>`;
      b.disabled = !unlocked;
      b.addEventListener('click', () => { if (unlocked) { Sound.play('select'); startStage(i, -1); } });
      grid.appendChild(b);
    });
  }
  const melonCounts = {};
  function countMelons(i) {
    if (melonCounts[i] == null) melonCounts[i] = Engine.parseStage(STAGES[i], i).melons.length;
    return melonCounts[i];
  }

  // ===== ゲーム本体 =====
  function startStage(index, cp) {
    const level = Engine.parseStage(STAGES[index], index);
    game = {
      index, level, world: null, player: null, cp: -1,
      cam: { x: 0, y: 0, look: 0 }, particles: [], time: 0,
      deathT: 0, deathAnim: null, winT: 0, melons: 0, melonGot: level.melons.map(() => false),
      walk: 0, fw: level.theme === 'hilltop' ? Render.makeFireworks() : null,
    };
    game.cp = cp != null && cp < level.checkpoints.length ? cp : -1;
    spawn();
    game.cam.x = clampCamX(game.player.x - vw * 0.3);
    $('hud-stage').textContent = `${index + 1}. ${level.name}`;
    updateMelonHud();
    showBanner(index, level);
    save.resume = { stage: index, cp: game.cp };
    writeSave();
    setScreen('play');
  }

  function spawn() {
    const level = game.level;
    game.world = Engine.createWorld(level);
    game.world.melonGot = game.melonGot;
    const sp = game.cp >= 0 ? level.checkpoints[game.cp].spawn : level.spawn;
    const p = Engine.createPlayer(sp);
    p.checkpoint = game.cp;
    p.invuln = game.deathAnim ? Engine.PHYS.respawnInvuln : 0;
    p.jumpHeld = Input.state().jump; // 押しっぱなしで勝手に跳ばないように
    game.player = p;
    game.deathT = 0;
    game.deathAnim = null;
    game.winT = 0;
  }

  let bannerTimer = null;
  function showBanner(index, level) {
    const b = $('banner');
    $('banner-num').textContent = `ステージ ${index + 1}`;
    $('banner-name').textContent = level.name;
    $('banner-hint').textContent = (!isTouch && index === 0) ? '← → で歩いて、スペースでジャンプ。長く押すと高く跳べるよ' : (level.def.hint || '');
    b.hidden = false;
    b.classList.remove('out');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      b.classList.add('out');
      bannerTimer = setTimeout(() => { b.hidden = true; }, 700);
    }, 2600);
  }
  function hideBanner() { clearTimeout(bannerTimer); $('banner').hidden = true; }

  function updateMelonHud() {
    $('hud-melon').textContent = `${game.melons}/${game.level.melons.length}`;
  }

  function clampCamX(x) {
    const max = game.level.w * T - vw;
    return Math.max(0, Math.min(max, x));
  }

  function addParticles(x, y, n, kind, col) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = kind === 'dust' ? 30 + Math.random() * 40 : 80 + Math.random() * 120;
      game.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: kind === 'dust' ? -Math.abs(Math.sin(a)) * 30 : Math.sin(a) * sp - 40,
        life: kind === 'dust' ? 0.35 : 0.6, max: kind === 'dust' ? 0.35 : 0.6, kind, col,
      });
    }
  }

  function handleEvent(ev) {
    const p = game.player;
    const type = typeof ev === 'string' ? ev : ev.type;
    switch (type) {
      case 'jump': Sound.play('jump'); addParticles(p.x + p.w / 2, p.y + p.h, 4, 'dust', '#ffffff'); break;
      case 'land': addParticles(p.x + p.w / 2, p.y + p.h, 3, 'dust', '#ffffff'); break;
      case 'stomp': Sound.play('stomp'); addParticles(ev.enemy.x + ev.enemy.w / 2, ev.enemy.y, 8, 'star', '#ffe066'); break;
      case 'melon': {
        Sound.play('melon');
        const m = game.level.melons[ev.index];
        addParticles(m.x, m.y, 10, 'star', '#ff7a8a');
        game.melons++;
        updateMelonHud();
        break;
      }
      case 'checkpoint': {
        Sound.play('checkpoint');
        game.cp = ev.index;
        const c = game.level.checkpoints[ev.index];
        addParticles(c.x + 26, c.y - 40, 14, 'star', '#bfe8ff');
        save.resume = { stage: game.index, cp: game.cp };
        writeSave();
        break;
      }
      case 'die':
        Sound.play('miss');
        game.deathAnim = { x: p.x + p.w / 2, y: p.y + p.h, vy: ev.cause === 'fall' ? 0 : -420, fall: ev.cause === 'fall' };
        break;
      case 'goal': Sound.play('clear'); onGoal(); break;
    }
  }

  function onGoal() {
    const i = game.index;
    save.cleared[i] = true;
    save.unlocked = Math.min(STAGES.length, Math.max(save.unlocked, i + 2));
    save.best[i] = Math.max(save.best[i] || 0, game.melons);
    save.resume = i + 1 < STAGES.length ? { stage: i + 1, cp: -1 } : null;
    writeSave();
    hideBanner();
  }

  function update(dt) {
    if (screen === 'title') { titleTime += dt; return; }
    if (screen === 'ending') {
      endingTime += dt;
      Render.updateFireworks(endingFw, dt, vw, vh, 0.9, () => { if (endingTime > 0.5) Sound.play('boom'); });
      return;
    }
    if (!game || screen !== 'play') return;
    game.time += dt;
    const p = game.player;
    Engine.stepWorld(game.world, dt);
    if (game.fw) Render.updateFireworks(game.fw, dt, vw, vh, 1.8);

    if (p.dead) {
      game.deathT += dt;
      const d = game.deathAnim;
      if (d && !d.fall && game.deathT > 0.25) { d.vy += 1400 * dt; d.y += d.vy * dt; }
      if (game.deathT > (d && d.fall ? 0.7 : 1.1)) spawn();
    } else if (p.won) {
      game.winT += dt;
      if (game.winT > 1.7) {
        if (game.index === STAGES.length - 1) startEnding();
        else showClear();
        return;
      }
    } else {
      const events = [];
      Engine.stepPlayer(p, Input.state(), game.world, dt, events);
      for (const ev of events) handleEvent(ev);
      if (Math.abs(p.vx) > 10 && p.onGround) game.walk += Math.abs(p.vx) * dt * 0.075;
    }

    for (let i = game.particles.length - 1; i >= 0; i--) {
      const q = game.particles[i];
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.kind === 'dust' ? 0 : 300) * dt;
      q.life -= dt;
      if (q.life <= 0) game.particles.splice(i, 1);
    }

    // カメラ: 向いている方向の先が見えるように
    if (!p.dead) {
      const look = p.face * vw * 0.12;
      game.cam.look += (look - game.cam.look) * Math.min(1, dt * 2.2);
      const target = clampCamX(p.x + p.w / 2 - vw * 0.42 + game.cam.look);
      game.cam.x += (target - game.cam.x) * Math.min(1, dt * 7);
    }
  }

  function showClear() {
    const total = game.level.melons.length;
    $('clear-melon').textContent = `スイカのかけら ${game.melons} / ${total}` + (game.melons === total && total > 0 ? '  ぜんぶ!' : '');
    setScreen('clear');
  }

  function startEnding() {
    game = null;
    endingFw = Render.makeFireworks();
    endingTime = 0;
    let got = 0, total = 0;
    STAGES.forEach((_, i) => { got += save.best[i] || 0; total += countMelons(i); });
    $('ending-melon').textContent = `あつめたスイカのかけら ${got} / ${total}`;
    // アニメーションを最初から再生
    const box = $('ending-text');
    box.querySelectorAll('p, button').forEach((el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
    setScreen('ending');
    Sound.play('ending');
  }

  // ===== 描画 =====
  function render() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (screen === 'ending') {
      Render.drawEndingScene(ctx, vw, vh, endingTime, endingFw);
      return;
    }
    if (screen === 'title' || screen === 'select' || screen === 'howto' || !game) {
      drawTitleScene();
      return;
    }
    const g = game, p = g.player, lvl = g.level, w = g.world;
    const camX = Math.round(g.cam.x * scale) / scale, camY = 0;
    const time = g.time;
    Render.drawBackground(ctx, lvl.theme, camX, camY, vw, vh, time, g.fw);
    ctx.save();
    ctx.translate(-camX, -camY);
    for (const m of w.movers) Render.drawMoverPath(ctx, m);
    Render.drawLevel(ctx, lvl, camX, camY, vw, vh, time);
    w.yoyos.forEach((y, i) => Render.drawYoyo(ctx, y, i, time));
    lvl.checkpoints.forEach((c, i) => Render.drawCheckpoint(ctx, c, i <= g.cp, time));
    Render.drawGoal(ctx, lvl.goal, p.won, time);
    lvl.melons.forEach((m, i) => { if (!g.melonGot[i] && m.x > camX - 40 && m.x < camX + vw + 40) Render.drawMelon(ctx, m.x, m.y, time); });
    for (const m of w.movers) Render.drawMover(ctx, m);
    for (const e of w.enemies) {
      if (e.x < camX - 60 || e.x > camX + vw + 60) continue;
      if (!e.alive && e.deadT > 0.4) continue;
      Render.drawEnemy(ctx, e, time);
    }
    // 主人公
    const anim = { t: time, walk: g.walk, blink: (time % 3.3) < 0.12, state: 'idle' };
    let px = p.x + p.w / 2, py = p.y + p.h;
    if (p.dead) {
      anim.state = 'dead';
      if (g.deathAnim && !g.deathAnim.fall) { px = g.deathAnim.x; py = g.deathAnim.y; }
    } else if (p.won) anim.state = 'win';
    else if (!p.onGround) anim.state = p.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(p.vx) > 15) anim.state = 'walk';
    const blinkHide = p.invuln > 0 && Math.floor(time * 16) % 2 === 0;
    if (!(p.dead && g.deathAnim && g.deathAnim.fall) && !blinkHide) Render.drawPlayer(ctx, px, py, p.face, anim);
    // パーティクル
    for (const q of g.particles) {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.col;
      if (q.kind === 'dust') Render.circle(ctx, q.x, q.y, 3 + (1 - q.life / q.max) * 3);
      else drawStar(q.x, q.y, 4);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawStar(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  let titleLevel = null;
  function drawTitleScene() {
    if (!titleLevel) titleLevel = Engine.parseStage(STAGES[0], 0);
    const camX = (titleTime * 18) % 900;
    Render.drawBackground(ctx, 'home', camX, 0, vw, vh, titleTime);
    ctx.save();
    ctx.translate(-camX, 0);
    // 地面だけ描く(タイトル用)
    for (let tx = Math.floor(camX / T); tx <= (camX + vw) / T + 1; tx++) {
      ctx.fillStyle = '#c58a55'; ctx.fillRect(tx * T, 11 * T, T + 0.5, 3 * T);
      ctx.fillStyle = '#74c64b'; ctx.fillRect(tx * T, 11 * T, T + 0.5, 8);
      ctx.fillStyle = '#a3e36f'; ctx.fillRect(tx * T, 11 * T, T + 0.5, 3);
    }
    ctx.restore();
    Render.drawPlayer(ctx, vw * 0.16, 11 * T, 1, { state: 'walk', t: titleTime, walk: titleTime * 9, blink: (titleTime % 3) < 0.12 });
    Render.drawMelon(ctx, vw * 0.16 + 70, 11 * T - 40, titleTime);
  }

  // ===== メインループ =====
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // タブ復帰などで飛ばない
    if (!frozen) {
      acc += dt;
      while (acc >= STEP) { update(STEP); acc -= STEP; }
    }
    render();
    requestAnimationFrame(frame);
  }

  // ===== 一時停止 =====
  function pause() {
    if (screen !== 'play') return;
    Sound.play('pause');
    setScreen('pause');
  }
  function resume() {
    if (screen !== 'pause') return;
    if (isPortraitBlocked()) return;
    setScreen('play');
  }

  // ===== 縦持ち案内 =====
  function isPortraitBlocked() {
    return isTouch && window.innerHeight > window.innerWidth;
  }
  function checkOrientation() {
    const block = isPortraitBlocked();
    $('scr-rotate').hidden = !block;
    if (block && screen === 'play') pause();
  }

  // ===== ボタン =====
  function bind(id, fn) {
    $(id).addEventListener('click', (e) => { e.preventDefault(); firstTouch(); fn(); });
  }
  bind('btn-continue', () => { Sound.play('select'); const r = save.resume; startStage(r.stage, r.cp); });
  bind('btn-new', () => { Sound.play('select'); startStage(0, -1); });
  bind('btn-select', () => { Sound.play('select'); setScreen('select'); });
  bind('btn-howto', () => { Sound.play('select'); setScreen('howto'); });
  bind('btn-howto-back', () => { Sound.play('select'); setScreen('title'); });
  bind('btn-select-back', () => { Sound.play('select'); setScreen('title'); });
  bind('btn-reset', () => {
    if (window.confirm('クリアの記録とスイカの記録をけしますか?')) {
      const muted = save.muted;
      save = defaultSave();
      save.muted = muted;
      writeSave();
      buildSelect();
    }
  });
  bind('btn-pause', pause);
  bind('btn-mute', toggleMute);
  bind('btn-mute-title', toggleMute);
  bind('btn-resume', () => { Sound.play('select'); resume(); });
  bind('btn-retry', () => { Sound.play('select'); startStage(game.index, -1); });
  bind('btn-pause-select', () => { Sound.play('select'); hideBanner(); setScreen('select'); });
  bind('btn-pause-title', () => { Sound.play('select'); hideBanner(); setScreen('title'); });
  bind('btn-next', () => { Sound.play('select'); startStage(game.index + 1, -1); });
  bind('btn-clear-select', () => { Sound.play('select'); setScreen('select'); });
  bind('btn-ending-title', () => { Sound.play('select'); setScreen('title'); });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (screen === 'play') pause();
      else if (screen === 'pause') resume();
    } else if (e.code === 'Enter' && screen === 'clear') {
      startStage(game.index + 1, -1);
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', () => pause());

  // ページのスクロールや拡大を防ぐ
  document.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => { if (screen === 'play') e.preventDefault(); });

  Input.init($('touch'), { left: $('vb-left'), right: $('vb-right'), jump: $('vb-jump') });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();
  refreshMute();
  setScreen('title');
  requestAnimationFrame(frame);

  // ===== テスト・調整用のフック =====
  window.__take = {
    get screen() { return screen; },
    get game() { return game; },
    get save() { return save; },
    startStage, pause, resume, setScreen,
    freeze(v) { frozen = v; },
    advance(n) { for (let i = 0; i < n; i++) update(STEP); render(); },
  };
})();
