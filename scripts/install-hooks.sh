#!/usr/bin/env bash
# Configure git to use the repo-managed .githooks/ directory.
# Run once after cloning: bash scripts/install-hooks.sh
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
git -C "$REPO_ROOT" config core.hooksPath .githooks
chmod +x "$REPO_ROOT/.githooks/pre-push"
echo "✅  Git hooks installed (core.hooksPath = .githooks)"
echo "    The pre-push hook runs: typecheck + unit tests + E2E smoke (delta vs baseline)"
echo "    Bypass: SKIP_E2E_SMOKE=1 git push   or   git push --no-verify"
