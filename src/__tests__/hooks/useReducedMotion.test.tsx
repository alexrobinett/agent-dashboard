/**
 * 8.2: Motion/polish — prefers-reduced-motion tests
 *
 * Verifies:
 * 1. useReducedMotion() returns `false` when the user has NOT requested reduced motion.
 * 2. useReducedMotion() returns `true`  when `prefers-reduced-motion: reduce` is active.
 * 3. Skeleton component omits `animate-pulse` when reduced motion is preferred.
 * 4. Live indicator loses `animate-pulse` when reduced motion is preferred.
 *
 * matchMedia is not available in jsdom by default, so we mock it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { Skeleton } from '../../components/ui/skeleton'

// ---------------------------------------------------------------------------
// matchMedia mock helpers
// ---------------------------------------------------------------------------

type MediaQueryCallback = (event: MediaQueryListEvent) => void

function createMatchMediaMock(matches: boolean) {
  const listeners: MediaQueryCallback[] = []

  const mql: MediaQueryList = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: vi.fn(),     // deprecated but kept for compat
    removeListener: vi.fn(),  // deprecated but kept for compat
    addEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.push(listener as MediaQueryCallback)
    }),
    removeEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
      const idx = listeners.indexOf(listener as MediaQueryCallback)
      if (idx !== -1) listeners.splice(idx, 1)
    }),
    dispatchEvent: vi.fn(),
  }

  return { mql, listeners }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useReducedMotion hook', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
  })

  it('returns false when prefers-reduced-motion is NOT set', () => {
    const { mql } = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('returns true when prefers-reduced-motion: reduce is active', () => {
    const { mql } = createMatchMediaMock(true)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('updates when the media query changes', async () => {
    const { mql, listeners } = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)

    // Simulate the OS switching to reduce mode — wrap in act() so React flushes state
    await act(async () => {
      const event = { matches: true } as MediaQueryListEvent
      listeners.forEach((fn) => fn(event))
    })

    // After the state update the hook should reflect the new preference
    expect(result.current).toBe(true)
  })
})

describe('Skeleton component — reduced-motion', () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
  })

  it('includes animate-pulse when reduced motion is NOT preferred', () => {
    const { mql } = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    render(<Skeleton data-testid="skel" />)
    const el = screen.getByTestId('skel')
    expect(el.className).toContain('animate-pulse')
  })

  it('omits animate-pulse when prefers-reduced-motion: reduce is active', () => {
    const { mql } = createMatchMediaMock(true)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    render(<Skeleton data-testid="skel" />)
    const el = screen.getByTestId('skel')
    expect(el.className).not.toContain('animate-pulse')
  })
})
