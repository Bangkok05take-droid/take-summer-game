// 素材パスの一元管理。ChatGPT から本番素材が届いたら public/assets/ に同名で置く。
// 読み込みに失敗した素材は placeholders による仮素材で描画される。
export const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`;

export const assetManifest = {
  // 都市マップ背景（推奨 1440x2560 WebP）
  'city.bangkok.bg': 'cities/bangkok/bg.webp',
  // マス上の建物（推奨 512x512 透過 WebP、接地点=下端中央）
  'city.bangkok.building.bkk_01': 'cities/bangkok/buildings/bkk_01.webp',
  'city.bangkok.building.bkk_03': 'cities/bangkok/buildings/bkk_03.webp',
  'city.bangkok.building.bkk_04': 'cities/bangkok/buildings/bkk_04.webp',
  'city.bangkok.building.bkk_06': 'cities/bangkok/buildings/bkk_06.webp',
  'city.bangkok.building.bkk_08': 'cities/bangkok/buildings/bkk_08.webp',
  'city.bangkok.building.bkk_12': 'cities/bangkok/buildings/bkk_12.webp',
  'city.bangkok.building.bkk_13': 'cities/bangkok/buildings/bkk_13.webp',
  // プレイヤー駒（推奨 256x256 透過 WebP）
  'token.p1': 'characters/tokens/p1.webp',
  'token.p2': 'characters/tokens/p2.webp',
  'token.p3': 'characters/tokens/p3.webp',
  'token.p4': 'characters/tokens/p4.webp',
} as const;

export type AssetId = keyof typeof assetManifest;

export function assetUrl(id: AssetId): string {
  return ASSET_BASE + assetManifest[id];
}
