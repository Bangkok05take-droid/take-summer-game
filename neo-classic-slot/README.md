# NEO CLASSIC SLOT

スマートフォン縦画面向けの、クラシックな3リールスロット（ブラウザゲーム）。
現在は **第1段階**（21コマ配列・内部抽選・目押し・停止制御）の試作品です。

## 遊び方

`index.html` をブラウザ（Android Chrome 推奨）で直接開くだけです。サーバー不要。

- **LEVER** でゲーム開始（3枚掛け自動）→ リールが定速になると **STOP** が光る
- PC確認用キー: Space＝レバー、1/2/3 または J/K/L＝停止
- 左リールの BAR を上段〜中段に狙うと、チェリー成立時に必ずチェリーが止まる
- ランプ「NEO!」点灯でボーナス確定 → 7を狙って揃える（ボーナスゲーム本体は第2段階）

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
js/view/     リール描画・図柄・UI
js/effects/  告知演出
js/audio/    サウンド
js/debug/    デバッグパネル
assets/      画像・音声素材の置き場（差し替え用）
tools/       Node 用検証ツール
```
