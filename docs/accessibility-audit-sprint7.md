# Accessibility Audit — Sprint 7

**Date:** 2026-02-18  
**Auditor:** Sentinel (senior staff engineer, automated code audit)  
**Scope:** Full codebase — `src/components/`, `src/routes/`, UI primitives  
**Method:** Static code analysis (no runtime execution)

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 BLOCKER | 5 |
| 🟡 WARNING | 5 |
| 🟢 SUGGESTION | 3 |

The dashboard has a solid foundation of semantic HTML in many places (ARIA labels on FilterBar inputs, `aria-hidden` on decorative icons, Radix UI Dialog for modals). However, **five blockers** prevent keyboard-only and screen-reader users from completing core flows. Most critical: the slide-out nav panel leaks focus, there is no `<main>` landmark, and the "Create Task" submit button is non-functional.

---

## 🔴 BLOCKERS

### B1 — Slide-out navigation `<aside>` not hidden from AT when closed; no focus trap when open

**File:** `src/components/Header.tsx:29–52`

The `<aside>` navigation drawer uses CSS transforms (`-translate-x-full`) to visually hide itself when `isOpen=false`, but it is **never removed from the accessibility tree**. Screen readers will announce all nav links in the closed panel as if they were visible.

When `isOpen=true`, focus is not moved into the drawer and there is no focus trap — keyboard users can Tab through the drawer content without their focus being visible on screen (it goes "behind" the overlay), or they may Tab past the close button without realizing the drawer is open.

Missing:
- `aria-hidden={!isOpen}` on the `<aside>` element
- `aria-expanded={isOpen}` on the open-menu `<button>` (line 12)
- Focus management: call `closeButtonRef.current?.focus()` when drawer opens
- Focus trap when drawer is open (or use Radix Dialog/Sheet which handles this natively)

```tsx
// Header.tsx:29 — missing aria-hidden
<aside
  aria-hidden={!isOpen}   // ← MISSING
  aria-modal={isOpen}     // ← MISSING
  className={`fixed top-0 left-0 ...`}
>
```

**GitHub Issue:** #64

---

### B2 — No `<main>` landmark wrapping page content

**File:** `src/routes/__root.tsx:42–57`

