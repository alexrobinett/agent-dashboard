# Development Workflows

## Git push safety policy

- Use the repo-managed pre-push hook (`pnpm hooks:install`) so local pushes run quality checks.
- Avoid `git push --no-verify`.
- If bypassing checks is unavoidable (including `SKIP_E2E_SMOKE=1`), include an explicit note in the PR description with the reason and follow-up plan.
- Full CI checks, including full Playwright E2E, are still required for merge.
