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
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.PUBLIC_APP_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  database: new Database(
    process.env.BETTER_AUTH_DB_URL ?? resolve(process.cwd(), 'better-auth.db'),
  ),
})
