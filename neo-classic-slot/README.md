# NEO CLASSIC SLOT

スマートフォン縦画面向けの、クラシックな3リールスロット（ブラウザゲーム）。
現在は **第1段階**（21コマ配列・内部抽選・目押し・停止制御）の試作品です。

## 遊び方

`index.html`（正式筐体画面）をブラウザ（Android Chrome 推奨）で直接開くだけです。サーバー不要。

| ページ | 内容 |
|---|---|
| `index.html` | ゲーム本体（正式筐体デザイン。画像未配置のパーツは仮表示） |
| `cabinet-preview.html` | レイアウト確認用（正式デザインの重ね表示・パーツ単体の状態テスト） |
| `prototype.html` | 旧試作画面（比較用） |

- 操作: BET（1枚ずつ）→ 左の物理レバー、または大きな LEVER ON（MAX BET＋レバーON）→ STOP×3
- MENU: データ画面（サウンドON/OFF・デバッグパネル・セーブデータ初期化）／ 左下の「× n BOX」: ドル箱画面
- `?images=1` で画像素材、`?sounds=1` で音声素材を読み込み

- **LEVER** でゲーム開始（3枚掛け自動）→ リールが定速になると **STOP** が光る
- PC確認用キー: Space＝レバー、1/2/3 または J/K/L＝停止
- 左リールの BAR を上段〜中段に狙うと、チェリー成立時に必ずチェリーが止まる
- ランプ「NEO!」点灯でボーナス確定 → 7を狙って揃える（ボーナスゲーム本体は第2段階）

## 正式筐体デザイン（準備中）

`cabinet-preview.html` … 正式デザインの筐体レイアウト確認ページ（第1段階のゲームを接続済み）。
各パーツは `js/config/skin.js` の座標で独立配置され、`js/view/cabinet.js` が状態（画像）を切り替えます。
「デザイン重ね」で見本画像と位置を比較できます。必要素材は [docs/ASSETS.md](docs/ASSETS.md)。

## デバッグ

- 画面右上の **DEBUG** でパネル表示（`js/config/game.js` の `DEBUG_PANEL`、または URL `?debug=0/1`）
- 次ゲームの強制当選（BIG/REG/チェリー外れ/2確/先ペカ/大山/小山/山型/BAR一直線/逆押し7/各小役）
- 内部フラグ・押下位置・すべりコマ数・リーチ目の表示
- 抽選確率の検証（100万G）、停止制御の総当たり検証

## 検証（Node.js）

```
node tools/verify.js         # 停止制御の総当たり検証（NGがあれば exit 1）
node tools/search-strips.js  # 配列の自動調整（局所探索・補助ツール）
```

## 構成

設計の詳細・配列表・リーチ目一覧は [docs/DESIGN.md](docs/DESIGN.md) を参照。

```
index.html
css/style.css
js/config/   図柄・配列・役・確率・リーチ目・設定（データ）
js/core/     抽選・判定・停止制御・ゲーム進行・検証（DOM非依存）
js/view/     リール描画・図柄・UI・筐体レイヤー(cabinet.js)
js/effects/  告知演出
js/audio/    サウンド
js/debug/    デバッグパネル
assets/      画像・音声素材の置き場（差し替え用）
tools/       Node 用検証ツール
```
