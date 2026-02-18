import { betterAuth } from 'better-auth'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.PUBLIC_APP_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  database: {
    type: 'sqlite',
    url: './better-auth.db',
  },
})
