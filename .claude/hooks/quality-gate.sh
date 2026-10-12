#!/usr/bin/env bash
# 変更のある領域（api / web）だけ型チェック・テスト・lint を実行する。
#   Stop hook として:  stdin に hook JSON。失敗時は exit 2 で Claude に作業を続けさせる
#   手動実行:          bash .claude/hooks/quality-gate.sh [--all]
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 0

all=false
[ "${1:-}" = "--all" ] && all=true

# hook から呼ばれた場合、2 回目以降の停止はブロックしない（無限ループ防止）
if [ ! -t 0 ]; then
  input=$(cat)
  if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
    exit 0
  fi
fi

if ! docker compose ps --status running --services 2>/dev/null | grep -q .; then
  echo "quality-gate: docker compose が起動していないためスキップしました" >&2
  exit 0
fi

changed() {
  $all && return 0
  [ -n "$(git status --porcelain -- "$1")" ] && return 0
  git rev-parse --verify -q main >/dev/null &&
    [ -n "$(git diff --name-only main...HEAD -- "$1" 2>/dev/null)" ]
}

failed=0
report=""

run() {
  local label=$1; shift
  local out
  if ! out=$("$@" 2>&1); then
    failed=1
    report+=$'\n'"### ✗ ${label}"$'\n'"$(printf '%s\n' "$out" | tail -n 40)"$'\n'
  else
    report+=$'\n'"### ✓ ${label}"$'\n'
  fi
}

if changed api/; then
  run "api: tsc"  docker compose exec -T api npx tsc --noEmit
  run "api: test" docker compose exec -T api npm test
fi

if changed web/; then
  run "web: tsc"  docker compose exec -T web npx tsc --noEmit
  run "web: lint" docker compose exec -T web npm run lint
fi

[ -z "$report" ] && exit 0

if [ "$failed" -ne 0 ]; then
  printf '品質チェックに失敗しました。修正してから完了してください。\n%s' "$report" >&2
  exit 2
fi

printf '品質チェック OK%s' "$report"
exit 0
