/* 承認済み画像の読み込み。読み終わるまで・読めなかったときは null を返し、呼び出し側は仮の表示を使う */
const store = new Map();
export function getImage(src) {
  if (!src || typeof Image === 'undefined') return null;
  let s = store.get(src);
  if (!s) {
    s = { img: new Image(), ok: false, failed: false };
    s.img.onload = () => { s.ok = true; };
    s.img.onerror = () => { s.failed = true; console.warn('素材を読み込めません（仮の表示を使います）：', src); };
    s.img.src = src;
    store.set(src, s);
  }
  return s.ok ? s.img : null;
}
export function preload(srcs) { for (const s of srcs) getImage(s); }
