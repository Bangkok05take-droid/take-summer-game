/* 戦闘のロジック（描画・DOM に依存しない）
 *
 * - 位置は横方向の1次元（x）。**人間軍の拠点が左、魔王軍の封印の祠が右**。
 *   魔物は右から左へ（dir = -1）、人間軍は左から右へ（dir = +1）進む。
 * - 1手 = STEP 秒の固定ステップ。乱数はシード付き。同じシード・同じ操作なら同じ結果になる。
 * - 操作は queue() で積み、次の手のはじめに反映する（リプレイ・テストのため）。
 * - 描画用の出来事は events に積む（描画側が取り出して消す）。
 *
 * ユニットの定義（js/data/units.js・humans.js）で使う項目
 *   target('front'|'backline') line('front'|'back')   標的の選び方・自分の位置（units.js の先頭）。射程 range とは別
 *   hp atk range speed interval windup kb attack('single'|'area') projectile size
 *   hits / hitGap         1回の攻撃で何回当てるか（2連撃など）
 *   heal { every, ratio, radius }          一定時間ごとに周りの味方を回復
 *   gamble { strong, fail, strongMult, strongRadius, failStun }   特殊魔法（確率で強い魔法・失敗）
 *   skills [{ id, every, windup, ... }]    特技（勇者・幹部）。下の useSkill を参照
 */
import { makeRng } from './rng.js';

export const STEP = 1 / 30;

export class Battle {
  constructor({ stage, deck, humanDefs, config, seed = 1, mana }) {
    this.stage = stage;
    this.config = config;
    this.humanDefs = humanDefs;
    this.rng = makeRng(seed);
    this.seed = seed;
    this.t = 0;
    this.frame = 0;
    this.result = null;          // 'win' | 'lose'
    this.events = [];
    this.commands = [];
    this.nextId = 1;
    this.entities = [];
    this.stats = { summoned: 0, kills: 0, lost: 0, manaSpent: 0, spells: 0, heroesBeaten: 0 };

    const hw = config.baseHalfWidth;
    this.base = { side: 'human', x: 110, hp: stage.baseHp, maxHp: stage.baseHp, halfWidth: hw };
    this.shrine = { side: 'demon', x: stage.length - 110, hp: stage.shrineHp, maxHp: stage.shrineHp, halfWidth: hw };

    const m = mana || stage.mana;
    this.mana = m.start;
    this.manaMax = m.max;
    this.manaRegen = m.regen;
    this.furnaceLv = 1;

    this.deck = deck; // 戦闘で使う数値に解決済みのユニット定義（key を持つ）
    this.cooldowns = Object.fromEntries(this.deck.map((d) => [d.key, 0]));
    this.spellCharge = 0;
    this.bossSwitch = 0; // 幹部が撃破されたあと、別の幹部を出せるまでの残り秒

    this.spawnState = stage.spawns.map((s) => ({ nextAt: s.start ?? 0, fired: false }));
    this.pending = []; // { at, who }
    this.spawnT = 0;
    this.inFlight = [];       // 飛んでいる最中の攻撃 { at, hits, dmg, src }
    this.pendingSpells = [];  // 飛んでいる最中の魔王の呪文 { at, cx, damage, radius }
    this.pierces = [];        // 進んでいる貫通斬撃 { x, prevX, dir, speed, dmg, hit }          // 敵の出現の時計（spawnerOff の間は進まない）
    this.spawnerOff = false;  // true：敵が出てこない（チュートリアル用）
  }

  // ---------- 向き・位置 ----------
  dirOf(side) { return side === 'demon' ? -1 : 1; }
  home(side) { return side === 'demon' ? this.shrine : this.base; }
  enemyBase(e) { return e.side === 'demon' ? this.base : this.shrine; }
  spawnX(side) { const h = this.home(side); return h.x + this.dirOf(side) * (h.halfWidth + 10); }

