/* 進行・育成・セーブ
 *
 * プロフィール（localStorage の 'maougunInvasion.save' に JSON で保存）
 *   version     形式の版（移行用）
 *   stones      魔界石
 *   units[key]  { unlocked, level, form, formKey }   form：進化の段階（0 = 基本形）。formKey：今の進化形のキー（分岐する進化用。無ければ基本形）
 *   upgrades    { manaMax, manaRegen, cooldown, spellPower, spellCharge } の段階
 *   events      { ruin: { done, choice: 'recruit'|'reject', recruited, rematches } }  特殊イベント「壊滅した町」
 *               { crystal: { done } }  特殊イベント「大魔王の魔力回復」（6-3 の初回クリア）。魔力の部分回復と上位進化の解放
 *               { ultimate: { done } } 特殊イベント「魔王軍の究極進化」（8-4 の初回クリア）。魔力炉のさらなる強化と最上位進化の解放
 *               { final: { done } }    最終章への進軍と最終章解放演出（9-4 の初回クリア）。演出だけ（能力の変化なし）
 *               { conquest: { done } } エンディング・世界征服達成（10-5 の初回クリア）。大魔王の完全復活
 *   formation   { units: [key…], bosses: [key…] }  出撃する編成（次のステージにも引き継ぐ）。枠の数は大魔王Lvで決まる（SLOTS）
 *   stages[id]  { cleared, clears, bestTime }
 *   seen        { [key]: true }  解放画面を見たユニット
 *   story       { [scene]: true }  見た会話（opening・before:1-2・after:1-1 …）
 *   loot        集めた戦利品（手がかり）のステージID
 */
import { ALL_DEMONS, UNIT_ORDER, BOSSES, BOSS_ORDER, EVOLUTIONS } from './units.js';
import { STAGES, CHAPTER1, STAGE_ORDER, chapterOf } from './stages.js';

export const SAVE_KEY = 'maougunInvasion.save';
export const SAVE_VERSION = 2; // 2：編成（formation）と魔王の力の強化を追加
export const START_UNITS = ['mass', 'vanguard', 'tank', 'ranged', 'fast', 'area', 'healer', 'mallet']; // 2026-11-25：通常8体は最初から全員
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
  for (const k of [...UNIT_ORDER, 'special', 'charger']) units[k] = { unlocked: START_UNITS.includes(k), level: 1, form: 0 };
  for (const k of BOSS_ORDER) if (!units[k]) units[k] = { unlocked: false, level: 1, form: 0 };
  const p = { version: SAVE_VERSION, events: {}, stones: 0, units, upgrades: { manaMax: 0, manaRegen: 0, cooldown: 0, spellPower: 0, spellCharge: 0 }, stages: {}, story: {}, loot: [], seen: Object.fromEntries(START_UNITS.map((k) => [k, true])), formation: { units: [], bosses: [] } };
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
  for (const k of START_UNITS) out.units[k].unlocked = true; // 最初から使える魔物（古いセーブでも）
  out.upgrades = { ...base.upgrades, ...(p.upgrades || {}) };
  out.stages = { ...(p.stages || {}) };
  out.seen = { ...base.seen, ...(p.seen || {}) };
  out.story = { ...(p.story || {}) };
  out.loot = Array.isArray(p.loot) ? p.loot.slice() : [];
  out.stones = Number.isFinite(p.stones) ? p.stones : 0;
  out.events = { ...(p.events || {}) };
  const f = p.formation;
  out.formation = { units: Array.isArray(f && f.units) ? f.units.slice() : [], bosses: Array.isArray(f && f.bosses) ? f.bosses.slice() : [] };
  normalizeFormation(out);
  // 2026-11-26：6-3 をクリアずみの古いセーブには、あとから追加した幹部（熔氷の岩魔）を渡す
  for (const [id, st] of Object.entries(STAGES)) {
    for (const u of [].concat((st.reward && st.reward.unlock) || [])) if (u !== 'ord' && out.stages[id] && out.stages[id].cleared && out.units[u] && !out.units[u].unlocked) { out.units[u].unlocked = true; out.seen[u] = out.seen[u] || false; }
    // ボス戦の前に加わる幹部（joinBoss）：そのステージに挑んだ・クリアしたセーブなら加入ずみにする
    const jb = st.joinBoss; const tried = out.stages[id] && (out.stages[id].cleared || out.stages[id].losses);
    if (jb && tried && out.units[jb] && !out.units[jb].unlocked) { out.units[jb].unlocked = true; out.story['join:' + jb] = true; }
  }
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
// 章をまたいで順に開く（1-3 をクリアすると 2-1 が開く）
export function isStageOpen(p, id) {
  if (id === 'ex-1') return ruinRematchOpen(p);
  const i = STAGE_ORDER.indexOf(id);
  if (i <= 0) return i === 0;
  // 第4章は、壊滅した町のイベントが終わってから（オルドの加入・未加入は問わない）
  const ch = chapterOf(id);
  if (ch.needsEvent && ch.stages[0] === id && !(p.events && p.events[ch.needsEvent] && p.events[ch.needsEvent].done)) return false;
  return !!(p.stages[STAGE_ORDER[i - 1]] && p.stages[STAGE_ORDER[i - 1]].cleared);
}
export function nextStage(p) {
  return STAGE_ORDER.find((id) => !(p.stages[id] && p.stages[id].cleared)) || null;
}
export function chapterCleared(p, ch = CHAPTER1) { return ch.stages.every((id) => p.stages[id] && p.stages[id].cleared); }
export function isChapterOpen(p, ch) { return ch.special ? ruinVisible(p) : isStageOpen(p, ch.stages[0]); }

