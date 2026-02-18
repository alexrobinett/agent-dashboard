import { betterAuth } from 'better-auth'
import Database from 'better-sqlite3'
import { resolve } from 'node:path'

if (process.env.NODE_ENV === 'production') {
  if (!process.env.GITHUB_CLIENT_ID) throw new Error('Missing GITHUB_CLIENT_ID')
  if (!process.env.GITHUB_CLIENT_SECRET) throw new Error('Missing GITHUB_CLIENT_SECRET')
  if (!process.env.BETTER_AUTH_DB_URL)
    throw new Error(
      'Missing required environment variable in production: BETTER_AUTH_DB_URL. ' +
        'Refusing to fall back to a CWD-relative SQLite file.',
    )
  // [security] BETTER_AUTH_SECRET must be set to a strong value in production.
  // A missing or weak secret allows session token forgery.
  if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error(
      'BETTER_AUTH_SECRET must be set (>=32 chars) in production. ' +
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
  // [security] Ensure the Secure cookie flag is set in production so session
  // cookies are only transmitted over HTTPS.
  // Note: Better Auth v1.4.18 reads this from options.advanced.useSecureCookies;
  // top-level placement is silently ignored at runtime.
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
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