  // ---------- 操作 ----------
  queue(cmd) { this.commands.push(cmd); }
  deckDef(key) { return this.deck.find((d) => d.key === key); }
  aliveDemons() { let n = 0; for (const e of this.entities) if (e.side === 'demon' && e.state !== 'dead') n++; return n; }
  aliveBoss() { return this.entities.find((e) => e.side === 'demon' && e.def.unique && e.state !== 'dead') || null; }
  aliveHumans() { let n = 0; for (const e of this.entities) if (e.side === 'human' && e.state !== 'dead') n++; return n; }

  // 召喚できるか。{ ok, reason, wait?, need?, lv? }
  //  幹部（unique）：戦場の幹部は種類を問わず1体まで（'alive'＝同じ幹部が出撃中／'bossOut'＝別の幹部が出撃中）。
  //  撃破後は同じ幹部が cooldown 秒、別の幹部が bossSwitch 秒（'cooldown'）。魔力炉Lvが needFurnace 未満なら 'furnace'
  canSummon(key) {
    if (this.result) return { ok: false, reason: 'ended' };
    const d = this.deckDef(key);
    if (!d) return { ok: false, reason: 'locked' };
    if (d.unique) {
      const out = this.aliveBoss();
      if (out) return { ok: false, reason: out.key === key ? 'alive' : 'bossOut', who: out.key };
    }
    // 理由の優先：出撃中 → 出撃上限 → 再召喚待ち → 魔力炉Lv → 魔力不足
    if (this.aliveDemons() >= this.config.demonCap) return { ok: false, reason: 'cap' };
    const wait = Math.max(this.cooldowns[key] || 0, d.unique ? this.bossSwitch : 0);
    if (wait > 0) return { ok: false, reason: 'cooldown', wait };
    if (d.needFurnace && this.furnaceLv < d.needFurnace) return { ok: false, reason: 'furnace', lv: d.needFurnace };
    if (this.mana < d.cost) return { ok: false, reason: 'mana', need: d.cost - this.mana };
    return { ok: true };
  }

  furnaceCost() {
    const c = this.config.furnace.costs;
    return this.furnaceLv - 1 < c.length ? c[this.furnaceLv - 1] : null;
  }
  canUpgradeFurnace() {
    if (this.result) return { ok: false, reason: 'ended' };
    const cost = this.furnaceCost();
    if (cost == null) return { ok: false, reason: 'max' };
    if (this.mana < cost) return { ok: false, reason: 'mana', need: cost - this.mana };
    return { ok: true };
  }
  canCastSpell() {
    if (this.result) return { ok: false, reason: 'ended' };
    if (this.spellCharge < this.config.spell.charge) return { ok: false, reason: 'charging' };
    if (!this.entities.some((e) => e.side === 'human' && e.state !== 'dead')) return { ok: false, reason: 'noTarget' };
    return { ok: true };
  }

  // ---------- 1手 ----------
  step() {
    const dt = STEP;
    if (this.result) { this.commands.length = 0; return; }

    for (const c of this.commands.splice(0)) this.apply(c);

    this.mana = Math.min(this.manaMax, this.mana + this.manaRegen * dt);
    this.spellCharge = Math.min(this.config.spell.charge, this.spellCharge + dt);
    for (const k in this.cooldowns) if (this.cooldowns[k] > 0) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    if (this.bossSwitch > 0) this.bossSwitch = Math.max(0, this.bossSwitch - dt);

    // 敵の出現：spawnerOff の間は止める（チュートリアルの説明中）。止めた分だけ出現の時計も止まる
    if (!this.spawnerOff) { this.runSpawner(); this.spawnT += dt; }

    for (const e of this.entities) { e.px = e.x; this.updateEntity(e, dt); }
    if (this.pierces.length) this.stepPierces(dt);
    if (this.pendingSpells.length) {
      const due = this.pendingSpells.filter((f) => f.at <= this.t + 1e-9);
      if (due.length) { this.pendingSpells = this.pendingSpells.filter((f) => f.at > this.t + 1e-9); for (const f of due) this.landSpell(f); }
    }
    if (this.inFlight.length) { // 届いた飛び道具のダメージ
      const due = this.inFlight.filter((f) => f.at <= this.t + 1e-9);
      if (due.length) { this.inFlight = this.inFlight.filter((f) => f.at > this.t + 1e-9); for (const f of due) this.applyHits(f.hits, f.dmg, f.src); }
    }

    if (this.entities.some((e) => e.state === 'dead' && e.timer >= this.config.deathTime)) {
      this.entities = this.entities.filter((e) => !(e.state === 'dead' && e.timer >= this.config.deathTime));
    }

    this.t += dt;
    this.frame++;
    if (this.base.hp <= 0) this.finish('win');
    else if (this.shrine.hp <= 0) this.finish('lose');
  }

