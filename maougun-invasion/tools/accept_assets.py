#!/usr/bin/env python3
"""承認済み素材の受け入れ（検査 → 取り込み → 登録）

  python3 -I tools/accept_assets.py <納品ZIP> [--dry-run] [--root <maougun-invasion のパス>]

- ZIP の中から、docs/CHATGPT_REQUEST.md で決めたファイル名の素材だけを読む（フォルダの深さは問わない）。
- 検査：PNG か、透過が必要な素材の四隅が透明か、寸法とコマ数が仕様の比率どおりか。
- 合格した素材は、元のバイト列のまま assets/approved/<ファイル名> にコピーする（見た目を変える加工はしない）。
- 自動で登録する種類は js/data/approved.js に書き出す（skin.js が読み込む）。登録した場所だけ仮の表示から差し替わる。
- 出どころは docs/ASSET_SOURCES.md、検査の結果は docs/reports/accept_<日付>_<ZIP名>.md に残す。
- 元の ZIP は変更しない。
"""
import argparse
import hashlib
import io
import json
import re
import sys
import zipfile
from datetime import datetime
from pathlib import Path

from PIL import Image

DEMONS = ['mass', 'vanguard', 'tank', 'ranged', 'fast', 'area', 'healer', 'special']
SOLDIERS = ['militia', 'swordsman', 'archer', 'shield', 'priest', 'rider']
FOOT = 16  # 足元：各コマの下端から16px上
SOLDIER_HEIGHT = 64   # ゲーム内の背丈の目安（論理ドット）
HERO_HEIGHT = 92
# エフェクト：名前 → (1コマの幅, 高さ, コマ数)（docs/CHATGPT_REQUEST.md）
FX_SPEC = {
    'summon': (256, 96, 6), 'hit': (128, 128, 4), 'slash': (192, 192, 4), 'defeat_demon': (192, 192, 6), 'defeat_human': (192, 192, 6),
    'spell': (384, 540, 6), 'big_magic': (384, 384, 6), 'fizzle': (192, 192, 4), 'wave': (384, 256, 4), 'stun': (256, 256, 4), 'heal': (256, 128, 6),
}
# UI：名前 → 推奨サイズ
UI_SPEC = {
    'logo': (1600, 600), 'frame_card': (160, 192), 'frame_panel': (800, 500), 'button_spell': (256, 256), 'icon_mana': (96, 96), 'icon_stone': (96, 96),
    **{f'loot_1-{i}': (192, 192) for i in range(1, 6)},
}
DEMON_HEIGHT = {'mass': 46, 'vanguard': 64, 'tank': 84, 'ranged': 58, 'fast': 50, 'area': 66, 'healer': 56, 'special': 58}


