/**
 * E2E Test Fixtures - Mock Task Data
 * Sprint 3.1: Playwright configuration
 * 
 * Provides mock task data for E2E testing across multiple viewports
 */

export interface Task {
  _id: string
  _creationTime: number
  title: string
  assignedAgent: string
  status: 'planning' | 'ready' | 'in_progress' | 'in_review' | 'done' | 'blocked'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  project?: string
  createdBy: string
  createdAt: number
}

export const mockTasks: Record<string, Task[]> = {
  planning: [
    {
      _id: 'task-planning-1',
      _creationTime: Date.now(),
      title: 'Design new feature',
      assignedAgent: 'forge',
      status: 'planning',
      priority: 'normal',
      project: 'agent-dashboard',
      createdBy: 'main',
      createdAt: Date.now(),
    },
  ],
  ready: [
    {
      _id: 'task-ready-1',
      _creationTime: Date.now(),
      title: 'Implement authentication',
      assignedAgent: 'sentinel',
      status: 'ready',
      priority: 'high',
      createdBy: 'main',
      createdAt: Date.now(),
    },
    {
      _id: 'task-ready-2',
      _creationTime: Date.now(),
      title: 'Update documentation',
      assignedAgent: 'friday',
      status: 'ready',
      priority: 'low',
      createdBy: 'main',
      createdAt: Date.now(),
    },
  ],
  in_progress: [
    {
      _id: 'task-inprogress-1',
      _creationTime: Date.now(),
      title: 'Fix critical bug',
      assignedAgent: 'oracle',
      status: 'in_progress',
      priority: 'urgent',
      project: 'trading-bot',
      createdBy: 'main',
      createdAt: Date.now(),
    },
  ],
  in_review: [],
  done: [
    {
      _id: 'task-done-1',
      _creationTime: Date.now(),
      title: 'Complete Sprint 1',
      assignedAgent: 'forge',
      status: 'done',
      priority: 'normal',
      createdBy: 'main',
      createdAt: Date.now(),
    },
  ],
  blocked: [],
}

export const emptyTasks: Record<string, Task[]> = {
  planning: [],
  ready: [],
  in_progress: [],
  in_review: [],
  done: [],
  blocked: [],
}