  finish(result) {
    this.result = result;
    this.events.push({ type: 'end', result });
  }

  apply(c) {
    if (c.type === 'summon') {
      const chk = this.canSummon(c.key);
      if (!chk.ok) { this.events.push({ type: 'denied', key: c.key, ...chk }); return; }
      const d = this.deckDef(c.key);
      this.mana -= d.cost;
      this.stats.manaSpent += d.cost;
      if (!d.unique) this.cooldowns[c.key] = d.cooldown; // 幹部は撃破されたときから数える
      this.spawn('demon', d, this.spawnX('demon'));
      this.stats.summoned++;
    } else if (c.type === 'furnace') {
      const chk = this.canUpgradeFurnace();
      if (!chk.ok) { this.events.push({ type: 'denied', key: 'furnace', ...chk }); return; }
      this.mana -= this.furnaceCost();
      this.furnaceLv++;
      this.manaMax += this.config.furnace.maxAdd;
      this.manaRegen += this.config.furnace.regenAdd;
      this.events.push({ type: 'furnace', lv: this.furnaceLv });
    } else if (c.type === 'spell') {
      const chk = this.canCastSpell();
      if (!chk.ok) { this.events.push({ type: 'denied', key: 'spell', ...chk }); return; }
      this.castSpell();
    }
  }

  spawn(side, def, x) {
    const e = {
      id: this.nextId++, side, key: def.key, def,
      dir: this.dirOf(side),
      x: x + (this.rng() - 0.5) * 14, px: x,
      lane: this.rng(),
      hp: def.hp, maxHp: def.hp,
      state: 'walk', timer: 0, hitsDone: 0, kbDone: 0,
      healTimer: 0, flash: 0, born: this.t,
      stun: 0, skillCd: {}, skill: null,
    };
    for (const s of def.skills || []) e.skillCd[s.id] = s.first ?? s.every;
    e.px = e.x;
    this.entities.push(e);
    this.events.push({ type: 'spawn', id: e.id, side, key: def.key, x: e.x, hero: !!def.hero });
    return e;
  }

  // ---------- 人間軍の出撃 ----------
  runSpawner() {
    const s = this.stage;
    const humansFull = () => this.aliveHumans() >= this.config.humanCap;
    s.spawns.forEach((row, i) => {
      const st = this.spawnState[i];
      if (row.trigger) {
        if (!st.fired && this.base.hp / this.base.maxHp <= row.trigger.baseBelow) {
          st.fired = true;
          let at = this.spawnT;
          for (const w of row.wave) for (let n = 0; n < w.count; n++) { this.pending.push({ at, who: w.who, force: !!this.humanDefs[w.who].hero }); at += row.gap || 0.6; }
          this.events.push({ type: row.hero ? 'heroAlarm' : 'alarm', who: row.hero || null, line: row.line || null });
        }
        return;
      }
      if (row.until != null && this.spawnT >= row.until) return;
      if (this.spawnT + 1e-9 < st.nextAt) return;
      const mine = this.entities.filter((e) => e.row === i && e.state !== 'dead').length;
      if (mine >= row.max || humansFull()) { st.nextAt = this.spawnT + 1; return; } // いっぱいなら1秒後に見直す
      const e = this.spawnHuman(row.who);
      e.row = i;
      st.nextAt += row.every;
      if (st.nextAt < this.spawnT) st.nextAt = this.spawnT + row.every;
    });
    if (this.pending.length) {
      const due = this.pending.filter((p) => p.at <= this.spawnT + 1e-9);
      if (due.length) {
        this.pending = this.pending.filter((p) => p.at > this.spawnT + 1e-9);
        for (const p of due) {
          if (humansFull() && !p.force) { p.at = this.spawnT + 1; this.pending.push(p); continue; } // 勇者は上限でも必ず出る
          this.spawnHuman(p.who);
        }
      }
    }
  }

