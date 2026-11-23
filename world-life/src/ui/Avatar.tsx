import { useState } from 'react';
import { avatarUrl } from '../assets/manifest';
import type { Player } from '../core/types';
import { hex } from './format';

/** プレイヤーの顔アイコン（画像が無ければ色付きの丸＋頭文字） */
export function Avatar({ player, size }: { player: Player; size: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, ['--pc' as string]: hex(player.color) };
  if (!failed) {
    return <img className="avatar" style={style} src={avatarUrl(player.id)} alt="" onError={() => setFailed(true)} draggable={false} />;
  }
  const initial = player.isHuman ? 'P1' : player.name.replace('AI・', '').slice(0, 1);
  return (
    <span className="avatar ph" style={{ ...style, fontSize: size * 0.5 }}>
      {initial}
    </span>
  );
}
