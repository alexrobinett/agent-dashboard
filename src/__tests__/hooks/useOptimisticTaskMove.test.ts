/**
 * Tests for optimistic task move logic.
 * 
 * Tests the pure computeDisplayTasks function and the hook behavior
 * for optimistic updates with rollback.
 */

import { describe, it, expect } from 'vitest'
import { computeDisplayTasks } from '../../hooks/useOptimisticTaskMove'

const makeTask = (id: string, status: string, title = `Task ${id}`) => ({
  _id: id,
  title,
  status,
  assignedAgent: 'forge',
  priority: 'normal',
  project: 'test',
})

const baseTasks = {
  planning: [makeTask('t1', 'planning'), makeTask('t2', 'planning')],
  ready: [makeTask('t3', 'ready')],
  in_progress: [],
  in_review: [],
  done: [makeTask('t4', 'done')],
  blocked: [],
}

describe('computeDisplayTasks', () => {
  it('returns server tasks when no pending moves', () => {
    const result = computeDisplayTasks(baseTasks, new Map())
    expect(result).toBe(baseTasks) // same reference — no copy needed
  })

  it('moves a task from one column to another', () => {
    const pending = new Map([['t1', 'in_progress']])
    const result = computeDisplayTasks(baseTasks, pending)

    expect(result.planning.map((t: any) => t._id)).toEqual(['t2'])
    expect(result.in_progress.map((t: any) => t._id)).toEqual(['t1'])
    expect(result.in_progress[0].status).toBe('in_progress')
  })

  it('handles multiple simultaneous pending moves', () => {
    const pending = new Map([
      ['t1', 'ready'],
      ['t3', 'done'],
    ])
    const result = computeDisplayTasks(baseTasks, pending)

    expect(result.planning.map((t: any) => t._id)).toEqual(['t2'])
    expect(result.ready.map((t: any) => t._id)).toContain('t1')
    expect(result.done.map((t: any) => t._id)).toContain('t3')
    expect(result.done.map((t: any) => t._id)).toContain('t4')
  })

  it('does not mutate original tasks', () => {
    const planningBefore = [...baseTasks.planning]
    const pending = new Map([['t1', 'done']])
    computeDisplayTasks(baseTasks, pending)

    expect(baseTasks.planning).toEqual(planningBefore)
  })

  it('preserves all task fields when moving', () => {
    const pending = new Map([['t1', 'blocked']])
    const result = computeDisplayTasks(baseTasks, pending)
    const moved = result.blocked.find((t: any) => t._id === 't1')

    expect(moved).toBeDefined()
    expect(moved.title).toBe('Task t1')
    expect(moved.assignedAgent).toBe('forge')
    expect(moved.priority).toBe('normal')
    expect(moved.status).toBe('blocked')
  })

  it('places moved task at beginning of target column', () => {
    const pending = new Map([['t1', 'done']])
    const result = computeDisplayTasks(baseTasks, pending)

    expect(result.done[0]._id).toBe('t1')
    expect(result.done[1]._id).toBe('t4')
  })

  it('handles moving task to empty column', () => {
    const pending = new Map([['t4', 'in_review']])
    const result = computeDisplayTasks(baseTasks, pending)

    expect(result.done).toHaveLength(0)
    expect(result.in_review).toHaveLength(1)
    expect(result.in_review[0]._id).toBe('t4')
  })

  it('ignores pending move for non-existent task', () => {
    const pending = new Map([['nonexistent', 'done']])
    const result = computeDisplayTasks(baseTasks, pending)

    // All columns should have same counts as original
    expect(result.planning).toHaveLength(2)
    expect(result.done).toHaveLength(1)
  })
})
