import { ConvexHttpClient } from 'convex/browser'
import { ConvexReactClient } from 'convex/react'

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL

if (!CONVEX_URL) {
  throw new Error('VITE_CONVEX_URL environment variable is not set')
}

// HTTP client for server-side queries (SSR)
export const convex = new ConvexHttpClient(CONVEX_URL)

// React client for client-side reactive queries
export const convexReactClient = new ConvexReactClient(CONVEX_URL)
