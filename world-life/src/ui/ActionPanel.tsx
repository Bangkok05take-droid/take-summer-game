import { canBuy, ownsWholeArea } from '../core/economy';
import { currentPlayer } from '../core/game';
import { ctx, useGame } from '../store/gameStore';
import { fxBus } from '../fx/bus';
import { Dice3D } from './Dice3D';
import { hex, money } from './format';

const tap = (fn: () => void) => () => {
  fxBus.emit({ type: 'tap' });
  fn();
};

export function ActionPanel() {
  const game = useGame((s) => s.game)!;
  const busy = useGame((s) => s.busy);
  const rolling = useGame((s) => s.diceRolling);
  const fast = useGame((s) => s.fastForward);
  const { roll, pickBranch, buy, skip, next, setFastForward } = useGame.getState();

  if (game.phase === 'gameOver') return null;
  // イベント表示中（人間の手番）は画面を広く使うため最小表示
  if ((game.phase === 'awaitEvent' || game.phase === 'eventResult') && currentPlayer(game).isHuman) {
    return (
      <footer className="action-panel compact">
        <div className="ap-log">{game.log[game.log.length - 1]}</div>
      </footer>
    );
  }
  const player = currentPlayer(game);
  const node = ctx.map.nodes[player.position];
  const lastLog = game.log[game.log.length - 1];

  let body: React.ReactNode = null;
  if (!player.isHuman) {
    body = (
      <div className="ap-msg">
        <b style={{ color: hex(player.color) }}>{player.name}</b> の手番…
      </div>
    );
  } else if (busy) {
    body = <div className="ap-msg">{rolling ? 'サイコロを振っています…' : '移動中…'}</div>;
  } else if (game.phase === 'awaitEvent' || game.phase === 'eventResult') {
    body = <div className="ap-msg">✨ イベント発生中</div>;
  } else if (game.phase === 'awaitRoll') {
    body = (
      <button className="btn gold big roll-btn" onClick={roll}>
        サイコロを振る
      </button>
    );
  } else if (game.phase === 'awaitBranch') {
    body = (
      <div className="ap-branch">
        <div className="ap-title">
          分岐！ 残り <b>{game.stepsRemaining}</b> 歩 <small>マップのマスでも選択可</small>
        </div>
        <div className="ap-row">
          {game.branchOptions.map((id, i) => (
            <button key={id} className={`btn ${i === 0 ? 'gold' : 'neon'}`} onClick={tap(() => pickBranch(id))}>
              {i === 0 ? '通常ルート' : '近道'}
              <small>→ {ctx.map.nodes[id].label}</small>
            </button>
          ))}
        </div>
      </div>
    );
  } else if (game.phase === 'awaitPurchase') {
    const prop = ctx.properties[node.propertyId!];
    const check = canBuy(game, ctx, player.id, prop.id);
    const monopoly = ownsWholeArea({ ...game, ownership: { ...game.ownership, [prop.id]: player.id } }, ctx, player.id, prop.area);
    body = (
      <div className="ap-prop">
        <div className="ap-title">
          🏢 {prop.name} <span className="area-chip">{ctx.map.areas[prop.area].name}</span>
        </div>
        <div className="ap-kv">
          <span>価格 <b>{money(prop.price)}</b></span>
          <span>収益 <b>+{money(prop.income)}</b>/ターン</span>
        </div>
        {monopoly && <div className="ap-hint">購入するとエリア独占！ 収益+20%</div>}
        <div className="ap-row">
          <button className="btn gold" disabled={!check.ok} onClick={buy}>
            {check.ok ? '購入する' : '資金不足'}
          </button>
          <button className="btn ghost" onClick={tap(skip)}>
            見送る
          </button>
        </div>
      </div>
    );
  } else if (game.phase === 'landed') {
    const l = game.landing!;
    let text = '';
    if (l.kind === 'property-owned-self') text = '自分の物件です。';
    else if (l.kind === 'property-owned-other') {
      const owner = game.players.find((p) => p.id === l.ownerId);
      text = `${owner?.name} の物件です（通行料なし）。`;
    } else if (l.kind === 'start') text = '空港に到着。';
    else text = 'イベントは次フェーズで実装予定です。';
    body = (
      <div className="ap-landed">
        <div className="ap-title">「{node.label}」</div>
        <div className="ap-sub">{text}</div>
        <button className="btn gold" onClick={tap(next)}>
          次へ
        </button>
      </div>
    );
  }

  return (
    <footer className="action-panel">
      <div className="ap-left">
        <Dice3D />
        <button className={`ff${fast ? ' on' : ''}`} onClick={tap(() => setFastForward(!fast))}>
          ⏩ 早送り
        </button>
      </div>
      <div className="ap-main">
        <div className="ap-body" key={`${game.phase}-${game.currentPlayerIndex}-${busy}`}>
          {body}
        </div>
        <div className="ap-log">{lastLog}</div>
      </div>
    </footer>
  );
}
