import { ConvexHttpClient } from 'convex/browser'
import { ConvexReactClient } from 'convex/react'

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL

if (!CONVEX_URL) {
  throw new Error('VITE_CONVEX_URL environment variable is not set')
}

const convexClientOptions = {
  // Convex now serves deployment URLs on .convex.site in some environments.
  // Allow that domain until SDK default validation catches up.
  skipConvexDeploymentUrlCheck: true,
}

// HTTP client for server-side queries (SSR)
export const convex = new ConvexHttpClient(CONVEX_URL, convexClientOptions)

// React client for client-side reactive queries
export const convexReactClient = new ConvexReactClient(CONVEX_URL, convexClientOptions)
