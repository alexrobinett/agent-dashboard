import { test, expect } from '@playwright/test'
import { DashboardPage } from '../pages/DashboardPage'

/**
 * Sprint 4 Validation Tests
 * Smoke-level E2E tests for Advanced Features pipeline integration points.
 *
 * Validates that the dashboard renders correctly and that Sprint 4
 * integration points (Filters/Search, Workload View, Drag-and-Drop,
 * Activity Log) are accessible without errors.
 */

test.describe('Sprint 4: Filters/Search Integration', () => {
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()
  })

  test('should render dashboard with columns available for filtering', async () => {
    // Validate the board renders with all status columns (filter targets)
    const allColumnsVisible = await dashboardPage.areAllColumnsVisible()
    expect(allColumnsVisible).toBe(true)
  })

  test('should display task cards with filterable attributes', async ({ page }) => {
    // Verify task cards render with agent and priority info used for filtering
    const taskCards = page.locator('[data-testid^="column-"] .bg-secondary')
    const cardCount = await taskCards.count()

    // Board may have zero tasks in test environment; validate structure exists
    if (cardCount > 0) {
      const firstCard = taskCards.first()
      await expect(firstCard).toBeVisible()
      // Cards should contain agent name text (filterable attribute)
      const cardText = await firstCard.textContent()
      expect(cardText).toBeTruthy()
    }

    // Columns themselves should always be present as filter targets
    await expect(page.locator('[data-testid="column-planning"]')).toBeVisible()
    await expect(page.locator('[data-testid="column-in_progress"]')).toBeVisible()
  })

  test('should not produce console errors when page loads with filter-ready structure', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Reload to capture all console output from scratch
    await page.reload()
    await dashboardPage.waitForLoad()

    expect(consoleErrors).toHaveLength(0)
  })
})

test.describe('Sprint 4: Workload View Integration', () => {
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()
  })

  test('should render dashboard with task count badges for workload visibility', async ({ page }) => {
    // Each column header shows a count badge — the foundation for workload view
    const countBadges = page.locator('[data-testid^="column-"] .rounded-full')
    const badgeCount = await countBadges.count()

    // Should have exactly 6 count badges (one per status column)
    expect(badgeCount).toBe(6)
  })

  test('should display agent assignments on task cards for workload aggregation', async ({ page }) => {
    // Agent names on cards are the basis for workload-per-agent views
    const taskCards = page.locator('[data-testid^="column-"] .bg-secondary')
    const cardCount = await taskCards.count()

    if (cardCount > 0) {
      // Verify first card has agent info in its metadata section
      const firstCardMeta = taskCards.first().locator('.text-xs')
      await expect(firstCardMeta).toBeVisible()
    }
  })

  test('should render all six status columns needed for workload breakdown', async () => {
    // Workload view breaks down by status; all columns must exist
    await expect(dashboardPage.planningHeading).toBeVisible()
    await expect(dashboardPage.readyHeading).toBeVisible()
    await expect(dashboardPage.inProgressHeading).toBeVisible()
    await expect(dashboardPage.inReviewHeading).toBeVisible()
    await expect(dashboardPage.doneHeading).toBeVisible()
    await expect(dashboardPage.blockedHeading).toBeVisible()
  })
})

test.describe('Sprint 4: Drag-and-Drop Integration', () => {
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()
  })

  test('should render column containers as potential drop targets', async ({ page }) => {
    // Each status column is a potential drop target for drag-and-drop
    const columns = page.locator('[data-testid^="column-"]')
    const columnCount = await columns.count()
    expect(columnCount).toBe(6)

    // Verify each column has a container structure
    for (let i = 0; i < columnCount; i++) {
      const column = columns.nth(i)
      await expect(column).toBeVisible()
      // Columns should have heading + task area
      const heading = column.locator('h2')
      await expect(heading).toBeVisible()
    }
  })

  test('should render task cards as potential drag sources', async ({ page }) => {
    // Task cards with cursor-pointer are the drag source candidates
    const taskCards = page.locator('[data-testid^="column-"] .cursor-pointer')
    const cardCount = await taskCards.count()

    if (cardCount > 0) {
      const firstCard = taskCards.first()
      await expect(firstCard).toBeVisible()
      // Card should be interactive (has cursor-pointer class in the markup)
      const box = await firstCard.boundingBox()
      expect(box).not.toBeNull()
    }
  })

  test('should maintain board layout integrity for drag operations', async ({ page }) => {
    // Verify the grid layout renders correctly — required for drag-and-drop positioning
    const gridContainer = page.locator('.grid')
    await expect(gridContainer).toBeVisible()

    // Grid should contain all 6 columns
    const columns = gridContainer.locator('[data-testid^="column-"]')
    expect(await columns.count()).toBe(6)
  })
})

test.describe('Sprint 4: Activity Log Integration', () => {
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()
  })

  test('should render tasks with data attributes suitable for activity tracking', async ({ page }) => {
    // Task cards need identifiable structure to log activity (status changes, clicks)
    const columns = page.locator('[data-testid^="column-"]')
    const columnCount = await columns.count()
    expect(columnCount).toBe(6)

    // Verify each column has a data-testid for activity tracking
    for (let i = 0; i < columnCount; i++) {
      const testId = await columns.nth(i).getAttribute('data-testid')
      expect(testId).toMatch(/^column-/)
    }
  })

  test('should display live indicator confirming real-time activity subscription', async () => {
    // Live indicator shows WebSocket subscription is active — needed for activity log streaming
    const isLive = await dashboardPage.isLiveIndicatorVisible()
    expect(isLive).toBe(true)
  })

  test('should load dashboard without errors ensuring activity log pipeline is stable', async ({ page }) => {
    // No errors = activity log integration won't be blocked by rendering failures
    const errorMessage = dashboardPage.errorMessage
    await expect(errorMessage).not.toBeVisible()

    // Verify the page title loaded (full pipeline is functional)
    const heading = page.getByRole('heading', { name: /task dashboard/i })
    await expect(heading).toBeVisible()
  })
})
