# Agent Dashboard — Sprint Plan (Back on Track)

**Created:** 2026-02-16  
**Goal:** Ship a production-quality Kanban dashboard with real-time updates, proper testing, and pixel-perfect UI matching our design mocks.

---

## Current State Assessment

### ✅ What's Done (Sprints 0-2)
- TanStack Start + Convex wired up, `pnpm dev` works
- Schema aligned between agent backend and dashboard
- HTTP API: `/api/board`, `/api/tasks`, `/api/tasks/:id`, `/api/workload`, `/api/health`
- Convex queries: `getByStatus`, `listFiltered`, `getWorkload`, `getById`, `create`, `update`
- CI pipeline: ESLint, typecheck, unit tests, build (GitHub Actions)
- Basic dashboard route with live Convex subscription + SSR hydration
- Design mocks: desktop kanban, mobile list, task detail modal
- PRD, TDD plan, wireframes, interaction patterns documented

### ❌ What's Missing
- **No Playwright** — not installed, no E2E tests, no config
- **No component tests** — only smoke tests exist
- **No shadcn/ui** — using raw Tailwind, no design system
- **No Sidebar/Navigation** — just a flat page
- **No TaskCard component** — inline JSX in dashboard route
- **No TaskDetailModal** — can't view/edit tasks
- **No mobile layout** — desktop-only grid
- **No loading skeletons** — spinner only
- **No keyboard shortcuts**
- **No auth** — wide open
- **Dashboard UI is prototype-quality** — functional but far from the mocks

---

## The Plan: 6 Sprints to Production

### Sprint 3: Testing Infrastructure + Design System Foundation
**Priority: CRITICAL — everything else builds on this**