  spawnHuman(who) {
    const base = this.humanDefs[who];
    const k = this.stage.enemyScale || 1;
    const def = { ...base, key: who, hp: Math.round(base.hp * k), atk: Math.round(base.atk * k) };
    return this.spawn('human', def, this.spawnX('human'));
  }

  // ---------- ユニットの動き ----------
  // 射程内の相手（近い順）。{ target, dist, isBase }。from〜to は自分の前方の距離
  targetsAhead(e, from, to) {
    const out = [];
    for (const o of this.entities) {
      if (o.side === e.side || o.state === 'dead' || o.state === 'kb') continue; // 吹き飛んでいる間は当たらない
      const dist = (o.x - e.x) * e.dir;
      if (dist >= from && dist <= to) out.push({ target: o, dist });
    }
    const b = this.enemyBase(e);
    const bd = (b.x - e.x) * e.dir - b.halfWidth;
    if (bd <= to) out.push({ target: b, dist: Math.max(0, bd), isBase: true });
    out.sort((a, c) => a.dist - c.dist);
    return out;
  }
  targetsInRange(e, extra = 0) { return this.targetsAhead(e, -12, e.def.range + extra); }

  updateEntity(e, dt) {
    const d = e.def;
    e.timer += dt;
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
    for (const k in e.skillCd) if (e.skillCd[k] > 0) e.skillCd[k] -= dt;

    if (e.state === 'dead') { e.x -= e.dir * 20 * dt; return; }

    if (e.state === 'kb') {
      const p = Math.min(1, e.timer / this.config.kbTime);
      const ease = 1 - (1 - p) * (1 - p);
      e.x = e.kbFrom + (e.kbTo - e.kbFrom) * ease;
      if (p >= 1) { e.state = 'walk'; e.timer = 0; }
      return;
    }

    // 行動妨害（気絶）：動かず攻撃もしない
    if (e.stun > 0) {
      e.stun -= dt;
      if (e.state === 'attack' || e.state === 'skill') { e.state = 'walk'; e.timer = 0; e.skill = null; }
      return;
    }

    if (d.heal) this.tickHeal(e, d.heal, dt);

    if (e.state === 'skill') {
      const s = e.skill;
      if (!s.done && e.timer >= s.windup) { s.done = true; this.useSkill(e, s); }
      if (e.dash) { // 突進の踏み込み：決まった距離を dashTime 秒で進む（瞬間移動しない）
        const step = Math.min(e.dash.left, e.dash.speed * dt); e.x += e.dir * step; e.dash.left -= step;
        if (e.dash.left <= 1e-6) e.dash = null;
      }
      if (e.timer >= s.windup + (s.recover ?? 0.5)) { e.dash = null; e.state = 'walk'; e.timer = 0; e.skill = null; }
      return;
    }

    if (e.state === 'attack') {
      const hits = d.hits || 1;
      const at = d.windup + e.hitsDone * (d.hitGap || 0.2);
      if (e.hitsDone < hits && e.timer >= at) { e.hitsDone++; this.resolveAttack(e); }
      if (e.timer >= d.interval) { e.state = 'walk'; e.timer = 0; }
      return;
    }

    // 特技（たまっていて、使える相手がいれば攻撃より優先）
    for (const s of d.skills || []) {
      if (e.skillCd[s.id] > 0) continue;
      if (!this.skillReady(e, s)) continue;
      e.skillCd[s.id] = s.every;
      e.state = 'skill'; e.timer = 0; e.skill = { ...s, done: false };
      this.events.push({ type: 'skillStart', id: e.id, skill: s.id, side: e.side, x: e.x, name: s.name });
      return;
    }

    // 射程に相手がいれば攻撃を始める。いなければ前進
    // stopRange（後衛狙撃）：前衛の敵は stopRange で止まり、狙える後衛・拠点は range まで届けば止まる
    const engage = d.stopRange
      ? this.targetsAhead(e, -12, d.stopRange).length > 0 || this.backlineTargets(this.targetsInRange(e)).length > 0
      : this.targetsInRange(e).length > 0;
    if (engage) {
      e.state = 'attack'; e.timer = 0; e.hitsDone = 0;
      this.events.push({ type: 'windup', id: e.id });
      return;
    }
    if (d.speed > 0) {
      e.x += e.dir * d.speed * dt;
      const b = this.enemyBase(e);
      const limit = b.x - e.dir * b.halfWidth;
      if ((limit - e.x) * e.dir < 0) e.x = limit;
    }
  }

