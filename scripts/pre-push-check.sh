#!/usr/bin/env bash
set -euo pipefail

header() {
  printf '\n==> %s\n' "$1"
}

header "Pre-push checks started"

header "TypeScript typecheck"
pnpm typecheck

header "Unit/integration tests"
pnpm test

if [[ "${SKIP_E2E_SMOKE:-0}" == "1" ]]; then
  printf '\n⚠️  WARNING: SKIP_E2E_SMOKE=1 set. Skipping Playwright smoke tests.\n'
  printf '⚠️  Use only for emergencies and document reason in PR description.\n'
else
  header "Playwright smoke tests"
  pnpm test:e2e:smoke
fi

header "✅ Pre-push checks passed"