| ID | Task | Type | Details |
|----|------|------|---------|
| 3.1 | Install & configure Playwright | infra | `pnpm add -D @playwright/test`, `playwright.config.ts`, `.github/workflows/e2e.yml` |
| 3.2 | Add Playwright to CI | infra | Separate E2E workflow, runs on PR + nightly, uploads trace on failure |
| 3.3 | Install shadcn/ui + design tokens | infra | `pnpm dlx shadcn@latest init`, configure dark theme matching mock colors (#0F0F10 bg, #1A1A1D cards, #6366F1 accent) |
| 3.4 | Create shared test utilities | infra | Convex mock provider, render helpers, test fixtures matching real task schema |
| 3.5 | Write E2E smoke test | test | Navigate to `/dashboard`, verify board renders, columns visible |

**Testing approach:**
- Playwright config: `chromium` + `webkit` (Safari/iOS proxy), viewport 1440×900 + 390×844
- Use `data-testid` attributes on all interactive elements
- Fixture factory: `createMockTask({ status: 'ready', priority: 'high', ... })`
- CI: E2E runs in parallel with unit tests, both must pass

**Exit criteria:** `pnpm test:e2e` runs green, CI has separate E2E job, shadcn theme matches mock palette

---

### Sprint 4: Core UI Components (Test-First)
**Priority: HIGH — the building blocks**

Each component follows RED → GREEN → REFACTOR:
1. Write Vitest component test with Testing Library
2. Write Playwright visual/interaction test
3. Build component to pass both
4. Screenshot compare against mock

| ID | Task | Unit Test | E2E Test | Mock Reference |
|----|------|-----------|----------|----------------|
| 4.1 | **TaskCard** | Renders title, priority border, agent badge, hover state | Click opens detail | `desktop-kanban-dashboard.png` card design |
| 4.2 | **KanbanColumn** | Renders header with count, accepts task list, empty state | Column visible with tasks | `desktop-kanban-dashboard.png` columns |
| 4.3 | **KanbanBoard** | Renders all status columns, passes tasks correctly | Full board renders, columns in order | `desktop-kanban-dashboard.png` full layout |
| 4.4 | **Sidebar/Navigation** | Renders nav items, active state, collapse toggle | Navigate between routes | `desktop-kanban-dashboard.png` sidebar |
| 4.5 | **StatusBadge** | Correct color per status, pill variant + dot variant | N/A (unit only) | `mocks-spec.md` status pills |
| 4.6 | **PriorityBadge** | Correct color per priority, border + pill variants | N/A (unit only) | `mocks-spec.md` priority design |
| 4.7 | **AgentAvatar** | Renders initials, correct color per agent | N/A (unit only) | `mocks-spec.md` agent badges |
| 4.8 | **LoadingSkeleton** | Renders animated placeholders matching card structure | Board shows skeletons before data loads | N/A |
| 4.9 | **EmptyState** | Renders illustration + message per context | Empty column shows state | N/A |

**Playwright testing strategy for components:**
```typescript
// e2e/tests/kanban-board.spec.ts
test('kanban board renders all status columns', async ({ page }) => {
  await page.goto('/dashboard')
  
  // Verify all columns present
  const columns = ['Ready', 'In Progress', 'In Review', 'Done', 'Blocked']
  for (const col of columns) {
    await expect(page.getByTestId(`column-${col.toLowerCase().replace(' ', '-')}`)).toBeVisible()
  }
})

test('task card shows priority border color', async ({ page }) => {
  await page.goto('/dashboard')
  const highPriorityCard = page.getByTestId('task-card').filter({ hasText: /high priority task/i }).first()
  await expect(highPriorityCard).toHaveCSS('border-left-color', 'rgb(239, 68, 68)') // #EF4444
})

test('clicking task card opens detail modal', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByTestId('task-card').first().click()
  await expect(page.getByTestId('task-detail-modal')).toBeVisible()
})

test('sidebar navigation works', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByTestId('nav-workload').click()
  await expect(page).toHaveURL(/\/workload/)
})
```

**Exit criteria:** All components render correctly, match mock colors/spacing, pass unit + E2E tests

---

### Sprint 5: Dashboard Assembly + Real-Time
**Priority: HIGH — wire it all together**

| ID | Task | Unit Test | E2E Test |
|----|------|-----------|----------|
| 5.1 | **Refactor dashboard route** | Uses KanbanBoard component, passes Convex data | Full board renders with real data shape |
| 5.2 | **TaskDetailModal** | Shows all fields, edit mode, save/cancel | Open modal → edit title → save → verify update |
| 5.3 | **TaskFilters** | Filter by status, agent, project, priority | Apply filter → board updates → clear filter |
| 5.4 | **CreateTaskDialog** | Form validation, required fields, submit | Create task → appears in correct column |
| 5.5 | **Real-time updates** | Convex subscription fires on change | Open 2 tabs → update in one → verify other updates |
| 5.6 | **SSR → WebSocket handoff** | Initial render uses SSR data, then subscribes | Page loads fast (SSR), then goes live |
| 5.7 | **Error boundaries** | Shows error UI on API failure | Kill Convex → error state → reconnect → recovery |

**Playwright real-time test:**
```typescript
test('real-time sync between tabs', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const page1 = await ctx1.newPage()
  const page2 = await ctx2.newPage()
  
  await page1.goto('/dashboard')
  await page2.goto('/dashboard')
  
  // Create task in page1
  await page1.getByTestId('create-task-btn').click()
  await page1.getByTestId('task-title-input').fill('Real-time test task')
  await page1.getByTestId('task-submit-btn').click()
  
  // Verify it appears in page2
  await expect(page2.getByText('Real-time test task')).toBeVisible({ timeout: 5000 })
})
```

**Exit criteria:** Dashboard is fully functional with CRUD, filters, real-time, and error handling

---

### Sprint 6: Mobile + Responsive
**Priority: HIGH — PRD requires mobile-first**

| ID | Task | E2E Test |
|----|------|----------|
| 6.1 | **Mobile layout** — list view (not kanban) below 768px | `iphone-14.spec.ts`: list renders, no horizontal scroll |
| 6.2 | **Bottom navigation bar** | Tap Board/List/Health/Settings tabs |
| 6.3 | **Task detail as bottom sheet** (mobile) | Swipe up to expand, drag handle visible |
| 6.4 | **Pull-to-refresh** | Pull down → loading → fresh data |
| 6.5 | **Touch targets ≥ 44px** | Automated a11y check on all interactive elements |
| 6.6 | **Responsive filter tabs** | Horizontal scroll tabs with count badges |

**Playwright mobile testing:**
```typescript
// e2e/tests/mobile.spec.ts
import { devices } from '@playwright/test'

test.use({ ...devices['iPhone 14 Pro'] })

test('mobile shows list view not kanban', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByTestId('task-list-view')).toBeVisible()
  await expect(page.getByTestId('kanban-board')).not.toBeVisible()
})

test('bottom nav is visible and functional', async ({ page }) => {
  await page.goto('/dashboard')
  const bottomNav = page.getByTestId('bottom-nav')
  await expect(bottomNav).toBeVisible()
  await bottomNav.getByText('Health').tap()
  await expect(page).toHaveURL(/\/health/)
})

test('task detail opens as bottom sheet', async ({ page }) => {
  await page.goto('/dashboard')
  await page.getByTestId('task-card').first().tap()
  const sheet = page.getByTestId('task-detail-sheet')
  await expect(sheet).toBeVisible()
  // Verify drag handle
  await expect(sheet.getByTestId('drag-handle')).toBeVisible()
})

test('no touch target smaller than 44px', async ({ page }) => {
  await page.goto('/dashboard')
  const buttons = await page.locator('button, a, [role="button"]').all()
  for (const btn of buttons) {
    const box = await btn.boundingBox()
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  }
})
```

**Exit criteria:** Dashboard looks native on iPhone SE → iPad, all touch targets pass, bottom sheet works

---

### Sprint 7: Workload + Health Views
**Priority: NORMAL**

| ID | Task | E2E Test |
|----|------|----------|
| 7.1 | **Workload route** | Agent capacity bars render with correct data |
| 7.2 | **Agent stats cards** | Show total/active/done per agent |
| 7.3 | **Task distribution chart** | Bar/donut chart, interactive tooltips |
| 7.4 | **Health dashboard** | Blocked count, stale tasks, dispatcher status |
| 7.5 | **Blocked task alerts** | Red banner when tasks blocked >24h |

---

### Sprint 8: Auth + Polish + Deploy
**Priority: NORMAL**

| ID | Task | E2E Test |
|----|------|----------|
| 8.1 | **GitHub OAuth** (Better Auth) | Login → redirect → authorized → dashboard |
| 8.2 | **Auth guard** | Unauthenticated → redirect to login |
| 8.3 | **Keyboard shortcuts** | `n` = new task, `f` = filter, `1-5` = columns |
| 8.4 | **Animations** | Card enter/exit, modal spring, column transitions |
| 8.5 | **Micro-interactions** | Hover reveals, focus rings, press states |
| 8.6 | **Visual regression baseline** | Chromatic or Percy screenshot tests |
| 8.7 | **Lighthouse CI** | Score >90 perf, a11y, best practices |
| 8.8 | **Cloudflare Pages deploy** | Auto-deploy on main push |

---

## Testing Philosophy

### Pyramid
```
         ╱╲
        ╱ E2E ╲         5% — Critical user journeys
       ╱────────╲
      ╱ Component ╲     15% — UI behavior + integration
     ╱──────────────╲
    ╱   Unit Tests    ╲  80% — Logic, utils, hooks
   ╱────────────────────╲
```

### What to Test at Each Level

**Unit (Vitest + Testing Library)**
- Component renders correct output for given props
- Hook returns correct state
- Utility functions (priority colors, date formatting)
- Convex query/mutation args validation

**Component Integration (Vitest + Testing Library)**
- Component responds to user events (click, type, submit)
- Components compose correctly (TaskCard inside KanbanColumn)
- Loading/error/empty states render correctly
- Accessibility: proper roles, labels, focus management

**E2E (Playwright)**
- Full user journeys: load dashboard → filter → click task → edit → save
- Real-time: change in one tab appears in another
- Mobile: touch interactions, responsive layout, bottom sheet
- Cross-browser: Chromium + WebKit (Safari proxy)
- Performance: page load time, interaction responsiveness

### Playwright Best Practices
1. **Use `data-testid`** for stable selectors (not CSS classes that change)
2. **Use `page.getByRole()` and `page.getByText()`** for accessibility-first selectors
3. **Prefer `getByRole` > `getByTestId` > CSS selectors** (in that order)
4. **Never use `page.waitForTimeout()`** — use `expect().toBeVisible()` or `page.waitForSelector()`
5. **Use `test.describe.serial()`** for tests that must run in order (CRUD flows)
6. **Isolate test data** — each test creates its own tasks, cleans up after
7. **Use Page Object Model** for complex pages:
   ```typescript
   // e2e/pages/dashboard.page.ts
   export class DashboardPage {
     constructor(private page: Page) {}
     
     async goto() { await this.page.goto('/dashboard') }
     async createTask(title: string) { ... }
     async filterByAgent(agent: string) { ... }
     async getColumnCount(status: string) { ... }
     column(status: string) { return this.page.getByTestId(`column-${status}`) }
     taskCard(title: string) { return this.page.getByTestId('task-card').filter({ hasText: title }) }
   }
   ```
8. **Test on multiple viewports** in CI:
   ```typescript
   const viewports = [
     { name: 'desktop', width: 1440, height: 900 },
     { name: 'tablet', width: 768, height: 1024 },
     { name: 'mobile', width: 390, height: 844 },
   ]
   ```
9. **Trace on failure** — Playwright trace viewer for debugging CI failures
10. **Parallel execution** — tests run in parallel by default, design for independence

### File Structure
```
e2e/
├── fixtures/
│   └── tasks.ts              # createTestTask(), cleanupTasks()
├── pages/
│   ├── dashboard.page.ts     # Page Object: Kanban board
│   ├── workload.page.ts      # Page Object: Workload view
│   └── task-detail.page.ts   # Page Object: Task modal/sheet
├── tests/
│   ├── dashboard.spec.ts     # Board render, columns, real-time
│   ├── task-crud.spec.ts     # Create, read, update task
│   ├── filters.spec.ts       # Filter by status/agent/project
│   ├── mobile.spec.ts        # Mobile-specific tests
│   ├── keyboard.spec.ts      # Keyboard shortcut tests
│   └── a11y.spec.ts          # Accessibility audit
└── playwright.config.ts
```

---

## Convex Backend Alignment

The dashboard reads from the **same Convex deployment** (`curious-dolphin-134`) as the agent system.

### Shared Schema Fields (dashboard must handle all of these)
| Field | Type | Dashboard Usage |
|-------|------|-----------------|
| `status` | union of 9 values | Kanban columns + filters |
| `priority` | `low\|normal\|high\|urgent` | Card border color + filter + badge |
| `assignedAgent` | optional string | Agent avatar + filter + workload |
| `project` | optional string | Filter + grouping |
| `dependsOn` | optional array of task IDs | Show dependency chain in detail view |
| `blockedReason` | optional string | Show in blocked column + detail |
| `leaseOwner` | optional string | Show "claimed by" indicator |
| `handoffPayload` | optional object | Show handoff context in detail |
| `notes` | optional string | Detail view, markdown rendered |
| `result` | optional string | Done tasks show result |
| `tags` | optional array | Pill badges in card + filter |
| `parentTask` | optional task ID | Subtask indicator |

### API Contracts (existing, tested)
- `GET /api/board` → `{ planning: [], ready: [], in_progress: [], ... , meta: { total, lastUpdated } }`
- `GET /api/tasks?status=X&priority=Y&project=Z&assignedAgent=A&limit=N&offset=M` → `{ tasks: [], total, limit, offset, hasMore }`
- `GET /api/tasks/:id` → single task object
- `POST /api/tasks` → `{ id }` (requires title, priority, project)
- `PATCH /api/tasks/:id` → `{ success: true }`
- `GET /api/workload` → `{ agent: { total, byStatus, byPriority } }`

### Legacy Status Handling
Dashboard must handle `pending` and `active` (legacy) — map to `planning` and `in_progress` in the UI.

---

## Sprint Dispatch Plan

| Sprint | Assignee | Model | Est Duration |
|--------|----------|-------|--------------|
| 3 (Testing Infra) | Forge | Sonnet | 1-2 days |
| 4 (Components) | Forge | Sonnet | 2-3 days |
| 5 (Assembly) | Forge | Sonnet → Opus for real-time | 2-3 days |
| 6 (Mobile) | Forge | Sonnet | 2 days |
| 7 (Workload) | Forge | Sonnet | 2 days |
| 8 (Auth+Polish) | Forge + Sentinel review | Sonnet/Opus | 3 days |

**Total: ~2-3 weeks with agent dispatching**

All PRs go through Sentinel code review before merge.
