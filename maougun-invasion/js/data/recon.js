/* 偵察：ステージの出現データから、人間軍の兵種・特徴をまとめる（編成画面・偵察報告で使う）
 * 報告する側近の表示名は SKIN.speakers.aide（ストーリー側の正式名称が決まったら skin.js の1か所を変えるだけ）。 */
import { HUMANS } from './humans.js';
import { STAGES, STAGE_ORDER } from './stages.js';

// 出てくる順に、兵種ごとの情報を返す。[{ key, name, role, note, counter, hero, when }]
export function enemiesOf(stageId) {
  const st = STAGES[stageId];
  const list = []; const seen = new Map();
  const add = (who, when, hero) => {
    if (!HUMANS[who]) return;
    if (seen.has(who)) return;
    const h = HUMANS[who];
    const e = { key: who, name: h.name, role: h.role + (h.line === 'back' ? '・後衛' : ''), back: h.line === 'back', note: h.note || '', counter: h.counter || '', hero: !!(hero || h.hero), when };
    seen.set(who, e); list.push(e);
  };
  const rows = (st.spawns || []).slice().sort((a, b) => (a.start ?? 1e9) - (b.start ?? 1e9));
  for (const s of rows) {
    if (s.who) add(s.who, s.start <= 30 ? '最初から' : '途中から');
    else if (s.wave) for (const w of s.wave) add(w.who, `拠点HP${Math.round(s.trigger.baseBelow * 100)}%で登場`, s.hero === w.who);
  }
  // 前のステージにいなかった兵種に NEW の印
  const i = STAGE_ORDER.indexOf(stageId);
  const prev = i > 0 ? enemyKeys(STAGE_ORDER[i - 1]) : null;
  for (const e of list) e.isNew = !!prev && !prev.has(e.key);
  return list;
}
function enemyKeys(stageId) {
  const ks = new Set();
  for (const s of STAGES[stageId].spawns || []) { if (s.who) ks.add(s.who); else if (s.wave) for (const w of s.wave) ks.add(w.who); }
  return ks;
}

// 2回目以降の1行報告（初回はステージの「前の会話」をそのまま使う）
export function reconLine(stageId) {
  const st = STAGES[stageId];
  const es = enemiesOf(stageId);
  const heroes = es.filter((e) => e.hero);
  const troops = es.filter((e) => !e.hero).map((e) => e.name);
  const news = es.filter((e) => e.isNew && !e.hero);
  const danger = news[0] || es.find((e) => !e.hero && e.key !== 'militia');
  let t = `大魔王様。${st.name}には ${troops.join('・')} がおります。`;
  if (heroes.length) t += `${heroes.map((h) => h.name).join('と')}が現れるはずです。`;
  else if (danger) t += `${news.length ? '新顔の' : ''}${news.length > 1 ? news.map((e) => e.name).join('と') : danger.name}にご注意を。`;
  return t;
}
