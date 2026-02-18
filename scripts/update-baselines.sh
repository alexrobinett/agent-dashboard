#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Regenerate pre-push baseline files to reflect the current state of main.
#
# Run this on the main branch whenever intentional failure counts change
# (e.g. after resolving pre-existing TypeScript errors or fixing E2E tests):
#
#   git checkout main && git pull
#   bash scripts/update-baselines.sh
#   git add scripts/baselines/ && git commit -m "chore: update pre-push baselines"
#
# The committed baselines let pre-push-check.sh detect NEW regressions without
# blocking on pre-existing known failures.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASELINES_DIR="$REPO_ROOT/scripts/baselines"

mkdir -p "$BASELINES_DIR"

echo "==> Generating stubs (same environment as pre-push-check.sh uses) ..."
bash "$REPO_ROOT/scripts/generate-stubs.sh" 2>&1 | grep -v "^$" || true

echo ""
echo "==> Capturing TypeScript baseline ..."
TC_RAW=$(pnpm --dir "$REPO_ROOT" typecheck 2>&1 || true)
TC_ERRORS=$(printf '%s\n' "$TC_RAW" | grep -c "error TS" || true)
TC_ERRORS=${TC_ERRORS:-0}
printf '%d\n' "$TC_ERRORS" > "$BASELINES_DIR/typecheck-errors.txt"
echo "    typecheck-errors.txt = $TC_ERRORS"

echo ""
echo "==> Capturing E2E smoke baseline (starts dev server — takes ~2 min) ..."
E2E_RAW=$(pnpm --dir "$REPO_ROOT" test:e2e:smoke 2>&1 || true)
E2E_FAILURES=$(printf '%s\n' "$E2E_RAW" \
  | grep -E '[0-9]+ failed' \
  | grep -oE '[0-9]+ failed' \
  | grep -oE '^[0-9]+' \
  | tail -1 || true)
E2E_FAILURES=${E2E_FAILURES:-0}
printf '%d\n' "$E2E_FAILURES" > "$BASELINES_DIR/e2e-smoke-failures.txt"
echo "    e2e-smoke-failures.txt = $E2E_FAILURES"

echo ""
echo "✅  Baselines updated. Review and commit:"
echo "    git diff scripts/baselines/"
echo "    git add scripts/baselines/ && git commit -m 'chore: update pre-push baselines'"
