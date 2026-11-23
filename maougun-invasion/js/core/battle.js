/* 戦闘のロジック（描画・DOM に依存しない）
 *
 * - 位置は横方向の1次元（x）。魔王軍は左（祠）から右へ、人間軍は右（拠点）から左へ進む。
 * - 1手 = STEP 秒の固定ステップ。同じシード・同じ操作なら同じ結果になる。
 * - 操作は queue() で積み、次の手のはじめに反映する（リプレイ・テストのため）。
 * - 描画用の出来事は events に積む（描画側が取り出して消す）。
 */
import { makeRng } from './rng.js';
import { resolveUnit, resolveMana } from '../data/progress.js';

export const STEP = 1 / 30;

export const REASONS = {
  mana: '魔力不足',
  cooldown: '再召喚待ち',
  cap: '出撃上限',
  alive: '出撃中',
  ended: '戦闘終了',
  locked: '未編成',
};

export class Battle {
  constructor({ stage, unitDefs, humanDefs, config, seed = 1, profile = null, deck = null }) {
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
    this.stats = { summoned: 0, kills: 0, lost: 0, manaSpent: 0, spells: 0 };

    const hw = config.baseHalfWidth;
    this.shrine = { side: 'demon', x: 120, hp: stage.shrineHp, maxHp: stage.shrineHp, halfWidth: hw };
    this.base = { side: 'human', x: stage.length - 120, hp: stage.baseHp, maxHp: stage.baseHp, halfWidth: hw };

    const m = resolveMana(stage.mana, profile);
    this.mana = m.start;
    this.manaMax = m.max;
    this.manaRegen = m.regen;
    this.furnaceLv = 1;

    this.deck = (deck || stage.deck).map((key) => resolveUnit(key, unitDefs, profile));
    this.cooldowns = Object.fromEntries(this.deck.map((d) => [d.key, 0]));
    this.spellCharge = 0;

    this.spawnState = stage.spawns.map((s) => ({ nextAt: s.start ?? 0, fired: false }));
    this.pending = []; // { at, who }
  }

  // ---------- 操作 ----------
  queue(cmd) { this.commands.push(cmd); }

  deckDef(key) { return this.deck.find((d) => d.key === key); }
  aliveDemons() { let n = 0; for (const e of this.entities) if (e.side === 'demon' && e.state !== 'dead') n++; return n; }
  aliveHumans() { let n = 0; for (const e of this.entities) if (e.side === 'human' && e.state !== 'dead') n++; return n; }