  tickHeal(e, h, dt) {
    e.healTimer += dt;
    if (e.healTimer < h.every) return;
    const hurt = this.entities.filter((o) => o.side === e.side && o.state !== 'dead' && o.hp < o.maxHp && Math.abs(o.x - e.x) <= h.radius);
    if (!hurt.length) return;
    e.healTimer = 0;
    this.events.push({ type: 'healCast', id: e.id, x: e.x, radius: h.radius, side: e.side });
    for (const o of hurt) this.healUnit(o, Math.round(o.maxHp * h.ratio), e);
  }

  healUnit(o, amt, src = null) {
    const before = o.hp;
    o.hp = Math.min(o.maxHp, o.hp + amt);
    this.events.push({ type: 'heal', id: o.id, x: o.x, amount: Math.round(o.hp - before), side: o.side, lane: o.lane, src: src ? src.id : null, srcKey: src ? src.key : null });
  }

  // 後衛狙撃（target: 'backline'）が狙える相手：射程内の敵の後衛（line: 'back'）と敵拠点だけ。
  // 回復役 → 近い順、拠点は最後。前衛には切り替えない
  backlineTargets(list) {
    const isHealer = (o) => !!(o.def && (o.def.heal || (o.def.skills || []).some((s) => s.type === 'heal')));
    return list
      .filter((t) => t.isBase || t.target.def.line === 'back')
      .sort((a, b) => (a.isBase - b.isBase) || (isHealer(b.target) - isHealer(a.target)) || (a.dist - b.dist));
  }

  resolveAttack(e) {
    const d = e.def;
    const all = this.targetsInRange(e, 10); // 準備のあいだに少し離れても当たる
    let list = all;
    if (d.target === 'backline') list = this.backlineTargets(all);
    if (!list.length) {
      // 空振り：攻撃の演出は続ける（飛び道具は手前に落ちる）
      this.events.push({ type: 'whiff', id: e.id, x: e.x, side: e.side });
      // 後衛狙撃の空振り：前線の敵の頭上を越えて、射程いっぱいの後ろの地面に落ちる（誰にも当たらない）
      const over = d.target === 'backline';
      // 落ちる所：射程内でいちばん奥の敵のさらに後ろ（射程いっぱいまで）
      const far = all.filter((t) => !t.isBase).reduce((m, t) => Math.max(m, t.dist), 0);
      const land = over ? Math.min(d.range, far + 40) : d.range * 0.6;
      if (d.projectile) this.events.push({ type: 'shot', id: e.id, kind: d.projectile, from: e.x, to: e.x + e.dir * land, side: e.side, miss: true, over, delay: over && d.flight ? d.flight[1] : 0 });
      this.events.push({ type: 'strike', id: e.id, area: false, side: e.side });
      return;
    }

    // 特殊魔法：確率で強い魔法・失敗
    let mult = 1; let area = d.attack === 'area'; let radius = 0;
    if (d.gamble) {
      const r = this.rng();
      if (r < d.gamble.fail) {
        e.stun = d.gamble.failStun || 1;
        this.events.push({ type: 'fizzle', id: e.id, x: e.x, side: e.side, lane: e.lane });
        return;
      }
      if (r < d.gamble.fail + d.gamble.strong) {
        mult = d.gamble.strongMult; area = true; radius = d.gamble.strongRadius;
        this.events.push({ type: 'bigMagic', id: e.id, x: list[0].target.x, radius, side: e.side });
      }
    }

    let hits;
    if (radius) {
      // 最初の相手を中心に、半径 radius の全員
      const cx = list[0].target.x;
      hits = this.targetsAhead(e, -12, d.range + 10 + radius).filter((h) => Math.abs(h.target.x - cx) <= radius || h.isBase && Math.abs(h.dist - list[0].dist) <= radius);
    } else hits = area ? list : [list[0]];

    // flight [最短, 最長]：飛び道具が届くまでの秒数（距離で決まる）。ダメージは届いた瞬間に入る（2026-11-25）
    let delay = 0;
    if (d.flight) {
      const [lo, hi] = d.flight;
      delay = lo + (hi - lo) * Math.max(0, Math.min(1, hits[0].dist / Math.max(1, d.range)));
    }
    if (d.projectile) this.events.push({ type: 'shot', id: e.id, kind: d.projectile, from: e.x, to: hits[0].target.x, toLane: hits[0].isBase ? null : hits[0].target.lane, side: e.side, big: mult > 1, delay });
    this.events.push({ type: 'strike', id: e.id, area, side: e.side });
    // 近接の命中地点（見た目用）：攻撃した本人の ID と、最初の相手の位置
    if (!d.projectile) this.events.push({ type: 'impact', id: e.id, key: e.key, side: e.side, x: hits[0].isBase ? e.x + e.dir * hits[0].dist : hits[0].target.x, lane: hits[0].isBase ? e.lane : hits[0].target.lane });
    const dmg = Math.round(d.atk * mult);
    if (delay > 0) { this.inFlight.push({ at: this.t + delay, hits, dmg, src: e }); return; }
    this.applyHits(hits, dmg, e);
  }
  applyHits(hits, dmg, e) {
    for (const h of hits) {
      if (h.isBase) this.damageBase(h.target, dmg, e);
      else this.damageUnit(h.target, dmg, e, e.def.blowAway); // 届く前に倒れていたら damageUnit が何もしない
    }
  }

