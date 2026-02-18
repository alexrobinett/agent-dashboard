import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
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
}

export interface TaskDetailModalProps {
  task: TaskDetail | null
  activityEntries: ActivityEntry[]
  open: boolean
  onOpenChange: (open: boolean) => void
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
}: TaskDetailModalProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const claimTask = useMutation(api.tasks.claimTask)
  const completeTask = useMutation(api.tasks.completeTask)
  const updateTask = useMutation(api.tasks.update)

  if (!task) return null

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

  const canClaim = !task.assignedAgent && task.status !== 'done'
  const canComplete = task.status !== 'done' && task.status !== 'cancelled'
  const canBlock = task.status !== 'blocked' && task.status !== 'done'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="task-detail-modal"
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle data-testid="task-detail-title">{task.title}</DialogTitle>
          {task.description && (
            <DialogDescription data-testid="task-detail-description">
              {task.description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={STATUS_VARIANT[task.status] ?? 'outline'}>
            {task.status}
          </Badge>
          <Badge variant="secondary">{task.priority}</Badge>
          {task.assignedAgent && (
            <Badge variant="outline">{task.assignedAgent}</Badge>
          )}
          {task.project && (
            <span className="text-xs text-muted-foreground">{task.project}</span>
          )}
        </div>

        {/* Action buttons with loading states */}
        <div data-testid="task-actions" className="flex items-center gap-2 flex-wrap pt-2">
          {canClaim && (
            <Button
              data-testid="action-claim"
              variant="outline"
              size="sm"
              disabled={loadingAction !== null}
              onClick={() =>
                handleAction('claim', () => claimTask({ taskId: task._id as any, agent: 'user' }), 'Task claimed')
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
                handleAction('complete', () => completeTask({ taskId: task._id as any, result: 'Completed' }), 'Task completed')
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
                handleAction('block', () => updateTask({ id: task._id as any, status: 'blocked' }), 'Task blocked')
              }
            >
              {loadingAction === 'block' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Block
            </Button>
          )}
        </div>

        <ActivityTimeline entries={activityEntries} />
      </DialogContent>
    </Dialog>
  )
}
