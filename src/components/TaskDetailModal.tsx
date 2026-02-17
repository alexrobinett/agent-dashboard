import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'
import { Badge } from './ui/badge'
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
  if (!task) return null

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

        <ActivityTimeline entries={activityEntries} />
      </DialogContent>
    </Dialog>
  )
}
