import type { EventCategory } from '../core/types';

// イベント種別の表示情報（仮デザイン。本番はビジュアル制作室の指定に従う）
export const EVENT_CATEGORY_META: Record<EventCategory, { label: string; en: string; color: string }> = {
  social: { label: '社交', en: 'SOCIAL', color: '#d4af37' },
  romance: { label: '恋愛', en: 'ROMANCE', color: '#ff5fa2' },
  fate: { label: '運命', en: 'FATE', color: '#b04dff' },
  vip: { label: 'VIP', en: 'VIP', color: '#8a5cff' },
  business: { label: '商談', en: 'BUSINESS', color: '#3d7bff' },
  scandal: { label: 'スキャンダル', en: 'SCANDAL', color: '#ff6b4a' },
  party: { label: '大富豪パーティー', en: 'PARTY', color: '#f5d77a' },
  bigfate: { label: '運命の大勝負', en: 'BIG GAMBLE', color: '#2fd6c8' },
};
