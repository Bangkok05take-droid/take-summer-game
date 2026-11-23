import { avatarUrl } from '../assets/manifest';
import { useImageAvailable } from '../assets/useImage';
import type { Player } from '../core/types';
import { hex } from './format';

/** プレイヤーの顔アイコン（画像が無ければ色付きの丸＋頭文字） */
export function Avatar({ player, size }: { player: Player; size: number }) {
  const url = avatarUrl(player.id);
  const ok = useImageAvailable(url);
  const style = { width: size, height: size, ['--pc' as string]: hex(player.color) };
  if (ok) return <img className="avatar" style={style} src={url} alt="" draggable={false} />;
  const initial = player.isHuman ? 'P1' : player.name.replace('AI・', '').slice(0, 1);
  return (
    <span className="avatar ph" style={{ ...style, fontSize: size * 0.5 }}>
      {initial}
    </span>
  );
}
