#!/usr/bin/env bash
# 試遊版を既存の GitHub Pages 公開ブランチの world-life/ フォルダへ配置する。
# 既存ゲームのファイルには触れない（world-life/ 以下のみ置き換える）。
set -euo pipefail

PAGES_BRANCH="claude/takenin-summer-game-em1re8"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$(cd "$APP_DIR/.." && pwd)"
WORKTREE="$(mktemp -d)/pages"

cd "$APP_DIR"
npm test
npm run build

cd "$REPO_DIR"
git fetch origin "$PAGES_BRANCH"
git worktree add --detach "$WORKTREE" "origin/$PAGES_BRANCH"
trap 'git -C "$REPO_DIR" worktree remove --force "$WORKTREE"' EXIT

mkdir -p "$WORKTREE/world-life"
# world-life/ の中身だけを最新ビルドで置き換える
find "$WORKTREE/world-life" -mindepth 1 -delete
cp -R "$APP_DIR/dist/." "$WORKTREE/world-life/"

cd "$WORKTREE"
git add world-life
# world-life/ 以外に変更が無いことを確認
if git diff --cached --name-only | grep -v '^world-life/' ; then
  echo "world-life/ 以外の変更が検出されたため中止します" >&2
  exit 1
fi
if git diff --cached --quiet; then
  echo "変更なし"
  exit 0
fi
git commit -q -m "WORLD LIFE 試遊版を更新 ($(git -C "$REPO_DIR" rev-parse --short HEAD))" \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016ffhdMYYhjCmMftFgF5JgE"
# 既存ゲームのファイル（world-life/ 以外の全項目）が公開前と同一か確認
for entry in $(git ls-tree --name-only HEAD~1); do
  [ "$entry" = "world-life" ] && continue
  if [ "$(git rev-parse "HEAD~1:$entry")" != "$(git rev-parse "HEAD:$entry")" ]; then
    echo "既存ファイル $entry が変化したため中止します" >&2
    exit 1
  fi
done
echo "既存ゲームのファイルは変更なし"
git push origin "HEAD:$PAGES_BRANCH"
echo "公開: https://bangkok05take-droid.github.io/take-summer-game/world-life/"
