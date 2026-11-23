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
  // マス種別アイコン（推奨 128×128 透過 WebP）。物件マスは建物画像があればそちらを優先
  'icon.node.start': 'icons/nodes/start.webp',
  'icon.node.property': 'icons/nodes/property.webp',
  'icon.node.social': 'icons/nodes/social.webp',
  'icon.node.romance': 'icons/nodes/romance.webp',
  'icon.node.fate': 'icons/nodes/fate.webp',
  'icon.node.vip': 'icons/nodes/vip.webp',
  'icon.node.business': 'icons/nodes/business.webp',
  'icon.node.scandal': 'icons/nodes/scandal.webp',
  'icon.node.party': 'icons/nodes/party.webp',
  'icon.node.bigfate': 'icons/nodes/bigfate.webp',
} as const;

export type AssetId = keyof typeof assetManifest;

export function assetUrl(id: AssetId): string {
  return ASSET_BASE + assetManifest[id];
}

// ---------- DOM（React）で使う素材：イベント演出 ----------
// 画像が無い場合は CSS の仮表示になる。

/** イベント用人物カットイン（推奨 1024×1536 透過 WebP） */
export function characterCutinUrl(characterId: string): string {
  return `${ASSET_BASE}characters/cutin/${characterId}.webp`;
}

/** イベント背景（推奨 1080×1080 WebP） */
export function eventBgUrl(category: string): string {
  return `${ASSET_BASE}events/bg/${category}.webp`;
}

/** HUD・順位表のプレイヤー顔アイコン（推奨 256×256 透過 WebP、駒と同じ人物） */
export function avatarUrl(playerId: string): string {
  return `${ASSET_BASE}characters/avatars/${playerId}.webp`;
}

/** タイトル背景（推奨 1080×1920 WebP） */
export const TITLE_BG_URL = `${ASSET_BASE}ui/title_bg.webp`;

/** 効果音（mp3）。置くと合成音の代わりに再生される */
export function sfxUrl(id: string): string {
  return `${ASSET_BASE}sfx/${id}.mp3`;
}
