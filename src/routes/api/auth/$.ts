import { createFileRoute } from '@tanstack/react-router'
import { auth } from '../../../lib/auth.server'

/**
 * Catch-all route handler for Better Auth at /api/auth/*
 * Delegates all GET and POST requests to the Better Auth handler.
 */
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => auth.handler(request),
      POST: ({ request }: { request: Request }) => auth.handler(request),
    },
  },
})
