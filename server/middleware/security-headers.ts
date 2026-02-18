import { defineEventHandler, setResponseHeaders } from 'nitro/h3'

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
  setResponseHeaders(event, {
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  })
})
