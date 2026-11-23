# WORLD LIFE 素材受け入れ仕様（ビジュアル制作室向け）

ファイルを `world-life/public/assets/` 配下の指定パスに **同じファイル名** で置くと、コード変更なしで自動的に差し替わります。
未提供の素材は仮素材（図形・シルエット・合成音）で表示されます。

受け入れ状況の確認: 試遊URLの末尾に `?assets` を付けると一覧が表示されます。
座標合わせ: 試遊URLの末尾に `?debug` を付けると、マップをタップした位置の座標が表示されます。

## マップ

| パス | 推奨 | 備考 |
|---|---|---|
| `cities/bangkok/bg.webp` | 1000:1440 比（例 1500×2160）WebP 品質80 | 1辺4096px以下。マス位置は `src/data/maps/bangkok.ts` の `pos`（1000×1440 座標）に合わせる |
| `cities/bangkok/buildings/bkk_01.webp` ほか（01,03,04,06,08,12,13） | 512×512 透過 WebP | 接地点＝画像の下端中央。マス上に約110pxで表示 |
| `characters/tokens/p1.webp`〜`p4.webp` | 256×256 透過 WebP | プレイヤー駒。p1=あなた（金）、p2=紫、p3=青、p4=緑 |

## イベント演出

| パス | 推奨 | 備考 |
|---|---|---|
| `characters/cutin/<id>.webp` | 1024×1536（2:3）透過 WebP、300KB以下目安 | 画面上部から大きく表示。顔は画像の上 1/3 に配置 |
| `events/bg/<category>.webp` | 1080×1080 WebP | カットインの背面（半透明で表示） |

人物ID（仮）: socialite（社交界の華）, investor（投資家）, muse（運命の人）, oracle（占い師）, host（クラブの支配人）, celebrity（有名人）, reporter（記者）, tycoon（大富豪）, dealer（伝説のディーラー）

イベント種別: social, romance, fate, vip, business, scandal, party, bigfate

## 効果音

`sfx/<id>.mp3`（短く、ピーク -3dB 程度）

tap, diceRoll, diceResult, step, land, branch, purchase, income, turnStart, yourTurn, gameOver, eventOpen, eventGood, eventBad

## データの差し替え（ChatGPT本部向け）

| 内容 | ファイル |
|---|---|
| イベントの文章・選択肢・効果 | `src/data/events/bangkok.ts`（現在はすべて仮データ） |
| 物件価格・収益・独占ボーナス | `src/data/properties/bangkok.ts` |
| 人物の一覧 | `src/data/characters.ts` |
| イベント種別の表示名・色 | `src/data/eventCategories.ts` |
