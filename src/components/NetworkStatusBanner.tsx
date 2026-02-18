import { useConvexConnectionState } from 'convex/react'
import { WifiOff } from 'lucide-react'

/**
 * Detects Convex WebSocket disconnects using the Convex useConvexConnectionState()
 * hook, which accurately reflects the actual WebSocket connection state rather
 * than relying on the browser's navigator.onLine API.
 */
export function NetworkStatusBanner() {
  const { isWebSocketConnected } = useConvexConnectionState()

  if (isWebSocketConnected) return null

  return (
    <div
      data-testid="network-status-banner"
      role="alert"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-md"
    >
      <WifiOff className="h-4 w-4" />
      <span>Reconnecting — live updates paused</span>
    </div>
  )
}