  // 貫通斬撃を進める。直前と今の位置の間（区間）にいる敵に当てる（倍速・描画の間引きで飛び越さない）
  stepPierces(dt) {
    for (const p of this.pierces) {
      p.prevX = p.x; p.x += p.dir * p.speed * dt;
      const lo = Math.min(p.prevX, p.x) - 8; const hi = Math.max(p.prevX, p.x) + 8;
      for (const o of this.entities) {
        if (o.side === p.side || o.state === 'dead' || p.hit.has(o.id)) continue;
        if (o.x < lo || o.x > hi) continue;
        p.hit.add(o.id);
        this.damageUnit(o, p.dmg, p.src, true);
        this.events.push({ type: 'pierceHit', x: o.x, lane: o.lane, big: false });
      }
      const b = p.side === 'demon' ? this.base : this.shrine;
      const face = b.x - p.dir * b.halfWidth;
      if ((p.x - face) * p.dir >= 0) {
        this.damageBase(b, p.dmg, p.src);
        this.events.push({ type: 'pierceHit', x: face, lane: 0.5, big: true });
        p.done = true;
      }
    }
    this.pierces = this.pierces.filter((p) => !p.done);
  }

  // 特技が使える状況か（前方の射程に相手がいる・回復が必要な味方がいる）
  skillReady(e, s) {
    if (s.type === 'pierce') return true; // 貫通斬撃：敵がいなくても砦に届くので、たまったら使う
    if (s.type === 'heal') return this.entities.some((o) => o.side === e.side && o.state !== 'dead' && o.hp < o.maxHp * 0.8 && Math.abs(o.x - e.x) <= s.radius);
    return this.targetsAhead(e, -12, s.trigger ?? s.reach).some((t) => !t.isBase); // trigger：この距離まで近づいてから使う
  }

