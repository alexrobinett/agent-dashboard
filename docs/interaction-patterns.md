# Task Board Dashboard - Interaction Patterns

How users interact with the dashboard on web vs mobile platforms.

---

## Web (Desktop) Interaction Patterns

### Navigation

| Pattern | Implementation | Behavior |
|---------|----------------|----------|
| **Sidebar Navigation** | Fixed 240px left panel | Collapsible on tablet (< 1024px), slide-in overlay |
| **Header** | Sticky 56px top bar | Contains search, notifications, profile always visible |
| **Breadcrumbs** | Under header, sticky | Context-aware navigation for nested views |

### Kanban Board Interactions

| Action | Desktop Pattern | Details |
|--------|-----------------|---------|
| **Drag & Drop** | Native HTML5 DnD | Mouse-based, visual ghost element, drop zone highlighting |
| **Multi-select** | Cmd/Ctrl + click, Shift + click | Selected cards get accent border + subtle background |
| **Card Move** | Drag to column OR keyboard shortcuts | Arrow keys + modifier for keyboard-only navigation |
| **Quick Edit** | Hover reveals pencil icon OR double-click | Inline editing for title/priority on hover |
| **Column Scroll** | Shift + scroll wheel OR trackpad horizontal | Smooth horizontal pan across columns |

### Task Card Interactions

| Action | Trigger | Behavior |
|--------|---------|----------|
| **Open Detail** | Click card | Modal opens with full context |
| **Quick Preview** | Hover + Space | Popover peek without full open |
| **Context Menu** | Right-click | Menu: Move, Duplicate, Delete, Copy ID |
| **Priority Change** | Click priority dot | Cycle: High → Normal → Low |
| **Status Change** | Click status OR drag to column | Smooth animation to target column |

### Modal Interactions

| Pattern | Implementation |
|---------|----------------|
| **Open** | Click card or "New Task" button |
| **Close** | Click backdrop, X button, or Escape key |
| **Save** | Cmd/Ctrl + S or explicit Save button |
| **Discard** | Close with unsaved changes → confirm dialog |
| **Resize** | Modal supports optional maximize for long content |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + B` | Toggle board/list view |
| `Cmd/Ctrl + F` | Focus search bar |
| `Cmd/Ctrl + N` | Create new task |
| `Cmd/Ctrl + Enter` | Save current form |
| `Escape` | Close modal/clear selection |
| `X` | Select/deselect card under cursor |
| `Shift + X` | Add/remove from selection |
| `S` | Quick status change menu |
| `P` | Quick priority change menu |
| `J/K` | Navigate up/down (Vim-style) |
| `H/L` | Navigate left/right columns |
| `?` | Show keyboard shortcut help |

### Drag & Drop States

```
Card States:
  - Default: Subtle shadow (elevation-1)
  - Hover: Lifted shadow (elevation-2), cursor: grab
  - Drag Start: Reduce opacity to 70%, scale(1.02)
  - Dragging (Ghost): Full opacity, rotated 2deg, follows cursor
  - Drop Target Column: Background tint (accent-subtle)
  - Invalid Drop: Shake animation, red border flash
  - Dropped: Snap animation to new position
