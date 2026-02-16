import { type Page, type Locator } from '@playwright/test'

/**
 * Page Object Model for the Dashboard page
 * Provides methods to interact with the Kanban board
 */
export class DashboardPage {
  readonly page: Page
  
  // Status columns
  readonly planningColumn: Locator
  readonly readyColumn: Locator
  readonly inProgressColumn: Locator
  readonly inReviewColumn: Locator
  readonly doneColumn: Locator
  readonly blockedColumn: Locator
  
  // Live indicator
  readonly liveIndicator: Locator
  
  // Error states
  readonly errorMessage: Locator

  constructor(page: Page) {
    this.page = page
    
    // Locate status columns by data-testid
    this.planningColumn = page.locator('[data-testid="column-planning"]')
    this.readyColumn = page.locator('[data-testid="column-ready"]')
    this.inProgressColumn = page.locator('[data-testid="column-in_progress"]')
    this.inReviewColumn = page.locator('[data-testid="column-in_review"]')
    this.doneColumn = page.locator('[data-testid="column-done"]')
    this.blockedColumn = page.locator('[data-testid="column-blocked"]')
    
    // Live indicator
    this.liveIndicator = page.locator('[data-testid="live-indicator"]')
    
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
    // Wait for at least one column to be visible
    await this.planningColumn.waitFor({ state: 'visible' })
  }

  /**
   * Check if all status columns are visible
   * @returns true if all columns are visible
   */
  async areAllColumnsVisible(): Promise<boolean> {
    const columns = [
      this.planningColumn,
      this.readyColumn,
      this.inProgressColumn,
      this.inReviewColumn,
      this.doneColumn,
      this.blockedColumn,
    ]
    
    for (const column of columns) {
      const isVisible = await column.isVisible()
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
    const column = this.getColumnByName(columnName)
    const tasks = column.locator('[data-testid^="task-"]')
    return await tasks.count()
  }

  /**
   * Get a column locator by name
   * @param columnName - Name of the column
   * @returns Locator for the column
   */
  private getColumnByName(columnName: string): Locator {
    switch (columnName) {
      case 'planning':
        return this.planningColumn
      case 'ready':
        return this.readyColumn
      case 'in_progress':
        return this.inProgressColumn
      case 'in_review':
        return this.inReviewColumn
      case 'done':
        return this.doneColumn
      case 'blocked':
        return this.blockedColumn
      default:
        throw new Error(`Unknown column name: ${columnName}`)
    }
  }
}
