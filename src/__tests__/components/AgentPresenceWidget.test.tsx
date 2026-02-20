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
})