```

---

## Mobile (iOS) Interaction Patterns

### Navigation

| Pattern | Implementation | Notes |
|---------|----------------|-------|
| **Bottom Tab Bar** | Fixed 56px at bottom | 4 tabs: Board, List, Health, User |
| **Top Navigation** | Sticky title bar | Back button, title, optional actions |
| **Swipe Navigation** | Swipe left/right between main tabs | Follows iOS navigation conventions |
| **Pull to Refresh** | Standard iOS gesture | On list views and health dashboard |

### Touch-Specific Patterns

| Action | Pattern | Implementation |
|--------|---------|----------------|
| **Task Card Tap** | Single tap | Opens bottom sheet (not modal) |
| **Task Card Long Press** | Long press (300ms) | Trigger reorder or context menu |
| **Task Card Swipe Left** | Swipe left | Reveal actions: Delete (red), Archive |
| **Task Card Swipe Right** | Swipe right | Reveal actions: Quick status change |
| **Column Swipe** | Horizontal scroll | Snap to column boundaries |
| **List Scroll** | Vertical infinite scroll | Group headers sticky on scroll |
| **Pull Down to Dismiss** | Sheet only | Swipe down to close bottom sheet |

### Bottom Sheet Interactions

```
Sheet States:
  ┌─────────────────────────┐
  │        ═══ (drag)       │ ← Collapsed height: 50% (peek)
  │    Preview content      │
  └─────────────────────────┘

  ┌─────────────────────────┐
  │        ═══ (drag)       │ ← Full height: 90% (expanded)
  │                         │
  │                         │
  │    Full content         │
  │                         │
  │                         │
  └─────────────────────────┘
```

| Action | Gesture | Behavior |
|--------|---------|----------|
| **Expand** | Tap collapsed sheet OR drag up | Animate to full height |
| **Collapse** | Drag down OR tap handle | Collapse to peek height |
| **Dismiss** | Swipe down past threshold (velocity > threshold) | Close sheet with dismiss animation |
| **Scroll Content** | Touch content area | Scroll within sheet (nested scroll) |
| **Edge Dismiss** | Tap backdrop (if visible) | Close sheet |

### Status Change (Mobile)

```
Tap status badge → Action Sheet:

┌─────────────────────────┐
│  Change Status          │
├─────────────────────────┤
│  ⚪ Ready                │
│  🔵 In Progress    ✓    │ ← Current
│  🟣 In Review            │
│  ✅ Done                 │
│  🔴 Blocked              │
├─────────────────────────┤
│  Cancel                 │
└─────────────────────────┘
```

### Quick Actions (Mobile)

| Pattern | Implementation | Trigger |
|---------|----------------|---------|
| **Floating Action Button (FAB)** | Circular + button, bottom right | Always visible in list view |
| **Action Menu** | Expand from FAB | Tap FAB |
| **Contextual Actions** | Bottom toolbar | Multi-select mode |
| **Haptic Feedback** | Light tap on interactions | Status change, task completion |

### Mobile-Optimized Drag & Drop

Since native drag-and-drop is difficult on touch devices, use:

**Alternative: Press-Hold-Reorder**
```
1. Long press card (300ms) → Card lifts with haptic feedback
2. Card remains "held" (slightly larger, shadow increased)
3. Drag to new position (other cards animate to make space)
4. Release → Card snaps to new position with bounce
5. Confirm change with brief success haptic
```

**Alternative: Edit Menu Reorder**
```
1. Tap "Edit" button → Enter edit mode
2. Drag handles appear on right side of cards
3. User drags handle to reorder
4. Tap "Done" to exit edit mode
```

### Swipe Actions Reference

```
Left Swipe (Task Card):
  ┌─────────────────────────────────────────┐
  │ Card Content │ [Archive] [Delete 🔴]  │ ← 15% + 25% width
  └─────────────────────────────────────────┘

Right Swipe (Task Card):
  ┌─────────────────────────────────────────┐
  │ [▶ Next] [Done ✓] │ Card Content      │ ← 25% + 15% width
  └─────────────────────────────────────────┘
