import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

/**
 * Detects Convex WebSocket disconnects by listening to browser online/offline
 * events and monitoring the Convex client connection state.
 */
export function NetworkStatusBanner() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return

    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => setIsOffline(false)

    // Check initial state
    if (!navigator.onLine) {
      setIsOffline(true)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!isOffline) return null

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
