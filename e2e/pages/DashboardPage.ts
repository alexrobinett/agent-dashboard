import { type Page, type Locator } from '@playwright/test'

/**
 * Page Object Model for the Dashboard page
 * Provides methods to interact with the Kanban board
 */
export class DashboardPage {
  readonly page: Page
  
  // Status headings (only present when there are tasks to show)
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

  // Empty states (shown by 7.1c UX resilience feature when no tasks exist)
  readonly emptyStateNoData: Locator
  readonly emptyStateNoResults: Locator

  // Board panel (present whether tasks exist or not)
  readonly boardViewPanel: Locator

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

    // Empty states from 7.1c UX resilience
    this.emptyStateNoData = page.getByTestId('empty-state-no-data')
    this.emptyStateNoResults = page.getByTestId('empty-state-no-results')

    // Board panel
    this.boardViewPanel = page.getByTestId('board-view-panel')
  }

  /**
   * Navigate to the dashboard page
   */
  async goto() {
    await this.page.goto('/dashboard')
  }

  /**
   * Wait for the dashboard to be fully loaded.
   * The board always renders KanbanBoard columns. When no tasks exist,
   * an EmptyState notice appears above the columns (7.1c UX resilience).
   */
  async waitForLoad() {
    // Wait for the page header (always present after auth + load)
    await this.page.getByRole('heading', { name: /task dashboard/i }).waitFor({ state: 'visible' })

    // The board-view-panel is always rendered (even when empty)
    await Promise.race([
      this.boardViewPanel.waitFor({ state: 'visible', timeout: 20000 }),
      this.emptyStateNoResults.waitFor({ state: 'visible', timeout: 20000 }),
    ])
  }

  /**
   * Check if the board is in a valid loaded state.
   * Returns true when the board panel is visible (columns always render)
   * or a no-results empty state is shown.
   */
  async isBoardInValidState(): Promise<boolean> {
    const hasBoardPanel = await this.boardViewPanel.isVisible()
    const hasEmptyStateNoResults = await this.emptyStateNoResults.isVisible()
    return hasBoardPanel || hasEmptyStateNoResults
  }

  /**
   * Check if all status columns are visible.
   * Columns are always rendered even when empty (7.1c keeps columns visible).
   * Returns false only if a "no results" filter state is active.
   */
  async areAllColumnsVisible(): Promise<boolean> {
    // No-results filter: columns are replaced by EmptyState
    const hasEmptyStateNoResults = await this.emptyStateNoResults.isVisible()
    if (hasEmptyStateNoResults) return true // board loaded, filter just matched nothing

    // All column headings should be present
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
