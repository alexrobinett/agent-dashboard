/**
 * src/test-utils/task-fixtures.ts
 * Task fixture factory matching the real Convex schema.
 * Sprint 3: Testing Infrastructure
 *
 * Schema source: convex/schema.ts
 */

import type { Id } from '../../convex/_generated/dataModel'

// ---------------------------------------------------------------------------
// Types mirroring convex/schema.ts
// ---------------------------------------------------------------------------

export type TaskStatus =
  | 'planning'
  | 'ready'
  | 'in_progress'
  | 'in_review'
  | 'done'
  | 'blocked'
  | 'cancelled'
  | 'pending'
  | 'active'

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface TaskFixture {
  _id: Id<'tasks'>
  _creationTime: number
  title: string
  description?: string
  assignedAgent?: string
  createdBy: string
  status: TaskStatus
  priority: TaskPriority
  createdAt: number
  startedAt?: number
  completedAt?: number
  dueAt?: number
  parentTask?: Id<'tasks'>
  dependsOn?: Id<'tasks'>[]
  project?: string
  notes?: string
  tags?: string[]
  result?: string
  blockedReason?: string
}

// ---------------------------------------------------------------------------
// Counter for deterministic IDs
// ---------------------------------------------------------------------------

let _counter = 0

function nextId(): Id<'tasks'> {
  return `task_fixture_${++_counter}` as unknown as Id<'tasks'>
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * buildTask — create a TaskFixture with sensible defaults.
 * Override any field by passing a partial object.
 *
 * @example
 * const task = buildTask({ title: 'Write tests', status: 'in_progress' })
 * const tasks = buildTaskList(5)
 */
export function buildTask(overrides: Partial<TaskFixture> = {}): TaskFixture {
  const now = Date.now()
  return {
    _id: nextId(),
    _creationTime: now,
    title: 'Test Task',
    description: 'A fixture task for testing.',
    assignedAgent: 'forge',
    createdBy: 'test-user',
    status: 'planning',
    priority: 'normal',
    createdAt: now,
    tags: [],
    ...overrides,
  }
}

/**
 * buildTaskList — create an array of n TaskFixtures.
 * Applies the optional override to each task, or you can pass an array of overrides.
 *
 * @example
 * const tasks = buildTaskList(3, { status: 'in_progress' })
 */
export function buildTaskList(
  count: number,
  overrides: Partial<TaskFixture> | Partial<TaskFixture>[] = {}
): TaskFixture[] {
  return Array.from({ length: count }, (_, i) => {
    const override = Array.isArray(overrides) ? overrides[i] ?? {} : overrides
    return buildTask({ title: `Test Task ${i + 1}`, ...override })
  })
}

/**
 * TASK_STATUSES — all valid status values for iteration in tests.
 */
export const TASK_STATUSES: TaskStatus[] = [
  'planning',
  'ready',
  'in_progress',
  'in_review',
  'done',
  'blocked',
  'cancelled',
]

/**
 * TASK_PRIORITIES — all valid priority values.
 */
export const TASK_PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent']

/**
 * buildTasksForKanban — convenience factory that creates one task per canonical column.
 * Useful for rendering a fully-populated Kanban board in tests.
 */
export function buildTasksForKanban(): TaskFixture[] {
  const columnStatuses: TaskStatus[] = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked']
  return columnStatuses.map((status, i) =>
    buildTask({
      title: `${status.replace('_', ' ')} task ${i + 1}`,
      status,
      priority: TASK_PRIORITIES[i % TASK_PRIORITIES.length],
    })
  )
}
