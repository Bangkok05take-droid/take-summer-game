/* 進行・育成・セーブ
 *
 * プロフィール（localStorage の 'maougunInvasion.save' に JSON で保存）
 *   version     形式の版（移行用）
 *   stones      魔界石
 *   units[key]  { unlocked, level, form }   form：進化の段階（0 = 基本形。UNITS[key].evolvesTo をたどる）
 *   upgrades    { manaMax, manaRegen, cooldown, spellPower, spellCharge } の段階
 *   formation   { units: [key…], bosses: [key…] }  出撃する編成（次のステージにも引き継ぐ）。枠の数は大魔王Lvで決まる（SLOTS）
 *   stages[id]  { cleared, clears, bestTime }
 *   seen        { [key]: true }  解放画面を見たユニット
 *   story       { [scene]: true }  見た会話（opening・before:1-2・after:1-1 …）
 *   loot        集めた戦利品（手がかり）のステージID
 */
import { ALL_DEMONS, UNIT_ORDER, BOSSES, BOSS_ORDER } from './units.js';
import { STAGES, CHAPTER1 } from './stages.js';

export const SAVE_KEY = 'maougunInvasion.save';
export const SAVE_VERSION = 2; // 2：編成（formation）と魔王の力の強化を追加
export const START_UNITS = ['mass', 'vanguard', 'tank', 'area'];
export const MAX_UNIT_LEVEL = 10;

/* 大魔王の恒久的な成長（魔界石）。戦闘中の「魔力炉」（その戦闘だけ）とは別。
 *   group：mana＝魔力（最大魔力・回復）／lord＝魔王の力（呪文・再召喚）。支配力（編成枠）は大魔王Lvで自動（SLOTS） */
export const UPGRADES = {
  manaMax: { group: 'mana', name: '魔力の器', desc: '最大魔力 +100', per: 100, max: 10, cost: (lv) => 80 + lv * 60 },
  manaRegen: { group: 'mana', name: '魔力の泉', desc: '魔力回復 +2/秒', per: 2, max: 10, cost: (lv) => 100 + lv * 70 },
  spellPower: { group: 'lord', name: '呪文の威力', desc: '魔王の呪文のダメージ +10%', per: 0.1, max: 5, cost: (lv) => 120 + lv * 90 },
  spellCharge: { group: 'lord', name: '呪文の詠唱', desc: '魔王の呪文のため時間 −2秒', per: 2, max: 5, cost: (lv) => 120 + lv * 90 },
  cooldown: { group: 'lord', name: '召喚の陣', desc: '再召喚時間 −4%', per: 0.04, max: 10, cost: (lv) => 120 + lv * 80 },
};
export const UPGRADE_GROUPS = { mana: '魔力', lord: '魔王の力' };

/* 支配力：大魔王Lvで編成枠が増える（承認済み 2026-11-24） */
export const SLOTS = [
  { lv: 1, units: 5, bosses: 1 },
  { lv: 4, units: 6, bosses: 1 },
  { lv: 9, units: 6, bosses: 2 },
];
export const MAX_UNIT_SLOTS = 6;
export const MAX_BOSS_SLOTS = 2;
export function slotsFor(p) {
  const lv = lordLevel(p);
  let cur = SLOTS[0];
  for (const s of SLOTS) if (lv >= s.lv) cur = s;
  return { units: cur.units, bosses: cur.bosses };
}
// それぞれの枠が開く大魔王Lv（鍵マークの表示用）
export function slotUnlockLv(kind, index) {
  const s = SLOTS.find((x) => x[kind] > index);
  return s ? s.lv : null;
}

/* 魔王の呪文。今は1種類（序盤から使える）。新しい呪文はここに足し、unlock（大魔王Lv）で解放する */
export const SPELLS = [
  { id: 'main', name: '魔王の呪文', unlockLv: 1 },
];
export const unitLevelCost = (lv) => 60 + (lv - 1) * 70; // Lv → Lv+1

export function newProfile() {
  const units = {};
  for (const k of [...UNIT_ORDER, 'charger']) units[k] = { unlocked: START_UNITS.includes(k), level: 1, form: 0 };
  for (const k of BOSS_ORDER) if (!units[k]) units[k] = { unlocked: false, level: 1, form: 0 };
  const p = { version: SAVE_VERSION, stones: 0, units, upgrades: { manaMax: 0, manaRegen: 0, cooldown: 0, spellPower: 0, spellCharge: 0 }, stages: {}, story: {}, loot: [], seen: Object.fromEntries(START_UNITS.map((k) => [k, true])), formation: { units: [], bosses: [] } };
  fillFormation(p);
  return p;
}

function safeStorage(storage) {
  try { return storage || (typeof localStorage !== 'undefined' ? localStorage : null); } catch { return null; }
}

