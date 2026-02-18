# Testing Guide — Agent Dashboard

This document describes the testing strategy, Playwright E2E configuration,
and the flake-budget policy for the agent-dashboard project.

---

## Table of Contents

1. [Unit Tests (Vitest)](#unit-tests-vitest)
2. [E2E Tests (Playwright)](#e2e-tests-playwright)
3. [Retry Policy](#retry-policy)
4. [Flake Budget](#flake-budget)
5. [Quarantine Mechanism](#quarantine-mechanism)
6. [CI Workflow](#ci-workflow)
7. [Pre-push Quality Gate](#pre-push-quality-gate)

---

## Unit Tests (Vitest)

```bash
pnpm test          # run unit tests once
pnpm test:watch    # watch mode
pnpm test:coverage # with coverage report
```

Unit tests live in `src/**/__tests__/` and `src/**/*.test.ts(x)`.
The suite currently has **742 passing tests** on `main`.

---

## E2E Tests (Playwright)

End-to-end tests live in `e2e/tests/`.  They run against the Vite dev server
on port `4173` (auto-started by Playwright's `webServer` config).

```bash
pnpm test:e2e                      # run full E2E suite
pnpm exec playwright test --ui     # interactive UI mode (local only)
pnpm exec playwright show-report   # view last HTML report
```

### Projects (browsers × viewports)

| Project name       | Browser  | Viewport       |
|--------------------|----------|----------------|
| `desktop-chromium` | Chromium | 1440 × 900     |
| `tablet-webkit`    | WebKit   | 768 × 1024     |
| `mobile-webkit`    | WebKit   | 390 × 844 (iPhone 12) |

### Output artefacts

| File                          | Description                          |
|-------------------------------|--------------------------------------|
| `test-results/results.json`   | Full results in JSON (used by PR comment action) |
| `test-results/results.xml`    | JUnit XML (used by `flake-report.sh`) |
| `playwright-report/`          | Interactive HTML report              |
| `test-results/*/trace.zip`    | Traces on failure (uploaded to CI)   |

---

## Retry Policy

Configured in `playwright.config.ts`:

```ts
retries: process.env.CI ? 2 : 0,
```

- **CI**: up to **2 retries** per test.  A test that fails on attempt 1 but
  passes on attempt 2 or 3 is considered **flaky** (not broken).
- **Local**: **0 retries** — failures are immediate, making local debugging
  faster.

> **Never increase retries to hide real bugs.** Retries exist to surface flaky
> tests so we can quarantine or fix them, not to paper over intermittent
> failures silently.

---

## Flake Budget

### Policy

The project maintains a **≤ 2% flake rate** across the full nightly E2E suite.

> Flake rate = (tests that needed ≥ 1 retry but eventually passed) ÷ (total
> non-quarantined tests) × 100

### Flake Report Script

`scripts/flake-report.sh` parses `test-results/results.xml` after a test run
and enforces the budget.

```bash
# Run manually after a Playwright run:
bash scripts/flake-report.sh

# Override budget threshold (e.g. 5%):
FLAKE_BUDGET_PCT=5 bash scripts/flake-report.sh

# Dry-run (report only, don't fail):
FLAKE_REPORT_ONLY=1 bash scripts/flake-report.sh
```

**Exit codes:**
- `0` — Flake rate within budget (or XML not found — treated as pass)
- `1` — Flake rate exceeds budget

### CI Enforcement

The nightly E2E workflow (`.github/workflows/e2e.yml`) runs the flake report
automatically **after** the test suite:

- **Nightly / push to main**: Hard failure if flake rate > 2%.
- **Pull request smoke**: Informational only (`FLAKE_REPORT_ONLY=1`), never
  blocks merge on its own.

---

## Quarantine Mechanism

### What is quarantine?

When a test is **persistently flaky** but fixing it immediately is not
feasible (e.g. blocked on an upstream fix, infrastructure issue, known race
condition), you can **quarantine** it.

Quarantined tests:
- **Still run** — we need to see when they stabilize.
- **Are excluded** from the 2% flake-budget check.
- **Are tagged** `[quarantine:<ticket-id>]` in the test title so CI reports
  them separately.

### How to quarantine a test

1. **Find or file a ticket** to track the root cause.

2. **Add an entry** to `playwright/quarantine.ts`:

   ```ts
   export const QUARANTINE_REGISTRY: Record<string, QuarantineEntry> = {
     'My Suite > my flaky test': {
       ticketId: 'FLAKE-042',
       reason: 'Race condition in WebSocket reconnect — tracking in #99',
       quarantinedOn: '2026-02-18',
       reviewBy: '2026-03-01',  // sprint deadline
     },
   }
   ```

3. **Wrap the test** with the `quarantine()` helper:

   ```ts
   // e2e/tests/my-suite.spec.ts
   import { quarantine } from '../../playwright/quarantine'

   quarantine('FLAKE-042', 'my flaky test', async ({ page }) => {
     // original test body — unchanged
   })
   ```

4. **Commit** with a message like:
   ```
   test(e2e): quarantine FLAKE-042 — race condition in WebSocket reconnect
   ```

### Quarantine review cadence

- **Sprint start**: Review the registry.  Any test quarantined for > 2 sprints
  without a fix must have an owner assigned.
- **Stabilized test** (passes cleanly for ≥ 5 consecutive nightly runs):
  remove the `quarantine()` wrapper, restore `test()`, and delete the registry
  entry.  Commit with:
  ```
  test(e2e): un-quarantine FLAKE-042 — stable for 5 nights
  ```

---

## CI Workflow

### `.github/workflows/e2e.yml`

| Trigger          | What runs                                    | Retries | Flake check       |
|------------------|----------------------------------------------|---------|-------------------|
| Pull request     | Smoke: `dashboard.spec.ts` on Chromium only  | 0       | Informational     |
| Push to `main`   | Full suite, all browsers                      | 2       | Hard fail > 2%    |
| Nightly (2 AM)   | Full suite, all browsers                      | 2       | Hard fail > 2%    |

Artefacts uploaded on every run:
- `playwright-report` (HTML, 30 days)
- `test-results` (JSON + XML, 30 days)
- `playwright-traces` (on failure, 30 days)

---

## Pre-push Quality Gate

The `.githooks/pre-push` hook runs a delta-vs-baseline check before every
`git push`.  See `scripts/pre-push-check.sh` for details.

Key points:
- Compares new failure counts against committed baselines in
  `scripts/baselines/`.
- Only fails when your branch introduces **new** failures beyond the
  known-baseline count on `main`.
- E2E smoke can be skipped for urgent fixes:
  ```bash
  SKIP_E2E_SMOKE=1 git push   # document reason in PR description
  git push --no-verify        # emergencies only
  ```

---

## Updating Baselines

When an intentional change alters the expected failure counts (e.g. a
pre-existing flaky test is fixed), update the baselines:

```bash
bash scripts/update-baselines.sh
git add scripts/baselines/
git commit -m "chore(tests): update baselines after fixing FLAKE-042"
```
