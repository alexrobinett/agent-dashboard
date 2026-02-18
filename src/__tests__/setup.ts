import '@testing-library/jest-dom'

// jsdom does not implement window.matchMedia — provide a minimal stub so that
// useReducedMotion (and any other hook that calls window.matchMedia) works in tests.
// Individual tests that need to control the return value can override this mock.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
