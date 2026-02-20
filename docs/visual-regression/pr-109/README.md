# PR #109 — Dark-mode overlay polish evidence

This directory captures **before/after dark-mode overlay renders** for the S7.6 token changes.

## Before/After captures

- `before/dark-keyboard-shortcuts-overlay.png` → `after/dark-keyboard-shortcuts-overlay.png`
- `before/dark-new-task-sheet.png` → `after/dark-new-task-sheet.png`
- `before/dark-command-palette.png` → `after/dark-command-palette.png`

Before = pre-change checkpoint (`2e1029b`)
After = PR branch (`forge/j574dawjchhdmxwdgd830c8j8981hxm9`)

## Visual regression snapshot references (existing suite)

- `e2e/tests/visual.spec.ts-snapshots/dashboard-board-view-desktop-chromium-darwin.png`
- `e2e/tests/visual.spec.ts-snapshots/dashboard-above-fold-desktop-chromium-darwin.png`
- `e2e/tests/visual.spec.ts-snapshots/dashboard-board-desktop-1280-desktop-chromium-darwin.png`

These are included as the stable PR visual baseline references while this PR's dark-mode overlay evidence is attached above.