The `RootDocument` shell renders `<Header />` followed by `{children}` directly inside `<body>`. There is no `<main>` element, so screen reader users cannot use landmark navigation (e.g., pressing `M` in NVDA/JAWS, or using VoiceOver's rotor) to jump to the primary content, bypassing the header.

```tsx
// __root.tsx:42 — children rendered with no <main> wrapper
<body className="dark">
  <ConvexProvider client={convexReactClient}>
    <Header />
    {children}   // ← should be wrapped in <main>
  </ConvexProvider>
  ...
</body>
```

**GitHub Issue:** #65

---

### B3 — Loading spinners have no accessible label or live region

**Files:**
- `src/routes/dashboard.tsx` (DashboardPendingComponent, ~line 329–338)
- `src/routes/login.tsx:16–22`

Both loading states render an animated `<div>` as a spinner with no `role`, `aria-label`, or `aria-live` attribute. Screen readers receive no indication that the page is loading; they may announce nothing, leaving users confused.

```tsx
// dashboard.tsx — DashboardPendingComponent
<div className="inline-block h-8 w-8 animate-spin ..."></div>
// ↑ No role="status", no aria-label="Loading", no sr-only text

// login.tsx
<div className="inline-block h-8 w-8 animate-spin ..."></div>
// ↑ Same issue
```

Fix: add `role="status"` and a visually hidden `<span className="sr-only">Loading...</span>` inside the spinner container.

**GitHub Issue:** #66

---

### B4 — "Create Task" submit button is non-functional (keyboard flow dead end)

**File:** `src/routes/dashboard.tsx:341–360` (New Task Sheet)

The `<Button className="w-full">Create Task</Button>` inside the new task Sheet has **no `onClick` handler and no parent `<form>`**. Pressing Enter or Space on this button does nothing. Keyboard-only users who navigate to the new task flow via the `n` shortcut or button click are left with a dead-end — the task is never created.

```tsx
// dashboard.tsx — Sheet content
<Button className="w-full">Create Task</Button>
// ↑ No onClick, no form onSubmit, no action — pressing Enter/Space is a no-op
```

This is both a functional bug and an accessibility blocker (keyboard-only users cannot complete the create-task flow).

**GitHub Issue:** #67

---

### B5 — `TaskDetailModal` exists but is never wired to `TaskCard`; Enter on focused card is a silent no-op

**Files:** `src/components/TaskDetailModal.tsx`, `src/components/TaskCard.tsx`, `src/routes/dashboard.tsx`

`TaskDetailModal` is implemented and exported but is not imported or used anywhere in `dashboard.tsx` or any route. `TaskCard` is a draggable `div` (with `role="button"` from `@dnd-kit`) but pressing `Enter` or `Space` while a card has focus only activates the drag behavior — it does not open task details. Keyboard users have no way to view task details at all.

Screen reader users would hear "button: Task Title — sentinel — high — agent-dashboard" and expect pressing Enter to do something meaningful. It does not.

**GitHub Issue:** #68

---

## 🟡 WARNINGS

### W1 — No skip-to-content link

**File:** `src/routes/__root.tsx` / `src/components/Header.tsx`

There is no skip-to-content (`<a href="#main-content">Skip to content</a>`) link before the header. Keyboard users must Tab through the hamburger button and all header elements on every page load/navigation before reaching the main content. Standard accessibility requirement (WCAG 2.4.1, Level A).

---

### W2 — WorkloadChart agent rows have `role="button"` but no `aria-pressed`

**File:** `src/components/WorkloadChart.tsx:42–56`

When `onAgentClick` is provided, each agent row is given `role="button"` and `tabIndex={0}` — correct. However, clicking an agent row activates a filter. There is no `aria-pressed` attribute indicating whether this agent's filter is currently active. Screen readers cannot convey filter state.

```tsx
// WorkloadChart.tsx:42 — missing aria-pressed
role: 'button',
tabIndex: 0,
onClick: () => onAgentClick(agent.name),
// ↑ No aria-pressed={filters.agent === agent.name}
```

---

### W3 — Animated elements have no `prefers-reduced-motion` handling

**Files:**
- `src/routes/dashboard.tsx` — `animate-spin` (loading), `animate-pulse` (live indicator)
- `src/routes/login.tsx` — `animate-spin` (loading)
- Tailwind config uses `tailwindcss-animate` but no `prefers-reduced-motion` overrides in `src/styles.css`

Users with vestibular disorders or motion sensitivity (WCAG 2.3.3, AAA; 2.3.1 "Three Flashes", AA) may experience discomfort. Tailwind's `motion-reduce:` variant should be used on all animated elements.

```tsx
// Recommended fix
<div className="animate-spin motion-reduce:animate-none ..." />
<span className="animate-pulse motion-reduce:animate-none ..." />
```

---

### W4 — KanbanColumn count badge lacks contextual `aria-label`

**File:** `src/components/KanbanColumn.tsx:24–28`

The task count badge is a `<span>` containing only a number (e.g., `3`). Without context, a screen reader user navigating to this element hears only "3" with no indication of which column's count it represents.

```tsx
// KanbanColumn.tsx:24 — no aria-label
<span
  data-testid={`count-badge-${status}`}
  className="text-sm text-muted-foreground ..."
>
  {tasks.length}  {/* Screen reader: "3" — no context */}
</span>
```

Fix: `<span aria-label={`${tasks.length} tasks`}>` or add `aria-hidden="true"` and expose the count via the column heading.

---

### W5 — Page `<title>` is generic ("TanStack Start Starter")

**File:** `src/routes/__root.tsx:15–17`

The document title is hardcoded as `"TanStack Start Starter"` and never changes. Screen reader users rely on the page title to orient themselves. The dashboard should have a descriptive title like `"Task Dashboard — Agent Dashboard"`. Route-level title updates are also missing.

---

## 🟢 SUGGESTIONS

### S1 — Add `aria-live` region for filter results count

**File:** `src/routes/dashboard.tsx`

After filtering, there is no announcement to screen reader users about how many tasks match. Adding a visually hidden `<div aria-live="polite" aria-atomic="true">` that announces `"Showing 12 tasks"` would greatly improve the experience.

---

### S2 — Add `aria-current="page"` on active nav links in Header

**File:** `src/components/Header.tsx:44–53`

TanStack Router's `<Link>` component supports `activeProps`. The active link already has a visual highlight (cyan background) via `activeProps.className`, but no `aria-current="page"` is set. Screen readers use `aria-current` to convey active navigation state.

```tsx
// Header.tsx:44 — add aria-current
<Link
  activeProps={{
    className: '...',
    'aria-current': 'page',  // ← add this
  }}
>
```

---

### S3 — Announce keyboard shortcut `j`/`k` navigation to screen readers

**File:** `src/hooks/useKeyboardShortcuts.ts`, `src/routes/dashboard.tsx`

The `j`/`k` shortcuts move focus between task cards via `.focus()`. Screen readers will announce the focused card, but there is no explicit `aria-live` feedback or visual focus indicator count (e.g., "Task 3 of 12"). Adding a visually hidden live region or a visible count indicator would help both AT and sighted keyboard users.

---

## Landmark Structure Assessment

| Landmark | Present | Notes |
|----------|---------|-------|
| `<html lang="en">` | ✅ | Set in `__root.tsx` |
| `<header>` | ✅ | `Header.tsx` uses `<header>` correctly |
| `<nav>` | ✅ | `<nav>` inside the aside drawer |
| `<main>` | ❌ | **Missing entirely** (see B2) |
| `<aside>` | ⚠️ | Used for nav drawer but not aria-hidden when closed (see B1) |
| `<footer>` | ❌ | Not present (acceptable for this app) |
| Skip link | ❌ | **Missing** (see W1) |

---

## Keyboard Flow Assessment

| Flow | Keyboard Accessible? | Notes |
|------|---------------------|-------|
| Open nav drawer | ✅ | `Tab` to hamburger, `Enter` opens |
| Navigate within open drawer | ⚠️ | No focus trap; focus leaks out |
| Close nav drawer via keyboard | ⚠️ | Close button focusable but focus not trapped to it |
| Focus search (`/` shortcut) | ✅ | Works via `useKeyboardShortcuts` |
| Filter by project/agent/priority | ✅ | Native `<select>` elements, fully keyboard accessible |
| Clear filters | ✅ | Button with `aria-label="Clear all filters"` |
| Navigate task cards (`j`/`k`) | ✅ | Works; cards are focusable via `@dnd-kit` |
| Open task detail | ❌ | **TaskDetailModal not wired to TaskCard** (see B5) |
| Open new task drawer (`n`) | ✅ | Sheet opens |
| Fill new task form | ✅ | Inputs are accessible (implicit label via wrapper) |
| Submit new task | ❌ | **Create Task button has no handler** (see B4) |
| Switch views (`g b` / `g w`) | ✅ | Keyboard chord shortcuts work |
| Open shortcuts help (`?`) | ✅ | Dialog opens with Radix (focus trapped) |
| Drag-and-drop reorder | ⚠️ | `@dnd-kit` provides keyboard sensor, but no live announcement of new column |

---

## ARIA Coverage Summary

| Component | Has ARIA Label | Role | Notes |
|-----------|---------------|------|-------|
| `Header` burger button | ✅ `aria-label="Open menu"` | implicit `button` | |
| `Header` close button | ✅ `aria-label="Close menu"` | implicit `button` | |
| `Header` aside | ❌ No `aria-hidden` | `aside` | **BLOCKER B1** |
| `FilterBar` search | ✅ `aria-label="Search tasks"` | `input` | |
| `FilterBar` selects | ✅ all have `aria-label` | `select` | |
| `FilterBar` clear button | ✅ `aria-label="Clear all filters"` | `button` | |
| `TaskCard` drag handle | ✅ `aria-hidden="true"` | decorative | |
| `TaskCard` card | ⚠️ implicit from text | `button` (via dnd-kit) | No explicit `aria-label` |
| `KanbanColumn` count badge | ❌ No context | `span` | W4 |
| `WorkloadChart` agent rows | ✅ `aria-label="{name}: {n} tasks"` | `button` | Missing `aria-pressed` (W2) |
| `WorkloadChart` bar segments | ✅ `aria-label="{status}: {count}"` | `div` | |
| `ActivityTimeline` container | ✅ `aria-label="Activity timeline"` | `div` | |
| `ActivityTimeline` list | ✅ `role="list"` | `ol` | |
| `TaskDetailModal` | ✅ Radix Dialog (aria-modal, labelledby, describedby) | `dialog` | Never mounted (B5) |
| Loading spinner (dashboard) | ❌ No label | `div` | **BLOCKER B3** |
| Loading spinner (login) | ❌ No label | `div` | **BLOCKER B3** |
| Live indicator dot | ❌ No label | `span` | Decorative but misleading |
| `ShortcutHint` `<kbd>` | ✅ `aria-hidden="true"` | `kbd` | Correctly hidden from AT |

---

## Issues Filed

| Issue | Title | Severity |
|-------|-------|----------|
| #64 | A11y: Slide-out nav aside leaks into AT when closed; no focus trap when open | 🔴 BLOCKER |
| #65 | A11y: Missing `<main>` landmark — screen reader users cannot navigate to main content | 🔴 BLOCKER |
| #66 | A11y: Loading spinners have no accessible label or live region | 🔴 BLOCKER |
| #67 | A11y: Create Task button has no onClick handler — keyboard-only flow is a dead end | 🔴 BLOCKER |
| #68 | A11y: TaskDetailModal never wired to TaskCard — Enter/Space on focused card is a silent no-op | 🔴 BLOCKER |

---

*Report generated by Sentinel accessibility audit, Sprint 7.*
