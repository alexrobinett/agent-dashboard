import { test, expect } from '@playwright/test'
import { DashboardPage } from '../pages/DashboardPage'

test.describe('Dashboard Smoke Test', () => {
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page)
  })

  test('should load dashboard without errors', async ({ page }) => {
    // Set up console error tracking
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Navigate to dashboard
    await dashboardPage.goto()

    // Wait for dashboard to load (handles both Kanban and EmptyState from 7.1c)
    await dashboardPage.waitForLoad()

    // Verify page loaded (no error boundary alerts)
    const errorBoundary = page.getByTestId('error-boundary-fallback')
    await expect(errorBoundary).not.toBeVisible()

    // Verify no console errors (filter WebSocket noise which is a known infra issue)
    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.includes('WebSocket') &&
        !e.includes('convex') &&
        !e.includes('ws://') &&
        !e.includes('wss://')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('should display board in a valid state', async () => {
    // Navigate to dashboard
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()

    // The board renders in one of two valid states:
    //  1. Kanban columns (when tasks exist in the DB)
    //  2. EmptyState "no tasks yet" (when DB is empty — correct 7.1c behavior)
    const isValid = await dashboardPage.isBoardInValidState()
    expect(isValid).toBe(true)
  })

  test('should display live indicator', async () => {
    // Navigate to dashboard
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()

    // Verify live indicator is visible
    const isLiveIndicatorVisible = await dashboardPage.isLiveIndicatorVisible()
    expect(isLiveIndicatorVisible).toBe(true)

    // Also verify using Playwright assertion
    await expect(dashboardPage.liveIndicator).toBeVisible()
  })

  test('should display column headers with correct text', async () => {
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()

    // KanbanBoard always renders columns, even when empty (7.1c keeps columns visible).
    // When filters match nothing, EmptyState replaces the board — skip column check.
    const hasNoResults = await dashboardPage.emptyStateNoResults.isVisible()
    if (!hasNoResults) {
      await expect(dashboardPage.planningHeading).toBeVisible()
      await expect(dashboardPage.readyHeading).toBeVisible()
      await expect(dashboardPage.inProgressHeading).toBeVisible()
      await expect(dashboardPage.inReviewHeading).toBeVisible()
      await expect(dashboardPage.doneHeading).toBeVisible()
      await expect(dashboardPage.blockedHeading).toBeVisible()
    }
  })

  test('should be responsive on mobile viewport', async ({ page, viewport }) => {
    // This test runs on all configured viewports
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()

    // Verify page renders without horizontal scroll
    const body = page.locator('body')
    const bodyBox = await body.boundingBox()
    
    if (viewport && bodyBox) {
      // Body should not be wider than viewport
      expect(bodyBox.width).toBeLessThanOrEqual(viewport.width + 20) // Allow small tolerance
    }

    // Verify board is in a valid state (columns OR emptyState — both are responsive)
    const isValid = await dashboardPage.isBoardInValidState()
    expect(isValid).toBe(true)
  })

  test('should not show network errors', async ({ page }) => {
    // Track network failures
    const failedRequests: string[] = []
    page.on('requestfailed', (request) => {
      failedRequests.push(request.url())
    })

    await dashboardPage.goto()
    await dashboardPage.waitForLoad()

    // Wait a bit for any lazy-loaded content
    await page.waitForTimeout(1000)

    // Verify no critical network failures
    const hasCriticalFailures = failedRequests.some(url => {
      // Allow failures for non-critical resources like analytics, ads, etc.
      return !url.includes('analytics') && !url.includes('ads')
    })

    expect(hasCriticalFailures).toBe(false)
  })

  test('should provide per-lane scrolling with sticky headers', async ({ page }) => {
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()

    const laneScroll = page.locator('[data-testid="column-scroll-planning"]')
    await expect(laneScroll).toBeVisible()

    await laneScroll.focus()

    const overflowY = await laneScroll.evaluate((el) => getComputedStyle(el).overflowY)
    expect(['auto', 'scroll']).toContain(overflowY)

    const laneHeader = page.locator('[data-testid="column-header-planning"]')
    const position = await laneHeader.evaluate((el) => getComputedStyle(el).position)
    expect(position).toBe('sticky')
  })

  test('should support board lane search with clear no-results feedback', async ({ page }) => {
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()

    const laneSearch = page.getByTestId('lane-search-input')
    await expect(laneSearch).toBeVisible({ timeout: 15000 })

    const uniqueQuery = 'zzzz_no_match_query_12345'
    await laneSearch.fill(uniqueQuery)

    const noResults = page.getByTestId('lane-search-no-results')
    await expect(noResults).toBeVisible()
    await expect(noResults).toContainText('No matching tasks')

    await laneSearch.fill('')
    await expect(noResults).not.toBeVisible()
  })
})

test.describe('Dashboard Viewport Tests', () => {
  test('should render correctly on desktop viewport (1440x900)', async ({ page, browserName }) => {
    // Only run on chromium-desktop and webkit-desktop projects
    test.skip(browserName === 'chromium' && page.viewportSize()?.width === 390, 'Mobile test')

    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()

    // Verify board is in a valid state (columns OR emptyState)
    const isValid = await dashboardPage.isBoardInValidState()
    expect(isValid).toBe(true)

    // Take a screenshot for visual regression (optional)
    await page.screenshot({ path: 'e2e/screenshots/dashboard-desktop.png', fullPage: true })
  })

  test('should render correctly on mobile viewport (390x844)', async ({ page }) => {
    // Only run on chromium-mobile project
    test.skip(page.viewportSize()?.width !== 390, 'Not a mobile viewport')

    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()

    // Verify board is in a valid state on mobile (columns OR emptyState)
    const isValid = await dashboardPage.isBoardInValidState()
    expect(isValid).toBe(true)

    // Take a screenshot for visual regression (optional)
    await page.screenshot({ path: 'e2e/screenshots/dashboard-mobile.png', fullPage: true })
  })
})