export function loadProfile(storage) {
  const st = safeStorage(storage);
  let raw = null;
  try { raw = st && st.getItem(SAVE_KEY); } catch { raw = null; }
  if (!raw) return newProfile();
  try {
    const p = JSON.parse(raw);
    return migrate(p);
  } catch { return newProfile(); }
}

// 足りない項目を補う（版が上がったときの移行もここで）
export function migrate(p) {
  const base = newProfile();
  if (!p || typeof p !== 'object') return base;
  const out = { ...base, ...p, version: SAVE_VERSION };
  out.units = { ...base.units };
  for (const k in p.units || {}) out.units[k] = { ...base.units[k], ...p.units[k] };
  out.upgrades = { ...base.upgrades, ...(p.upgrades || {}) };
  out.stages = { ...(p.stages || {}) };
  out.seen = { ...base.seen, ...(p.seen || {}) };
  out.story = { ...(p.story || {}) };
  out.loot = Array.isArray(p.loot) ? p.loot.slice() : [];
  out.stones = Number.isFinite(p.stones) ? p.stones : 0;
  const f = p.formation;
  out.formation = { units: Array.isArray(f && f.units) ? f.units.slice() : [], bosses: Array.isArray(f && f.bosses) ? f.bosses.slice() : [] };
  normalizeFormation(out);
  if (!f) fillFormation(out); // 版1のセーブ：解放済みの魔物を空き枠へ（今までどおり出撃できるように）
  return out;
}

export function saveProfile(p, storage) {
  const st = safeStorage(storage);
  try { if (st) st.setItem(SAVE_KEY, JSON.stringify(p)); return true; } catch { return false; }
}

export function resetProfile(storage) {
  const st = safeStorage(storage);
  try { if (st) st.removeItem(SAVE_KEY); } catch { /* 保存できない環境 */ }
  return newProfile();
}

// ---------- 進行 ----------
export function isStageOpen(p, id) {
  const i = CHAPTER1.stages.indexOf(id);
  if (i <= 0) return i === 0;
  return !!(p.stages[CHAPTER1.stages[i - 1]] && p.stages[CHAPTER1.stages[i - 1]].cleared);
}
export function nextStage(p) {
  return CHAPTER1.stages.find((id) => !(p.stages[id] && p.stages[id].cleared)) || null;
}
export function chapterCleared(p) { return CHAPTER1.stages.every((id) => p.stages[id] && p.stages[id].cleared); }

// 戦闘の結果を反映。戻り値：{ stones, firstClear, unlocked }
export function applyResult(p, stageId, result, time) {
  const stage = STAGES[stageId];
  const rec = p.stages[stageId] || { cleared: false, clears: 0, bestTime: null };
  const out = { stones: 0, firstClear: false, unlocked: null, slotsUp: null };
  const slots0 = slotsFor(p);
  if (result === 'win') {
    out.firstClear = !rec.cleared;
    out.stones = out.firstClear ? stage.reward.stones : Math.round(stage.reward.stones * 0.4);
    rec.cleared = true;
    rec.clears++;
    rec.bestTime = rec.bestTime == null ? time : Math.min(rec.bestTime, time);
    if (!p.loot.includes(stageId)) p.loot.push(stageId);
    const u = stage.reward.unlock;
    if (u && p.units[u] && !p.units[u].unlocked) { p.units[u].unlocked = true; out.unlocked = u; }
    p.stages[stageId] = rec; // 先に記録して、大魔王Lv（＝編成枠）に反映する
    normalizeFormation(p);
    if (out.unlocked) addToFormation(p, out.unlocked); // 新しい仲間は空き枠があれば自動で編成に入れる
    const slots1 = slotsFor(p);
    if (slots1.units > slots0.units || slots1.bosses > slots0.bosses) out.slotsUp = slots1;
  } else {
    out.stones = Math.round(stage.reward.stones * 0.15); // 負けても少しもらえる
  }
  p.stones += out.stones;
  p.stages[stageId] = rec;
  return out;
}

