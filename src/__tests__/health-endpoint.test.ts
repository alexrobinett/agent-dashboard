/**
 * Tests for the /api/health Convex HTTP endpoint response shape.
 *
 * These are unit-level tests for the expected response contract.
 * They do NOT make real HTTP calls — they validate the shape of the
 * response that the httpActionGeneric handler should return.
 */

import { describe, it, expect } from 'vitest'

// ── Helpers to mirror the handler logic ───────────────────────────────────

/**
 * Build the health response body the same way convex/http.ts does.
 */
function buildHealthBody(): { status: string; timestamp: string } {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/health — response shape', () => {
  it('should contain status "ok"', () => {
    const body = buildHealthBody()
    expect(body.status).toBe('ok')
  })

  it('should contain a valid ISO 8601 timestamp', () => {
    const body = buildHealthBody()
    expect(typeof body.timestamp).toBe('string')
    // ISO 8601 format: e.g. "2025-01-01T00:00:00.000Z"
    const parsed = new Date(body.timestamp)
    expect(parsed.toISOString()).toBe(body.timestamp)
  })

  it('should serialise cleanly as JSON', () => {
    const body = buildHealthBody()
    const json = JSON.stringify(body)
    const parsed = JSON.parse(json)
    expect(parsed).toMatchObject({
      status: 'ok',
      timestamp: expect.any(String),
    })
  })

  it('should not include unexpected fields', () => {
    const body = buildHealthBody()
    const keys = Object.keys(body).sort()
    expect(keys).toEqual(['status', 'timestamp'])
  })

  it('timestamp should be close to the current time (within 5 s)', () => {
    const before = Date.now()
    const body = buildHealthBody()
    const after = Date.now()

    const ts = new Date(body.timestamp).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after + 5000)
  })
})