  useSkill(e, s) {
    const ev = { type: 'skill', id: e.id, skill: s.id, side: e.side, x: e.x, dir: e.dir, reach: s.reach, name: s.name };
    this.events.push(ev);
    if (s.type === 'pierce') {
      // 貫通斬撃（竜人オルド）：剣先から敵の砦へ向かって進み、途中の敵すべてに1回ずつ、砦にも1回当たる（止まらない）
      this.pierces.push({ id: this.nextId++, src: e, side: e.side, dir: e.dir, x: e.x + e.dir * 30, prevX: e.x, speed: s.speed || 900, dmg: Math.round(e.def.atk * s.mult), hit: new Set(), done: false, lane: e.lane });
      return;
    }
    if (s.type === 'wave') {
      // 前方へ飛ぶ斬撃：届く範囲の全員にダメージと吹き飛ばし
      for (const t of this.targetsAhead(e, -12, s.reach)) {
        if (t.isBase) continue;
        this.damageUnit(t.target, Math.round(e.def.atk * s.mult), e, true);
      }
    } else if (s.type === 'stun') {
      for (const t of this.targetsAhead(e, -12, s.reach)) {
        if (t.isBase || t.target.state === 'dead') continue;
        t.target.stun = Math.max(t.target.stun, s.duration);
        this.events.push({ type: 'stun', id: t.target.id, x: t.target.x, lane: t.target.lane, duration: s.duration });
      }
    } else if (s.type === 'heal') {
      for (const o of this.entities) {
        if (o.side !== e.side || o.state === 'dead' || Math.abs(o.x - e.x) > s.radius) continue;
        this.healUnit(o, Math.round(o.maxHp * s.ratio));
      }
    } else if (s.type === 'charge') {
      // 突進：前方へ進みながら、通り道の敵をまとめて吹き飛ばす。
      // push があれば、当たった敵の前線を push だけ後ろへ押し下げる（強敵・押されにくい敵も下がる）
      const hitList = this.targetsAhead(e, -12, s.reach);
      ev.hitX = hitList.length ? (hitList[0].isBase ? e.x + e.dir * hitList[0].dist : hitList[0].target.x) : null; // 見た目用：最初に当たった位置（空振りは null）
      ev.hitLane = hitList.length && !hitList[0].isBase ? hitList[0].target.lane : e.lane;
      for (const t of hitList) {
        if (t.isBase) { this.damageBase(t.target, Math.round(e.def.atk * s.mult), e); continue; }
        this.damageUnit(t.target, Math.round(e.def.atk * s.mult), e, !s.push);
        if (s.push && t.target.state !== 'dead') this.knockback(t.target, Math.max(s.push, this.config.kbDistance));
      }
      const b = this.enemyBase(e);
      const limit = b.x - e.dir * (b.halfWidth + 20);
      const dist = Math.min(s.move, Math.max(0, (limit - e.x) * e.dir));
      if (s.dashTime) e.dash = { left: dist, speed: dist / s.dashTime }; else e.x += e.dir * dist;
    }
  }

  damageBase(b, dmg) {
    if (b.hp <= 0) return;
    b.hp = Math.max(0, b.hp - dmg);
    if (b.side === 'demon' && this.stage.noLose) b.hp = Math.max(1, b.hp); // 負けないステージ（チュートリアル）：祠は壊れない
    this.events.push({ type: 'baseHit', side: b.side, dmg, x: b.x });
  }

  damageUnit(o, dmg, src, forceKb = false) {
    if (o.state === 'dead') return;
    const cut = o.def.guard || 0; // 被ダメージの軽減率
    dmg = Math.max(1, Math.round(dmg * (1 - cut)));
    o.hp -= dmg;
    o.flash = 0.12;
    this.events.push({ type: 'hit', id: o.id, x: o.x, dmg, side: o.side, lane: o.lane });
    if (o.hp <= 0) { this.kill(o); return; }
    const per = o.maxHp / o.def.kb;
    const crossed = Math.floor((o.maxHp - o.hp) / per);
    const threshold = crossed > o.kbDone;
    if (threshold || forceKb) {
      o.kbDone = Math.max(o.kbDone, crossed);
      // 決まった回数のノックバックは満額、技による吹き飛ばしだけのときは少し短い
      this.knockback(o, threshold ? this.config.kbDistance : this.config.kbDistance * 0.6);
    }
  }

