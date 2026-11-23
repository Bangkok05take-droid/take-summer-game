import { characterCutinUrl, eventBgUrl } from '../assets/manifest';
import { useImageAvailable } from '../assets/useImage';
import { canChoose } from '../core/events';
import type { InsolvencyReport } from '../core/types';
import { currentPlayer } from '../core/game';
import { CHARACTERS } from '../data/characters';
import { EVENT_CATEGORY_META } from '../data/eventCategories';
import { fxBus } from '../fx/bus';
import { ctx, useGame } from '../store/gameStore';
import { hex, money } from './format';

/** 画像が無ければ仮のシルエットを出す */
function Portrait({ characterId, color }: { characterId?: string; color: string }) {
  const ch = characterId ? CHARACTERS[characterId] : undefined;
  const ok = useImageAvailable(characterCutinUrl(ch?.id ?? '_none'));
  if (ch && ok) return <img className="ec-portrait-img" src={characterCutinUrl(ch.id)} alt="" draggable={false} />;
  if (ch && ok === null) return null;
  return (
    <div className="ec-portrait-ph" style={{ ['--cc' as string]: ch ? hex(ch.color) : color }}>
      <svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMin meet" aria-hidden="true">
        <defs>
          <linearGradient id="phg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--cc)" stopOpacity="0.85" />
            <stop offset="1" stopColor="#120c22" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="92" rx="44" ry="52" fill="url(#phg)" stroke="var(--cc)" strokeWidth="2" />
        <path d="M18 300 C24 200 60 168 100 168 C140 168 176 200 182 300 Z" fill="url(#phg)" stroke="var(--cc)" strokeWidth="2" />
      </svg>
      <div className="ec-ph-label">
        {ch ? ch.name : 'CHARACTER'}
        <small>仮素材</small>
      </div>
    </div>
  );
}

function EventBg({ category }: { category: string }) {
  const ok = useImageAvailable(eventBgUrl(category));
  return ok ? <img className="ec-bg-img" src={eventBgUrl(category)} alt="" draggable={false} /> : null;
}

function Chips({ a }: { a: { money: number; debt: number; fame: number; network: number; happiness: number } }) {
  const chips: [string, boolean][] = [];
  const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);
  if (a.money) chips.push([`${a.money > 0 ? '+' : '-'}${money(Math.abs(a.money))}`, a.money > 0]);
  if (a.debt) chips.push([`負債 ${a.debt > 0 ? '+' : '-'}${money(Math.abs(a.debt))}`, a.debt < 0]);
  if (a.fame) chips.push([`名声 ${sign(a.fame)}`, a.fame > 0]);
  if (a.network) chips.push([`人脈 ${sign(a.network)}`, a.network > 0]);
  if (a.happiness) chips.push([`幸福度 ${sign(a.happiness)}`, a.happiness > 0]);
  if (!chips.length) chips.push(['変化なし', true]);
  return (
    <div className="ec-chips">
      {chips.map(([t, good], i) => (
        <span key={i} className={good ? 'good' : 'bad'} style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
          {t}
        </span>
      ))}
    </div>
  );
}

function Insolvency({ r }: { r: InsolvencyReport }) {
  return (
    <div className="ec-insolvency">
      <div className="ins-title">⚠ 支払い不能</div>
      <div className="ins-sub">
        負債 {money(r.debtBefore)} が上限 {money(r.limitBefore)} を超えたため清算しました
      </div>
      <ul>
        {r.cashRepaid > 0 && <li>現金で返済 {money(r.cashRepaid)}</li>}
        {r.sold.map((s) => (
          <li key={s.propertyId}>
            強制売却：{ctx.properties[s.propertyId].name} <b>{money(s.proceeds)}</b>
          </li>
        ))}
        {r.forgiven > 0 && (
          <li>
            債務整理：{money(r.forgiven)} 免除（名声 {r.penalty.fame}、幸福度 {r.penalty.happiness}）
          </li>
        )}
      </ul>
      <div className="ins-after">
        清算後の負債 {money(r.debtAfter)} ／ 上限 {money(r.limitAfter)}
      </div>
    </div>
  );
}

/** イベント演出：人物カットイン＋選択肢＋結果 */
export function EventCutin() {
  const game = useGame((s) => s.game)!;
  const fast = useGame((s) => s.fastForward);
  const chooseEvent = useGame((s) => s.chooseEvent);
  const next = useGame((s) => s.next);

  if (game.phase !== 'awaitEvent' && game.phase !== 'eventResult') return null;
  const player = currentPlayer(game);
  if (!player.isHuman && fast) return null;
  const eventId = game.pendingEvent?.eventId ?? game.eventResult?.eventId;
  const ev = eventId ? ctx.events[eventId] : undefined;
  if (!ev) return null;
  const meta = EVENT_CATEGORY_META[ev.category];
  const result = game.phase === 'eventResult' ? game.eventResult : null;
  const press = (fn: () => void) => () => {
    fxBus.emit({ type: 'tap' });
    fn();
  };

  return (
    <div className="ec-overlay" style={{ ['--ec' as string]: meta.color }} key={ev.id + player.id}>
      <div className="ec-backdrop" />
      <EventBg category={ev.category} />
      <div className="ec-rays" />
      <div className="ec-portrait">
        <Portrait characterId={ev.characterId} color={meta.color} />
      </div>
      <div className="ec-card">
        <div className="ec-cat">
          <span>{meta.en}</span>
          {meta.label}
          {ev.placeholder && <em>仮データ</em>}
        </div>
        <div className="ec-who" style={{ color: hex(player.color) }}>
          {player.name}
        </div>
        <h3 className="ec-title">{ev.title}</h3>
        {!result ? (
          <>
            <p className="ec-text">{ev.text}</p>
            {player.isHuman ? (
              <div className="ec-choices">
                {ev.choices.map((c, i) => {
                  const ok = canChoose(player, c);
                  return (
                    <button
                      key={c.id}
                      className={`btn ${i === 0 ? 'gold' : 'ghost'} ec-choice`}
                      disabled={!ok}
                      style={{ animationDelay: `${0.25 + i * 0.08}s` }}
                      onClick={press(() => chooseEvent(c.id))}
                    >
                      {c.label}
                      {c.requiresMoney !== undefined && <small>{ok ? `必要資金 ${money(c.requiresMoney)}` : '資金不足'}</small>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="ec-thinking">考え中…</div>
            )}
          </>
        ) : (
          <div className="ec-result" key="result">
            <div className="ec-choice-made">▶ {ev.choices.find((c) => c.id === result.choiceId)?.label}</div>
            <p className="ec-text strong">{result.text}</p>
            <Chips a={result.applied} />
            {result.insolvency && <Insolvency r={result.insolvency} />}
            {player.isHuman && (
              <button className="btn gold ec-next" onClick={press(next)}>
                次へ
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
