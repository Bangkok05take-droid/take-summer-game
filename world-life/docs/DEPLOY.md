# 試遊版の公開手順

公開先: https://bangkok05take-droid.github.io/take-summer-game/world-life/
（既存ゲーム: https://bangkok05take-droid.github.io/take-summer-game/ ）

既存ゲームの GitHub Pages 公開ブランチ `claude/takenin-summer-game-em1re8` に、`world-life/` フォルダだけを追加・更新する方式（指令 No.003 A案）。

```bash
cd world-life
./scripts/deploy-pages.sh
```

スクリプトの安全策:
1. 公開前に自動テストとビルドを実行（失敗したら中止）
2. 公開ブランチを一時作業フォルダに取り出し、`world-life/` の中身だけを置き換える
3. `world-life/` 以外の変更が1つでもあれば中止
4. 公開後、既存ゲームのファイル（index.html, css/, js/ 等）が公開前と同一であることを `git rev-parse` で確認する

注意: このリポジトリの GitHub Actions からは Pages へ公開しない（既存の公開設定を変えないため）。
