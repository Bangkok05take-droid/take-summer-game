# 素材フォルダ

```
assets/
  design/   reference_cabinet.jpg … 正式筐体デザイン（位置合わせ用の見本。ゲームでは表示しない）
  images/
    cabinet/  筐体背景・リール枠
    symbols/  リール図柄（8種）
    lamps/    LUCKY CHANCE・ステータス・ラインランプ・ボーナスパネル
    buttons/  STOP・LEVER ON・レバー・AUTO PLAY・MENU
    display/  LED数字スプライト（任意）
    effects/  BIG/REG 演出ロゴ等
  sounds/     効果音・BGM（第4段階）
```

必要な素材のファイル名・サイズ・位置は [docs/ASSETS.md](../docs/ASSETS.md) を参照。
画像を置いたら `js/config/game.js` の `USE_IMAGE_ASSETS` を `true` にします。
