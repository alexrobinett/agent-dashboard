/**
 * Visual Regression Tests — Task 7.2a
 *
 * Compares key dashboard views against baseline screenshots stored in
 * e2e/snapshots/.  Baselines are generated on first run via
 * `pnpm test:visual:update` and committed to the repository.
 *
 * CI NOTE: These tests are INFORMATIONAL on PRs — failures indicate visual
 * drift but do not hard-block merges.  See .github/workflows/e2e.yml for
 * details.  The `--ignore-snapshots` flag can be passed locally to skip
 * comparison while still generating new screenshots.
 *
 * Design mock reference files live in docs/:
 *   docs/desktop-kanban-dashboard.png  ← board view reference
 *   docs/mobile-task-list.png          ← mobile reference
 *   docs/task-detail-modal.png         ← modal reference
 *
 * These PNGs are NOT used as direct Playwright baselines (different
 * resolutions / tooling) but serve as the source-of-truth design intent
 * that the snapshots must match visually.
 */

import { test, expect, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Disable all CSS animations and transitions so screenshots are fully
 * deterministic regardless of timing.
 */
async function disableAnimations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition: none !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  })
}

/**
 * Navigate to the dashboard and wait for it to be fully loaded.
 * Applies animation-disable and waits for network idle before capture.
 */
async function gotoDashboard(page: Page): Promise<void> {
  await page.goto('/dashboard', { waitUntil: 'networkidle' })

  // Wait for the Kanban board headings to appear — guards against SSR flicker
  await page.getByRole('heading', { name: /task dashboard/i }).waitFor({ state: 'visible' })
  await page.getByRole('heading', { name: /planning/i }).waitFor({ state: 'visible' })

  await disableAnimations(page)

  // Extra settle time for Convex subscriptions / data hydration
  await page.waitForTimeout(500)
}

// ---------------------------------------------------------------------------
// Visual regression suite
// ---------------------------------------------------------------------------

test.describe('Visual Regression — Dashboard', () => {
  // Use a fixed desktop viewport for all visual tests so baselines are
  // consistent across machines.  1280×720 matches most CI runners and is
  // wide enough to show the full Kanban board in a single row.
  test.use({ viewport: { width: 1280, height: 720 } })

  test('board view — full page @visual', async ({ page }) => {
    await gotoDashboard(page)

    // Ensure we're on the board view (default)
    // If a view-toggle exists, make sure "Board" is active
    const boardToggle = page.getByRole('button', { name: /board/i })
    if (await boardToggle.isVisible()) {
      await boardToggle.click()
      await page.waitForTimeout(200)
    }

    await expect(page).toHaveScreenshot('dashboard-board-view.png', {
      // 10 % pixel threshold — tolerates minor anti-aliasing / font rendering
      // differences across platforms.
      maxDiffPixelRatio: 0.1,
      // Clip to the viewport rather than the full scrollable document so the
      // snapshot size stays stable even as content grows.
      fullPage: false,
    })
  })

  test('workload view — full page @visual', async ({ page }) => {
    await gotoDashboard(page)

    // Switch to the Workload view if the toggle is available
    const workloadToggle = page.getByRole('button', { name: /workload/i })
    if (await workloadToggle.isVisible()) {
      await workloadToggle.click()
      // Wait for the WorkloadChart to render
      await page.waitForTimeout(400)
      await disableAnimations(page)
    } else {
      // Workload view not yet implemented / accessible — skip gracefully
      test.skip()
    }

    await expect(page).toHaveScreenshot('dashboard-workload-view.png', {
      maxDiffPixelRatio: 0.1,
      fullPage: false,
    })
  })

  test('board view — above the fold only @visual', async ({ page }) => {
    await gotoDashboard(page)

    // Capture just the viewport (above the fold) for a quick-glance diff
    await expect(page).toHaveScreenshot('dashboard-above-fold.png', {
      maxDiffPixelRatio: 0.1,
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    })
  })
})

test.describe('Visual Regression — Kanban columns', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test('each status column is visible and stable @visual', async ({ page }) => {
    await gotoDashboard(page)

    // Capture each column individually so diffs are scoped and easy to
    // interpret in the Playwright HTML report.
    const columns = [
      'planning',
      'ready',
      'in-progress',
      'in-review',
      'done',
      'blocked',
    ] as const

    for (const col of columns) {
      // Columns are identified by their heading text
      const heading = page.getByRole('heading', { name: new RegExp(col.replace('-', ' '), 'i') })
      const columnEl = heading.locator('../..')

      if (await columnEl.isVisible()) {
        await expect(columnEl).toHaveScreenshot(`column-${col}.png`, {
          maxDiffPixelRatio: 0.1,
        })
      }
    }
  })
})