  // 召喚できるか。{ ok, reason, wait? }
  canSummon(key) {
    if (this.result) return { ok: false, reason: 'ended' };
    const d = this.deckDef(key);
    if (!d) return { ok: false, reason: 'locked' };
    if (d.unique && this.entities.some((e) => e.key === key && e.state !== 'dead')) return { ok: false, reason: 'alive' };
    // 理由の優先：出撃上限 → 再召喚待ち → 魔力不足（いちばん「待っても解決しない」ものから見せる）
    if (this.aliveDemons() >= this.config.demonCap) return { ok: false, reason: 'cap' };
    if (this.cooldowns[key] > 0) return { ok: false, reason: 'cooldown', wait: this.cooldowns[key] };
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

    this.runSpawner();

    for (const e of this.entities) { e.px = e.x; this.updateEntity(e, dt); }

    // 撃破の演出が終わったものを消す
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
      this.spawn('demon', d, this.shrine.x + this.shrine.halfWidth + 10);
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
      if (!this.canCastSpell().ok) { this.events.push({ type: 'denied', key: 'spell', reason: 'charging' }); return; }
      this.castSpell();
    }
  }

  spawn(side, def, x) {
    const e = {
      id: this.nextId++, side, key: def.key, def,
      dir: side === 'demon' ? 1 : -1,
      x: x + (this.rng() - 0.5) * 12, px: x,
      lane: this.rng(),
      hp: def.hp, maxHp: def.hp,
      state: 'walk', timer: 0, hitDone: false, kbDone: 0,
      healTimer: 0, flash: 0, born: this.t,
    };
    e.px = e.x;
    this.entities.push(e);
    this.events.push({ type: 'spawn', id: e.id, side, key: def.key, x: e.x });
    return e;
  }

  // ---------- 敵の出撃 ----------
  runSpawner() {
    const s = this.stage;
    const humansFull = () => this.aliveHumans() >= this.config.humanCap;
    s.spawns.forEach((row, i) => {
      const st = this.spawnState[i];
      if (row.trigger) {
        if (!st.fired && this.base.hp / this.base.maxHp < row.trigger.baseBelow) {
          st.fired = true;
          let at = this.t;
          for (const w of row.wave) for (let n = 0; n < w.count; n++) { this.pending.push({ at, who: w.who }); at += row.gap || 0.6; }
          this.events.push({ type: 'alarm' });
        }
        return;
      }
      if (row.until != null && this.t >= row.until) return;
      if (this.t + 1e-9 < st.nextAt) return;
      const mine = this.entities.filter((e) => e.row === i && e.state !== 'dead').length;
      if (mine >= row.max || humansFull()) { st.nextAt = this.t + 1; return; } // いっぱいなら1秒後に見直す
      const e = this.spawnHuman(row.who);
      e.row = i;
      st.nextAt += row.every;
      if (st.nextAt < this.t) st.nextAt = this.t + row.every;
    });
    if (this.pending.length) {
      const due = this.pending.filter((p) => p.at <= this.t + 1e-9);
      if (due.length) {
        this.pending = this.pending.filter((p) => p.at > this.t + 1e-9);
        for (const p of due) {
          if (humansFull()) { p.at = this.t + 1; this.pending.push(p); continue; }
          this.spawnHuman(p.who);
        }
      }
    }
  }

  spawnHuman(who) {
    const def = { ...this.humanDefs[who], key: who };
    return this.spawn('human', def, this.base.x - this.base.halfWidth - 10);
  }

  // ---------- ユニットの動き ----------
  opponents(e) { return e.side === 'demon' ? 'human' : 'demon'; }
  enemyBase(e) { return e.side === 'demon' ? this.base : this.shrine; }

  // 射程内の相手（近い順）。{ target, dist, isBase }
  targetsInRange(e, extra = 0) {
    const out = [];
    const range = e.def.range + extra;
    const opp = this.opponents(e);
    for (const o of this.entities) {
      if (o.side !== opp || o.state === 'dead' || o.state === 'kb') continue; // 吹き飛んでいる間は当たらない
      const dist = (o.x - e.x) * e.dir;
      if (dist >= -12 && dist <= range) out.push({ target: o, dist });
    }
    const b = this.enemyBase(e);
    const bd = (b.x - e.x) * e.dir - b.halfWidth;
    if (bd <= range) out.push({ target: b, dist: Math.max(0, bd), isBase: true });
    out.sort((a, c) => a.dist - c.dist);
    return out;
  }

  updateEntity(e, dt) {
    const d = e.def;
    e.timer += dt;
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);

    if (e.state === 'dead') { e.x -= e.dir * 20 * dt; return; }

    if (e.state === 'kb') {
      const p = Math.min(1, e.timer / this.config.kbTime);
      const ease = 1 - (1 - p) * (1 - p);
      e.x = e.kbFrom + (e.kbTo - e.kbFrom) * ease;
      if (p >= 1) { e.state = 'walk'; e.timer = 0; }
      return;
    }

    if (d.heal) {
      e.healTimer += dt;
      if (e.healTimer >= d.heal.every) {
        const hurt = this.entities.filter((o) => o.side === e.side && o.state !== 'dead' && o.hp < o.maxHp && Math.abs(o.x - e.x) <= d.heal.radius);
        if (hurt.length) {
          e.healTimer = 0;
          for (const o of hurt) {
            const amt = Math.round(o.maxHp * d.heal.ratio);
            o.hp = Math.min(o.maxHp, o.hp + amt);
            this.events.push({ type: 'heal', id: o.id, x: o.x, amount: amt, side: o.side });
          }
        }
      }
    }

    if (e.state === 'attack') {
      if (!e.hitDone && e.timer >= d.windup) { e.hitDone = true; this.resolveAttack(e); }
      if (e.timer >= d.interval) { e.state = 'walk'; e.timer = 0; }
      return;
    }

    // walk：射程に相手がいれば攻撃を始める。いなければ前進
    if (this.targetsInRange(e).length) {
      e.state = 'attack'; e.timer = 0; e.hitDone = false;
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

  resolveAttack(e) {
    const d = e.def;
    const list = this.targetsInRange(e, 10); // 準備のあいだに少し離れても当たる
    if (!list.length) { this.events.push({ type: 'whiff', id: e.id }); return; }
    const hits = d.attack === 'area' ? list : [list[0]];
    if (d.projectile) {
      this.events.push({ type: 'shot', id: e.id, kind: d.projectile, from: e.x, to: hits[0].target.x, side: e.side });
    }
    this.events.push({ type: 'strike', id: e.id, area: d.attack === 'area', side: e.side });
    for (const h of hits) {
      if (h.isBase) this.damageBase(h.target, d.atk, e);
      else this.damageUnit(h.target, d.atk, e);
    }
  }

  damageBase(b, dmg, src) {
    if (b.hp <= 0) return;
    b.hp = Math.max(0, b.hp - dmg);
    this.events.push({ type: 'baseHit', side: b.side, dmg, x: b.x });
  }

  damageUnit(o, dmg, src, forceKb = false) {
    if (o.state === 'dead') return;
    o.hp -= dmg;
    o.flash = 0.12;
    this.events.push({ type: 'hit', id: o.id, x: o.x, dmg, side: o.side, lane: o.lane });
    if (o.hp <= 0) { this.kill(o); return; }
    const per = o.maxHp / o.def.kb;
    const crossed = Math.floor((o.maxHp - o.hp) / per);
    if (crossed > o.kbDone || forceKb) {
      o.kbDone = Math.max(o.kbDone, crossed);
      this.knockback(o);
    }
  }

  knockback(o, dist = this.config.kbDistance) {
    o.state = 'kb'; o.timer = 0;
    o.kbFrom = o.x;
    const own = o.side === 'demon' ? this.shrine : this.base;
    let to = o.x - o.dir * dist;
    // 自分の祠・拠点より後ろへは下がらない
    const back = own.x + o.dir * (own.halfWidth + 5);
    if ((to - back) * o.dir < 0) to = back;
    o.kbTo = to;
    this.events.push({ type: 'kb', id: o.id, x: o.x, side: o.side });
  }

  kill(o) {
    o.hp = 0;
    o.state = 'dead'; o.timer = 0;
    this.events.push({ type: 'death', id: o.id, x: o.x, side: o.side, key: o.key, lane: o.lane });
    if (o.side === 'human') {
      this.stats.kills++;
      if (o.def.mana) {
        this.mana = Math.min(this.manaMax, this.mana + o.def.mana);
        this.events.push({ type: 'manaGain', x: o.x, amount: o.def.mana });
      }
    } else {
      this.stats.lost++;
      if (o.def.unique && this.cooldowns[o.key] != null) this.cooldowns[o.key] = o.def.cooldown;
    }
  }

  castSpell() {
    const sp = this.config.spell;
    this.spellCharge = 0;
    this.stats.spells++;
    const x0 = this.shrine.x + this.shrine.halfWidth;
    const x1 = x0 + sp.reach;
    this.events.push({ type: 'spell', x0, x1 });
    for (const o of this.entities) {
      if (o.side !== 'human' || o.state === 'dead') continue;
      if (o.x < x0 || o.x > x1) continue;
      this.damageUnit(o, sp.damage, null, sp.knockback); // 吹き飛び中の相手にも当たる
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
