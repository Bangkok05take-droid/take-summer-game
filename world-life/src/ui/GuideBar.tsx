import { nextGoal, recommendation } from '../core/advisor';
import { currentPlayer } from '../core/game';
import { ctx, useGame } from '../store/gameStore';
import { useTutorial } from '../store/tutorialStore';

/** マップ上部：「今おすすめの行動」と「次の目標」 */
export function GuideBar() {
  const game = useGame((s) => s.game)!;
  const busy = useGame((s) => s.busy);
  const tutorial = useTutorial((s) => s.active);
  if (tutorial) return null;
  if (game.phase === 'gameOver' || game.phase === 'awaitEvent' || game.phase === 'eventResult') return null;
  const human = game.players.find((p) => p.isHuman)!;
  const myTurn = currentPlayer(game).isHuman;
  const goal = nextGoal(game, ctx, human.id);
  const rec = myTurn && !busy ? recommendation(game, ctx) : null;
  const main = rec ?? goal;
  return (
    <div className={`guide-bar tone-${main.tone}`} key={main.text}>
      <div className="gb-main">
        <span className="gb-icon">{rec ? '💡' : '🎯'}</span>
        {main.text}
      </div>
      {rec ? <div className="gb-sub">{rec.sub}</div> : goal.sub && <div className="gb-sub">{goal.sub}</div>}
      {rec && <div className="gb-goal">🎯 {goal.text}</div>}
    </div>
  );
}
