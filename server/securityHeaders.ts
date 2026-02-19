function getConvexWssSource(convexUrl?: string) {
  if (!convexUrl) return 'wss://*.convex.cloud'
  try {
    const hostname = new URL(convexUrl).hostname
    return hostname ? `wss://${hostname}` : 'wss://*.convex.cloud'
  } catch {
    return 'wss://*.convex.cloud'
  }
}

export function buildSecurityHeaders(convexUrl?: string) {
  const convexWssSource = getConvexWssSource(convexUrl)
  return {
    'Content-Security-Policy':
      `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: ${convexWssSource}; frame-ancestors 'none'`,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  } as const
}

export const securityHeaders = buildSecurityHeaders(process.env.VITE_CONVEX_URL)
