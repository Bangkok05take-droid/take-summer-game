/* 画面の上下（DOM）：HP・魔力・召喚ボタン・魔力炉・呪文・お知らせ */
import { SKIN } from '../data/skin.js';
import { Renderer } from '../render/renderer.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(handlers) {
    this.h = handlers;
    this.slots = [];
    this.toastTimer = 0;
    $('btnFurnace').addEventListener('pointerdown', (ev) => { ev.preventDefault(); this.h.furnace(); });
    $('btnSpell').addEventListener('pointerdown', (ev) => { ev.preventDefault(); this.h.spell(); });
    $('btnSpeed').addEventListener('click', () => this.h.speed());
    $('btnPause').addEventListener('click', () => this.h.pause());
  }

  build(battle) {
    const wrap = $('slots');
    wrap.innerHTML = '';
    this.slots = battle.deck.map((d, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot';
      b.dataset.key = d.key;
      b.setAttribute('aria-label', `${SKIN.names[d.key]}を召喚（魔力${d.cost}）`);
      const cv = document.createElement('canvas'); cv.width = 144; cv.height = 120;
      const name = document.createElement('span'); name.className = 'name'; name.textContent = SKIN.names[d.key] || d.key;
      const cost = document.createElement('span'); cost.className = 'cost'; cost.textContent = d.cost;
      const cd = document.createElement('i'); cd.className = 'cd';
      const why = document.createElement('span'); why.className = 'why';
      b.append(cv, name, cost, cd, why);
      // 押した瞬間に反応させる（click の遅れをなくす）
      b.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 90);
        this.h.summon(d.key, b);
      });
      wrap.appendChild(b);
      Renderer.thumb(cv, d.key, d.size);
      return { el: b, key: d.key, def: d, cd, why, state: '' };
    });
    $('capMax').textContent = battle.config.demonCap;
  }

  update(b) {
    const pct = (v) => `scaleX(${Math.max(0, Math.min(1, v))})`;
    $('shrineBar').style.transform = pct(b.shrine.hp / b.shrine.maxHp);
    $('baseBar').style.transform = pct(b.base.hp / b.base.maxHp);
    $('shrineNum').textContent = `${Math.ceil(b.shrine.hp)} / ${b.shrine.maxHp}`;
    $('baseNum').textContent = `${Math.ceil(b.base.hp)} / ${b.base.maxHp}`;
    $('manaNum').textContent = Math.floor(b.mana);
    $('manaMax').textContent = '/' + b.manaMax;
    $('manaBar').style.transform = pct(b.mana / b.manaMax);

    const alive = b.aliveDemons();
    $('capNum').textContent = alive;
    $('cap').classList.toggle('full', alive >= b.config.demonCap);

    for (const s of this.slots) {
      const chk = b.canSummon(s.key);
      const state = chk.ok ? 'ready' : chk.reason;
      if (state !== s.state) {
        s.el.classList.remove('ready', 'mana', 'cooldown', 'cap', 'alive', 'ended');
        s.el.classList.add(state);
        s.state = state;
      }
      const w = b.cooldowns[s.key] || 0;
      s.cd.style.transform = `scaleY(${s.def.cooldown ? w / s.def.cooldown : 0})`;
      s.why.textContent = state === 'cooldown' ? `${w.toFixed(1)}秒` : state === 'mana' ? '魔力不足' : state === 'cap' ? '上限' : state === 'alive' ? '出撃中' : '';
    }

    const fc = b.furnaceCost();
    const fb = $('btnFurnace');
    $('furnaceLv').textContent = 'Lv' + b.furnaceLv;
    $('furnaceCost').textContent = fc == null ? 'MAX' : fc;
    fb.classList.toggle('max', fc == null);
    fb.classList.toggle('ok', fc != null && b.mana >= fc);
    fb.classList.toggle('no', fc != null && b.mana < fc);

    const sp = b.config.spell;
    const r = b.spellCharge / sp.charge;
    $('spellFill').style.transform = `scaleY(${r})`;
    $('spellPct').textContent = r >= 1 ? '発動！' : Math.floor(r * 100) + '%';
    $('btnSpell').classList.toggle('full', r >= 1);

    if (this.toastTimer > 0) {
      this.toastTimer -= 1 / 60;
      if (this.toastTimer <= 0) $('toast').classList.remove('show');
    }
  }

  setSpeed(v) { const el = $('btnSpeed'); el.textContent = '×' + v; el.classList.toggle('on', v > 1); }

  toast(text, info = false) {
    const t = $('toast');
    t.textContent = text;
    t.classList.toggle('info', info);
    t.classList.add('show');
    this.toastTimer = 1.4;
  }

  deny(key) {
    const s = this.slots.find((x) => x.key === key);
    if (!s) return;
    s.el.classList.remove('deny'); void s.el.offsetWidth; s.el.classList.add('deny');
  }
}

export function reasonText(chk, cap) {
  switch (chk.reason) {
    case 'mana': return `魔力が足りません（あと ${Math.ceil(chk.need)}）`;
    case 'cooldown': return `再召喚まで あと ${chk.wait.toFixed(1)} 秒`;
    case 'cap': return `出撃上限です（同時に ${cap} 体まで）`;
    case 'alive': return '出撃中です（同じ幹部は同時に1体まで）';
    case 'charging': return '魔王の呪文はまだたまっていません';
    case 'max': return '魔力炉は最大です';
    case 'ended': return '戦闘は終わりました';
    default: return '召喚できません';
  }
}
