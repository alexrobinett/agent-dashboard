import { httpRouter, httpActionGeneric } from 'convex/server'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { sendApnsPush } from './apns'

/**
 * Constant-time string comparison to prevent timing attacks on Bearer token checks.
 * Convex functions run in a V8-isolate sandbox without Node.js crypto/Buffer,
 * so we implement a manual XOR-based loop.
 * [security] Fix: replaces naive `===` comparison (timing-safe, j57c04qmxggwc6zvvnd5f4yz1s81c0jm)
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const la = a.length
  const lb = b.length
  // XOR of lengths: non-zero when they differ (constant-time length check)
  let result = la ^ lb
  const maxLen = Math.max(la, lb)
  for (let i = 0; i < maxLen; i++) {
    // charCodeAt returns NaN out-of-bounds; `| 0` coerces NaN → 0 safely
    result |= ((a.charCodeAt(i) | 0) ^ (b.charCodeAt(i) | 0))
  }
  return result === 0
}

const http = httpRouter()

/**
 * Require authentication via Authorization Bearer token.
 * Validates the Bearer token against the CONVEX_API_SECRET_KEY env variable.
 * Returns 401 JSON response if not authenticated, or null if valid.
 */
async function requireAuth(
  _ctx: unknown,
  request: Request
): Promise<Response | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return withCors(
      new Response(
        JSON.stringify({ error: 'Unauthorized: missing or invalid token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
      request.headers.get('Origin') || undefined
    )
  }

  const token = authHeader.slice(7)
  const apiKey = process.env.CONVEX_API_SECRET_KEY

  // If no API key is configured, deny all requests (fail-closed for safety)
  if (!apiKey) {
    return withCors(
      new Response(
        JSON.stringify({ error: 'Unauthorized: server not configured' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
      request.headers.get('Origin') || undefined
    )
  }

  // [security] Use constant-time comparison to prevent timing attacks (j57c04qmxggwc6zvvnd5f4yz1s81c0jm)
  if (!timingSafeStringEqual(token, apiKey)) {
    return withCors(
      new Response(
        JSON.stringify({ error: 'Unauthorized: invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
      request.headers.get('Origin') || undefined
    )
  }

  return null // Authenticated
}

/**
 * Get allowed CORS origins from environment.
 * Supports comma-separated list of origins via ALLOWED_ORIGINS env var.
 * [security] Fail-closed: returns empty list (deny all) when ALLOWED_ORIGINS is unset (j574s0sjsbveed9cdw11pz3ywn81deef).
 * Set ALLOWED_ORIGINS=* explicitly in dev/staging to allow all origins.
 */
function getAllowedOrigins(): string[] {
  const origins = process.env.ALLOWED_ORIGINS
  if (origins) {
    return origins.split(',').map((o) => o.trim())
  }
  // Fail-closed: no ALLOWED_ORIGINS configured → deny all cross-origin requests.
  // This prevents accidental CORS exposure in misconfigured deployments.
  return []
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
 * Helper to add CORS headers to response.
 * [security] Fail-closed: CORS headers are only set when the requesting origin
 * is explicitly present in allowedOrigins. If allowedOrigins is empty (ALLOWED_ORIGINS
 * unset) or the origin is not in the list, no Access-Control-Allow-Origin header is
 * added — browsers will block the cross-origin request (j574s0sjsbveed9cdw11pz3ywn81deef).
 */
function withCors(response: Response, requestOrigin?: string): Response {
  const { allowedOrigins, methods, headers, maxAge } = corsConfig

  // Wildcard shortcut: only if explicitly configured in ALLOWED_ORIGINS
  if (allowedOrigins.includes('*')) {
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', methods)
    response.headers.set('Access-Control-Allow-Headers', headers)
    response.headers.set('Access-Control-Max-Age', maxAge)
    return response
  }

  // Origin-specific: only set header if the requesting origin is in the allow-list.
  // An absent Access-Control-Allow-Origin header causes browsers to block CORS requests.
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    response.headers.set('Access-Control-Allow-Origin', requestOrigin)
    response.headers.set('Access-Control-Allow-Methods', methods)
    response.headers.set('Access-Control-Allow-Headers', headers)
    response.headers.set('Access-Control-Max-Age', maxAge)
    // Vary tells CDNs/caches the response differs per origin
    response.headers.set('Vary', 'Origin')
  }
  // else: no CORS headers — cross-origin request denied (fail-closed)

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
  handler: httpActionGeneric(async (ctx, request) => {
    const authError = await requireAuth(ctx, request)
    if (authError) return authError

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
    const authError = await requireAuth(ctx, request)
    if (authError) return authError

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
  handler: httpActionGeneric(async (ctx, request) => {
    const authError = await requireAuth(ctx, request)
    if (authError) return authError

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
 * Returns: { status: "ok", timestamp: "<ISO string>" }
 * Note: intentionally public — no auth required
 */
http.route({
  path: '/api/health',
  method: 'GET',
  handler: httpActionGeneric(async () => {
    return withCors(
      new Response(
        JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
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
    const authError = await requireAuth(ctx, request)
    if (authError) return authError

    // Extract task ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const taskId = pathParts[pathParts.length - 1]
    
    try {
      // Query single task
      const task = await ctx.runQuery(api.tasks.getById, {
        id: taskId as Id<"tasks">,
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
    const authError = await requireAuth(ctx, request)
    if (authError) return authError

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
      const result = await ctx.runMutation(internal.tasks.create, {
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
    const authError = await requireAuth(ctx, request)
    if (authError) return authError

    // Extract task ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const taskId = pathParts[pathParts.length - 1]
    
    try {
      // Parse request body
      const body = await request.json()
      
      // Update task
      const result = await ctx.runMutation(internal.tasks.update, {
        id: taskId as Id<"tasks">,
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
