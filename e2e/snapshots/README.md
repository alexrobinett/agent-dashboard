# Playwright Visual Regression Snapshots

Baseline screenshots are stored in sub-directories by platform/OS.
Run `pnpm test:visual:update` to regenerate baselines.

## Responsive visual matrix thresholds (Task 7.2b)

The responsive matrix snapshots in `e2e/tests/visual.spec.ts` use these `maxDiffPixels` limits:

- Mobile (`375px` width): `120`
- Tablet (`768px` width): `180`
- Desktop (`1280px` width): `240`

Dynamic regions are masked to keep snapshots stable:

- `data-testid="live-indicator"` (animated live pulse)
- `data-testid^="count-badge-"` (live counts)
- `data-testid^="activity-timestamp-"` (localized timestamps)
- Avatar-like selectors (`[data-testid*="avatar"]`, `[aria-label*="avatar" i]`, `[class*="avatar" i]`)