// ---------- 特殊イベント「壊滅した町」 ----------
export const ruinState = (p) => (p.events && p.events.ruin) || null;
export function ruinPending(p) { return !!(p.stages['3-3'] && p.stages['3-3'].cleared) && !(ruinState(p) && ruinState(p).done); }
export function ruinVisible(p) { return !!(ruinState(p) && ruinState(p).done); } // イベントのあとだけ、ステージ選択に「壊滅した町」
export function ruinRematchOpen(p) { const r = ruinState(p); return !!(r && r.done && !r.recruited); }
// イベントの結果を記録。choice：'recruit'（すぐ加入）｜'reject'（加入しない・あとで再戦できる）
export function finishRuinEvent(p, choice) {
  p.events = p.events || {};
  const r = p.events.ruin = { ...(p.events.ruin || {}), done: true, choice, rematches: (p.events.ruin && p.events.ruin.rematches) || 0 };
  if (choice === 'recruit') recruitOrd(p);
  else r.recruited = !!r.recruited;
  return r;
}
// オルドの加入（重複しない）。戻り値：今回はじめて加入したら true
export function recruitOrd(p) {
  p.events = p.events || {};
  const r = p.events.ruin = { done: true, ...(p.events.ruin || {}) };
  if (p.units.ord && p.units.ord.unlocked) { r.recruited = true; return false; }
  p.units.ord = { ...(p.units.ord || { level: 1, form: 0 }), unlocked: true };
  r.recruited = true;
  addToFormation(p, 'ord');
  return true;
}
export { chapterOf };

