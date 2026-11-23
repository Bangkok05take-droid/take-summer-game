import { computeScores } from '../core/scoring';
import { ctx, useGame } from '../store/gameStore';
import { hex, money } from './format';

export function GameOver() {
  const game = useGame((s) => s.game)!;
  const backToTitle = useGame((s) => s.backToTitle);
  const rows = computeScores(game, ctx).sort((a, b) => a.rank - b.rank);
  return (
    <div className="overlay">
      <div className="result">
        <h2>FINAL RESULT</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>プレイヤー</th>
              <th>純資産</th>
              <th>スコア</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = game.players.find((x) => x.id === r.playerId)!;
              return (
                <tr key={r.playerId} className={r.rank === 1 ? 'win' : ''}>
                  <td>{r.rank}</td>
                  <td style={{ color: hex(p.color) }}>
                    {r.name}
                    <small>
                      資産{r.assetPoints.toFixed(0)} ★{r.fame} ⚭{r.network} ♥{r.happiness}
                    </small>
                  </td>
                  <td>{money(r.netWorth)}</td>
                  <td className="score">{r.total.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="formula">資産60% ＋ 名声15% ＋ 人脈10% ＋ 幸福度15%</p>
        <button className="btn gold" onClick={backToTitle}>
          タイトルへ
        </button>
      </div>
    </div>
  );
}
