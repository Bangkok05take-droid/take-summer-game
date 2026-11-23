// 試作 1-1 のテンポの参考値：ボットごとのクリア時間（ゲーム内の秒）
import { makeBattle, run, botPlayer } from './helpers.js';
const seeds = Number(process.argv[2] || 20);
for (const style of ['normal', 'slow', 'massonly', 'nofurnace', 'idle']) {
  const res = [];
  for (let s = 1; s <= seeds; s++) {
    const b = makeBattle({ seed: s });
    run(b, 900, style === 'idle' ? null : botPlayer(style));
    res.push({ r: b.result || 'timeout', t: b.t, shrine: b.shrine.hp / b.shrine.maxHp, k: b.stats.kills, sum: b.stats.summoned });
  }
  const wins = res.filter((r) => r.r === 'win');
  const avg = (a, f) => a.length ? (a.reduce((x, r) => x + f(r), 0) / a.length) : 0;
  console.log(`${style.padEnd(10)} 勝ち ${wins.length}/${seeds}  平均時間 ${avg(res, (r) => r.t).toFixed(0)}秒  勝ち平均 ${avg(wins, (r) => r.t).toFixed(0)}秒  残り祠 ${(avg(res, (r) => r.shrine) * 100).toFixed(0)}%  撃破 ${avg(res, (r) => r.k).toFixed(0)}  召喚 ${avg(res, (r) => r.sum).toFixed(0)}`);
}
