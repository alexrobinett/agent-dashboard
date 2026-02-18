/**
 * Playwright Quarantine Mechanism
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose:
 *   Mark known-flaky tests so they:
 *   1. Continue to run (we don't skip them — we need to know when they stabilize)
 *   2. Are excluded from the >2% flake-budget check in scripts/flake-report.sh
 *   3. Are tagged with [quarantine] so CI can report them separately
 *
 * Usage in a test file:
 *   import { quarantine } from '../../playwright/quarantine'
 *
 *   quarantine('FLAKE-42', 'should load dashboard without errors', ({ page }) => {
 *     // test body ...
 *   })
 *
 * How it works:
 *   - quarantine() wraps test() with a [quarantine] annotation tag.
 *   - flake-report.sh skips test names containing "[quarantine]" when computing
 *     the flake rate, so they don't trip the 2% budget.
 *   - Quarantined tests still execute; their retry counts appear in the XML
 *     report with the tag so humans can track stabilization progress.
 *
 * Policy:
 *   - Every quarantine entry MUST include a ticket ID and a short reason.
 *   - Review the quarantine list at the start of each sprint.
 *   - A test that passes cleanly for 5 consecutive nightly runs should be
 *     un-quarantined (remove the wrapper, use plain test()).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { test, type TestInfo } from '@playwright/test'
import type {
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
} from '@playwright/test'

/** Explicit fixture type for Playwright test functions (avoids Parameters<> hack that resolves to never) */
type PlaywrightTestFixtures = PlaywrightTestArgs &
  PlaywrightTestOptions &
  PlaywrightWorkerArgs &
  PlaywrightWorkerOptions

/** Shape of a quarantine registry entry */
export interface QuarantineEntry {
  /** Ticket / issue ID tracking the root cause */
  ticketId: string
  /** Human-readable reason this test is flaky */
  reason: string
  /** ISO date when the test was quarantined */
  quarantinedOn: string
  /** Optional: ISO date by which this must be resolved (sprint deadline) */
  reviewBy?: string
}

/**
 * Known-flaky test registry.
 *
 * Key:   A unique identifier for the test (e.g. "suite > test title").
 * Value: Metadata explaining why it is quarantined.
 *
 * Populate this as you discover persistently flaky tests.
 */
export const QUARANTINE_REGISTRY: Record<string, QuarantineEntry> = {
  // Example entry (uncomment and fill in when real flaky tests are found):
  //
  // 'Dashboard Smoke Test > should load dashboard without errors': {
  //   ticketId: 'FLAKE-001',
  //   reason: 'Intermittent Convex WebSocket timeout in CI; tracking in issue #99',
  //   quarantinedOn: '2026-02-18',
  //   reviewBy: '2026-03-01',
  // },
}

/**
 * Wrap a known-flaky test in the quarantine mechanism.
 *
 * @param ticketId  Tracking ticket for the flake (e.g. "FLAKE-42")
 * @param title     Test title — must match the key in QUARANTINE_REGISTRY if
 *                  the test is registered there, but registration is optional.
 * @param fn        The test body (same signature as `test(title, fn)`)
 */
export function quarantine(
  ticketId: string,
  title: string,
  fn: (fixtures: PlaywrightTestFixtures, testInfo: TestInfo) => Promise<void> | void,
): void {
  const taggedTitle = `${title} [quarantine:${ticketId}]`

  test(taggedTitle, async (fixtures, testInfo) => {
    // Annotate in the report for visibility
    await testInfo.attach('quarantine-info', {
      contentType: 'text/plain',
      body: Buffer.from(
        `Quarantined test\nTicket: ${ticketId}\nTitle:  ${title}\n` +
          (QUARANTINE_REGISTRY[title]
            ? `Reason: ${QUARANTINE_REGISTRY[title].reason}\n` +
              `Since:  ${QUARANTINE_REGISTRY[title].quarantinedOn}\n`
            : ''),
      ),
    })

    await fn(fixtures, testInfo)
  })
}

/**
 * Check whether a test title is currently quarantined.
 * Useful in custom fixtures or reporters.
 */
export function isQuarantined(title: string): boolean {
  return (
    title in QUARANTINE_REGISTRY ||
    title.includes('[quarantine:')
  )
}

/**
 * Return all currently quarantined test titles.
 */
export function listQuarantined(): string[] {
  return Object.keys(QUARANTINE_REGISTRY)
}
