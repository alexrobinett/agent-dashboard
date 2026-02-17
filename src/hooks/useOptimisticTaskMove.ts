import { useState, useCallback, useRef } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { toast } from 'sonner'

type TasksByStatus = Record<string, any[]>

/**
 * Hook that provides optimistic task status updates with rollback on failure.
 * 
 * When a task is moved (via DnD), the UI updates immediately. If the server
 * mutation fails, the change is rolled back and a toast notification is shown.
 */
export function useOptimisticTaskMove(serverTasks: TasksByStatus) {
  // Optimistic overrides: taskId -> newStatus
  const [pendingMoves, setPendingMoves] = useState<Map<string, string>>(new Map())
  const updateTask = useMutation(api.tasks.update)
  const inflightRef = useRef(0)

  // Compute the displayed tasks by applying pending moves on top of server state
  const displayTasks: TasksByStatus = computeDisplayTasks(serverTasks, pendingMoves)

  const moveTask = useCallback(
    async (taskId: string, _fromStatus: string, toStatus: string) => {
      // Apply optimistic update
      setPendingMoves((prev) => {
        const next = new Map(prev)
        next.set(taskId, toStatus)
        return next
      })

      inflightRef.current++

      try {
        await updateTask({ id: taskId as any, status: toStatus })
        // Success — server state will update via subscription, remove pending
        setPendingMoves((prev) => {
          const next = new Map(prev)
          next.delete(taskId)
          return next
        })
      } catch (error) {
        // Rollback: remove the optimistic override
        setPendingMoves((prev) => {
          const next = new Map(prev)
          next.delete(taskId)
          return next
        })

        const message =
          error instanceof Error ? error.message : 'Unknown error'
        toast.error('Failed to move task', {
          description: message,
          duration: 5000,
        })
      } finally {
        inflightRef.current--
      }
    },
    [updateTask],
  )

  return { displayTasks, moveTask, hasPending: pendingMoves.size > 0 }
}

/**
 * Pure function: applies optimistic moves on top of server tasks.
 */
export function computeDisplayTasks(
  serverTasks: TasksByStatus,
  pendingMoves: Map<string, string>,
): TasksByStatus {
  if (pendingMoves.size === 0) return serverTasks

  // Clone all columns
  const result: TasksByStatus = {}
  for (const [status, tasks] of Object.entries(serverTasks)) {
    result[status] = [...tasks]
  }

  // Move tasks according to pending overrides
  for (const [taskId, newStatus] of pendingMoves) {
    // Find and remove from current column
    let movedTask: any = null
    for (const [status, tasks] of Object.entries(result)) {
      const idx = tasks.findIndex((t: any) => t._id === taskId)
      if (idx !== -1) {
        movedTask = tasks[idx]
        result[status] = tasks.filter((_: any, i: number) => i !== idx)
        break
      }
    }

    // Add to new column
    if (movedTask && result[newStatus]) {
      result[newStatus] = [{ ...movedTask, status: newStatus }, ...result[newStatus]]
    }
  }

  return result
}
