// イベント登場人物（仮）。本番の人物設定・画像は ChatGPT ビジュアル制作室が担当。
// 画像: public/assets/characters/cutin/<id>.webp（推奨 1024×1536 透過 WebP）
export interface CharacterDef {
  id: string;
  /** 仮の表示名 */
  name: string;
  /** 仮素材の色 */
  color: number;
}

export const CHARACTERS: Record<string, CharacterDef> = {
  socialite: { id: 'socialite', name: '社交界の華', color: 0xd4af37 },
  investor: { id: 'investor', name: '投資家', color: 0x3d7bff },
  muse: { id: 'muse', name: '運命の人', color: 0xff5fa2 },
  oracle: { id: 'oracle', name: '占い師', color: 0xb04dff },
  host: { id: 'host', name: 'クラブの支配人', color: 0x8a5cff },
  celebrity: { id: 'celebrity', name: '有名人', color: 0xffd36b },
  reporter: { id: 'reporter', name: '記者', color: 0xff6b4a },
  tycoon: { id: 'tycoon', name: '大富豪', color: 0xf5d77a },
  dealer: { id: 'dealer', name: '伝説のディーラー', color: 0x2fd6c8 },
};