def spec_for(name):
    """ファイル名（assets 内の相対パス）→ 仕様。合わないものは None"""
    m = re.fullmatch(r'units/(\w+)\.png', name)
    if m and m[1] in DEMONS:
        return dict(kind='unit', key=m[1], frame=(256, 256), frames=(4, 1), facing='left', auto=False, height=DEMON_HEIGHT[m[1]])
    m = re.fullmatch(r'humans/(\w+)\.png', name)
    if m and m[1] in SOLDIERS:
        return dict(kind='unit', key=m[1], frame=(256, 256), frames=(4, 1), facing='right', auto=True, height=SOLDIER_HEIGHT)
    if m and m[1] in ('take', 'sai'):
        return dict(kind='unit', key=m[1], frame=(384, 384), frames=(6, 4, 1), facing='right', auto=True, height=HERO_HEIGHT)
    if name == 'bosses/charger.png':
        return dict(kind='unit', key='charger', frame=(384, 384), frames=(16, 1), facing='left', auto=False, height=100)
    m = re.fullmatch(r'bases/(shrine|watchtower|gate|castle)_([012])\.png', name)
    if m:
        size = {'castle': (560, 680)}.get(m[1], (480, 640))
        return dict(kind='building', key=m[1], stage=int(m[2]), frame=size, frames=(1,), auto=True)
    if name == 'bases/shrine_portal.png':
        return dict(kind='other', frame=None, frames=(1,), auto=False)
    if name == 'bg/shrine_room.png':
        return dict(kind='talkbg', key='shrine', frame=(1920, 1080), frames=(1,), opaque=True, auto=True)
    m = re.fullmatch(r'bg/ch1_(wheat|river|gate|plaza)\.png', name)
    if m:
        return dict(kind='stagebg', key={'wheat': '1-2', 'river': '1-3', 'gate': '1-4', 'plaza': '1-5'}[m[1]], frame=(1672, 941), frames=(1,), opaque=True, auto=True)
    m = re.fullmatch(r'talk/(\w+)_(normal|angry|happy|sad)\.png', name)
    if m:
        who = m[1]
        return dict(kind='portrait', key=who, face=m[2], frame=(512, 512), frames=(1,), auto=who in ('take', 'sai', 'tiw', 'mot', 'waan', 'koi'))
    m = re.fullmatch(r'fx/([\w-]+)\.png', name)
    if m and m[1] in FX_SPEC:
        fw, fh, n = FX_SPEC[m[1]]
        return dict(kind='fx', key=m[1], frame=(fw, fh), frames=(n, 1), auto=True)
    m = re.fullmatch(r'ui/([\w-]+)\.png', name)
    if m and m[1] in UI_SPEC:
        return dict(kind='ui', key=m[1], frame=UI_SPEC[m[1]], frames=(1,), auto=True)
    return None


def check(name, data, sp):
    """検査。戻り値：(合格か, 情報, 問題のリスト)"""
    problems = []
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
    except Exception as e:  # noqa: BLE001
        return False, {}, [f'画像として読めません（{e}）']
    if im.format != 'PNG':
        problems.append(f'PNGではありません（{im.format}）')
    w, h = im.size
    info = {'size': f'{w}×{h}', 'w': w, 'h': h}
    opaque = sp.get('opaque')
    if not opaque:
        rgba = im.convert('RGBA')
        a = rgba.getchannel('A')
        corners = [a.getpixel((0, 0)), a.getpixel((w - 1, 0)), a.getpixel((0, h - 1)), a.getpixel((w - 1, h - 1))]
        if im.mode not in ('RGBA', 'LA', 'P') or max(corners) > 0:
            problems.append('背景が透過されていません（四隅が不透明）')
        hist = a.histogram()
        clear = sum(hist[:8]) / (w * h)
        info['clear'] = f'{clear:.0%}'
        if clear < 0.15:
            problems.append(f'透明な部分が少なすぎます（{clear:.0%}）。背景が残っていないか確認してください')
    fr = sp.get('frame')
    if fr:
        fw, fh = fr
        if sp['frames'] and sp['frames'] != (1,) and sp['kind'] in ('unit', 'fx'):
            # 1コマの高さを基準に、横に何コマあるか
            n = round(w / (h * fw / fh))
            info['frames'] = n
            if n not in sp['frames'] or abs(w - n * h * fw / fh) > max(2, w * 0.01):
                problems.append(f'コマ数・比率が仕様と合いません（{w}×{h}：1コマ{fw}×{fh}を横に{"・".join(map(str, sp["frames"]))}コマ）')
        elif sp['kind'] == 'building':
            # 建物は縦長〜正方形まで受け入れる（2026-11-24：承認済みの batch01 が 384×384）。足元は絵の一番下から測る
            if not (0.5 <= w / h <= 1.25):
                problems.append(f'縦横比が建物として受け入れられる範囲（縦長〜正方形）を外れています（{w}×{h}）')
            bb = im.convert('RGBA').getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
            if bb:
                info['footY'] = bb[3]
                if h - bb[3] > h * 0.08:
                    problems.append(f'足元の下に余白が多すぎます（{h - bb[3]}px）')
            if w < 256:
                problems.append('小さすぎます（256px 以上）')
        else:
            if abs(w / h - fw / fh) > 0.02:
                problems.append(f'縦横比が仕様（{fw}×{fh}）と合いません（{w}×{h}）')
            if w < fw * 0.5:
                problems.append(f'小さすぎます（推奨 {fw}×{fh} 以上）')
    return not problems, info, problems


