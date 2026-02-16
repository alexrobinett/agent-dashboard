import { httpRouter, httpActionGeneric } from 'convex/server'
import { api } from './_generated/api'

const http = httpRouter()

/**
 * Get allowed CORS origins from environment
 * Supports comma-separated list of origins
 * Falls back to wildcard (*) if not configured (development mode)
 */
function getAllowedOrigins(): string[] {
  const origins = process.env.ALLOWED_ORIGINS
  if (origins) {
    return origins.split(',').map((o) => o.trim())
  }
  // Development fallback: allow all origins
  return ['*']
}

/**
 * CORS configuration for web dashboard
 * Configurable via ALLOWED_ORIGINS environment variable
 */
const corsConfig = {
  allowedOrigins: getAllowedOrigins(),
  methods: 'GET, POST, PUT, DELETE, OPTIONS',
  headers: 'Content-Type, Authorization',
  maxAge: '86400',
}

/**
 * Helper to add CORS headers to response
 * Supports origin-specific responses for security
 */
function withCors(response: Response, requestOrigin?: string): Response {
  const { allowedOrigins, methods, headers, maxAge } = corsConfig

  // Determine which origin to allow
  let allowOrigin = '*'
  if (!allowedOrigins.includes('*')) {
    // If request origin is in allowed list, use it
    // Otherwise, use first allowed origin as fallback
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      allowOrigin = requestOrigin
    } else {
      allowOrigin = allowedOrigins[0]
    }
    // Also set Vary header for proper caching
    response.headers.set('Vary', 'Origin')
  }

  response.headers.set('Access-Control-Allow-Origin', allowOrigin)
  response.headers.set('Access-Control-Allow-Methods', methods)
  response.headers.set('Access-Control-Allow-Headers', headers)
  response.headers.set('Access-Control-Max-Age', maxAge)

  return response
}

/**
 * Kanban board endpoint
 * GET /api/board
 * Returns: Full board state grouped by status
 */
http.route({
  path: '/api/board',
  method: 'GET',
  handler: httpActionGeneric(async (ctx) => {
    // Query tasks grouped by status
    const board = await ctx.runQuery(api.tasks.getByStatus, {})
    
    // Calculate metadata
    const allTasks = Object.values(board).flat()
    const total = allTasks.length
    const lastUpdated = Date.now()
    
    // Ensure all status columns exist with empty arrays
    const response = {
      planning: board.planning || [],
      ready: board.ready || [],
      in_progress: board.in_progress || [],
      in_review: board.in_review || [],
      done: board.done || [],
      blocked: board.blocked || [],
      meta: {
        total,
        lastUpdated,
      },
    }
    
    return withCors(
      new Response(
        JSON.stringify(response),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    )
  }),
})

/**
 * OPTIONS handler for /api/board CORS preflight
 */
http.route({
  path: '/api/board',
  method: 'OPTIONS',
  handler: httpActionGeneric(async () => {
    return withCors(
      new Response(null, {
        status: 204,
      })
    )
  }),
})

/**
 * Health check endpoint
 * GET /api/health
 * Returns: { status: "ok" }
 */
http.route({
  path: '/api/health',
  method: 'GET',
  handler: httpActionGeneric(async () => {
    return withCors(
      new Response(
        JSON.stringify({ status: 'ok' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    )
  }),
})

/**
 * OPTIONS handler for CORS preflight requests
 */
http.route({
  path: '/api/health',
  method: 'OPTIONS',
  handler: httpActionGeneric(async () => {
    return withCors(
      new Response(null, {
        status: 204,
      })
    )
  }),
})

// Export the HTTP router
export default http
