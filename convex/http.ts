import { httpRouter, httpActionGeneric } from 'convex/server'

const http = httpRouter()

/**
 * CORS configuration for web dashboard
 * Allows requests from the dashboard origin
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // TODO: Restrict to dashboard domain in production
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

/**
 * Helper to add CORS headers to response
 */
function withCors(response: Response): Response {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

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
