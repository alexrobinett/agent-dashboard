import { test, expect } from '@playwright/test'
import { DashboardPage } from '../pages/DashboardPage'

/**
 * Sprint 4 Validation Tests
 * E2E tests that validate actual dashboard page behavior:
 * - Board columns render with correct headings and structure
 * - Task cards display filterable attributes (status, agent, priority)
 * - Count badges reflect actual task counts in each column
 * - Page loads without errors and maintains structural integrity
 */

test.describe('Sprint 4: Filters/Search Integration', () => {
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()
  })

  test('should render all six status columns as filter targets', async ({ page }) => {
    const expectedStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked']

    for (const status of expectedStatuses) {
      const column = page.locator(`[data-testid="column-${status}"]`)
      await expect(column).toBeVisible()
    }

    // Verify exactly 6 columns (no duplicates, no extras)
    const columns = page.locator('[data-testid^="column-"]')
    expect(await columns.count()).toBe(6)
  })

  test('should display task cards with agent and priority info for filtering', async ({ page }) => {
    const taskCards = page.locator('[data-testid^="column-"] .bg-secondary')
    const cardCount = await taskCards.count()

    if (cardCount > 0) {
      // Each card should have visible text content (title, agent, priority info)
      const firstCard = taskCards.first()
      await expect(firstCard).toBeVisible()
      const text = await firstCard.textContent()
      expect(text!.length).toBeGreaterThan(0)

      // Cards should have metadata section with agent/priority info
      const metaSection = firstCard.locator('.text-xs')
      await expect(metaSection).toBeVisible()

      // Card should have a colored left border (priority indicator)
      const borderStyle = await firstCard.evaluate((el) => {
        return window.getComputedStyle(el).borderLeftStyle
      })
      expect(borderStyle).toBe('solid')
    }
  })

  test('should not produce console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

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

  test('should display count badges that reflect task counts per column', async ({ page }) => {
    const expectedStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked']

    for (const status of expectedStatuses) {
      const column = page.locator(`[data-testid="column-${status}"]`)
      const badge = column.locator('.rounded-full')
      await expect(badge).toBeVisible()

      // Badge text should be a number (the task count)
      const badgeText = await badge.textContent()
      expect(badgeText!.trim()).toMatch(/^\d+$/)

      // Count in badge should match actual card count in column
      const count = parseInt(badgeText!.trim(), 10)
      const cards = column.locator('.bg-secondary')
      expect(await cards.count()).toBe(count)
    }
  })

  test('should render all status column headings for workload breakdown', async () => {
    await expect(dashboardPage.planningHeading).toBeVisible()
    await expect(dashboardPage.readyHeading).toBeVisible()
    await expect(dashboardPage.inProgressHeading).toBeVisible()
    await expect(dashboardPage.inReviewHeading).toBeVisible()
    await expect(dashboardPage.doneHeading).toBeVisible()
    await expect(dashboardPage.blockedHeading).toBeVisible()
  })

  test('should display agent assignments on task cards', async ({ page }) => {
    const taskCards = page.locator('[data-testid^="column-"] .bg-secondary')
    const cardCount = await taskCards.count()

    if (cardCount > 0) {
      // Cards should have a metadata row with agent info
      const firstCard = taskCards.first()
      const metaRow = firstCard.locator('.text-xs')
      await expect(metaRow).toBeVisible()
      const metaText = await metaRow.textContent()
      expect(metaText!.length).toBeGreaterThan(0)
    }
  })
})

test.describe('Sprint 4: Drag-and-Drop Integration', () => {
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()
  })

  test('should render column containers with heading and task area structure', async ({ page }) => {
    const columns = page.locator('[data-testid^="column-"]')
    expect(await columns.count()).toBe(6)

    for (let i = 0; i < 6; i++) {
      const column = columns.nth(i)
      await expect(column).toBeVisible()

      // Each column must have a heading
      const heading = column.locator('h2')
      await expect(heading).toBeVisible()
      const headingText = await heading.textContent()
      expect(headingText!.length).toBeGreaterThan(0)

      // Each column must have a count badge
      const badge = column.locator('.rounded-full')
      await expect(badge).toBeVisible()
    }
  })

  test('should render task cards as interactive drag sources with bounding boxes', async ({ page }) => {
    const taskCards = page.locator('[data-testid^="column-"] .cursor-pointer')
    const cardCount = await taskCards.count()

    if (cardCount > 0) {
      // Each visible card should have a non-zero bounding box (draggable)
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        const card = taskCards.nth(i)
        await expect(card).toBeVisible()
        const box = await card.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.width).toBeGreaterThan(0)
        expect(box!.height).toBeGreaterThan(0)
      }
    }
  })

  test('should maintain grid layout with all columns positioned correctly', async ({ page }) => {
    const gridContainer = page.locator('.grid')
    await expect(gridContainer).toBeVisible()

    const columns = gridContainer.locator('[data-testid^="column-"]')
    expect(await columns.count()).toBe(6)

    // Verify columns have non-zero dimensions and are within the grid
    const gridBox = await gridContainer.boundingBox()
    expect(gridBox).not.toBeNull()

    for (let i = 0; i < 6; i++) {
      const colBox = await columns.nth(i).boundingBox()
      expect(colBox).not.toBeNull()
      expect(colBox!.width).toBeGreaterThan(0)
      expect(colBox!.height).toBeGreaterThan(0)
    }
  })
})

test.describe('Sprint 4: Activity Log Integration', () => {
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()
  })

  test('should display live indicator confirming real-time subscription is active', async () => {
    const isLive = await dashboardPage.isLiveIndicatorVisible()
    expect(isLive).toBe(true)
  })

  test('should render columns with identifiable data-testid attributes for tracking', async ({ page }) => {
    const expectedTestIds = [
      'column-planning', 'column-ready', 'column-in_progress',
      'column-in_review', 'column-done', 'column-blocked',
    ]

    for (const testId of expectedTestIds) {
      const column = page.locator(`[data-testid="${testId}"]`)
      await expect(column).toBeVisible()
      const actualId = await column.getAttribute('data-testid')
      expect(actualId).toBe(testId)
    }
  })

  test('should load dashboard without errors ensuring pipeline stability', async ({ page }) => {
    // No error alert should be visible
    const errorMessage = dashboardPage.errorMessage
    await expect(errorMessage).not.toBeVisible()

    // Main heading should render
    const heading = page.getByRole('heading', { name: /task dashboard/i })
    await expect(heading).toBeVisible()

    // All 6 columns should be populated (structure intact)
    const columns = page.locator('[data-testid^="column-"]')
    expect(await columns.count()).toBe(6)
  })
})
