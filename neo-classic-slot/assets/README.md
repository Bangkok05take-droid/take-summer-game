# 素材の差し替え

## 画像（第5段階・Gemini 制作）
`assets/images/` に以下のファイル名で配置し、`js/config/game.js` の `USE_IMAGE_ASSETS` を `true` にします。
未配置の図柄は仮のベクター図柄で描画されます。図柄1コマの表示比率は 横:縦 ≒ 1 : 0.62（透過PNG推奨）。

| 図柄 | ファイル |
|---|---|
| 赤7 | sym_seven.png |
| BAR | sym_bar.png |
| チェリー | sym_cherry.png |
| ブドウ | sym_grape.png |
| ベル | sym_bell.png |
| リプレイ | sym_replay.png |
| 山 | sym_mountain.png |
| スター | sym_star.png |

パスは `js/config/symbols.js` で変更できます。

## 音声（第4段階）
`assets/sounds/` に配置し `USE_SOUND_ASSETS` を `true` に。ファイル名は `js/audio/sound.js` の `FILES` を参照
（lever / stop / pay / lamp / bgm_normal / bgm_bonus）。未配置の音は合成音で代用します。
