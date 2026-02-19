import { useEffect, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { toast } from 'sonner'
import { Copy, Loader2, PencilLine } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { ActivityTimeline, type ActivityEntry } from './ActivityTimeline'

export interface TaskDetail {
  _id: string
  title: string
  description?: string
  status: string
  priority: string
  assignedAgent?: string
  project?: string
  taskKey?: string
}

export interface TaskDetailModalProps {
  task: TaskDetail | null
  activityEntries: ActivityEntry[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskPatched?: (taskId: string, patch: Partial<TaskDetail>) => void
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  in_progress: 'default',
  done: 'secondary',
  blocked: 'destructive',
  cancelled: 'outline',
}

export function TaskDetailModal({
  task,
  activityEntries,
  open,
  onOpenChange,
  onTaskPatched,
}: TaskDetailModalProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [optimisticTask, setOptimisticTask] = useState<TaskDetail | null>(null)
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false)

  const claimTask = useMutation(api.tasks.claimTask)
  const completeTask = useMutation(api.tasks.completeTask)
  const updateTask = useMutation(api.tasks.updateTask)
  const deleteTask = useMutation(api.tasks.deleteTask)

  useEffect(() => {
    if (!task) return
    setOptimisticTask(task)
    setTitleDraft(task.title ?? '')
    setDescriptionDraft(task.description ?? '')
    setIsEditing(false)
    setFormError(null)
    setIsDeleteConfirming(false)
  }, [task?._id, task])

  const displayedTask = optimisticTask ?? task
  if (!displayedTask) return null

  const trimmedTitle = titleDraft.trim()

  const handleAction = async (
    actionName: string,
    fn: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setLoadingAction(actionName)
    try {
      await fn()
      toast.success(successMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to ${actionName}`, { description: message })
    } finally {
      setLoadingAction(null)
    }
  }

  const canClaim = !displayedTask.assignedAgent && displayedTask.status !== 'done'
  const canComplete = displayedTask.status !== 'done' && displayedTask.status !== 'cancelled'
  const canBlock = displayedTask.status !== 'blocked' && displayedTask.status !== 'done'

  const copyToClipboard = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`, { description: value })
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`)
    }
  }

  const startEditing = () => {
    setTitleDraft(displayedTask.title ?? '')
    setDescriptionDraft(displayedTask.description ?? '')
    setIsEditing(true)
    setFormError(null)
  }

  const cancelEditing = () => {
    setTitleDraft(displayedTask.title ?? '')
    setDescriptionDraft(displayedTask.description ?? '')
    setIsEditing(false)
    setFormError(null)
  }

  const saveEdits = async () => {
    if (!trimmedTitle) {
      setFormError('Title is required.')
      return
    }

    const previousTask = displayedTask
    const patch: Partial<TaskDetail> = {
      title: trimmedTitle,
      description: descriptionDraft.trim() || undefined,
    }

    setFormError(null)
    setLoadingAction('save')
    setOptimisticTask((prev) => (prev ? { ...prev, ...patch } : prev))
    onTaskPatched?.(displayedTask._id, patch)
    setIsEditing(false)

    try {
      await updateTask({
        taskId: displayedTask._id as any,
        title: patch.title,
        description: patch.description,
      })
      toast.success('Task details saved')
    } catch (error) {
      setOptimisticTask(previousTask)
      onTaskPatched?.(displayedTask._id, {
        title: previousTask.title,
        description: previousTask.description,
      })
      setIsEditing(true)
      const message = error instanceof Error ? error.message : 'Unknown error'
      setFormError(message)
      toast.error('Failed to save task details', { description: message })
    } finally {
      setLoadingAction(null)
    }
  }

  const confirmDelete = async () => {
    setLoadingAction('delete')
    try {
      await deleteTask({ taskId: displayedTask._id as any })
      toast.success('Task deleted', {
        description: (
          <span className="inline-flex items-center gap-2">
            Undo is not available yet.
            <button
              type="button"
              className="underline"
              onClick={() => toast.info('Undo is coming soon')}
            >
              Undo
            </button>
          </span>
        ),
      })
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error('Failed to delete task', { description: message })
    } finally {
      setLoadingAction(null)
      setIsDeleteConfirming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="task-detail-modal"
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
        onKeyDown={(event) => {
          if (!isEditing || loadingAction === 'save') return
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
            event.preventDefault()
            void saveEdits()
          }
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle data-testid="task-detail-title">{displayedTask.title}</DialogTitle>
            {!isEditing && (
              <Button
                type="button"
                data-testid="edit-task-button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={startEditing}
              >
                <PencilLine className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
            )}
          </div>
          <DialogDescription
            data-testid="task-detail-description"
            className={displayedTask.description ? '' : 'sr-only'}
          >
            {displayedTask.description || 'Task details and activity'}
          </DialogDescription>
        </DialogHeader>

        {isEditing && (
          <form
            data-testid="task-edit-form"
            className="space-y-3 rounded-md border border-border p-3"
            onSubmit={(e) => {
              e.preventDefault()
              void saveEdits()
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="task-title-input" className="text-sm font-medium">Title</label>
              <input
                id="task-title-input"
                data-testid="edit-title-input"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-invalid={Boolean(formError && !trimmedTitle)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="task-description-input" className="text-sm font-medium">Description</label>
              <textarea
                id="task-description-input"
                data-testid="edit-description-input"
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {formError && (
              <p data-testid="task-edit-error" role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                data-testid="save-task-button"
                size="sm"
                disabled={loadingAction === 'save'}
              >
                {loadingAction === 'save' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Save
              </Button>
              <Button
                type="button"
                data-testid="cancel-task-button"
                variant="outline"
                size="sm"
                disabled={loadingAction === 'save'}
                onClick={cancelEditing}
              >
                Cancel
              </Button>
              <span className="text-xs text-muted-foreground">Press ⌘/Ctrl+S to save</span>
            </div>
          </form>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="font-mono">{displayedTask.taskKey ?? displayedTask._id}</Badge>
          <Button
            data-testid="copy-task-key"
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard('Task key', displayedTask.taskKey ?? displayedTask._id)}
          >
            <Copy className="h-3.5 w-3.5 mr-1" /> Copy key
          </Button>
          <Button
            data-testid="copy-task-id"
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard('Task id', displayedTask._id)}
          >
            <Copy className="h-3.5 w-3.5 mr-1" /> Copy ID
          </Button>
          <Badge variant={STATUS_VARIANT[displayedTask.status] ?? 'outline'}>
            {displayedTask.status}
          </Badge>
          <Badge variant="secondary">{displayedTask.priority}</Badge>
          {displayedTask.assignedAgent && (
            <Badge variant="outline">{displayedTask.assignedAgent}</Badge>
          )}
          {displayedTask.project && (
            <span className="text-xs text-muted-foreground">{displayedTask.project}</span>
          )}
        </div>

        <div data-testid="task-actions" className="flex items-center gap-2 flex-wrap pt-2">
          {canClaim && (
            <Button
              data-testid="action-claim"
              variant="outline"
              size="sm"
              disabled={loadingAction !== null}
              onClick={() =>
                handleAction('claim', () => claimTask({ taskId: displayedTask._id as any, agent: 'user' }), 'Task claimed')
              }
            >
              {loadingAction === 'claim' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Claim
            </Button>
          )}
          {canComplete && (
            <Button
              data-testid="action-complete"
              variant="outline"
              size="sm"
              disabled={loadingAction !== null}
              onClick={() =>
                handleAction('complete', () => completeTask({ taskId: displayedTask._id as any, result: 'Completed' }), 'Task completed')
              }
            >
              {loadingAction === 'complete' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Complete
            </Button>
          )}
          {canBlock && (
            <Button
              data-testid="action-block"
              variant="outline"
              size="sm"
              disabled={loadingAction !== null}
              onClick={() =>
                handleAction('block', () => updateTask({ taskId: displayedTask._id as any, status: 'blocked' }), 'Task blocked')
              }
            >
              {loadingAction === 'block' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Block
            </Button>
          )}
          {!isDeleteConfirming && (
            <Button
              data-testid="action-delete"
              variant="destructive"
              size="sm"
              disabled={loadingAction !== null}
              onClick={() => setIsDeleteConfirming(true)}
            >
              Delete
            </Button>
          )}
          {isDeleteConfirming && (
            <>
              <Button
                data-testid="action-delete-cancel"
                variant="outline"
                size="sm"
                disabled={loadingAction !== null}
                onClick={() => setIsDeleteConfirming(false)}
              >
                Cancel
              </Button>
              <Button
                data-testid="action-delete-confirm"
                variant="destructive"
                size="sm"
                disabled={loadingAction !== null}
                onClick={() => void confirmDelete()}
              >
                {loadingAction === 'delete' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                Confirm
              </Button>
            </>
          )}
        </div>

        <ActivityTimeline entries={activityEntries} />
      </DialogContent>
    </Dialog>
  )
}