```

---

## Progressive Disclosure Patterns

### Desktop

| Context | Collapsed | Expanded |
|---------|-----------|----------|
| **Card** | Title + Metadata | Full modal with description |
| **Column** | 5 cards, "N more" | Full scroll, cards stay visible |
| **Sidebar** | Icons only (56px) | Full text + icons (240px) |
| **Swimlanes** | Collapsed header | Expanded with all cards |
| **Filters** | Summary pill | Full filter panel |

### Mobile

| Context | Collapsed | Expanded |
|---------|-----------|----------|
| **Card** | Title row only | Bottom sheet with full details |
| **Task List** | Group headers only | Expand/collapse groups |
| **Health Stats** | Key numbers | Full stats + detailed list |
| **Description** | 2 lines + "More" | Full text with scroll |
| **Checklist** | X of Y completed | Expand to show all items |

---

## Form Interactions

### Desktop Forms

| Element | Interaction |
|---------|-------------|
| **Input Fields** | Tab navigation, focus rings |
| **Select/Dropdown** | Click to open, arrow keys navigate |
| **Tags/Assignments** | Typeahead search, multi-select |
| **Dates** | Date picker popup |
| **Markdown** | Live preview side-by-side (optional) |
| **Form Validation** | Real-time with inline errors |

### Mobile Forms

| Element | Interaction |
|---------|-------------|
| **Input Fields** | Auto-focus next on Return, dismiss keyboard on scroll |
| **Select** | Native iOS action sheet or picker wheel |
| **Tags** | Typeahead + chips, "X" to remove |
| **Dates** | Native iOS date picker |
| **Markdown** | Simple formatting toolbar |
| **Save** | Floating save button OR keyboard accessory bar |

---

## Error & Loading States

### Loading States

| Context | Desktop | Mobile |
|---------|---------|--------|
| **Initial Load** | Skeleton screens matching layout | Skeleton cards in list |
| **Column Refresh** | Spinner in header | Pull to refresh spinner |
| **Task Move** | Optimistic update with rollback | Haptic feedback on success |
| **Form Submit** | Button loading state | Overlay spinner |

### Error States

| Error Type | Desktop | Mobile |
|------------|---------|--------|
| **Network Error** | Toast notification, retry button | Inline error, pull to retry |
| **Block Task** | Red border + warning icon, tooltip | Red accent + alert banner |
| **Validation Error** | Inline field errors, scroll to first | Field shake + error message |
| **Generic Error** | Error boundary with retry | Full-screen error with retry |

---

## Accessibility

### Keyboard Navigation

- All interactive elements focusable
- Visible focus indicators (2px accent ring)
- Logical tab order
- Skip links for main content
- Arrow key navigation in lists/grids

### Screen Readers

- ARIA labels for icon buttons
- Live regions for status updates
- Task cards: "Task {title}, {status}, assigned to {user}, {priority} priority"
- Modal announcements when opened

### Touch Targets

- Minimum 44×44px on mobile (iOS HIG)
- Adequate spacing between touch targets (8px minimum)
- No precision-required gestures

### Motion

- Respect `prefers-reduced-motion`
- Essential animations only on low-motion mode
- No parallax or heavy effects

---

## Reference: Monday.com Patterns

Based on analysis of Monday.com's UX, here are patterns worth adapting:

### What Makes Monday.com "Lightweight but Powerful"

**1. Visual Density Through Color Psychology**
- Status columns use vibrant, saturated colors (not just dots)
- Each status state has a distinct background color + text color combination
- Colors create immediate visual grouping without explicit borders
- Example: "Done" = green background + white text (pill shape)

**2. Spreadsheet-First Mental Model**
- Main view is a table/spreadsheet (not kanban)
- Columns are highly customizable (status, assignee, date, priority, etc.)
- Users think in rows (items) and columns (attributes)
- Kanban is an alternate view, not the primary interface

**3. Sidebar Workspace Navigation**
- Collapsible left sidebar with workspace dropdown
- Boards organized in folders with expand/collapse
- Quick access to recent boards
- "+" button always visible for quick board creation

**4. Item Card (Expandable Detail View)**
- Click any row → Item Card opens as overlay
- Shows ALL column data in vertical layout
- Updates/Activity feed integrated at bottom
- Edit in place without separate "edit mode"

**5. Grouping with Visual Hierarchy**
- Items grouped by "Group" (like swimlanes)
- Each group has colored header bar
- Groups are collapsible
- Progress shown per group (X of Y done)

**6. Quick-Add Flow**
- Click "+ Add Item" at bottom of any group
- Inline row appears immediately (optimistic UI)
- Type title → press Enter → item created
- Other fields filled in after creation

**7. Status Labels (Not Just Dots)**
```
┌──────────────┐
│  ✓ Done      │  ← Full text + icon, colored background
└──────────────┘
```
- Status is the most visually prominent column
- Customizable labels per board
- Colors chosen by user (not fixed)
- Click to cycle or dropdown for selection

**8. Top Bar Design**
- Clean, minimal top navigation
- Global search with keyboard shortcut (Cmd+K)
- Notification bell with red badge
- User avatar dropdown
- Breadcrumbs for board context

### Monday.com Patterns Worth Adapting

| Pattern | Why It Works | Adaptation for Task Board |
|---------|--------------|---------------------------|
| **Colored Status Pills** | Immediate visual recognition | Use full pill badges instead of just dots |
| **Group Headers** | Visual organization without clutter | Add collapsible agent/priority groups |
| **Inline Quick-Add** | Zero friction task creation | FAB on mobile, inline input on desktop |
| **Item Card Overlay** | Context without navigation | Keep modal for desktop, sheet for mobile |
| **Column Customization** | User control over data density | Allow showing/hiding metadata columns |
| **Spreadsheet Primary View** | Familiar mental model | Add list view as primary, kanban as secondary |

### Monday.com Mobile Adaptations

- **Card View**: Instead of dense table, show task cards
- **Simplified Columns**: Only show 2-3 key columns
- **Quick Filters**: Filter bar at top (All, Mine, Recent)
- **Swipe Actions**: Right swipe = complete, Left swipe = more options
- **Bottom Sheet Detail**: Full item card as bottom sheet

### Visual Design Lessons

**Color Usage:**
- Monday.com uses color more aggressively than Linear
- Status colors have 80% saturation (not subtle)
- Background colors make status immediately scannable
- Contrast ratios still maintained (white text on colored bg)

**Typography:**
- Item names are bold, larger (16px)
- Column headers are light gray, small (12px)
- Clear hierarchy: Item name > Status > Other metadata

**Spacing:**
- Tight vertical spacing (32px row height)
- Horizontal padding generous (16px)
- Visual separation through alternating row colors (subtle)

### Implementation Recommendations

1. **Add Colored Status Pills** (High Impact)
   - Replace dot indicators with full pill badges
   - Use white text on colored backgrounds
   - Maintain our color palette but increase saturation

2. **Add List View as Primary** (Medium Impact)
   - Table view with sortable columns
   - Kanban as alternative view
   - Better for dense data display

3. **Inline Quick-Add** (Medium Impact)
   - Desktop: Input row at bottom of list
   - Mobile: FAB opens quick-add sheet
   - Optimistic UI (show immediately, save in background)

4. **Expandable Groups** (Low-Medium Impact)
   - Group by agent, status, or priority
   - Collapsible headers with progress
   - Reduces cognitive load

---

## Implementation Notes for TanStack Start + Tailwind

### Recommended Libraries

| Pattern | Library |
|---------|---------|
| Drag & Drop | `@dnd-kit/core` (modular, accessible) |
| Mobile Gestures | `@use-gesture/react` (swipe, pan) |
| Bottom Sheets | `vaul` or custom with Radix Dialog |
| Virtual Lists | `@tanstack/react-virtual` (performance) |
| Animations | `framer-motion` (layout animations) |

### Responsive Strategy

```javascript
// Tailwind breakpoints
const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px' // Extra large
};

// Component strategy
- Mobile-first CSS
- Conditional component rendering for mobile/desktop
- Shared state management
- Platform-specific interaction wrappers
```

### Key Considerations

1. **State Sync**: Keep board state consistent across views, optimistic UI updates
2. **Touch/Click Conflict**: Don't trigger click on drag end
3. **Scroll Performance**: Use `transform` and `opacity` for animations
4. **Memory**: Virtualize long lists on mobile
5. **Network**: Implement retry logic for failed operations
