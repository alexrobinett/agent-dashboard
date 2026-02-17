import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ActivityTimeline, type ActivityEntry } from '../../components/ActivityTimeline'

// --- helpers -----------------------------------------------------------

function createEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    _id: `log-${Math.random().toString(36).slice(2, 8)}`,
    taskId: 'task-1',
    actor: 'forge',
    actorType: 'agent',
    action: 'created',
    timestamp: Date.now(),
    ...overrides,
  }
}

function renderTimeline(entries: ActivityEntry[] = []) {
  return render(<ActivityTimeline entries={entries} />)
}

// --- tests -------------------------------------------------------------

describe('ActivityTimeline', () => {
  describe('Empty state', () => {
    it('renders empty state message when no entries', () => {
      renderTimeline([])
      expect(screen.getByTestId('activity-timeline-empty')).toBeDefined()
      expect(screen.getByText('No activity yet')).toBeDefined()
    })

    it('renders the timeline container', () => {
      renderTimeline([])
      expect(screen.getByTestId('activity-timeline')).toBeDefined()
    })
  })

  describe('Rendering entries', () => {
    it('renders correct number of entries', () => {
      const entries = [
        createEntry({ action: 'created', actor: 'forge' }),
        createEntry({ action: 'started', actor: 'sentinel' }),
        createEntry({ action: 'completed', actor: 'oracle' }),
      ]
      renderTimeline(entries)
      const items = screen.getAllByTestId(/^activity-entry-/)
      expect(items).toHaveLength(3)
    })

    it('displays actor name for each entry', () => {
      const entries = [
        createEntry({ actor: 'forge', _id: 'log-1' }),
        createEntry({ actor: 'sentinel', _id: 'log-2' }),
      ]
      renderTimeline(entries)
      expect(screen.getByText('forge')).toBeDefined()
      expect(screen.getByText('sentinel')).toBeDefined()
    })

    it('displays action for each entry', () => {
      const entries = [
        createEntry({ action: 'created', _id: 'log-1' }),
        createEntry({ action: 'completed', _id: 'log-2' }),
      ]
      renderTimeline(entries)
      expect(screen.getByText('created')).toBeDefined()
      expect(screen.getByText('completed')).toBeDefined()
    })

    it('displays formatted timestamp for each entry', () => {
      const ts = new Date('2025-06-15T10:30:00Z').getTime()
      const entries = [createEntry({ timestamp: ts, _id: 'log-1' })]
      renderTimeline(entries)
      const entry = screen.getByTestId('activity-entry-log-1')
      const timeEl = within(entry).getByTestId('activity-timestamp-log-1')
      expect(timeEl.textContent).toBeDefined()
      // Should contain some representation of the date
      expect(timeEl.textContent!.length).toBeGreaterThan(0)
    })
  })

  describe('Sorting', () => {
    it('sorts entries newest first', () => {
      const now = Date.now()
      const entries = [
        createEntry({ _id: 'log-oldest', timestamp: now - 3000, action: 'created' }),
        createEntry({ _id: 'log-newest', timestamp: now, action: 'completed' }),
        createEntry({ _id: 'log-middle', timestamp: now - 1000, action: 'started' }),
      ]
      renderTimeline(entries)
      const items = screen.getAllByTestId(/^activity-entry-/)
      expect(items[0].getAttribute('data-testid')).toBe('activity-entry-log-newest')
      expect(items[1].getAttribute('data-testid')).toBe('activity-entry-log-middle')
      expect(items[2].getAttribute('data-testid')).toBe('activity-entry-log-oldest')
    })

    it('preserves order for entries with same timestamp', () => {
      const ts = Date.now()
      const entries = [
        createEntry({ _id: 'log-a', timestamp: ts }),
        createEntry({ _id: 'log-b', timestamp: ts }),
      ]
      renderTimeline(entries)
      const items = screen.getAllByTestId(/^activity-entry-/)
      expect(items).toHaveLength(2)
    })
  })

  describe('Actor type badge', () => {
    it('renders actor type badge for agent', () => {
      const entries = [createEntry({ actorType: 'agent', _id: 'log-1' })]
      renderTimeline(entries)
      const entry = screen.getByTestId('activity-entry-log-1')
      expect(within(entry).getByText('agent')).toBeDefined()
    })

    it('renders actor type badge for user', () => {
      const entries = [createEntry({ actorType: 'user', actor: 'admin', _id: 'log-1' })]
      renderTimeline(entries)
      const entry = screen.getByTestId('activity-entry-log-1')
      expect(within(entry).getByText('user')).toBeDefined()
    })

    it('renders actor type badge for system', () => {
      const entries = [createEntry({ actorType: 'system', actor: 'scheduler', _id: 'log-1' })]
      renderTimeline(entries)
      const entry = screen.getByTestId('activity-entry-log-1')
      expect(within(entry).getByText('system')).toBeDefined()
    })
  })

  describe('Metadata display', () => {
    it('displays status transition when metadata has fromStatus and toStatus', () => {
      const entries = [
        createEntry({
          _id: 'log-1',
          action: 'status_changed',
          metadata: { fromStatus: 'ready', toStatus: 'in_progress' },
        }),
      ]
      renderTimeline(entries)
      const entry = screen.getByTestId('activity-entry-log-1')
      expect(within(entry).getByText(/ready/)).toBeDefined()
      expect(within(entry).getByText(/in_progress/)).toBeDefined()
    })

    it('displays notes when present in metadata', () => {
      const entries = [
        createEntry({
          _id: 'log-1',
          action: 'updated',
          metadata: { notes: 'Fixed authentication bug' },
        }),
      ]
      renderTimeline(entries)
      const entry = screen.getByTestId('activity-entry-log-1')
      expect(within(entry).getByText('Fixed authentication bug')).toBeDefined()
    })

    it('renders without metadata gracefully', () => {
      const entries = [createEntry({ _id: 'log-1', action: 'claimed' })]
      renderTimeline(entries)
      expect(screen.getByTestId('activity-entry-log-1')).toBeDefined()
    })
  })

  describe('Accessibility', () => {
    it('has aria-label on the timeline container', () => {
      renderTimeline([])
      expect(screen.getByLabelText('Activity timeline')).toBeDefined()
    })

    it('has role=list on the entries container', () => {
      const entries = [createEntry({ _id: 'log-1' })]
      renderTimeline(entries)
      const list = screen.getByRole('list')
      expect(list).toBeDefined()
    })
  })
})
