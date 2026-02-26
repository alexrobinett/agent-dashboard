import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentPresenceWidget, type AgentPresenceEntry } from '../../components/AgentPresenceWidget'
import type { WorkloadData } from '../../components/WorkloadChart'

describe('AgentPresenceWidget', () => {
  it('renders empty state when no agents are present', () => {
    render(<AgentPresenceWidget agents={[]} workload={{}} />)

    expect(screen.getByTestId('agent-presence-empty').textContent).toContain('No active agent presence data')
  })

  it('shows online/busy/offline states and current activity', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-20T22:45:00.000Z'))

    const agents: AgentPresenceEntry[] = [
      {
        agent: 'forge',
        status: 'in_progress',
        lastSeen: new Date('2026-02-20T22:44:00.000Z').getTime(),
        activeTask: { taskId: '1', taskKey: 'AD-1', title: 'Build presence widget' },
      },
      {
        agent: 'sentinel',
        status: 'ready',
        lastSeen: new Date('2026-02-20T22:43:30.000Z').getTime(),
        activeTask: { taskId: '2', taskKey: 'AD-2', title: 'Review PR' },
      },
      {
        agent: 'oracle',
        status: 'blocked',
        lastSeen: new Date('2026-02-20T22:35:00.000Z').getTime(),
        activeTask: { taskId: '3', taskKey: 'AD-3', title: 'Investigate issue' },
      },
    ]

    const workload: WorkloadData = {
      forge: { total: 4, byStatus: { in_progress: 2 }, byPriority: {} },
      sentinel: { total: 3, byStatus: { in_progress: 0 }, byPriority: {} },
      oracle: { total: 1, byStatus: { in_progress: 1 }, byPriority: {} },
    }

    render(<AgentPresenceWidget agents={agents} workload={workload} />)

    expect(screen.getByTestId('agent-state-forge').textContent).toBe('busy')
    expect(screen.getByTestId('agent-state-sentinel').textContent).toBe('online')
    expect(screen.getByTestId('agent-state-oracle').textContent).toBe('offline')

    expect(screen.getByTestId('agent-activity-forge').textContent).toContain('AD-1: Build presence widget')
    expect(screen.getByTestId('agent-activity-forge').textContent).toContain('in progress')
    expect(screen.getByTestId('agent-workload-forge').textContent).toContain('2/4 in progress')

    vi.useRealTimers()
  })

  it('shows "just now" for agents seen less than 30 seconds ago', () => {
    vi.useFakeTimers()
    const now = new Date('2026-02-20T22:45:00.000Z').getTime()
    vi.setSystemTime(now)

    const agents: AgentPresenceEntry[] = [
      {
        agent: 'jarvis',
        status: 'in_review',
        lastSeen: now - 10_000, // 10 seconds ago
        activeTask: { taskId: '4', taskKey: 'AD-4', title: 'Quick review' },
      },
    ]

    render(<AgentPresenceWidget agents={agents} workload={{}} />)

    expect(screen.getByTestId('agent-presence-jarvis').textContent).toContain('just now')
    // in_review is a busy status and recently seen => busy
    expect(screen.getByTestId('agent-state-jarvis').textContent).toBe('busy')

    vi.useRealTimers()
  })

  it('shows hours-ago format for agents seen more than 60 minutes ago', () => {
    vi.useFakeTimers()
    const now = new Date('2026-02-20T22:45:00.000Z').getTime()
    vi.setSystemTime(now)

    const agents: AgentPresenceEntry[] = [
      {
        agent: 'archivist',
        status: 'ready',
        lastSeen: now - 3 * 60 * 60 * 1000, // 3 hours ago → offline
        activeTask: { taskId: '5', taskKey: 'AD-5', title: 'Archive logs' },
      },
    ]

    render(<AgentPresenceWidget agents={agents} workload={{}} />)

    expect(screen.getByTestId('agent-presence-archivist').textContent).toContain('3h ago')
    expect(screen.getByTestId('agent-state-archivist').textContent).toBe('offline')

    vi.useRealTimers()
  })

  it('handles agents with no workload entry and no active task', () => {
    vi.useFakeTimers()
    const now = new Date('2026-02-20T22:45:00.000Z').getTime()
    vi.setSystemTime(now)

    const agents: AgentPresenceEntry[] = [
      {
        agent: 'unknown-agent',
        status: undefined,
        lastSeen: now - 60_000, // 1 minute ago → online
      },
    ]

    render(<AgentPresenceWidget agents={agents} workload={{}} />)

    // No workload entry → shows 0/0 in progress
    expect(screen.getByTestId('agent-workload-unknown-agent').textContent).toContain('0/0 in progress')
    // No active task → falls back to defaults
    expect(screen.getByTestId('agent-activity-unknown-agent').textContent).toContain('Task: No current task')
    // undefined status → "online" (not in BUSY_TASK_STATUSES)
    expect(screen.getByTestId('agent-state-unknown-agent').textContent).toBe('online')
    // undefined status → formatStatus returns 'planning'
    expect(screen.getByTestId('agent-activity-unknown-agent').textContent).toContain('planning')

    vi.useRealTimers()
  })

  it('shows busy state for in_review status when recently seen', () => {
    vi.useFakeTimers()
    const now = new Date('2026-02-20T22:45:00.000Z').getTime()
    vi.setSystemTime(now)

    const agents: AgentPresenceEntry[] = [
      {
        agent: 'reviewer',
        status: 'in_review',
        lastSeen: now - 2 * 60 * 1000, // 2 minutes ago → recently seen
        activeTask: { taskId: '6', taskKey: 'AD-6', title: 'Reviewing code' },
      },
      {
        agent: 'blocker',
        status: 'blocked',
        lastSeen: now - 3 * 60 * 1000, // 3 minutes ago → recently seen
        activeTask: { taskId: '7', taskKey: 'AD-7', title: 'Blocked task' },
      },
    ]

    const workload: WorkloadData = {
      reviewer: { total: 0, byStatus: {}, byPriority: {} },
      blocker: { total: 5, byStatus: { in_progress: 5 }, byPriority: {} },
    }

    render(<AgentPresenceWidget agents={agents} workload={workload} />)

    expect(screen.getByTestId('agent-state-reviewer').textContent).toBe('busy')
    expect(screen.getByTestId('agent-state-blocker').textContent).toBe('busy')
    // totalTasks = 0 → loadPct = 0
    expect(screen.getByTestId('agent-workload-reviewer').textContent).toContain('0/0 in progress')
    // totalTasks = 5, inProgress = 5 → 100% load
    expect(screen.getByTestId('agent-workload-blocker').textContent).toContain('5/5 in progress')

    vi.useRealTimers()
  })
})
