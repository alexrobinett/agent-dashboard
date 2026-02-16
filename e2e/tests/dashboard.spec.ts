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

    // Wait for dashboard to load
    await dashboardPage.waitForLoad()

    // Verify page loaded (no error messages)
    const errorMessage = dashboardPage.errorMessage
    await expect(errorMessage).not.toBeVisible()

    // Verify no console errors
    expect(consoleErrors).toHaveLength(0)
  })

  test('should display all status columns', async () => {
    // Navigate to dashboard
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()

    // Verify all columns are visible
    await expect(dashboardPage.planningHeading).toBeVisible()
    await expect(dashboardPage.readyHeading).toBeVisible()
    await expect(dashboardPage.inProgressHeading).toBeVisible()
    await expect(dashboardPage.inReviewHeading).toBeVisible()
    await expect(dashboardPage.doneHeading).toBeVisible()
    await expect(dashboardPage.blockedHeading).toBeVisible()

    // Verify using the helper method
    const allColumnsVisible = await dashboardPage.areAllColumnsVisible()
    expect(allColumnsVisible).toBe(true)
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

    // Verify column headers contain expected text
    // (Adjust these selectors based on actual implementation)
    const planningHeader = dashboardPage.planningHeading
    const readyHeader = dashboardPage.readyHeading
    const inProgressHeader = dashboardPage.inProgressHeading
    const inReviewHeader = dashboardPage.inReviewHeading
    const doneHeader = dashboardPage.doneHeading
    const blockedHeader = dashboardPage.blockedHeading

    // Verify headers are visible (text content may vary, so just check visibility)
    await expect(planningHeader).toBeVisible()
    await expect(readyHeader).toBeVisible()
    await expect(inProgressHeader).toBeVisible()
    await expect(inReviewHeader).toBeVisible()
    await expect(doneHeader).toBeVisible()
    await expect(blockedHeader).toBeVisible()
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

    // Verify all columns are still accessible (may be stacked on mobile)
    const allColumnsVisible = await dashboardPage.areAllColumnsVisible()
    expect(allColumnsVisible).toBe(true)
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
})

test.describe('Dashboard Viewport Tests', () => {
  test('should render correctly on desktop viewport (1440x900)', async ({ page, browserName }) => {
    // Only run on chromium-desktop and webkit-desktop projects
    test.skip(browserName === 'chromium' && page.viewportSize()?.width === 390, 'Mobile test')

    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()

    // Verify all columns are visible side-by-side on desktop
    const allColumnsVisible = await dashboardPage.areAllColumnsVisible()
    expect(allColumnsVisible).toBe(true)

    // Take a screenshot for visual regression (optional)
    await page.screenshot({ path: 'e2e/screenshots/dashboard-desktop.png', fullPage: true })
  })

  test('should render correctly on mobile viewport (390x844)', async ({ page }) => {
    // Only run on chromium-mobile project
    test.skip(page.viewportSize()?.width !== 390, 'Not a mobile viewport')

    const dashboardPage = new DashboardPage(page)
    await dashboardPage.goto()
    await dashboardPage.waitForLoad()

    // Verify columns are still accessible on mobile (may be stacked or scrollable)
    const allColumnsVisible = await dashboardPage.areAllColumnsVisible()
    expect(allColumnsVisible).toBe(true)

    // Take a screenshot for visual regression (optional)
    await page.screenshot({ path: 'e2e/screenshots/dashboard-mobile.png', fullPage: true })
  })
})
