import { defineEventHandler, setResponseHeaders } from 'nitro/h3'
import { securityHeaders } from '../securityHeaders'

/**
 * Nitro server middleware that applies HTTP security headers to every response.
 *
 * Headers applied:
 *   - Content-Security-Policy: restricts resource origins to reduce XSS surface
 *   - X-Frame-Options: prevents clickjacking via iframe embedding
 *   - X-Content-Type-Options: stops MIME-type sniffing
 *   - Referrer-Policy: controls how much referrer info is sent cross-origin
 *   - Permissions-Policy: disables unused browser features
 */
export default defineEventHandler((event) => {
  setResponseHeaders(event, securityHeaders)
})
