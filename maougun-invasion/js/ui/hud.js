/* 戦闘画面の上下（DOM）：HP・魔力・召喚カード・魔力炉・呪文・お知らせ */
import { SKIN } from '../data/skin.js';
import { Renderer } from '../render/renderer.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(handlers) {
    this.h = handlers;
    this.slots = [];
    this.toastUntil = 0;
    const tap = (id, fn) => $(id).addEventListener('pointerdown', (ev) => { ev.preventDefault(); fn(); });
    tap('btnFurnace', () => this.h.furnace());
    tap('btnSpell', () => this.h.spell());
    $('btnX1').addEventListener('click', () => this.h.speed(1));
    $('btnX2').addEventListener('click', () => this.h.speed(2));
    $('btnPause').addEventListener('click', () => this.h.pause());
  }

  build(battle, stage) {
    $('tagChap').textContent = `第${stage.chapter}章 はじまりの村を侵略せよ`;
    $('tagStage').textContent = `${stage.id}　${stage.name}`;
    const wrap = $('slots');
    wrap.innerHTML = '';
    this.slots = battle.deck.map((d, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'slot' + (d.unique ? ' boss' : '');
      b.dataset.key = d.key;
      b.setAttribute('aria-label', `${SKIN.names[d.key]}を召喚（魔力${d.cost}）キー${i + 1}`);
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 108;
      const name = document.createElement('span'); name.className = 'name'; name.textContent = SKIN.names[d.key] || d.key;
      const cost = document.createElement('span'); cost.className = 'cost'; cost.textContent = d.cost;
      const cd = document.createElement('i'); cd.className = 'cd';
      const why = document.createElement('span'); why.className = 'why';
      b.append(cv, name, cost, cd, why);
      // 押した瞬間に反応させる（click の遅れをなくす）
      b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); this.press(i); this.h.summon(d.key); });
      wrap.appendChild(b);
      Renderer.thumb(cv, d.key, d.size);
      return { el: b, key: d.key, def: d, cd, why, state: '' };
    });
    $('capMax').textContent = battle.config.demonCap;
  }

  press(i) {
    const s = this.slots[i]; if (!s) return;
    s.el.classList.add('press'); setTimeout(() => s.el.classList.remove('press'), 90);
  }

  update(b) {
    const pct = (v) => `scaleX(${Math.max(0, Math.min(1, v))})`;
    $('shrineBar').style.transform = pct(b.shrine.hp / b.shrine.maxHp);
    $('baseBar').style.transform = pct(b.base.hp / b.base.maxHp);
    $('shrineNum').textContent = `${Math.ceil(b.shrine.hp)}/${b.shrine.maxHp}`;
    $('baseNum').textContent = `${Math.ceil(b.base.hp)}/${b.base.maxHp}`;
    $('manaNum').textContent = Math.floor(b.mana);
    $('manaMax').textContent = '/' + Math.round(b.manaMax);
    $('manaBar').style.transform = pct(b.mana / b.manaMax);

    const alive = b.aliveDemons();
    $('capNum').textContent = alive;
    $('cap').classList.toggle('full', alive >= b.config.demonCap);

    for (const s of this.slots) {
      const chk = b.canSummon(s.key);
      const state = chk.ok ? 'ready' : chk.reason;
      if (state !== s.state) {
        s.el.classList.remove('ready', 'mana', 'cooldown', 'cap', 'alive', 'bossOut', 'furnace', 'ended');
        s.el.classList.add(state);
        s.state = state;
      }
      const w = state === 'cooldown' ? chk.wait : 0;
      s.cd.style.transform = `scaleY(${s.def.cooldown ? Math.min(1, w / s.def.cooldown) : 0})`;
      // 押せない理由をカードに出す（魔力不足・魔力炉Lv不足・再召喚待ち・幹部の出撃中）
      s.why.textContent = state === 'cooldown' ? `${w.toFixed(1)}秒` : state === 'mana' ? '魔力不足' : state === 'cap' ? '上限'
        : state === 'alive' || state === 'bossOut' ? '出撃中' : state === 'furnace' ? `炉Lv${chk.lv}` : '';
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

    if (this.toastUntil && performance.now() > this.toastUntil) { $('toast').classList.remove('show'); this.toastUntil = 0; }
  }

  setSpeed(v) { $('btnX1').classList.toggle('on', v === 1); $('btnX2').classList.toggle('on', v === 2); }
  setPaused(p) { $('btnPause').classList.toggle('on', p); }

  toast(text, info = false) {
    const t = $('toast');
    t.textContent = text;
    t.classList.toggle('info', info);
    t.classList.add('show');
    this.toastUntil = performance.now() + 1400;
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
    case 'alive': return 'この幹部は出撃中です（戦場の幹部は1体まで）';
    case 'bossOut': return `ほかの幹部（${SKIN.names[chk.who] || '幹部'}）が出撃中です。戦場の幹部は1体まで`;
    case 'furnace': return `魔力炉を Lv${chk.lv} まで上げると召喚できます`;
    case 'charging': return '魔王の呪文はまだたまっていません';
    case 'noTarget': return '呪文を当てる相手がいません';
    case 'max': return '魔力炉は最大です';
    case 'ended': return '戦闘は終わりました';
    default: return '召喚できません';
  }
}
