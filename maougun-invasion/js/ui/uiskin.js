/* 承認済みの UI 画像を画面に当てる（SKIN.ui）。
 * 画像が読み込めたものだけ #game に印（クラス）を付けて CSS で差し替える。読めなければ今の見た目のまま。 */
import { SKIN } from '../data/skin.js';

const SLOTS = {
  frame_card: { cls: 'ui-card', v: '--ui-card' },
  frame_panel: { cls: 'ui-panel', v: '--ui-panel' },
  button_spell: { cls: 'ui-spell', v: '--ui-spell' },
  icon_mana: { cls: 'ui-mana', v: '--ui-mana' },
  icon_stone: { cls: 'ui-stone', v: '--ui-stone' },
};

export function applyUiSkin(root = document.getElementById('game')) {
  const ui = SKIN.ui || {};
  for (const [key, slot] of Object.entries(SLOTS)) {
    if (!ui[key]) continue;
    const img = new Image();
    img.onload = () => { root.style.setProperty(slot.v, `url("${ui[key]}")`); root.classList.add(slot.cls); };
    img.onerror = () => console.warn('UI画像を読み込めません（今の見た目のまま）：', ui[key]);
    img.src = ui[key];
  }
  if (ui.logo) {
    const h1 = document.querySelector('.logo');
    const img = new Image();
    img.alt = h1.textContent.replace(/\s+/g, '');
    img.className = 'logoImg';
    img.onload = () => { h1.setAttribute('aria-label', img.alt); h1.replaceChildren(img); h1.classList.add('hasImg'); };
    img.src = ui.logo;
  }
}
