import type { CityMap, MapNode } from '../../core/types';

// バンコク16マス（開発本部指令 No.001 準拠）
// pos は仮の座標。本番背景が届いたら合わせて調整する。
const nodes: MapNode[] = [
  // スクンビット
  { id: 'bkk_00', area: 'sukhumvit', type: 'start', label: '空港・START', pos: { x: 820, y: 1290 }, next: ['bkk_01'] },
  { id: 'bkk_01', area: 'sukhumvit', type: 'property', label: 'ホテル', pos: { x: 840, y: 1080 }, next: ['bkk_02'], propertyId: 'prop_bkk_01' },
  { id: 'bkk_02', area: 'sukhumvit', type: 'social', label: 'ルーフトップバー', pos: { x: 830, y: 880 }, next: ['bkk_03'] },
  { id: 'bkk_03', area: 'sukhumvit', type: 'property', label: 'オフィス', pos: { x: 660, y: 740 }, next: ['bkk_04', 'bkk_07'], propertyId: 'prop_bkk_03' },
  // サイアム
  { id: 'bkk_04', area: 'siam', type: 'property', label: '高級モール', pos: { x: 860, y: 560 }, next: ['bkk_05'], propertyId: 'prop_bkk_04' },
  { id: 'bkk_05', area: 'siam', type: 'romance', label: '恋愛', pos: { x: 860, y: 350 }, next: ['bkk_06'] },
  { id: 'bkk_06', area: 'siam', type: 'property', label: '芸能事務所', pos: { x: 720, y: 170 }, next: ['bkk_07'], propertyId: 'prop_bkk_06' },
  { id: 'bkk_07', area: 'siam', type: 'fate', label: '運命', pos: { x: 510, y: 300 }, next: ['bkk_08'] },
  // シーロム
  { id: 'bkk_08', area: 'silom', type: 'property', label: '金融会社', pos: { x: 300, y: 170 }, next: ['bkk_09'], propertyId: 'prop_bkk_08' },
  { id: 'bkk_09', area: 'silom', type: 'vip', label: 'VIPクラブ', pos: { x: 160, y: 350 }, next: ['bkk_10'] },
  { id: 'bkk_10', area: 'silom', type: 'business', label: '商談', pos: { x: 160, y: 560 }, next: ['bkk_11'] },
  { id: 'bkk_11', area: 'silom', type: 'scandal', label: 'スキャンダル', pos: { x: 360, y: 740 }, next: ['bkk_12', 'bkk_15'] },
  // リバーサイド
  { id: 'bkk_12', area: 'riverside', type: 'property', label: 'クルーズ会社', pos: { x: 160, y: 900 }, next: ['bkk_13'], propertyId: 'prop_bkk_12' },
  { id: 'bkk_13', area: 'riverside', type: 'property', label: '高級ホテル', pos: { x: 160, y: 1110 }, next: ['bkk_14'], propertyId: 'prop_bkk_13' },
  { id: 'bkk_14', area: 'riverside', type: 'party', label: '大富豪パーティー', pos: { x: 320, y: 1300 }, next: ['bkk_15'] },
  { id: 'bkk_15', area: 'riverside', type: 'bigfate', label: '運命の大勝負', pos: { x: 540, y: 1150 }, next: ['bkk_00'] },
];

export const bangkokMap: CityMap = {
  id: 'bangkok',
  name: 'バンコク',
  startNodeId: 'bkk_00',
  size: { width: 1000, height: 1440 },
  areas: {
    sukhumvit: { id: 'sukhumvit', name: 'スクンビット', color: 0xd4af37 },
    siam: { id: 'siam', name: 'サイアム', color: 0xc04dff },
    silom: { id: 'silom', name: 'シーロム', color: 0x3d7bff },
    riverside: { id: 'riverside', name: 'リバーサイド', color: 0x2fd6c8 },
  },
  nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
};
