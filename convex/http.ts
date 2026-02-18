import { httpRouter, httpActionGeneric } from 'convex/server'
import { api } from './_generated/api'
import { sendApnsPush } from './apns'

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
 * Tasks list endpoint with filtering and pagination
 * GET /api/tasks
 * Query params: status, priority, project, assignedAgent, limit, offset
 * Returns: Filtered task list with pagination metadata
 */
http.route({
  path: '/api/tasks',
  method: 'GET',
  handler: httpActionGeneric(async (ctx, request) => {
    // Parse query parameters from URL
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || undefined
    const priority = url.searchParams.get('priority') || undefined
    const project = url.searchParams.get('project') || undefined
    const assignedAgent = url.searchParams.get('assignedAgent') || undefined
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined
    const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!, 10) : undefined
    
    // Query filtered tasks
    const result = await ctx.runQuery(api.tasks.listFiltered, {
      status,
      priority,
      project,
      assignedAgent,
      limit,
      offset,
    })
    
    return withCors(
      new Response(
        JSON.stringify(result),
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
 * OPTIONS handler for /api/tasks CORS preflight
 */
http.route({
  path: '/api/tasks',
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
 * Agent workload endpoint
 * GET /api/workload
 * Returns: Agent workload statistics
 */
http.route({
  path: '/api/workload',
  method: 'GET',
  handler: httpActionGeneric(async (ctx) => {
    // Query workload aggregation
    const workload = await ctx.runQuery(api.tasks.getWorkload, {})
    
    return withCors(
      new Response(
        JSON.stringify(workload),
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
 * OPTIONS handler for /api/workload CORS preflight
 */
http.route({
  path: '/api/workload',
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

/**
 * Get single task by ID
 * GET /api/tasks/:id
 * Returns: Single task object
 */
http.route({
  pathPrefix: '/api/tasks/',
  method: 'GET',
  handler: httpActionGeneric(async (ctx, request) => {
    // Extract task ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const taskId = pathParts[pathParts.length - 1]
    
    try {
      // Query single task
      const task = await ctx.runQuery(api.tasks.getById, {
        id: taskId as any,
      })
      
      if (!task) {
        return withCors(
          new Response(
            JSON.stringify({ error: 'Task not found' }),
            {
              status: 404,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          )
        )
      }
      
      return withCors(
        new Response(
          JSON.stringify(task),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      )
    } catch {
      return withCors(
        new Response(
          JSON.stringify({ error: 'Invalid task ID' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      )
    }
  }),
})

/**
 * Create new task
 * POST /api/tasks
 * Body: { title, priority, project, notes?, assignedAgent?, createdBy?, status? }
 * Returns: { id }
 */
http.route({
  path: '/api/tasks',
  method: 'POST',
  handler: httpActionGeneric(async (ctx, request) => {
    try {
      // Parse request body
      const body = await request.json()
      
      // Validate required fields
      if (!body.title || typeof body.title !== 'string') {
        return withCors(
          new Response(
            JSON.stringify({ error: 'Missing or invalid required field: title' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          )
        )
      }
      
      if (!body.priority || typeof body.priority !== 'string') {
        return withCors(
          new Response(
            JSON.stringify({ error: 'Missing or invalid required field: priority' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          )
        )
      }
      
      if (!body.project || typeof body.project !== 'string') {
        return withCors(
          new Response(
            JSON.stringify({ error: 'Missing or invalid required field: project' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          )
        )
      }
      
      // Create task
      const result = await ctx.runMutation(api.tasks.create, {
        title: body.title,
        priority: body.priority,
        project: body.project,
        notes: body.notes,
        assignedAgent: body.assignedAgent,
        createdBy: body.createdBy,
        status: body.status,
      })
      
      return withCors(
        new Response(
          JSON.stringify(result),
          {
            status: 201,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return withCors(
        new Response(
          JSON.stringify({ error: errorMessage }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      )
    }
  }),
})

/**
 * Update task
 * PATCH /api/tasks/:id
 * Body: { status?, priority?, assignedAgent?, notes? }
 * Returns: { success: true }
 */
http.route({
  pathPrefix: '/api/tasks/',
  method: 'PATCH',
  handler: httpActionGeneric(async (ctx, request) => {
    // Extract task ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const taskId = pathParts[pathParts.length - 1]
    
    try {
      // Parse request body
      const body = await request.json()
      
      // Update task
      const result = await ctx.runMutation(api.tasks.update, {
        id: taskId as any,
        status: body.status,
        priority: body.priority,
        assignedAgent: body.assignedAgent,
        notes: body.notes,
      })
      
      return withCors(
        new Response(
          JSON.stringify(result),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const status = errorMessage.includes('not found') ? 404 : 400
      return withCors(
        new Response(
          JSON.stringify({ error: errorMessage }),
          {
            status,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      )
    }
  }),
})

/**
 * OPTIONS handler for /api/tasks/:id CORS preflight
 */
http.route({
  pathPrefix: '/api/tasks/',
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
 * APNS push endpoint
 * POST /api/push/send
 * Body: { deviceToken, title, body, data? }
 */
http.route({
  path: '/api/push/send',
  method: 'POST',
  handler: sendApnsPush,
})

// Export the HTTP router
export default http
