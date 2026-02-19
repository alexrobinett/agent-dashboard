import { betterAuth } from 'better-auth'
import Database from 'better-sqlite3'
import { resolve } from 'node:path'

/** Canonical string for the production NODE_ENV value. */
const PRODUCTION_ENV = 'production'

if (process.env.NODE_ENV === PRODUCTION_ENV) {
  if (!process.env.GITHUB_CLIENT_ID) throw new Error('Missing GITHUB_CLIENT_ID')
  if (!process.env.GITHUB_CLIENT_SECRET) throw new Error('Missing GITHUB_CLIENT_SECRET')
  if (!process.env.BETTER_AUTH_DB_URL)
    throw new Error(
      `Missing required environment variable in ${PRODUCTION_ENV}: BETTER_AUTH_DB_URL. ` +
        'Refusing to fall back to a CWD-relative SQLite file.',
    )
  // [security] BETTER_AUTH_SECRET must be set to a strong value in production.
  // A missing or weak secret allows session token forgery.
  if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error(
      `BETTER_AUTH_SECRET must be set (>=32 chars) in ${PRODUCTION_ENV}. ` +
        'Generate one with: openssl rand -base64 32',
    )
  }
}

/**
 * Whether GitHub OAuth is configured via environment variables.
 * When false, the GitHub social provider is omitted from Better Auth
 * entirely (preventing the "missing clientId or clientSecret" warning),
 * and the login UI hides the GitHub button instead of showing a broken one.
 */
export const githubOAuthEnabled =
  Boolean(process.env.GITHUB_CLIENT_ID) && Boolean(process.env.GITHUB_CLIENT_SECRET)

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.PUBLIC_APP_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  advanced: {
    // [security] Only transmit session cookies over HTTPS in production.
    // Note: Better Auth v1.4.18 reads this from options.advanced.useSecureCookies;
    // top-level placement is silently ignored at runtime.
    useSecureCookies: process.env.NODE_ENV === PRODUCTION_ENV,
    // [security] Explicit cookie hardening applied to all Better Auth cookies:
    //   httpOnly — prevents JavaScript access, mitigating XSS-based session theft.
    //   sameSite — 'lax' blocks cross-site POST requests (CSRF) while allowing
    //              top-level navigations (e.g. OAuth redirects).
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax' as const,
    },
  },
  ...(githubOAuthEnabled
    ? {
        socialProviders: {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          },
        },
      }
    : {}),
  database: new Database(
    process.env.BETTER_AUTH_DB_URL ?? resolve(process.cwd(), 'better-auth.db'),
  ),
})
