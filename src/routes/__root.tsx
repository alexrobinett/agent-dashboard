import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { ConvexProvider } from 'convex/react'
import { Toaster } from 'sonner'

import Header from '../components/Header'
import { NetworkStatusBanner } from '../components/NetworkStatusBanner'
import { ThemeProvider, useTheme } from '../components/ThemeProvider'
import { convexReactClient } from '../lib/convex'
import { getThemeInitScript } from '../lib/theme'

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <ConvexProvider client={convexReactClient}>
            <NetworkStatusBanner />
            <Header />
            <main id="main-content" role="main" aria-label="Main content">
              {children}
            </main>
          </ConvexProvider>
          <ThemedToaster />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme()

  return <Toaster theme={resolvedTheme} position="bottom-right" richColors />
}
