# WORLD LIFE（Phase 1 試作版：バンコク）

スマホ縦画面向けブラウザボードゲーム。

## 開発

```bash
npm ci
npm run dev       # 開発サーバー
npm test          # ルールの自動テスト（Vitest）
npm run build     # 型チェック + 本番ビルド（dist/）
```

## 構成

| ディレクトリ | 役割 |
|---|---|
| `src/core/` | ゲームルール（純TS・描画非依存）。移動、ターン、物件、スコア、セーブ、AI |
| `src/data/` | マップ・物件・基本ルール値などのデータ。数値調整はここだけ |
| `src/render/` | PixiJS による都市マップ描画、カメラ（スクロール・ズーム） |
| `src/ui/` | React の HUD・操作パネル・結果画面 |
| `src/store/` | Zustand。core と UI/描画の橋渡し、AI進行、自動セーブ |
| `src/assets/manifest.ts` | 素材パスの一元管理 |
| `public/assets/` | 本番素材の置き場所 |
| `tests/core/` | 自動テスト |

## 素材の差し替え

`src/assets/manifest.ts` に記載されたパスへ、同じファイル名で `public/assets/` 配下に置くと自動で反映されます。
ファイルが無い場合は仮素材（図形・絵文字）で描画されます。

| 素材ID | パス | 推奨 |
|---|---|---|
| city.bangkok.bg | cities/bangkok/bg.webp | 1000:1440 比率（例 1500×2160）WebP |
| city.bangkok.building.bkk_XX | cities/bangkok/buildings/bkk_XX.webp | 512×512 透過、接地点=下端中央 |
| token.p1〜p4 | characters/tokens/p1.webp 等 | 256×256 透過 |

マスの座標は `src/data/maps/bangkok.ts` の `pos`（ワールド座標 1000×1440）。
