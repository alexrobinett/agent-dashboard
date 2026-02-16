import { type Page, type Locator } from '@playwright/test'

/**
 * Page Object Model for the Dashboard page
 * Provides methods to interact with the Kanban board
 */
export class DashboardPage {
  readonly page: Page
  
  // Status headings
  readonly planningHeading: Locator
  readonly readyHeading: Locator
  readonly inProgressHeading: Locator
  readonly inReviewHeading: Locator
  readonly doneHeading: Locator
  readonly blockedHeading: Locator
  
  // Live indicator
  readonly liveIndicator: Locator
  
  // Error states
  readonly errorMessage: Locator

  constructor(page: Page) {
    this.page = page
    
    // Locate column headings by visible text (more stable across markup changes)
    this.planningHeading = page.getByRole('heading', { name: /^planning$/i })
    this.readyHeading = page.getByRole('heading', { name: /^ready$/i })
    this.inProgressHeading = page.getByRole('heading', { name: /^in progress$/i })
    this.inReviewHeading = page.getByRole('heading', { name: /^in review$/i })
    this.doneHeading = page.getByRole('heading', { name: /^done$/i })
    this.blockedHeading = page.getByRole('heading', { name: /^blocked$/i })
    
    // Live indicator
    this.liveIndicator = page.getByText(/^live$/i).first()
    
    // Error states
    this.errorMessage = page.locator('[role="alert"]')
  }

  /**
   * Navigate to the dashboard page
   */
  async goto() {
    await this.page.goto('/dashboard')
  }

  /**
   * Wait for the dashboard to be fully loaded
   */
  async waitForLoad() {
    await this.page.getByRole('heading', { name: /task dashboard/i }).waitFor({ state: 'visible' })
    await this.planningHeading.waitFor({ state: 'visible' })
  }

  /**
   * Check if all status columns are visible
   * @returns true if all columns are visible
   */
  async areAllColumnsVisible(): Promise<boolean> {
    const headings = [
      this.planningHeading,
      this.readyHeading,
      this.inProgressHeading,
      this.inReviewHeading,
      this.doneHeading,
      this.blockedHeading,
    ]
    
    for (const heading of headings) {
      const isVisible = await heading.isVisible()
      if (!isVisible) return false
    }
    
    return true
  }

  /**
   * Check if the live indicator is visible
   * @returns true if live indicator is visible
   */
  async isLiveIndicatorVisible(): Promise<boolean> {
    return await this.liveIndicator.isVisible()
  }

  /**
   * Get the number of tasks in a specific column
   * @param columnName - Name of the column (e.g., 'planning', 'in_progress')
   * @returns Number of tasks in the column
   */
  async getTaskCount(columnName: string): Promise<number> {
    const column = this.getColumnContainerByName(columnName)
    return await column.locator('h3').count()
  }

  /**
   * Get a column locator by name
   * @param columnName - Name of the column
   * @returns Locator for the column
   */
  private getColumnContainerByName(columnName: string): Locator {
    switch (columnName) {
      case 'planning':
        return this.planningHeading.locator('..').locator('..')
      case 'ready':
        return this.readyHeading.locator('..').locator('..')
      case 'in_progress':
        return this.inProgressHeading.locator('..').locator('..')
      case 'in_review':
        return this.inReviewHeading.locator('..').locator('..')
      case 'done':
        return this.doneHeading.locator('..').locator('..')
      case 'blocked':
        return this.blockedHeading.locator('..').locator('..')
      default:
        throw new Error(`Unknown column name: ${columnName}`)
    }
  }
}