// ---------- 編成・強化 ----------
// ---------- 編成 ----------
// 編成できるか：通常は解放済み、幹部は解放済みかつ ready（能力と絵がそろっている）
export function canForm(p, key) {
  const u = p.units[key];
  if (!u || !u.unlocked) return false;
  if (BOSSES[key]) return !!BOSSES[key].ready;
  return UNIT_ORDER.includes(key);
}
// 編成を整える：編成できない・重複・枠を超えた分を外す
export function normalizeFormation(p) {
  const s = slotsFor(p);
  const f = p.formation || (p.formation = { units: [], bosses: [] });
  const uniq = (a) => a.filter((k, i) => a.indexOf(k) === i);
  f.units = uniq(f.units.filter((k) => UNIT_ORDER.includes(k) && canForm(p, k))).slice(0, s.units);
  f.bosses = uniq(f.bosses.filter((k) => BOSSES[k] && canForm(p, k))).slice(0, s.bosses);
  return f;
}
// 空き枠を、解放済みの魔物で順に埋める（新しいプロフィール・古いセーブ・テスト用）
export function fillFormation(p) {
  const f = normalizeFormation(p); const s = slotsFor(p);
  for (const k of UNIT_ORDER) if (f.units.length < s.units && canForm(p, k) && !f.units.includes(k)) f.units.push(k);
  for (const k of BOSS_ORDER) if (f.bosses.length < s.bosses && canForm(p, k) && !f.bosses.includes(k)) f.bosses.push(k);
  return f;
}
// 1体を編成に入れる。戻り値：{ ok, reason }（'full'：枠がいっぱい／'locked'：編成できない）
export function addToFormation(p, key) {
  if (!canForm(p, key)) return { ok: false, reason: 'locked' };
  const f = normalizeFormation(p); const s = slotsFor(p);
  const boss = !!BOSSES[key]; const list = boss ? f.bosses : f.units;
  if (list.includes(key)) return { ok: true };
  if (list.length >= (boss ? s.bosses : s.units)) return { ok: false, reason: 'full' };
  list.push(key);
  return { ok: true };
}
export function removeFromFormation(p, key) {
  const f = normalizeFormation(p);
  f.units = f.units.filter((k) => k !== key); f.bosses = f.bosses.filter((k) => k !== key);
  return { ok: true };
}

// 戦闘で使うユニット（編成の通常 → 幹部の順）を、レベルと強化を当てはめた数値で返す
export function buildDeck(p) {
  const f = normalizeFormation(p);
  return [...f.units, ...f.bosses].map((k) => resolveUnit(k, p));
}

// 魔王の呪文（魔王の力の強化を当てはめる）
export function resolveSpell(spell, p) {
  const up = (p && p.upgrades) || {};
  return {
    ...spell,
    damage: Math.round(spell.damage * (1 + (up.spellPower || 0) * UPGRADES.spellPower.per)),
    charge: Math.max(15, spell.charge - (up.spellCharge || 0) * UPGRADES.spellCharge.per),
  };
}

export function resolveUnit(key, p) {
  const u = p && p.units && p.units[key];
  let def = ALL_DEMONS[key];
  for (let f = 0; u && f < (u.form || 0) && def.evolvesTo; f++) def = ALL_DEMONS[def.evolvesTo];
  const lv = (u && u.level) || 1;
  const g = def.growth || { hp: 0, atk: 0 };
  const cdCut = Math.min(0.4, ((p && p.upgrades.cooldown) || 0) * UPGRADES.cooldown.per);
  return {
    ...def,
    key,
    level: lv,
    hp: Math.round(def.hp * (1 + g.hp * (lv - 1))),
    atk: Math.round(def.atk * (1 + g.atk * (lv - 1))),
    cooldown: Math.round(def.cooldown * (1 - cdCut) * 10) / 10,
  };
}

// 封印のほころび：ステージを1つクリアするごとに、大魔王の魔力が少し戻る（第1章の成長）
export const LORD_GROWTH = { max: 60, regen: 1.5 };
export function lordLevel(p) { return 1 + Object.values((p && p.stages) || {}).filter((s) => s.cleared).length; }

export function resolveMana(stageMana, p) {
  const up = (p && p.upgrades) || {};
  const lv = lordLevel(p) - 1;
  return {
    start: stageMana.start,
    max: stageMana.max + (up.manaMax || 0) * UPGRADES.manaMax.per + lv * LORD_GROWTH.max,
    regen: stageMana.regen + (up.manaRegen || 0) * UPGRADES.manaRegen.per + lv * LORD_GROWTH.regen,
  };
}

export function levelUpUnit(p, key) {
  const u = p.units[key];
  if (!u || !u.unlocked || u.level >= MAX_UNIT_LEVEL) return { ok: false, reason: u && u.level >= MAX_UNIT_LEVEL ? 'max' : 'locked' };
  const cost = unitLevelCost(u.level);
  if (p.stones < cost) return { ok: false, reason: 'stones', need: cost - p.stones };
  p.stones -= cost; u.level++;
  return { ok: true, cost };
}

export function buyUpgrade(p, id) {
  const def = UPGRADES[id]; const lv = p.upgrades[id] || 0;
  if (lv >= def.max) return { ok: false, reason: 'max' };
  const cost = def.cost(lv);
  if (p.stones < cost) return { ok: false, reason: 'stones', need: cost - p.stones };
  p.stones -= cost; p.upgrades[id] = lv + 1;
  return { ok: true, cost };
}