  knockback(o, dist = this.config.kbDistance) {
    if (o.def.noKbFromSmall && dist < this.config.kbDistance) return; // 勇者は小さな吹き飛ばしを受けない
    o.state = 'kb'; o.timer = 0; o.skill = null;
    o.kbFrom = o.x;
    const own = this.home(o.side);
    let to = o.x - o.dir * dist;
    const back = own.x + o.dir * (own.halfWidth + 5); // 自分の拠点より後ろへは下がらない
    if ((to - back) * o.dir < 0) to = back;
    o.kbTo = to;
    this.events.push({ type: 'kb', id: o.id, x: o.x, side: o.side });
  }

  kill(o) {
    o.hp = 0;
    o.state = 'dead'; o.timer = 0; o.stun = 0;
    this.events.push({ type: 'death', id: o.id, x: o.x, side: o.side, key: o.key, lane: o.lane, hero: !!o.def.hero });
    if (o.side === 'human') {
      this.stats.kills++;
      if (o.def.hero) this.stats.heroesBeaten++;
      if (o.def.mana) {
        this.mana = Math.min(this.manaMax, this.mana + o.def.mana);
        this.events.push({ type: 'manaGain', x: o.x, amount: o.def.mana });
      }
    } else {
      this.stats.lost++;
      if (o.def.unique) {
        if (this.cooldowns[o.key] != null) this.cooldowns[o.key] = o.def.cooldown; // 同じ幹部：撃破から cooldown 秒
        this.bossSwitch = this.config.bossSwitch || 0; // 別の幹部への切り替え待ち
      }
    }
  }

  // 魔王の呪文：人間がいちばん密集している地点を中心に、範囲ダメージと吹き飛ばし
  spellCenter() {
    const sp = this.config.spell;
    const hs = this.entities.filter((o) => o.side === 'human' && o.state !== 'dead');
    let best = null; let bestN = -1;
    for (const h of hs) {
      let n = 0; for (const o of hs) if (Math.abs(o.x - h.x) <= sp.radius) n += o.def.hero ? 3 : 1;
      // 同じ数なら祠に近い（危ない）方
      if (n > bestN || (n === bestN && h.x > best)) { bestN = n; best = h.x; }
    }
    return best;
  }

  // 2026-11-25：祠の上で炎をため（charge 秒）→ 不死鳥が密集地点へ飛び（距離で flight 秒）→ 着いた瞬間にダメージ。
  //   当たる範囲は着いた時点で、狙った地点 x から radius 以内の人間軍
  castSpell() {
    const sp = this.config.spell;
    const cx = this.spellCenter();
    this.spellCharge = 0;
    this.stats.spells++;
    const charge = sp.fxCharge ?? 0.2;
    const [lo, hi] = sp.fxFlight || [0.28, 0.4];
    const flight = lo + (hi - lo) * Math.max(0, Math.min(1, (this.shrine.x - cx) / Math.max(1, this.stage.length)));
    const delay = charge + flight;
    this.events.push({ type: 'spell', x: cx, radius: sp.radius, charge, flight, delay });
    this.pendingSpells.push({ at: this.t + delay, cx, damage: sp.damage, radius: sp.radius });
  }
  landSpell(s) {
    this.events.push({ type: 'spellHit', x: s.cx, radius: s.radius });
    for (const o of this.entities) {
      if (o.side !== 'human' || o.state === 'dead') continue;
      if (Math.abs(o.x - s.cx) > s.radius) continue;
      if (o.spellImmune) { this.events.push({ type: 'immune', id: o.id, x: o.x, lane: o.lane }); continue; } // 呪文が効かない（壊滅した町の初戦のオルド）
      this.damageUnit(o, s.damage, null, true);
    }
  }

  // テスト・リプレイ用の状態の要約
  snapshot() {
    return {
      t: Math.round(this.t * 1000) / 1000,
      mana: Math.round(this.mana * 100) / 100,
      shrine: this.shrine.hp, base: this.base.hp, result: this.result,
      units: this.entities.map((e) => [e.id, e.side, e.key, Math.round(e.x * 100) / 100, Math.round(e.hp), e.state]),
    };
  }
}

export function createBattle(opts) { return new Battle(opts); }
