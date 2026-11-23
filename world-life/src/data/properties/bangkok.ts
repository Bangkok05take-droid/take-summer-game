import type { EconomyRules, PropertyDef } from '../../core/types';

// 物件価格・収益は仮値（開発本部の調整待ち）。ここを書き換えるだけで反映される。
const list: PropertyDef[] = [
  { id: 'prop_bkk_01', nodeId: 'bkk_01', area: 'sukhumvit', name: 'スクンビット・ホテル', price: 150_000, income: 15_000 },
  { id: 'prop_bkk_03', nodeId: 'bkk_03', area: 'sukhumvit', name: 'スクンビット・オフィス', price: 200_000, income: 20_000 },
  { id: 'prop_bkk_04', nodeId: 'bkk_04', area: 'siam', name: 'サイアム高級モール', price: 280_000, income: 28_000 },
  { id: 'prop_bkk_06', nodeId: 'bkk_06', area: 'siam', name: 'サイアム芸能事務所', price: 220_000, income: 22_000 },
  { id: 'prop_bkk_08', nodeId: 'bkk_08', area: 'silom', name: 'シーロム金融会社', price: 320_000, income: 32_000 },
  { id: 'prop_bkk_12', nodeId: 'bkk_12', area: 'riverside', name: 'リバーサイド・クルーズ', price: 260_000, income: 26_000 },
  { id: 'prop_bkk_13', nodeId: 'bkk_13', area: 'riverside', name: 'リバーサイド高級ホテル', price: 350_000, income: 35_000 },
];

export const bangkokProperties: Record<string, PropertyDef> = Object.fromEntries(list.map((p) => [p.id, p]));

export const defaultEconomy: EconomyRules = {
  areaMonopolyMultiplier: 1.2,
  monopolyMinProperties: 2,
  // 買収（暫定値）: 購入価格の1.5倍、独占エリアは2倍。代金は元の所有者に支払う
  buyoutMultiplier: 1.5,
  monopolyBuyoutMultiplier: 2,
  // 負債上限 = 総物件評価額の50% + $200,000（指令 No.004）
  debtLimitPropertyRatio: 0.5,
  debtLimitBase: 200_000,
  // 以下は暫定値（本部の調整待ち）
  forcedSaleRatio: 0.7,
  restructurePenalty: { fame: -10, happiness: -10 },
};