def frames_map(key, n):
    if n == 1:
        return {'walk': [0], 'windup': 0, 'attack': 0}
    if key == 'charger' and n >= 16:
        return {'walk': [2, 3, 4, 5], 'windup': 6, 'attack': 8, 'idle': [0, 1], 'skill': [10, 11, 12, 13, 14, 15]}
    if n >= 6:
        return {'walk': [0, 1], 'windup': 2, 'attack': 3, 'skillWindup': 4, 'skill': 5}
    return {'walk': [0, 1], 'windup': 2, 'attack': 3}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('zip')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--root', default=str(Path(__file__).resolve().parent.parent))
    args = ap.parse_args()
    root = Path(args.root)
    zpath = Path(args.zip)
    zsha = hashlib.sha256(zpath.read_bytes()).hexdigest()

    manifest_path = root / 'js/data/approved.js'
    approved = {'sprites': {}, 'images': {'stageBg': {}, 'base': {}, 'shrine': None, 'talkBg': {}}, 'portraits': {}, 'fx': {}, 'ui': {}}
    if manifest_path.exists():
        txt = manifest_path.read_text(encoding='utf-8')
        m = re.search(r'/\*JSON\*/(.*)/\*END\*/', txt, re.S)
        if m:
            old = json.loads(m[1])
            approved.update(old)
            approved.setdefault('fx', {}); approved.setdefault('ui', {})

    results = []
    with zipfile.ZipFile(zpath) as z:
        for info in z.infolist():
            if info.is_dir() or '__MACOSX' in info.filename:
                continue
            parts = Path(info.filename).parts
            name = None
            for i in range(len(parts)):  # フォルダの深さは問わない（…/humans/militia.png など）
                cand = '/'.join(parts[i:])
                if spec_for(cand):
                    name = cand
                    break
            if not name:
                results.append((info.filename, None, False, {}, ['ファイル名が依頼書の一覧にありません（取り込みません）'], ''))
                continue
            sp = spec_for(name)
            data = z.read(info)
            ok, meta, problems = check(name, data, sp)
            reg = ''
            dst = f'assets/approved/{name}'
            if ok and not args.dry_run:
                out = root / dst
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(data)  # 元のバイト列のまま
            if ok:
                reg = register(approved, sp, dst, meta)
            results.append((info.filename, name, ok, meta, problems, reg, hashlib.sha256(data).hexdigest()))

    stamp = datetime.now().strftime('%Y%m%d_%H%M')
    lines = [f'# 素材の受け入れ結果（{zpath.name}）', '', f'- 日時：{datetime.now():%Y-%m-%d %H:%M}', f'- ZIP の SHA256：`{zsha}`', f'- {"検査のみ（--dry-run）" if args.dry_run else "合格した素材を assets/approved/ に取り込み"}', '',
             '| ファイル | 判定 | 寸法 | コマ | 透明 | 問題・登録 |', '|---|---|---|---|---|---|']
    for r in results:
        fn, name, ok, meta, problems, reg = r[:6]
        lines.append(f'| `{fn}` | {"合格" if ok else "不合格" if name else "対象外"} | {meta.get("size", "")} | {meta.get("frames", "")} | {meta.get("clear", "")} | {"<br>".join(problems) or reg} |')
    report = '\n'.join(lines) + '\n'
    print(report)

    if not args.dry_run:
        (root / 'docs/reports').mkdir(parents=True, exist_ok=True)
        (root / f'docs/reports/accept_{stamp}_{zpath.stem}.md').write_text(report, encoding='utf-8')
        manifest_path.write_text(
            '/* 承認済み素材の登録（tools/accept_assets.py が自動で書く。手で直さない）\n'
            ' * skin.js がこの内容を読み込み、登録された場所だけ仮の表示から差し替わる。 */\n'
            f'export const APPROVED = /*JSON*/{json.dumps(approved, ensure_ascii=False, indent=2)}/*END*/;\n', encoding='utf-8')
        src = root / 'docs/ASSET_SOURCES.md'
        with src.open('a', encoding='utf-8') as f:
            f.write(f'<!-- ZIP SHA256: {zsha} -->\n')
            for r in results:
                if r[2]:
                    f.write(f'| {datetime.now():%Y-%m-%d} | `{zpath.name}` | `{r[0]}` | `{r[6][:16]}…` | `assets/approved/{r[1]}` | `{r[6][:16]}…` | 加工なし（そのままコピー） |\n')
    return 0 if all(r[2] or not r[1] for r in results) else 1


