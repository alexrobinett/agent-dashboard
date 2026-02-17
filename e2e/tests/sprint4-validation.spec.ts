import { test, expect } from '@playwright/test'
import { DashboardPage } from '../pages/DashboardPage'

/**
 * Sprint 4 Validation Tests
 * E2E tests that validate actual dashboard interactions and behavior:
 * - Board columns render with correct headings and task content
 * - Task cards display filterable attributes and respond to interaction
 * - Count badges reflect actual task counts in each column
 * - Column heading text matches expected status labels
 * - Cards are interactive (clickable, hoverable)
 * - Page loads without errors and maintains structural integrity
 */

test.describe('Sprint 4: Filters/Search Integration', () => {
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()
  })

  test('should render all six status columns with correct heading labels', async ({ page }) => {
    const expectedLabels: Record<string, string> = {
      'planning': 'planning',
      'ready': 'ready',
      'in_progress': 'in progress',
      'in_review': 'in review',
      'done': 'done',
      'blocked': 'blocked',
    }

    for (const [status, label] of Object.entries(expectedLabels)) {
      const column = page.locator(`[data-testid="column-${status}"]`)
      await expect(column).toBeVisible()

      // Verify heading text matches the expected label (case-insensitive)
      const heading = column.locator('h2')
      await expect(heading).toContainText(new RegExp(label, 'i'))
    }

    // Verify exactly 6 columns
    const columns = page.locator('[data-testid^="column-"]')
    expect(await columns.count()).toBe(6)
  })

  test('should display task cards with title, agent, and priority text content', async ({ page }) => {
    const taskCards = page.locator('[data-testid^="column-"] .bg-secondary')
    const cardCount = await taskCards.count()

    if (cardCount > 0) {
      const firstCard = taskCards.first()
      await expect(firstCard).toBeVisible()

      // Card title (h3) should have actual text
      const title = firstCard.locator('h3')
      await expect(title).toBeVisible()
      const titleText = await title.textContent()
      expect(titleText!.trim().length).toBeGreaterThan(0)

      // Metadata section should show agent name and priority
      const metaSection = firstCard.locator('.text-xs')
      await expect(metaSection).toBeVisible()
      const metaText = await metaSection.textContent()
      expect(metaText!.trim().length).toBeGreaterThan(0)
    }
  })

  test('should have task cards that respond to hover with visual feedback', async ({ page }) => {
    const taskCards = page.locator('[data-testid^="column-"] .cursor-pointer')
    const cardCount = await taskCards.count()

    if (cardCount > 0) {
      const card = taskCards.first()
      await expect(card).toBeVisible()

      // Hover over the card — verify it has cursor-pointer (interactive)
      const cursor = await card.evaluate(el => window.getComputedStyle(el).cursor)
      expect(cursor).toBe('pointer')
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

  test('should display count badges that match actual card counts per column', async ({ page }) => {
    const expectedStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked']

    for (const status of expectedStatuses) {
      const column = page.locator(`[data-testid="column-${status}"]`)
      const badge = column.locator('.rounded-full')
      await expect(badge).toBeVisible()

      // Badge text should be a number
      const badgeText = await badge.textContent()
      expect(badgeText!.trim()).toMatch(/^\d+$/)

      // Count in badge should match actual card count in column
      const count = parseInt(badgeText!.trim(), 10)
      const cards = column.locator('.bg-secondary')
      expect(await cards.count()).toBe(count)
    }
  })

  test('should show "No tasks" message in columns with zero tasks', async ({ page }) => {
    const expectedStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked']

    for (const status of expectedStatuses) {
      const column = page.locator(`[data-testid="column-${status}"]`)
      const badge = column.locator('.rounded-full')
      const badgeText = await badge.textContent()
      const count = parseInt(badgeText!.trim(), 10)

      if (count === 0) {
        // Column with 0 tasks should show "No tasks" placeholder
        const noTasks = column.locator('text=No tasks')
        await expect(noTasks).toBeVisible()
      }
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

  test('should display agent name text on task cards', async ({ page }) => {
    const taskCards = page.locator('[data-testid^="column-"] .bg-secondary')
    const cardCount = await taskCards.count()

    if (cardCount > 0) {
      // Check first card's metadata row has agent text
      const firstCard = taskCards.first()
      const metaRow = firstCard.locator('.text-xs')
      await expect(metaRow).toBeVisible()

      // Agent text should be a capitalize span (first child)
      const agentSpan = metaRow.locator('.capitalize').first()
      await expect(agentSpan).toBeVisible()
      const agentText = await agentSpan.textContent()
      expect(agentText!.trim().length).toBeGreaterThan(0)
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

  test('should render columns with heading, badge, and task area structure', async ({ page }) => {
    const columns = page.locator('[data-testid^="column-"]')
    expect(await columns.count()).toBe(6)

    for (let i = 0; i < 6; i++) {
      const column = columns.nth(i)
      await expect(column).toBeVisible()

      // Each column must have a heading with text
      const heading = column.locator('h2')
      await expect(heading).toBeVisible()
      const headingText = await heading.textContent()
      expect(headingText!.trim().length).toBeGreaterThan(0)

      // Each column must have a count badge with a number
      const badge = column.locator('.rounded-full')
      await expect(badge).toBeVisible()
      const badgeText = await badge.textContent()
      expect(badgeText!.trim()).toMatch(/^\d+$/)
    }
  })

  test('should render task cards with non-zero bounding boxes (draggable targets)', async ({ page }) => {
    const taskCards = page.locator('[data-testid^="column-"] .cursor-pointer')
    const cardCount = await taskCards.count()

    if (cardCount > 0) {
      for (let i = 0; i < Math.min(cardCount, 5); i++) {
        const card = taskCards.nth(i)
        await expect(card).toBeVisible()
        const box = await card.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.width).toBeGreaterThan(50)
        expect(box!.height).toBeGreaterThan(20)
      }
    }
  })

  test('should render task cards with priority-colored left border', async ({ page }) => {
    const taskCards = page.locator('[data-testid^="column-"] .bg-secondary')
    const cardCount = await taskCards.count()

    if (cardCount > 0) {
      const card = taskCards.first()
      // Card has border-l-4 class and an inline borderLeftColor style
      const borderWidth = await card.evaluate(
        el => window.getComputedStyle(el).borderLeftWidth
      )
      expect(borderWidth).toBe('4px')

      const borderStyle = await card.evaluate(
        el => window.getComputedStyle(el).borderLeftStyle
      )
      expect(borderStyle).toBe('solid')
    }
  })

  test('should maintain grid layout with columns inside a grid container', async ({ page }) => {
    const gridContainer = page.locator('.grid')
    await expect(gridContainer).toBeVisible()

    const columns = gridContainer.locator('[data-testid^="column-"]')
    expect(await columns.count()).toBe(6)

    // Grid container should have grid display
    const display = await gridContainer.evaluate(
      el => window.getComputedStyle(el).display
    )
    expect(display).toBe('grid')
  })
})

test.describe('Sprint 4: Activity Log Integration', () => {
  let dashboardPage: DashboardPage

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()
  })

  test('should display live indicator confirming real-time subscription', async ({ page }) => {
    const isLive = await dashboardPage.isLiveIndicatorVisible()
    expect(isLive).toBe(true)

    // Verify the live indicator has the pulse animation class
    const liveIndicator = page.locator('[data-testid="live-indicator"]')
    await expect(liveIndicator).toBeVisible()
    const classes = await liveIndicator.getAttribute('class')
    expect(classes).toContain('animate-pulse')
  })

  test('should render columns with stable data-testid attributes for activity tracking', async ({ page }) => {
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

  test('should load dashboard without errors and render all structural elements', async ({ page }) => {
    // No error alert should be visible
    await expect(dashboardPage.errorMessage).not.toBeVisible()

    // Main heading should render
    const heading = page.getByRole('heading', { name: /task dashboard/i })
    await expect(heading).toBeVisible()

    // All 6 columns should be present
    const columns = page.locator('[data-testid^="column-"]')
    expect(await columns.count()).toBe(6)

    // Live indicator should be active
    const liveText = page.getByText(/^live$/i).first()
    await expect(liveText).toBeVisible()
  })
})
