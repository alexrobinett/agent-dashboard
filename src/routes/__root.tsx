import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { ConvexProvider } from 'convex/react'
import { Toaster } from 'sonner'

import Header from '../components/Header'
import { NetworkStatusBanner } from '../components/NetworkStatusBanner'
import { convexReactClient } from '../lib/convex'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Agent Dashboard',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="dark">
        <ConvexProvider client={convexReactClient}>
          <NetworkStatusBanner />
          <Header />
          {children}
        </ConvexProvider>
        <Toaster theme="dark" position="bottom-right" richColors />
        <Scripts />
      </body>
    </html>
  )
}
