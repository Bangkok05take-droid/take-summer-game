// 第1章のテンポの参考値：ボットごとのクリア時間（ゲーム内の秒）
//   node tests/balance.js [シード数] [ステージ]
import { makeBattle, run, botPlayer } from './helpers.js';
import { STAGE_ORDER } from '../js/data/stages.js';

const seeds = Number(process.argv[2] || 10);
const only = process.argv[3];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
for (const id of STAGE_ORDER) {
  if (only && id !== only) continue;
  console.log(`== ${id}`);
  for (const style of ['normal', 'upgraded', 'slow', 'massonly', 'idle']) {
    const res = [];
    for (let s = 1; s <= seeds; s++) {
      const b = makeBattle({ stageId: id, seed: s, upgraded: style === 'upgraded' });
      run(b, 900, style === 'idle' ? null : botPlayer(style === 'upgraded' ? 'normal' : style));
      res.push({ r: b.result || 'timeout', t: b.t, shrine: b.shrine.hp / b.shrine.maxHp, k: b.stats.kills, sum: b.stats.summoned, heroes: b.stats.heroesBeaten });
    }
    const wins = res.filter((r) => r.r === 'win');
    const avg = (a, f) => (a.length ? a.reduce((x, r) => x + f(r), 0) / a.length : 0);
    console.log(`  ${style.padEnd(9)} 勝ち ${String(wins.length).padStart(2)}/${seeds}  勝ち平均 ${fmt(avg(wins, (r) => r.t))}  全体平均 ${fmt(avg(res, (r) => r.t))}  残り祠 ${(avg(res, (r) => r.shrine) * 100).toFixed(0)}%  撃破 ${avg(res, (r) => r.k).toFixed(0)}  召喚 ${avg(res, (r) => r.sum).toFixed(0)}${id === '1-5' ? `  勇者撃破 ${avg(res, (r) => r.heroes).toFixed(1)}` : ''}`);
  }
}
