/* 進行・育成・セーブ
 *
 * プロフィール（localStorage の 'maougunInvasion.save' に JSON で保存）
 *   version     形式の版（移行用）
 *   stones      魔界石
 *   units[key]  { unlocked, level, form }   form：進化の段階（0 = 基本形。UNITS[key].evolvesTo をたどる）
 *   upgrades    { manaMax, manaRegen, cooldown } の段階
 *   stages[id]  { cleared, clears, bestTime }
 *   seen        { [key]: true }  解放画面を見たユニット
 *   story       { [scene]: true }  見た会話（opening・before:1-2・after:1-1 …）
 *   loot        集めた戦利品（手がかり）のステージID
 */
import { ALL_DEMONS, UNIT_ORDER } from './units.js';
import { STAGES, CHAPTER1 } from './stages.js';

export const SAVE_KEY = 'maougunInvasion.save';
export const SAVE_VERSION = 1;
export const START_UNITS = ['mass', 'vanguard', 'tank', 'area'];
export const MAX_UNIT_LEVEL = 10;

// 簡易強化の内容と費用（魔界石）
export const UPGRADES = {
  manaMax: { name: '魔力の器', desc: '最大魔力 +100', per: 100, max: 10, cost: (lv) => 80 + lv * 60 },
  manaRegen: { name: '魔力の泉', desc: '魔力回復 +2/秒', per: 2, max: 10, cost: (lv) => 100 + lv * 70 },
  cooldown: { name: '召喚の陣', desc: '再召喚時間 −4%', per: 0.04, max: 10, cost: (lv) => 120 + lv * 80 },
};
export const unitLevelCost = (lv) => 60 + (lv - 1) * 70; // Lv → Lv+1

export function newProfile() {
  const units = {};
  for (const k of [...UNIT_ORDER, 'charger']) units[k] = { unlocked: START_UNITS.includes(k), level: 1, form: 0 };
  return { version: SAVE_VERSION, stones: 0, units, upgrades: { manaMax: 0, manaRegen: 0, cooldown: 0 }, stages: {}, story: {}, loot: [], seen: Object.fromEntries(START_UNITS.map((k) => [k, true])) };
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
  const out = { stones: 0, firstClear: false, unlocked: null };
  if (result === 'win') {
    out.firstClear = !rec.cleared;
    out.stones = out.firstClear ? stage.reward.stones : Math.round(stage.reward.stones * 0.4);
    rec.cleared = true;
    rec.clears++;
    rec.bestTime = rec.bestTime == null ? time : Math.min(rec.bestTime, time);
    if (!p.loot.includes(stageId)) p.loot.push(stageId);
    const u = stage.reward.unlock;
    if (u && p.units[u] && !p.units[u].unlocked) { p.units[u].unlocked = true; out.unlocked = u; }
  } else {
    out.stones = Math.round(stage.reward.stones * 0.15); // 負けても少しもらえる
  }
  p.stones += out.stones;
  p.stages[stageId] = rec;
  return out;
}

// ---------- 編成・強化 ----------
// 戦闘で使うユニット（解放済み・第1章で召喚できるもの）を、レベルと強化を当てはめた数値で返す
export function buildDeck(p) {
  return UNIT_ORDER.filter((k) => p.units[k] && p.units[k].unlocked).map((k) => resolveUnit(k, p));
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
