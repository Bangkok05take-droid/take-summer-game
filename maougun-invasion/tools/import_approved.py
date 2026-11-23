#!/usr/bin/env python3
"""承認済み素材の取り込み（元のZIPと画像は変更しない）。

  python3 -I tools/import_approved.py <承認ZIPのパス>

- IMPORTS に書いたファイルだけを ZIP から読み、assets/approved/ に「加工コピー」として保存する。
  加工は、見た目を変えない範囲（形式の変換・圧縮）だけ。描き直し・色の変更・切り抜きはしない。
- 取り込んだ内容は docs/ASSET_SOURCES.md に追記する（ZIP名・ZIP内のパス・元のSHA256・保存先・加工内容）。
"""
import hashlib
import io
import sys
import zipfile
from datetime import date
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent

# ZIP内のパス → 保存先（maougun-invasion/ からの相対パス）
IMPORTS = {
    '02_APPROVED_SCENES/village_background_reference.png': 'assets/approved/bg/ch1_village.webp',
}


def main(zpath: str) -> None:
    zpath = Path(zpath)
    zsha = hashlib.sha256(zpath.read_bytes()).hexdigest()
    rows = []
    with zipfile.ZipFile(zpath) as z:
        for src, dst in IMPORTS.items():
            data = z.read(src)
            sha = hashlib.sha256(data).hexdigest()
            im = Image.open(io.BytesIO(data)).convert('RGB')
            out = ROOT / dst
            out.parent.mkdir(parents=True, exist_ok=True)
            im.save(out, 'WEBP', quality=92, method=6)
            osha = hashlib.sha256(out.read_bytes()).hexdigest()
            rows.append(f'| {date.today()} | `{zpath.name}` | `{src}` | `{sha[:16]}…` | `{dst}` | `{osha[:16]}…` | WebP（品質92）へ変換のみ。寸法 {im.size[0]}×{im.size[1]} のまま、描き直し・色の変更なし |')
            print('saved', dst, out.stat().st_size, 'bytes')
    doc = ROOT / 'docs' / 'ASSET_SOURCES.md'
    if not doc.exists():
        doc.write_text('# 取り込んだ承認済み素材の出どころ\n\n`tools/import_approved.py` が自動で追記する。元のZIP・画像は変更していない。\n\n'
                       '| 日付 | ZIP | ZIP内のパス | 元のSHA256 | 保存先 | 保存後のSHA256 | 加工 |\n|---|---|---|---|---|---|---|\n', encoding='utf-8')
    with doc.open('a', encoding='utf-8') as f:
        f.write(f'<!-- ZIP SHA256: {zsha} -->\n')
        for r in rows:
            f.write(r + '\n')


if __name__ == '__main__':
    main(sys.argv[1])
