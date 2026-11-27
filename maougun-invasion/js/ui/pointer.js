/* チュートリアルの「ここを押してね」の指し示し（2026-11-25）
 * .tutor-focus が付いた要素を探して、その上（上に余白が無ければ下）に「▼ ここ！」を出し、弾ませる。
 * 光らせる見た目は css の .tutor-focus。説明の仕組み（tutorial.js・screenTutor.js）は変えない */
export function startPointer() {
  const el = document.createElement('div');
  el.id = 'tutorPointer'; el.hidden = true; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<span class="pt-arrow">▼</span><span class="pt-text">ここ！</span>';
  document.body.appendChild(el);
  const tick = () => {
    const t = document.querySelector('.tutor-focus');
    const r = t && t.getBoundingClientRect();
    if (!r || !r.width || t.closest('[hidden]')) { el.hidden = true; }
    else {
      el.hidden = false;
      const below = r.top < 70;
      el.classList.toggle('below', below);
      el.style.left = `${r.left + r.width / 2}px`;
      el.style.top = below ? `${r.bottom + 6}px` : `${r.top - 6}px`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
