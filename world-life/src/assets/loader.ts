import { Assets, Texture } from 'pixi.js';
import { assetManifest, assetUrl, type AssetId } from './manifest';

const cache = new Map<AssetId, Texture | null>();

/** 素材を読み込む。存在しない・失敗した場合は null（呼び出し側で仮素材を描く） */
export async function tryLoadTexture(id: AssetId): Promise<Texture | null> {
  if (cache.has(id)) return cache.get(id)!;
  let tex: Texture | null = null;
  try {
    // 存在確認（SPAフォールバックで HTML が返るケースを除外）
    const res = await fetch(assetUrl(id), { method: 'HEAD' });
    const type = res.headers.get('content-type') ?? '';
    if (res.ok && type.startsWith('image/')) tex = await Assets.load<Texture>(assetUrl(id));
  } catch {
    tex = null;
  }
  cache.set(id, tex);
  return tex;
}

export async function preloadAll(): Promise<void> {
  await Promise.all((Object.keys(assetManifest) as AssetId[]).map(tryLoadTexture));
}
