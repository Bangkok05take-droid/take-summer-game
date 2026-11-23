import { useEffect, useState } from 'react';

// 画像の有無を一度だけ確認してキャッシュする（未提供素材で壊れた画像アイコンを出さないため）
const cache = new Map<string, boolean>();
const pending = new Map<string, Promise<boolean>>();

function probe(url: string): Promise<boolean> {
  if (cache.has(url)) return Promise.resolve(cache.get(url)!);
  let p = pending.get(url);
  if (!p) {
    p = new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0);
      img.onerror = () => resolve(false);
      img.src = url;
    }).then((ok) => {
      cache.set(url, ok);
      pending.delete(url);
      return ok;
    });
    pending.set(url, p);
  }
  return p;
}

/** true=画像あり / false=なし（仮素材を出す）/ null=確認中 */
export function useImageAvailable(url: string): boolean | null {
  const [ok, setOk] = useState<boolean | null>(cache.has(url) ? cache.get(url)! : null);
  useEffect(() => {
    let alive = true;
    if (cache.has(url)) setOk(cache.get(url)!);
    else void probe(url).then((v) => alive && setOk(v));
    return () => {
      alive = false;
    };
  }, [url]);
  return ok;
}
