import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskDetailModal } from '../../components/TaskDetailModal'

const mockUpdateTask = vi.fn()
const mockClaimTask = vi.fn()
const mockCompleteTask = vi.fn()
const mockDeleteTask = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    tasks: {
      updateTask: 'updateTask',
      claimTask: 'claimTask',
      completeTask: 'completeTask',
      deleteTask: 'deleteTask',
    },
  },
}))

vi.mock('convex/react', () => ({
  useMutation: (ref: string) => {
    if (ref === 'updateTask') return mockUpdateTask
    if (ref === 'claimTask') return mockClaimTask
    if (ref === 'completeTask') return mockCompleteTask
    if (ref === 'deleteTask') return mockDeleteTask
    return vi.fn()
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}))

const baseTask = {
  _id: 'j57-task-1',
  title: 'Original title',
  description: 'Original description',
  status: 'planning',
  priority: 'normal',
  taskKey: 'T-101',
}

describe('TaskDetailModal edit flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateTask.mockResolvedValue('ok')
    mockClaimTask.mockResolvedValue('ok')
    mockCompleteTask.mockResolvedValue('ok')
    mockDeleteTask.mockResolvedValue('ok')
  })

  it('opens and enters edit mode from the edit affordance', async () => {
    const user = userEvent.setup()
    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument()
    await user.click(screen.getByTestId('edit-task-button'))

    expect(screen.getByTestId('edit-title-input')).toBeInTheDocument()
    expect(screen.getByTestId('edit-description-input')).toBeInTheDocument()
  })

  it('saves edited title/description and calls updateTask with canonical _id', async () => {
    const user = userEvent.setup()
    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    await user.click(screen.getByTestId('edit-task-button'))
    await user.clear(screen.getByTestId('edit-title-input'))
    await user.type(screen.getByTestId('edit-title-input'), 'Updated title')
    await user.clear(screen.getByTestId('edit-description-input'))
    await user.type(screen.getByTestId('edit-description-input'), 'Updated description')
    await user.click(screen.getByTestId('save-task-button'))

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledWith({
        taskId: 'j57-task-1',
        title: 'Updated title',
        description: 'Updated description',
      })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Task details saved')
  })

  it('cancels edit and restores previous values without saving', async () => {
    const user = userEvent.setup()
    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    await user.click(screen.getByTestId('edit-task-button'))
    await user.clear(screen.getByTestId('edit-title-input'))
    await user.type(screen.getByTestId('edit-title-input'), 'Discarded title')
    await user.click(screen.getByTestId('cancel-task-button'))

    expect(screen.queryByTestId('edit-title-input')).not.toBeInTheDocument()
    expect(mockUpdateTask).not.toHaveBeenCalled()
    expect(screen.getByTestId('task-detail-title')).toHaveTextContent('Original title')
  })

  it('shows validation error when title is empty', async () => {
    const user = userEvent.setup()
    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    await user.click(screen.getByTestId('edit-task-button'))
    await user.clear(screen.getByTestId('edit-title-input'))
    await user.click(screen.getByTestId('save-task-button'))

    expect(screen.getByTestId('task-edit-error')).toHaveTextContent('Title is required.')
    expect(mockUpdateTask).not.toHaveBeenCalled()
  })

  it('supports keyboard save with Ctrl+S', async () => {
    const user = userEvent.setup()
    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    await user.click(screen.getByTestId('edit-task-button'))
    await user.clear(screen.getByTestId('edit-title-input'))
    await user.type(screen.getByTestId('edit-title-input'), 'Saved by keyboard')
    await user.keyboard('{Control>}s{/Control}')

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledWith({
        taskId: 'j57-task-1',
        title: 'Saved by keyboard',
        description: 'Original description',
      })
    })
  })

  it('handles save failure, rolls back optimistic patch, and surfaces clear error messaging', async () => {
    const user = userEvent.setup()
    const onTaskPatched = vi.fn()
    mockUpdateTask.mockRejectedValueOnce(new Error('Network down'))

    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
        onTaskPatched={onTaskPatched}
      />,
    )

    await user.click(screen.getByTestId('edit-task-button'))
    await user.clear(screen.getByTestId('edit-title-input'))
    await user.type(screen.getByTestId('edit-title-input'), 'Original title v2')
    await user.click(screen.getByTestId('save-task-button'))

    await waitFor(() => {
      expect(screen.getByTestId('task-edit-error')).toHaveTextContent('Network down')
    })
    expect(mockToastError).toHaveBeenCalledWith('Failed to save task details', {
      description: 'Network down',
    })
    expect(onTaskPatched).toHaveBeenNthCalledWith(1, 'j57-task-1', {
      title: 'Original title v2',
      description: 'Original description',
    })
    expect(onTaskPatched).toHaveBeenNthCalledWith(2, 'j57-task-1', {
      title: 'Original title',
      description: 'Original description',
    })
  })

  it('renders no action buttons for done task lower-branch path', () => {
    const doneTask = {
      ...baseTask,
      status: 'done',
      taskKey: undefined,
      assignedAgent: undefined,
      project: undefined,
    }

    render(
      <TaskDetailModal
        task={doneTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('action-claim')).not.toBeInTheDocument()
    expect(screen.queryByTestId('action-complete')).not.toBeInTheDocument()
    expect(screen.queryByTestId('action-block')).not.toBeInTheDocument()
  })

  it('shows all task action buttons for planning task', () => {
    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.getByTestId('action-claim')).toBeInTheDocument()
    expect(screen.getByTestId('action-complete')).toBeInTheDocument()
    expect(screen.getByTestId('action-block')).toBeInTheDocument()
  })

  it('covers TaskDetailModal lower branches: assignedAgent badge and project span', () => {
    const taskWithAgentAndProject = {
      ...baseTask,
      assignedAgent: 'forge',
      project: 'agent-dashboard',
    }

    render(
      <TaskDetailModal
        task={taskWithAgentAndProject}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    // assignedAgent badge should render
    expect(screen.getByText('forge')).toBeInTheDocument()
    // project span should render
    expect(screen.getByText('agent-dashboard')).toBeInTheDocument()
  })

  // Additional tests to cover action button handlers (lines 265-325)
  it('covers claim action button handler (lines 265-325)', async () => {
    const user = userEvent.setup()
    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    const claimButton = screen.getByTestId('action-claim')
    expect(claimButton).toBeInTheDocument()
    
    await user.click(claimButton)

    await waitFor(() => {
      expect(mockClaimTask).toHaveBeenCalledWith({
        taskId: 'j57-task-1',
        agent: 'user',
      })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Task claimed')
  })

  it('covers complete action button handler (lines 265-325)', async () => {
    const user = userEvent.setup()
    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    const completeButton = screen.getByTestId('action-complete')
    expect(completeButton).toBeInTheDocument()
    
    await user.click(completeButton)

    await waitFor(() => {
      expect(mockCompleteTask).toHaveBeenCalledWith({
        taskId: 'j57-task-1',
        result: 'Completed',
      })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Task completed')
  })

  it('covers block action button handler (lines 265-325)', async () => {
    const user = userEvent.setup()
    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    const blockButton = screen.getByTestId('action-block')
    expect(blockButton).toBeInTheDocument()
    
    await user.click(blockButton)

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledWith({
        taskId: 'j57-task-1',
        status: 'blocked',
      })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Task blocked')
  })

  it('covers action button loading states (lines 265-325)', async () => {
    // Make the mutation hang to test loading state
    mockClaimTask.mockImplementation(() => new Promise(() => {}))
    
    const user = userEvent.setup()
    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    const claimButton = screen.getByTestId('action-claim')
    await user.click(claimButton)

    // After clicking, all buttons should be disabled
    await waitFor(() => {
      expect(claimButton).toBeDisabled()
    })
    expect(screen.getByTestId('action-complete')).toBeDisabled()
    expect(screen.getByTestId('action-block')).toBeDisabled()
    
    // Loading spinner should be visible
    expect(claimButton.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('covers action button error handling (lines 265-325)', async () => {
    mockClaimTask.mockRejectedValueOnce(new Error('Claim failed'))
    
    const user = userEvent.setup()
    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    const claimButton = screen.getByTestId('action-claim')
    await user.click(claimButton)

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to claim', {
        description: 'Claim failed',
      })
    })
  })
})

describe('TaskDetailModal delete confirm/cancel flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateTask.mockResolvedValue('ok')
    mockClaimTask.mockResolvedValue('ok')
    mockCompleteTask.mockResolvedValue('ok')
    mockDeleteTask.mockResolvedValue('ok')
  })

  it('clicking Delete shows confirm and cancel buttons, hides Delete button', async () => {
    const user = userEvent.setup()
    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    // Initially the Delete button is visible, confirm/cancel are not
    expect(screen.getByTestId('action-delete')).toBeInTheDocument()
    expect(screen.queryByTestId('action-delete-confirm')).not.toBeInTheDocument()
    expect(screen.queryByTestId('action-delete-cancel')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('action-delete'))

    // After clicking Delete, confirm/cancel appear and Delete button hides
    expect(screen.queryByTestId('action-delete')).not.toBeInTheDocument()
    expect(screen.getByTestId('action-delete-confirm')).toBeInTheDocument()
    expect(screen.getByTestId('action-delete-cancel')).toBeInTheDocument()
  })

  it('clicking Cancel restores Delete button and does not call deleteTask', async () => {
    const user = userEvent.setup()
    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    await user.click(screen.getByTestId('action-delete'))
    await user.click(screen.getByTestId('action-delete-cancel'))

    // Confirm/cancel should be gone, Delete button should be back
    expect(screen.queryByTestId('action-delete-confirm')).not.toBeInTheDocument()
    expect(screen.queryByTestId('action-delete-cancel')).not.toBeInTheDocument()
    expect(screen.getByTestId('action-delete')).toBeInTheDocument()

    // deleteTask must NOT have been called
    expect(mockDeleteTask).not.toHaveBeenCalled()
  })

  it('clicking Confirm calls deleteTask and closes modal', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={onOpenChange}
      />,
    )

    await user.click(screen.getByTestId('action-delete'))
    await user.click(screen.getByTestId('action-delete-confirm'))

    await waitFor(() => {
      expect(mockDeleteTask).toHaveBeenCalledWith({ taskId: 'j57-task-1' })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Task deleted', expect.any(Object))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows error toast and keeps modal open when deleteTask fails', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    mockDeleteTask.mockRejectedValueOnce(new Error('Delete failed'))

    render(
      <TaskDetailModal
        task={baseTask}
        activityEntries={[]}
        open
        onOpenChange={onOpenChange}
      />,
    )

    await user.click(screen.getByTestId('action-delete'))
    await user.click(screen.getByTestId('action-delete-confirm'))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to delete task', {
        description: 'Delete failed',
      })
    })
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