// 戦闘の結果を反映。戻り値：{ stones, firstClear, unlocked }
export function applyResult(p, stageId, result, time) {
  const stage = STAGES[stageId];
  const rec = p.stages[stageId] || { cleared: false, clears: 0, bestTime: null };
  const out = { stones: 0, firstClear: false, unlocked: null, unlockedAll: [], slotsUp: null };
  const slots0 = slotsFor(p);
  if (stageId === 'ex-1' && result === 'win' && p.events && p.events.ruin) p.events.ruin.rematches = (p.events.ruin.rematches || 0) + 1;
  if (result === 'win') {
    out.firstClear = !rec.cleared;
    out.stones = out.firstClear ? stage.reward.stones : Math.round(stage.reward.stones * 0.4);
    rec.cleared = true;
    rec.clears++;
    rec.bestTime = rec.bestTime == null ? time : Math.min(rec.bestTime, time);
    if (!p.loot.includes(stageId)) p.loot.push(stageId);
    // 解放（1つ、または配列で複数）。out.unlocked は最初の1体（互換）、out.unlockedAll は全部
    for (const u of [].concat(stage.reward.unlock || [])) {
      if (u === 'ord') { if (recruitOrd(p)) out.unlockedAll.push('ord'); continue; } // 壊滅した町の再戦に勝つとオルドが加入
      if (p.units[u] && !p.units[u].unlocked) { p.units[u].unlocked = true; out.unlockedAll.push(u); }
    }
    out.unlocked = out.unlockedAll[0] || null;
    p.stages[stageId] = rec; // 先に記録して、大魔王Lv（＝編成枠）に反映する
    normalizeFormation(p);
    for (const u of out.unlockedAll) addToFormation(p, u); // 新しい仲間は空き枠があれば自動で編成に入れる
    const slots1 = slotsFor(p);
    if (slots1.units > slots0.units || slots1.bosses > slots0.bosses) { out.slotsUp = slots1; fillFormation(p); } // 増えた枠は控えから順に埋める
  } else {
    out.stones = Math.round(stage.reward.stones * 0.15); // 負けても少しもらえる
    if (stageId === 'ex-1' && p.events && p.events.ruin) p.events.ruin.rematches = (p.events.ruin.rematches || 0) + 1;
    rec.losses = (rec.losses || 0) + 1;
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
  if (u && u.formKey && ALL_DEMONS[u.formKey]) def = ALL_DEMONS[u.formKey]; // 進化形（分岐あり）
  else for (let f = 0; u && f < (u.form || 0) && def.evolvesTo && !Array.isArray(def.evolvesTo); f++) def = ALL_DEMONS[def.evolvesTo];
  const lv = (u && u.level) || 1;
  const g = def.growth || { hp: 0, atk: 0 };
  const cdCut = Math.min(0.4, ((p && p.upgrades.cooldown) || 0) * UPGRADES.cooldown.per);
  return {
    ...def,
    key,
    skin: (u && u.formKey && ALL_DEMONS[u.formKey]) ? u.formKey : key, // 絵と名前のキー（進化形なら進化形）
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
  const cr = crystalDone(p) ? CRYSTAL_BONUS : { max: 0, regen: 0 }; // 古代の魔力結晶（部分的な回復）
  return {
    start: stageMana.start,
    max: stageMana.max + (up.manaMax || 0) * UPGRADES.manaMax.per + lv * LORD_GROWTH.max + cr.max,
    regen: stageMana.regen + (up.manaRegen || 0) * UPGRADES.manaRegen.per + lv * LORD_GROWTH.regen + cr.regen,
  };
}

export function levelUpUnit(p, key) {
  const u = p.units[key];
  if (!u || !u.unlocked || u.level >= MAX_UNIT_LEVEL) return { ok: false, reason: u && u.level >= MAX_UNIT_LEVEL ? 'max' : 'locked' };
  const cost = levelCostFor(p, key);
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

// ---------- 進化（2026-11-24：データの仕組みだけ。進化画面・条件は未実装） ----------
// 今の形から進化できる先（分岐なら複数）
export function evolutionChoices(p, key) {
  const def = resolveUnit(key, p);
  return [].concat(def.evolvesTo || []).filter((k) => EVOLUTIONS[k]);
}
// 進化させる。{ ok, reason }：'locked' 未解放／'invalid' その形からは進化できない／'planned' 進化形がまだ準備中
export function evolveUnit(p, key, toKey) {
  const u = p.units[key];
  if (!u || !u.unlocked) return { ok: false, reason: 'locked' };
  if (!evolutionChoices(p, key).includes(toKey)) return { ok: false, reason: 'invalid' };
  if (EVOLUTIONS[toKey].ready === false) return { ok: false, reason: 'planned' };
  u.formKey = toKey; u.form = EVOLUTIONS[toKey].tier - 1;
  u.level = Math.max(1, u.level - (EVOLVE_NEED.level - 1)); // 2026-11-25 確定：レベルを一部引き継ぐ（進化前のLv−4。Lv5→Lv1・Lv10→Lv6）
  return { ok: true };
}

// ---------- 特殊イベント「大魔王の魔力回復」（第6章・古代の魔力結晶） ----------
// 部分的な回復：戦いを始めるときの最大魔力 +400・回復 +8/秒（大魔王の肉体は戻らない）。数値は仮（バトル設計で調整）
export const CRYSTAL_BONUS = { max: 400, regen: 8 };
export function crystalDone(p) { return !!(p && p.events && p.events.crystal && p.events.crystal.done); }
export function crystalPending(p) { return !!(p.stages['6-3'] && p.stages['6-3'].cleared) && !crystalDone(p); }
// 1回だけ。戻り値：今回はじめて回復したら true（再クリアでは false＝重複しない）
export function applyCrystal(p) {
  if (crystalDone(p)) return false;
  p.events = p.events || {};
  p.events.crystal = { done: true };
  return true;
}

// ---------- 特殊イベント「魔王軍の究極進化」（第8章・魔法都市の魔力増幅技術） ----------
// 8-4 の初回クリアで1回だけ。魔力炉のさらなる強化（戦闘中の魔力炉：1段ごとの上がり幅が増え、Lv が1つ上まで上がる）と最上位進化の解放。
// 数値は仮（バトル設計で調整）。大魔王の肉体は戻らない（祠にとどまる）
export const ULTIMATE_FURNACE = { maxAdd: 100, regenAdd: 3, extraCosts: [850] };
export function ultimateDone(p) { return !!(p && p.events && p.events.ultimate && p.events.ultimate.done); }
export function ultimatePending(p) { return !!(p.stages['8-4'] && p.stages['8-4'].cleared) && !ultimateDone(p); }
// 1回だけ。戻り値：今回はじめて解放したら true（再クリアでは false＝重複しない）
export function applyUltimate(p) {
  if (ultimateDone(p)) return false;
  p.events = p.events || {};
  p.events.ultimate = { done: true };
  return true;
}
// 戦闘で使う魔力炉の設定（究極進化のあとは強化される）
export function resolveFurnace(furnace, p) {
  if (!ultimateDone(p)) return furnace;
  const u = ULTIMATE_FURNACE;
  return { ...furnace, costs: [...furnace.costs, ...u.extraCosts], maxAdd: furnace.maxAdd + u.maxAdd, regenAdd: furnace.regenAdd + u.regenAdd };
}

// ---------- 進化 ----------
// 進化できる段階の上限：魔力結晶の前は進化なし（1）、魔力結晶のあとは上位（2）、究極進化のあとは最上位（3）まで
export function evolveTierCap(p) { return ultimateDone(p) ? 3 : crystalDone(p) ? 2 : 1; }
export const EVOLVE_NEED = { level: 5, stones: (tier) => (tier >= 3 ? 1200 : 800) }; // 2026-11-25 企画回答 Ver.1（仮の数値）：基本形Lv5以上＋魔界石800。第3形態は保留
export const EVOLVED_LEVEL_COST = 1.5; // 進化形のレベル上げは基本形の1.5倍（仮）
// そのモンスターの今のレベル上げ費用（進化形は高い）
export function levelCostFor(p, key) { const u = p.units[key]; const c = unitLevelCost(u.level); return u && u.form > 0 ? Math.round(c * EVOLVED_LEVEL_COST / 10) * 10 : c; }
// 進化する。{ ok, reason }：'feature'＝まだ進化できない（魔力結晶の前）／'tier'＝最上位はまだ／'level'／'stones'／'planned'（進化先のデザイン待ち）など
export function tryEvolve(p, key, toKey) {
  if (!crystalDone(p)) return { ok: false, reason: 'feature' };
  const to = EVOLUTIONS[toKey];
  if (!to) return { ok: false, reason: 'invalid' };
  if (to.tier > evolveTierCap(p)) return { ok: false, reason: 'tier' };
  const u = p.units[key];
  if (!u || !u.unlocked) return { ok: false, reason: 'locked' };
  if (!evolutionChoices(p, key).includes(toKey)) return { ok: false, reason: 'invalid' }; // 今の形から進化できない（2回目など）
  if (u.level < EVOLVE_NEED.level) return { ok: false, reason: 'level', need: EVOLVE_NEED.level };
  const cost = EVOLVE_NEED.stones(to.tier);
  if (p.stones < cost) return { ok: false, reason: 'stones', need: cost - p.stones };
  const r = evolveUnit(p, key, toKey);
  if (r.ok) p.stones -= cost;
  return { ...r, cost };
}

// ---------- 最終章への進軍（第9章・9-4 の初回クリア）：会話と最終章解放演出を1回だけ ----------
export function finalDone(p) { return !!(p && p.events && p.events.final && p.events.final.done); }
export function finalPending(p) { return !!(p.stages['9-4'] && p.stages['9-4'].cleared) && !finalDone(p); }
export function markFinal(p) {
  if (finalDone(p)) return false;
  p.events = p.events || {};
  p.events.final = { done: true };
  return true;
}

// ---------- エンディング「大魔王復活」・世界征服達成（10-5 の初回クリア）：1回だけ ----------
export function conquestDone(p) { return !!(p && p.events && p.events.conquest && p.events.conquest.done); }
export function conquestPending(p) { return !!(p.stages['10-5'] && p.stages['10-5'].cleared) && !conquestDone(p); }
export function markConquest(p) {
  if (conquestDone(p)) return false;
  p.events = p.events || {};
  p.events.conquest = { done: true };
  return true;
}

// ---------- 幹部の加入（ボス戦の前・2026-11-26） ----------
// そのステージに joinBoss があり、まだ仲間でなければ true（加入の演出を出す）
export function joinPending(p, stageId) { const jb = STAGES[stageId] && STAGES[stageId].joinBoss; return !!(jb && p.units[jb] && !p.units[jb].unlocked); }
// 加入させて、編成の幹部枠に必ず入れる（枠がいっぱいなら最後の幹部と入れ替え）。負けても加入は残る
export function joinBoss(p, stageId) {
  const jb = STAGES[stageId] && STAGES[stageId].joinBoss; if (!jb || !p.units[jb]) return null;
  const first = !p.units[jb].unlocked;
  p.units[jb].unlocked = true; p.seen[jb] = true; p.story['join:' + jb] = true;
  const r = addToFormation(p, jb);
  if (!r.ok && r.reason === 'full') { const f = normalizeFormation(p); f.bosses[f.bosses.length - 1] = jb; }
  return first ? jb : null;
}
