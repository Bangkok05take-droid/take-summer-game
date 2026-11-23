import { useEffect, useState } from 'react';
import { ASSET_BASE, assetManifest, characterCutinUrl, eventBgUrl, sfxUrl } from '../assets/manifest';
import { CHARACTERS } from '../data/characters';
import { EVENT_CATEGORY_META } from '../data/eventCategories';

// 素材受け入れ確認ページ（URL末尾に ?assets）。どの素材が本番化済みかを一覧表示する。
interface Row {
  group: string;
  id: string;
  url: string;
  spec: string;
  kind: 'image' | 'audio';
}

const SFX_IDS = ['tap', 'diceRoll', 'diceResult', 'step', 'land', 'branch', 'purchase', 'income', 'turnStart', 'yourTurn', 'gameOver', 'eventOpen', 'eventGood', 'eventBad'];

function rows(): Row[] {
  const r: Row[] = [];
  for (const [id, path] of Object.entries(assetManifest)) {
    const spec = id.endsWith('.bg') ? '1000:1440比 (例1500×2160) WebP' : id.startsWith('token') ? '256×256 透過WebP' : '512×512 透過WebP 下端中央接地';
    r.push({ group: 'マップ', id, url: ASSET_BASE + path, spec, kind: 'image' });
  }
  for (const c of Object.values(CHARACTERS)) {
    r.push({ group: '人物カットイン', id: `characters/cutin/${c.id}.webp（${c.name}）`, url: characterCutinUrl(c.id), spec: '1024×1536 透過WebP', kind: 'image' });
  }
  for (const cat of Object.keys(EVENT_CATEGORY_META)) {
    r.push({ group: 'イベント背景', id: `events/bg/${cat}.webp`, url: eventBgUrl(cat), spec: '1080×1080 WebP', kind: 'image' });
  }
  for (const id of SFX_IDS) r.push({ group: '効果音', id: `sfx/${id}.mp3`, url: sfxUrl(id), spec: 'mp3 (短く・ピーク-3dB)', kind: 'audio' });
  return r;
}

async function exists(row: Row): Promise<boolean> {
  try {
    const res = await fetch(row.url, { method: 'HEAD' });
    const type = res.headers.get('content-type') ?? '';
    return res.ok && type.startsWith(row.kind === 'image' ? 'image/' : 'audio/');
  } catch {
    return false;
  }
}

export function AssetCheck() {
  const [list] = useState(rows);
  const [status, setStatus] = useState<Record<string, boolean>>({});
  useEffect(() => {
    void Promise.all(list.map(async (r) => [r.url, await exists(r)] as const)).then((pairs) => setStatus(Object.fromEntries(pairs)));
  }, [list]);
  const done = Object.values(status).filter(Boolean).length;
  return (
    <div className="asset-check">
      <h2>素材チェック</h2>
      <p>
        本番素材 {done} / {list.length}　（未提供は仮素材で表示）
      </p>
      <table>
        <tbody>
          {list.map((r, i) => (
            <tr key={r.url} className={status[r.url] ? 'ok' : ''}>
              {(i === 0 || list[i - 1].group !== r.group) && (
                <th rowSpan={list.filter((x) => x.group === r.group).length}>{r.group}</th>
              )}
              <td>{status[r.url] === undefined ? '…' : status[r.url] ? '✅' : '仮'}</td>
              <td>
                <code>public/assets/{r.url.slice(ASSET_BASE.length)}</code>
                <small>{r.spec}</small>
              </td>
              <td>{status[r.url] && r.kind === 'image' && <img src={r.url} alt="" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <a className="btn ghost" href="./">
        ゲームへ戻る
      </a>
    </div>
  );
}
