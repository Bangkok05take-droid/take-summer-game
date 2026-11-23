import { useEffect, useRef, useState } from 'react';
import { money } from './format';

/** 金額の増減をカウントアップ表示し、増減で色が光る */
export function AnimatedMoney({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const from = useRef(value);
  const raf = useRef(0);

  useEffect(() => {
    if (value === from.current) return;
    const start = performance.now();
    const a = shown;
    const b = value;
    setFlash(b > a ? 'up' : 'down');
    const dur = 700;
    cancelAnimationFrame(raf.current);
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const e = 1 - (1 - k) ** 3;
      setShown(Math.round(a + (b - a) * e));
      if (k < 1) raf.current = requestAnimationFrame(step);
      else setTimeout(() => setFlash(null), 250);
    };
    raf.current = requestAnimationFrame(step);
    from.current = value;
    return () => cancelAnimationFrame(raf.current);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className={`pmoney${flash ? ` flash-${flash}` : ''}`}>{money(shown)}</div>;
}