def register(approved, sp, dst, meta):
    """自動で登録できる種類は approved に書く。戻り値：表に書く説明"""
    k = sp['kind']
    if k == 'unit':
        n = meta.get('frames', 1)
        fh = meta['h']
        fw = round(meta['w'] / n)
        entry = {'src': dst, 'frameW': fw, 'frameH': fh, 'frames': frames_map(sp['key'], n), 'footY': round(fh - FOOT * fh / sp['frame'][1]),
                 'facing': sp['facing'], 'scale': round(sp['height'] / fh, 4)}
        if sp['auto']:
            approved['sprites'][sp['key']] = entry
            return f'登録：sprites.{sp["key"]}（{n}コマ）'
        return f'取り込みのみ。登録はプロジェクトの持ち主が skin.js の sprites に追加：`{sp["key"]}: {json.dumps(entry, ensure_ascii=False)}`'
    if k == 'building':
        key = sp['key']
        width = {'shrine': 210, 'watchtower': 190, 'gate': 220, 'castle': 240}[key]  # 画面での横幅（論理ドット）
        if key == 'shrine':
            cur = approved['images'].get('shrine') or {'width': width, 'stages': [None, None, None]}
            cur['footY'] = meta.get('footY', meta['h'])
            cur['stages'][sp['stage']] = dst
            cur['src'] = cur['stages'][0] or dst
            approved['images']['shrine'] = cur
        else:
            slot = {'watchtower': 'tower'}.get(key, key)
            cur = approved['images']['base'].get(slot) or {'width': width, 'stages': [None, None, None]}
            cur['footY'] = meta.get('footY', meta['h'])
            cur['stages'][sp['stage']] = dst
            cur['src'] = cur['stages'][0] or dst
            approved['images']['base'][slot] = cur
        return f'登録：{key}（{sp["stage"]}段階目）'
    if k == 'stagebg':
        approved['images']['stageBg'][sp['key']] = {'src': dst, 'scale': round(583 / meta['h'], 4), 'offsetY': -66}
        return f'登録：stageBg.{sp["key"]}'
    if k == 'talkbg':
        approved['images']['talkBg'][sp['key']] = dst
        return '登録：talkBg.shrine'
    if k == 'portrait':
        key = f'{sp["key"]}_{sp["face"]}'
        if sp['auto']:
            approved['portraits'][key] = dst
            return f'登録：portraits.{key}'
        return f'取り込みのみ。登録はプロジェクトの持ち主が skin.js の portraits に追加：`{key}: \'{dst}\'`'
    if k == 'fx':
        n = meta.get('frames', 1)
        approved['fx'][sp['key']] = {'src': dst, 'frameW': round(meta['w'] / n), 'frameH': meta['h'], 'frames': n}
        return f'登録：fx.{sp["key"]}（{n}コマ）'
    if k == 'ui':
        approved['ui'][sp['key']] = dst
        return f'登録：ui.{sp["key"]}'
    return '取り込みのみ（ゲームへのつなぎこみは今後）'


if __name__ == '__main__':
    sys.exit(main())
