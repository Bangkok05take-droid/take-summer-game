/*
 * engine.js — ゲームの物理・当たり判定・ステージ読み込み
 * 描画や DOM に依存しないので、ブラウザでも Node(tools/check-stages.js)でも動きます。
 */
(function (root) {
  'use strict';

  const TILE = 32;
  const VIEW_ROWS = 14; // 画面の縦に表示するタイル数

  // ===== 操作感の調整はここ =====
  const PHYS = {
    runSpeed: 170,        // ふつうの走る速さ (px/秒)。何も押さなくても自動で右へ走る
    dashSpeed: 255,       // ダッシュ中の最高速度 (ふつうの 1.5 倍)
    runAccel: 900,        // 走り出しの加速
    dashAccel: 420,       // ダッシュの加速 (小さいほどなめらか)
    dashDecel: 420,       // ダッシュをやめたときに元の速さへ戻る減速
    jumpSpeed: 650,       // ジャンプの初速 (大きいほど高く跳ぶ)
    jumpCut: 250,         // ボタンを離したときに残る上昇速度 (小さいほど小ジャンプが低い)
    gravityUp: 1900,
    gravityDown: 2400,    // 落下時の重力 (大きいほどストンと落ちる)
    maxFall: 760,
    coyoteTime: 0.10,     // 足場を離れてもジャンプできる猶予 (秒)
    jumpBuffer: 0.13,     // 着地前のジャンプ入力を覚えておく時間 (秒)
    stompBounce: 420,     // 敵を踏んだときの跳ね返り
    stompBounceHeld: 640, // 踏んだときジャンプを押していた場合
    startHold: 0.5,       // スタート・復帰直後に立ち止まる時間 (秒)
    respawnSafe: 1.0,     // 復帰直後にダメージを受けない時間 (秒)
    guardTime: 2.0,       // 大人→少年に戻った直後にダメージを受けない時間 (秒)
    killsToAdult: 3,      // 大人に変身するまでに踏む敵の数
    melonsToStar: 5,      // 無敵になるまでに集めるスイカの数
    starTime: 8,          // 無敵の時間 (秒)
  };

  const PLAYER_W = 20;
  const PLAYER_H = 30;

  // タイルの性質
  const SOLID = { '#': 1, 'B': 1 };
  const ONEWAY = { '-': 1 };
  const HAZARD = { '~': 1, '^': 1 };

  // ===== ステージ読み込み =====
  // def.chunks: 文字列配列の配列。各チャンクは下揃えで横に連結されます。
  function buildRows(def) {
    const rows = [];
    for (let r = 0; r < VIEW_ROWS; r++) rows.push('');
    def.chunks.forEach((chunk, ci) => {
      if (chunk.length > VIEW_ROWS) throw new Error(`${def.name}: チャンク${ci} の行数が多すぎます`);
      const w = chunk[0].length;
      chunk.forEach((line, li) => {
        if (line.length !== w) {
          throw new Error(`${def.name}: チャンク${ci} の ${li + 1} 行目の幅が ${line.length} です (${w} であるべき)`);
        }
      });
      const pad = VIEW_ROWS - chunk.length;
      for (let r = 0; r < VIEW_ROWS; r++) {
        rows[r] += r < pad ? '.'.repeat(w) : chunk[r - pad];
      }
    });
    return rows;
  }

  function parseStage(def, index) {
    const rows = buildRows(def);
    const h = rows.length;
    const w = rows[0].length;
    const grid = rows.map((r) => r.split(''));
    const level = {
      index, def, name: def.name, theme: def.theme, w, h, grid,
      spawn: null, checkpoints: [], goal: null, melons: [], enemies: [], movers: [], yoyos: [],
    };
    const enemySpeed = def.enemySpeed || 40;
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const c = grid[ty][tx];
        const px = tx * TILE;
        const py = ty * TILE;
        let clear = true;
        if (c === 'P') {
          level.spawn = { x: px + (TILE - PLAYER_W) / 2, y: py + TILE - PLAYER_H };
        } else if (c === 'C') {
          level.checkpoints.push({ tx, ty, x: px, y: py, spawn: { x: px + (TILE - PLAYER_W) / 2, y: py + TILE - PLAYER_H } });
        } else if (c === 'G') {
          level.goal = { tx, ty, x: px + TILE / 2, y: py + TILE };
        } else if (c === 'o') {
          level.melons.push({ x: px + TILE / 2, y: py + TILE / 2 });
        } else if (c === 'k') {
          level.enemies.push({ type: 'walker', x0: px + 3, y0: py + TILE - 22, w: 26, h: 22, speed: enemySpeed });
        } else if (c === 'f' || c === 'F') {
          level.enemies.push({
            type: c === 'f' ? 'flyV' : 'flyH', x0: px + 4, y0: py + 5, w: 24, h: 22,
            amp: (c === 'f' ? 1.3 : 2.2) * TILE, period: c === 'f' ? 2.6 : 3.4, phase: (tx * 0.7) % 6.28,
          });
        } else if (c === 'y' || c === 'Y') {
          const y = def.yoyo || {};
          level.yoyos.push({
            ax: px + TILE / 2, ay: py, min: (y.min != null ? y.min : 1) * TILE, max: (y.max != null ? y.max : 6) * TILE,
            period: y.period || 2.4, phase: c === 'Y' ? Math.PI : 0, r: 13,
          });
        } else if (c >= '1' && c <= '9') {
          const md = (def.movers || {})[c];
          if (!md) throw new Error(`${def.name}: 動く足場 ${c} の設定がありません`);
          level.movers.push({
            x0: px, y0: py, w: (md.w || 3) * TILE, h: 14, dx: (md.dx || 0) * TILE, dy: (md.dy || 0) * TILE,
            period: md.t || 4, phase: md.phase || 0,
          });
        } else {
          clear = false;
        }
        if (clear) grid[ty][tx] = '.';
      }
    }
    if (!level.spawn) throw new Error(`${def.name}: スタート地点 P がありません`);
    if (!level.goal) throw new Error(`${def.name}: ゴール G がありません`);
    level.checkpoints.sort((a, b) => a.x - b.x);
    return level;
  }

  function tileAt(level, tx, ty) {
    if (tx < 0 || tx >= level.w) return '#';
    if (ty < 0 || ty >= level.h) return '.';
    return level.grid[ty][tx];
  }
  function isSolid(level, tx, ty) { return !!SOLID[tileAt(level, tx, ty)]; }
  function isGroundFor(level, tx, ty) {
    const c = tileAt(level, tx, ty);
    return !!SOLID[c] || !!ONEWAY[c];
  }

  // ===== ワールド (敵・動く足場など、時間で動くもの) =====
  function createWorld(level) {
    const world = { level, t: 0, enemies: [], movers: [], yoyos: [], immortalEnemies: false };
    world.enemies = level.enemies.map((e) => ({
      type: e.type, x: e.x0, y: e.y0, w: e.w, h: e.h, x0: e.x0, y0: e.y0,
      vx: e.type === 'walker' ? -e.speed : 0, speed: e.speed, amp: e.amp, period: e.period, phase: e.phase,
      alive: true, deadT: 0, face: -1,
    }));
    world.movers = level.movers.map((m) => Object.assign({ x: m.x0, y: m.y0, px: m.x0, py: m.y0 }, m));
    world.yoyos = level.yoyos.map((y) => Object.assign({ bx: y.ax, by: y.ay + y.min }, y));
    stepWorld(world, 0);
    return world;
  }

  function stepWorld(world, dt) {
    const level = world.level;
    world.t += dt;
    const t = world.t;
    for (const m of world.movers) {
      m.px = m.x; m.py = m.y;
      const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / m.period + m.phase);
      m.x = m.x0 + m.dx * k;
      m.y = m.y0 + m.dy * k;
    }
    for (const y of world.yoyos) {
      const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / y.period + y.phase);
      y.bx = y.ax;
      y.by = y.ay + y.min + (y.max - y.min) * k;
    }
    for (const e of world.enemies) {
      if (!e.alive) { e.deadT += dt; continue; }
      if (e.type === 'walker') {
        const dir = Math.sign(e.vx) || -1;
        e.face = dir;
        const nx = e.x + e.vx * dt;
        const lead = dir > 0 ? nx + e.w : nx;
        const ltx = Math.floor(lead / TILE);
        const footTy = Math.floor((e.y + e.h - 1) / TILE);
        const blocked = isSolid(level, ltx, footTy) || HAZARD[tileAt(level, ltx, footTy)];
        const ledge = !isGroundFor(level, ltx, footTy + 1);
        if (blocked || ledge) e.vx = -e.vx;
        else e.x = nx;
      } else if (e.type === 'flyV') {
        e.y = e.y0 + e.amp * Math.sin((2 * Math.PI * t) / e.period + e.phase);
        e.face = -1;
      } else if (e.type === 'flyH') {
        const s = Math.sin((2 * Math.PI * t) / e.period + e.phase);
        e.face = Math.cos((2 * Math.PI * t) / e.period + e.phase) >= 0 ? 1 : -1;
        e.x = e.x0 + e.amp * s;
      }
    }
  }

  // ===== プレイヤー =====
  function createPlayer(spawn) {
    return {
      x: spawn.x, y: spawn.y, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0,
      onGround: false, mover: null, coyote: 0, buffer: 0, jumping: false, jumpHeld: false,
      face: 1, dead: false, won: false, checkpoint: -1,
      hold: PHYS.startHold,   // スタート直後は少しだけ立ち止まる(心の準備)
      form: 'boy',            // 'boy' | 'adult'
      kills: 0,               // 大人までのカウント(少年のときだけ貯まる)
      melons: 0,              // 無敵までのカウント
      starT: 0,               // 無敵の残り時間
      hurtT: 0,               // ダメージを受けない残り時間(大人→少年に戻った直後など)
      noPowers: false,        // true なら変身・無敵なし(自動チェック用)
    };
  }

  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function moveX(p, level, dx) {
    p.x += dx;
    const top = Math.floor(p.y / TILE);
    const bot = Math.floor((p.y + p.h - 0.01) / TILE);
    if (dx > 0) {
      const tx = Math.floor((p.x + p.w) / TILE);
      for (let ty = top; ty <= bot; ty++) {
        if (isSolid(level, tx, ty)) { p.x = tx * TILE - p.w; p.vx = Math.min(p.vx, PHYS.runSpeed * 0.5); break; }
      }
    } else if (dx < 0) {
      const tx = Math.floor(p.x / TILE);
      for (let ty = top; ty <= bot; ty++) {
        if (isSolid(level, tx, ty)) { p.x = (tx + 1) * TILE; break; }
      }
    }
  }

  // 戻り値: 着地したか
  function moveY(p, level, dy) {
    const prevBottom = p.y + p.h;
    p.y += dy;
    const left = Math.floor(p.x / TILE);
    const right = Math.floor((p.x + p.w - 0.01) / TILE);
    if (dy > 0) {
      const ty = Math.floor((p.y + p.h) / TILE);
      const tileTop = ty * TILE;
      for (let tx = left; tx <= right; tx++) {
        const c = tileAt(level, tx, ty);
        if (SOLID[c] || (ONEWAY[c] && prevBottom <= tileTop + 0.01)) {
          p.y = tileTop - p.h; p.vy = 0;
          return true;
        }
      }
    } else if (dy < 0) {
      const ty = Math.floor(p.y / TILE);
      for (let tx = left; tx <= right; tx++) {
        if (isSolid(level, tx, ty)) {
          p.y = (ty + 1) * TILE; p.vy = 0; p.jumping = false;
          break;
        }
      }
    }
    return false;
  }

  // 敵・トゲなどに当たったとき。戻り値 true ならミス
  function takeDamage(p, events, cause) {
    if (p.starT > 0 || p.hurtT > 0) return false;
    if (p.form === 'adult') {
      p.form = 'boy';
      p.kills = 0;
      p.hurtT = PHYS.guardTime;
      events.push({ type: 'powerdown', cause });
      return false;
    }
    kill(p, events, cause);
    return true;
  }

  /*
   * プレイヤーを dt 秒進める。自動で右に走ります。
   * input: { dash, jump } (押されているかどうか)
   * events: 起きたことを文字列/オブジェクトで push する配列
   */
  function stepPlayer(p, input, world, dt, events) {
    if (p.dead) return;
    if (p.won) {
      // ゴール後は、空中にいたら地面に降りるだけ
      p.vx = 0;
      p.vy = Math.min(PHYS.maxFall, p.vy + PHYS.gravityDown * dt);
      p.onGround = moveY(p, world.level, p.vy * dt);
      return;
    }
    const level = world.level;
    const P = PHYS;
    p.prevBottom = p.y + p.h;

    // ジャンプ入力 (押した瞬間を記憶しておく = 先行入力)
    if (input.jump && !p.jumpHeld) p.buffer = P.jumpBuffer;
    p.jumpHeld = !!input.jump;
    if (p.hurtT > 0) p.hurtT = Math.max(0, p.hurtT - dt);
    if (p.starT > 0) {
      p.starT -= dt;
      if (p.starT <= 0) { p.starT = 0; events.push('starEnd'); }
    }

    // 自動で右へ走る。ダッシュ中は最高 1.5 倍までなめらかに加速
    p.face = 1;
    if (p.hold > 0) {
      p.hold -= dt;
      p.vx = 0;
      p.buffer = 0;
    } else {
      const target = input.dash ? P.dashSpeed : P.runSpeed;
      if (p.vx < P.runSpeed) p.vx = Math.min(target, p.vx + P.runAccel * dt);
      else if (p.vx < target) p.vx = Math.min(target, p.vx + P.dashAccel * dt);
      else if (p.vx > target) p.vx = Math.max(target, p.vx - P.dashDecel * dt);
    }
    p.dashing = !!input.dash && p.hold <= 0;

    // 動く足場に乗っている分の移動
    let carryX = 0, carryY = 0;
    if (p.mover) { carryX = p.mover.x - p.mover.px; carryY = p.mover.y - p.mover.py; }

    // コヨーテタイム & ジャンプ
    if (p.onGround) p.coyote = P.coyoteTime; else p.coyote -= dt;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -P.jumpSpeed;
      p.jumping = true;
      p.onGround = false;
      p.mover = null;
      p.coyote = 0;
      p.buffer = 0;
      events.push('jump');
    }
    p.buffer = Math.max(0, p.buffer - dt);
    if (p.jumping && !p.jumpHeld && p.vy < -P.jumpCut) p.vy = -P.jumpCut;
    if (p.vy >= 0) p.jumping = false;

    p.vy = Math.min(P.maxFall, p.vy + (p.vy < 0 ? P.gravityUp : P.gravityDown) * dt);

    moveX(p, level, p.vx * dt + carryX);
    if (p.mover) p.y += carryY;
    const startBottom = p.y + p.h;
    let landed = moveY(p, level, p.vy * dt);
    let newMover = null;
    if (!landed && p.vy >= 0) {
      for (const m of world.movers) {
        const bottom = p.y + p.h;
        if (p.x + p.w > m.x + 1 && p.x < m.x + m.w - 1 &&
            startBottom <= Math.max(m.y, m.py) + 4 && bottom >= m.y) {
          p.y = m.y - p.h; p.vy = 0; landed = true; newMover = m;
          break;
        }
      }
    }
    if (landed && !p.onGround) events.push('land');
    p.onGround = landed;
    p.mover = newMover;

    // 当たり判定は見た目より少し小さめ (やさしめ)
    const hx = p.x + 3, hy = p.y + 5, hw = p.w - 6, hh = p.h - 7;

    // 落下(穴・水)は、大人でも無敵でもミス
    if (p.y > level.h * TILE + 40) { kill(p, events, 'fall'); return; }

    const tx0 = Math.floor(hx / TILE), tx1 = Math.floor((hx + hw) / TILE);
    const ty0 = Math.floor(hy / TILE), ty1 = Math.floor((hy + hh) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const c = tileAt(level, tx, ty);
        if (c === '~' && overlap(hx, hy, hw, hh, tx * TILE, ty * TILE + 12, TILE, 20)) { kill(p, events, 'water'); return; }
        if (c === '^' && overlap(hx, hy, hw, hh, tx * TILE + 7, ty * TILE + 13, 18, 19)) {
          if (takeDamage(p, events, 'spike')) return;
        }
      }
    }

    // 敵
    for (const e of world.enemies) {
      if (!e.alive) continue;
      if (!overlap(p.x + 1, p.y + 2, p.w - 2, p.h - 2, e.x + 2, e.y + 3, e.w - 4, e.h - 4)) continue;
      const stomp = p.vy > 0 && p.prevBottom <= e.y + e.h * 0.6;
      if (p.starT > 0) {
        // 無敵中はどこからぶつかっても倒せる(大人へのカウントには入らない)
        if (!world.immortalEnemies) { e.alive = false; e.deadT = 0; }
        if (stomp) { p.vy = -(p.jumpHeld ? P.stompBounceHeld : P.stompBounce); p.jumping = p.jumpHeld; }
        events.push({ type: 'stomp', enemy: e, star: true });
        continue;
      }
      if (stomp) {
        p.vy = -(p.jumpHeld ? P.stompBounceHeld : P.stompBounce);
        p.jumping = p.jumpHeld;
        p.y = Math.min(p.y, e.y - p.h + 2);
        if (!world.immortalEnemies) { e.alive = false; e.deadT = 0; }
        events.push({ type: 'stomp', enemy: e });
        if (p.form === 'boy' && !p.noPowers) {
          p.kills++;
          if (p.kills >= P.killsToAdult) {
            p.form = 'adult';
            p.kills = 0;
            events.push('transform');
          }
        }
      } else if (takeDamage(p, events, 'enemy')) {
        return;
      }
    }

    // ヨーヨー(上下に動く障害物)
    for (const y of world.yoyos) {
      const cx = Math.max(hx, Math.min(y.bx, hx + hw));
      const cy = Math.max(hy, Math.min(y.by, hy + hh));
      const r = y.r - 2;
      if ((cx - y.bx) ** 2 + (cy - y.by) ** 2 < r * r) {
        if (takeDamage(p, events, 'yoyo')) return;
      }
    }

    // スイカ
    const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    if (world.melonGot) {
      level.melons.forEach((m, i) => {
        if (!world.melonGot[i] && Math.abs(m.x - pcx) < 22 && Math.abs(m.y - pcy) < 26) {
          world.melonGot[i] = true;
          let star = false;
          // 無敵中に取ったものはスコアだけ(カウントも延長もしない)
          if (p.starT <= 0 && !p.noPowers) {
            p.melons++;
            if (p.melons >= P.melonsToStar) {
              p.melons = 0;
              p.starT = P.starTime;
              star = true;
            }
          }
          events.push({ type: 'melon', index: i });
          if (star) events.push('star');
        }
      });
    }

    // チェックポイント
    level.checkpoints.forEach((c, i) => {
      if (i > p.checkpoint && pcx >= c.x && pcx <= c.x + TILE * 3 && p.y + p.h > c.y - TILE * 4) {
        p.checkpoint = i;
        events.push({ type: 'checkpoint', index: i });
      }
    });

    // ゴール(サイちゃん)
    if (p.x + p.w >= level.goal.x - 6) {
      p.won = true;
      p.vx = 0;
      events.push('goal');
    }
  }

  function kill(p, events, cause) {
    p.dead = true;
    events.push({ type: 'die', cause });
  }

  const Engine = {
    TILE, VIEW_ROWS, PHYS, PLAYER_W, PLAYER_H, SOLID, ONEWAY, HAZARD, takeDamage,
    parseStage, tileAt, isSolid, createWorld, stepWorld, createPlayer, stepPlayer,
  };
  root.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
