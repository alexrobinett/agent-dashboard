# Task Board Dashboard - Mock Generation Specs

Detailed specifications for generating high-fidelity mock images using AI image generation.

---

## Spec 1: Desktop Dashboard View (1440px)

### Composition

**Layout:**
- Full-width viewport at 1440px
- Dark mode theme (primary)
- Three-column layout: Sidebar (240px) | Main Content | (optional right panel)

**Sidebar (Left):**
- Dark background (#0F0F10)
- Logo: "🔷 TASK BOARD" at top
- Navigation sections:
  - FAVORITES: My Tasks, Recent, Done, Blocked
  - AGENTS: Code (blue), Sentinel (purple), Research (green), Design (orange)
  - QUICK: New Task button (accent color)

**Header:**
- Background matches sidebar
- Search bar with icon (pill shape, gray fill)
- Health icon with badge ("3" for blocked tasks)
- User avatar (circular)

**Main Content:**
- Tab switcher: Board | List | Health
- Filter dropdowns
- Kanban board with 5 columns:
  - READY (8 tasks)
  - IN PROGRESS (12 tasks) 
  - IN REVIEW (5 tasks)
  - DONE (24 tasks)
  - BLOCKED (2 tasks with warning)

**Task Card Design:**
- Dark card background (#1A1A1D)
- 3px left border (color = priority)
- Title: White text, 14px, semibold
- Metadata row: Avatar (24px circle) + Agent badge + Due date
- Hover state: subtle lift shadow

### Visual Style

- **Theme:** Dark mode professional SaaS aesthetic
- **Contrast:** High contrast for readability
- **Style:** Clean, minimal, modern (Linear.app inspired)
- **Typography:** SF Pro / Inter / System sans-serif
- **Depth:** Subtle shadows for hierarchy
- **Grid:** 4px base grid, 12-16-24px spacing

### Colors

```
Background: #0F0F10 (deep dark)
Card: #1A1A1D
Card Hover: #252528
Borders: #2E2E32
Accent: #6366F1 (indigo)
Text Primary: #FAFAFA
Text Secondary: #9CA3AF
Priority High: #EF4444 (red)
Priority Normal: #F59E0B (amber)
Priority Low: #3B82F6 (blue)
Status In Progress: #3B82F6
Status Done: #22C55E
Status Blocked: #EF4444 + warning indicator
```

### Technical Specs

- **Resolution:** 1920×1080 (or 1440×900)
- **Aspect Ratio:** 16:9
- **Format:** PNG with dark background
- **Style:** UI mockup, flat design with subtle depth

---

## Spec 2: Mobile Dashboard View (iPhone)

### Composition

**Layout:**
- iPhone 14 Pro frame or full-screen 390×844px
- Dark mode
- Single column list view (not kanban)

**Header:**
- App title left, avatar right
- Search bar below (full width, rounded)

**Filter Tabs:**
- Horizontal scrollable tabs
- ALL | READY | IN PROGRESS | DONE | BLOCKED
- Active tab has accent underline
- Count badges on each tab

**Task List:**
- Grouped by date (TODAY, YESTERDAY)
- Each task card:
  - Priority dot (6px) + Task ID
  - Title (truncated if long)
  - Bottom row: Avatar + Agent badge + Status dot + time

**Bottom Navigation:**
- Fixed 56px tall
- 4 tabs: Board, List, Health, You
- Icons + labels
- Active tab highlighted

**Floating Action Button:**
- Circular + icon
- Bottom right, 16px from edges
- Accent color background

### Visual Style

- **Theme:** Dark mode, iOS native aesthetic
- **Style:** Modern mobile app, clean lines
- **Typography:** SF Pro, 15px body (prevents iOS zoom)
- **Touch Targets:** Minimum 44×44px
- **Safe Areas:** Respect iPhone notch and home indicator

### Colors

Same as desktop, adapted for mobile contrast and iOS guidelines.

### Technical Specs

- **Resolution:** 390×844px (iPhone 14 Pro)
- **Aspect Ratio:** 9:19.5
- **Format:** PNG with device frame optional
- **Style:** Mobile app UI mockup

---

## Spec 3: Task Detail Modal/Sheet

### Composition

**Desktop Modal:**
- Centered, max-width 640px
- Backdrop blur/overlay
- Rounded corners (12px)
- Header: Task ID, Close button, Actions

**Mobile Sheet:**
- Bottom sheet style
- Rounded top corners (16px)
- Drag handle at top center
- 50% height peek state, 90% full

**Content Structure:**
- Header: Task ID badge + Due date + Title
- Description area (markdown formatted)
- Grid of 4 metadata cards:
  - Assignee (avatar + name)
  - Agent (badge + name)
  - Priority (colored badge)
  - Status (colored badge)
- Activity timeline
- Comment input field
- Save/Cancel actions

### Visual Style

- **Elevation:** Higher than main content (modal overlay)
- **Animation:** Slide up (mobile) / Fade in (desktop)
- **Background:** Slightly lighter than main surface
- **Focus:** Clear focus ring on active elements

### Colors

```
Modal Background: #1A1A1D (desktop), #151518 (mobile sheet)
Backdrop: rgba(0,0,0,0.5)
Border: #2E2E32
Card Background: #252528 (metadata cards)
```

---

## Image Generation Prompts

### Prompt 1: Desktop Kanban Board

```
Professional dark mode kanban board dashboard UI design, 
1440px wide, modern SaaS interface inspired by Linear.app.

Layout:
- Left sidebar (240px) with navigation: "TASK BOARD" logo, 
  sections for My Tasks (4 items), Agents (Code-blue, Sentinel-purple, 
  Research-green, Design-orange icons), Quick Actions
- Main area: horizontal kanban board with 5 columns
  (READY, IN PROGRESS, IN REVIEW, DONE, BLOCKED)
- Header with search bar, health icon with warning badge, user avatar
- Each column contains 2-3 dark task cards with:
  * 3px colored left border (priority indicator)
  * Task ID (TSK-XXX)
  * Title in white sans-serif text
  * Bottom row: circular avatar, small colored agent badge, timestamp

Style:
- Clean minimal aesthetic, high contrast
- Dark theme: background #0F0F10, cards #1A1A1D
- Accent indigo (#6366F1) for buttons and highlights
- Red (#EF4444) for blocked column and high priority
- SF Pro / Inter typography
- Subtle shadows and borders for depth
- No gradients except for smooth shadows

Color palette:
- Background: #0F0F10
- Card: #1A1A1D
- Text: #FAFAFA (primary), #9CA3AF (secondary)
- Accent: #6366F1
- Success: #22C55E
- Warning: #F59E0B
- Error: #EF4444

High fidelity UI mockup, crisp vector aesthetic, 
professional dashboard design, no device frame.
Resolution: 1920x1080
```

### Prompt 2: Mobile List View (iPhone)

```
Mobile task list dashboard UI for iPhone, dark mode, 
iOS design language.

Layout:
- iPhone frame (390x844) or full screen mobile view
- Header: "TASK BOARD" title, search bar with pill shape
- Horizontal scrollable filter tabs: 
  ALL (31), READY (8), IN PROGRESS (12), DONE (24)
- Task list grouped by date:
  * TODAY section with 3 visible tasks
  * Each task row:
    - Left: colored dot (priority indicator)
    - Center: Task ID and title (truncated)
    - Right: time/due indicator
    - Bottom row: small avatar circle, agent badge, status dot
- Sticky section headers (TODAY, YESTERDAY)
- FAB (floating action button) bottom right with + icon
- Bottom tab bar: Board, List, Health, You icons

Visual style:
- iOS native dark theme
- Background: #0F0F10
- Cards: #1A1A1D with subtle border
- Large touch targets (44px minimum)
- Bottom sheet rounded corners
- SF Pro typography, 15px body text
- High contrast for sunlight readability

Colors:
- Background: #0F0F10
- Card Surface: #1A1A1D
- Primary Text: #FAFAFA
- Secondary Text: #9CA3AF
- Accent: #6366F1
- Success: #22C55E
- Warning/Eror: #EF4444

Modern mobile app design, professional productivity app UI,
high fidelity mockup, clean and minimal.
```

### Prompt 3: Task Detail Modal/Sheet

```
Task detail view UI design, showing both desktop modal 
(1440px view) and mobile bottom sheet (iPhone).

Desktop Modal (left side of image, 50% width):
- Centered modal, 640px width, rounded 12px corners
- Dark overlay backdrop (#000000 at 50% opacity)
- Modal background: #1A1A1D
- Header: Task ID badge "TSK-123", close X button, 
  "Edit" button
- Title: "Implement OAuth2 authentication flow" in white
- Due date: "2 days ago" aligned right
- Description area with markdown text, checklist items
- 4 metadata cards in 2x2 grid:
  * Assignee: avatar + "Alex"
  * Agent: blue badge + "Code"
  * Priority: red badge + "HIGH"  
  * Status: blue badge + "In Progress"
- Activity section with timeline icons
- Comment input at bottom
- Subtle borders between sections

Mobile Sheet (right side of image, iPhone frame):
- Bottom sheet style with drag handle
- Rounded topcorners (16px radius)
- Same content adapted for mobile width
- Stacked layout instead of grid
- Larger touch targets
- Swipe down to close affordance

Style:
- Dark theme consistent with main app
- High contrast text for readability
- Smooth rounded corners on all elements
- Subtle shadows for elevation
- SF Pro / Inter typography hierarchy
- Clean iconography (lucide/phosphor style)

Colors:
- Modal Bg: #1A1A1D
- Card Bg: #252528  
- Border: #2E2E32
- Primary Text: #FAFAFA
- Secondary Text: #9CA3AF
- Accent: #6366F1
- Priority High: #EF4444
- Status In Progress: #3B82F6

Professional dashboard UI mockup, high fidelity,
productivity app design, dark mode interface.
Split layout showing responsive design.
```

### Prompt 4: Desktop List View (Monday.com Style)

```
Dark mode task management list view UI design, 1440px wide,
spreadsheet-style table interface inspired by Monday.com.

Layout:
- Left sidebar (240px) with workspace navigation
- Main area: table/list view with columns
  * Task Name (bold, left-aligned)
  * Status (colored pills: green Done, blue In Progress, red Blocked)
  * Assignee (avatar + name)
  * Agent (colored badges: blue Code, purple Sentinel)
  * Due Date (relative time)
  * Priority (colored dots)
- Group headers with agent names:
  * "CODE AGENT (8 tasks, 80% capacity)" with blue left border
  * "SENTINEL AGENT (2 tasks, 20% capacity)" with purple left border
  * Collapsible sections with chevron icons
- Each row has:
  * Task title in white semibold text
  * Status pill with white text on colored background
  * Circular avatar (24px)
  * Agent badge (small pill)
  * Metadata aligned in columns
- Top bar with search, filter dropdowns, "+ Add Task" button
- Alternating row backgrounds (subtle)

Status Pills Design:
- Done: Green background #22C55E, white text, checkmark icon
- In Progress: Blue background #3B82F6, white text, dot icon
- Blocked: Red background #EF4444, white text, warning icon
- Ready: Gray background #6B7280, white text, circle outline

Visual Style:
- Clean spreadsheet aesthetic
- High information density
- Colorful status indicators (Monday.com style)
- Dark theme: background #0F0F10, rows #1A1A1D
- SF Pro / Inter typography
- Borderless design with subtle row separators
- Professional work management SaaS UI

High fidelity UI mockup, crisp vector aesthetic,
professional productivity app design, no device frame.
Resolution: 1920x1080
```

---

## Generation Settings

### For nano-banana-pro (Gemini 3 Pro Image)

| Parameter | Value |
|-----------|-------|
| Resolution | `--resolution 2K` for desktop, `--resolution 1K` for mobile |
| Format | `.png` output |
| Safety | Default (safe for work) |

### Execution

```bash
# Desktop mock
cd ~/clawd/research/dashboard-design
uv run /opt/homebrew/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "[Desktop prompt from above]" \
  --filename "2025-02-15-desktop-kanban.png" \
  --resolution 2K

# Mobile mock  
uv run /opt/homebrew/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "[Mobile prompt from above]" \
  --filename "2025-02-15-mobile-list.png" \
  --resolution 1K

# Task Detail mock
uv run /opt/homebrew/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "[Task detail prompt from above]" \
  --filename "2025-02-15-task-detail.png" \
  --resolution 2K
```

---

## Notes

- All designs prioritize clarity and function over decoration
- Dark mode is the primary theme (easier on eyes, modern aesthetic)
- Mobile designs respect iOS Human Interface Guidelines
- Desktop optimizations include keyboard shortcuts and drag-drop
- All colors tested for WCAG AA contrast compliance
- Component-based design system ready for Tailwind CSS implementation

## Reference Influences

**Linear.app**: Minimal aesthetic, keyboard shortcuts, speed-focused interactions
**Monday.com**: Colorful status pills, spreadsheet view, collapsible groups, quick-add flow
**GitHub Projects**: Cross-platform consistency, flexible views
**Trello**: Card-based simplicity, drag-and-drop familiarity
**Notion**: Flexible databases, nested content
**Apple Reminders**: iOS-native patterns, clean mobile UX
