// Type augmentation for TanStack Router during CI when routeTree is stubbed
// This allows createFileRoute to accept string paths without full codegen

import '@tanstack/react-router'

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
    }
  }
}
