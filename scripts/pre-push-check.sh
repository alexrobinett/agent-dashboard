#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Pre-push quality gate: typecheck + unit tests + E2E smoke
#
# Strategy: delta-vs-baseline
#   Each check compares against committed baselines in scripts/baselines/.
#   The hook only fails when your branch introduces NEW failures beyond main's
#   known pre-existing count — so pre-existing issues on main never block pushes.
#
#   Typecheck is always run with stubs generated first (scripts/generate-stubs.sh)
#   to ensure a deterministic, reproducible environment regardless of local state.
#
# Update baselines (run on main when intentional failure counts change):
#   bash scripts/update-baselines.sh
#
# Bypass options:
#   SKIP_E2E_SMOKE=1 git push     skip E2E only (document reason in PR)
#   git push --no-verify          skip all checks (emergencies only)
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
BASELINES_DIR="$REPO_ROOT/scripts/baselines"

header() { printf '\n==> %s\n' "$1"; }
ok()     { printf '✅  %s\n' "$1"; }
warn()   { printf '⚠️   %s\n' "$1"; }
fail()   { printf '❌  %s\n' "$1" >&2; }

FAILED=0

# ─── 0. Generate stubs for deterministic typecheck ───────────────────────────
# Ensures convex/_generated/ and src/routeTree.gen.ts are in a known state
# so typecheck results are reproducible and comparable to the stored baseline.
header "Generating stubs (deterministic typecheck environment)"
bash "$REPO_ROOT/scripts/generate-stubs.sh" 2>&1 | grep -v "^$" || true
ok "Stubs ready"

# ─── 1. TypeScript typecheck (delta vs baseline) ──────────────────────────────
header "TypeScript typecheck (delta vs baseline)"
TC_RAW=$(pnpm --dir "$REPO_ROOT" typecheck 2>&1 || true)
TC_ERRORS=$(printf '%s\n' "$TC_RAW" | grep -c "error TS" || true)
TC_ERRORS=${TC_ERRORS:-0}

TC_BASELINE=0
TC_BASELINE_FILE="$BASELINES_DIR/typecheck-errors.txt"
if [[ -f "$TC_BASELINE_FILE" ]]; then
  TC_BASELINE=$(tr -d '[:space:]' < "$TC_BASELINE_FILE")
fi

if [[ "$TC_ERRORS" -le "$TC_BASELINE" ]]; then
  ok "TypeScript: $TC_ERRORS error(s) ≤ baseline ($TC_BASELINE) — no regressions"
else
  NEW_TC=$((TC_ERRORS - TC_BASELINE))
  fail "TypeScript: $TC_ERRORS error(s) vs baseline $TC_BASELINE — $NEW_TC NEW error(s) introduced"
  printf '%s\n' "$TC_RAW" | grep "error TS" >&2
  FAILED=1
fi

# ─── 2. Unit / integration tests ─────────────────────────────────────────────
header "Unit / integration tests"
if pnpm --dir "$REPO_ROOT" test; then
  ok "All unit tests passed"
else
  fail "Unit tests FAILED — fix failures before pushing"
  FAILED=1
fi

# ─── 3. E2E smoke (delta vs baseline) ────────────────────────────────────────
if [[ "${SKIP_E2E_SMOKE:-0}" == "1" ]]; then
  warn "SKIP_E2E_SMOKE=1 — skipping Playwright smoke (emergency use only; document reason in PR)"
else
  header "E2E smoke: dashboard.spec.ts / desktop-chromium (delta vs baseline)"

  E2E_BASELINE=0
  E2E_BASELINE_FILE="$BASELINES_DIR/e2e-smoke-failures.txt"
  if [[ -f "$E2E_BASELINE_FILE" ]]; then
    E2E_BASELINE=$(tr -d '[:space:]' < "$E2E_BASELINE_FILE")
  fi

  E2E_RAW=$(pnpm --dir "$REPO_ROOT" test:e2e:smoke 2>&1 || true)

  # Parse Playwright summary line: "X failed" or "X passed, Y failed"
  E2E_FAILURES=$(printf '%s\n' "$E2E_RAW" \
    | grep -E '[0-9]+ failed' \
    | grep -oE '[0-9]+ failed' \
    | grep -oE '^[0-9]+' \
    | tail -1 || true)
  E2E_FAILURES=${E2E_FAILURES:-0}

  if [[ "$E2E_FAILURES" -le "$E2E_BASELINE" ]]; then
    ok "E2E smoke: $E2E_FAILURES failure(s) ≤ baseline ($E2E_BASELINE) — no regressions"
  else
    NEW_E2E=$((E2E_FAILURES - E2E_BASELINE))
    fail "E2E smoke: $E2E_FAILURES failure(s) vs baseline $E2E_BASELINE — $NEW_E2E NEW failure(s) introduced"
    printf '%s\n' "$E2E_RAW" | grep -E '(✘|FAILED|failed\b)' | head -20 >&2
    FAILED=1
  fi
fi

# ─── Result ───────────────────────────────────────────────────────────────────
echo ""
if [[ "$FAILED" -ne 0 ]]; then
  printf '❌  Pre-push checks FAILED. Fix the issues above before pushing.\n'
  printf '    Bypass options:\n'
  printf '      SKIP_E2E_SMOKE=1 git push   skip E2E only (document reason in PR)\n'
  printf '      git push --no-verify        skip all hooks (emergencies only)\n'
  exit 1
else
  printf '✅  All pre-push checks passed — safe to push.\n'
fi
