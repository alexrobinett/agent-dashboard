# Task Board Dashboard - Product Requirements Document

**Version:** 1.1  
**Date:** 2026-02-16  
**Status:** Active — Sprint 3 in progress  

---

## 0. Living Addendum (Source of Truth)

> **This section overrides anything below that conflicts.** The original PRD (Sections 1-9) was written before implementation. This addendum reflects what was actually built and what the dashboard must align to.

### 0.1 Actual Task Schema (from `~/clawd/convex/schema.ts`)

The dashboard reads from the **same Convex deployment** (`curious-dolphin-134`) as the agent system. The tasks table has these fields — the dashboard must handle ALL of them:

```typescript
tasks: defineTable({
  // Core
  title: v.string(),
  description: v.optional(v.string()),
  assignedAgent: v.optional(v.string()),   // NOTE: optional, not required
  createdBy: v.string(),
  
  // Status — 9 values (7 active + 2 legacy)
  status: v.union(
    v.literal("planning"),      // Defining scope
    v.literal("ready"),         // Ready for pickup
    v.literal("in_progress"),   // Being worked on
    v.literal("in_review"),     // Needs review
    v.literal("done"),          // Complete
    v.literal("blocked"),       // Stuck
    v.literal("cancelled"),     // Abandoned
    v.literal("pending"),       // Legacy → map to "planning" in UI
    v.literal("active"),        // Legacy → map to "in_progress" in UI
  ),

  // Priority — 4 values
  priority: v.union(
    v.literal("low"),
    v.literal("normal"),
    v.literal("high"),
    v.literal("urgent"),
  ),

  // Timing (Unix ms)
  createdAt: v.number(),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  dueAt: v.optional(v.number()),

  // Hierarchy & Dependencies
  parentTask: v.optional(v.id("tasks")),
  dependsOn: v.optional(v.array(v.id("tasks"))),   // Array of task IDs

  // Project & Metadata
  project: v.optional(v.string()),
  notes: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  result: v.optional(v.string()),
  blockedReason: v.optional(v.string()),

  // Lease / Dispatch (agent system internals — show read-only in dashboard)
  leaseOwner: v.optional(v.string()),
  leaseExpiresAt: v.optional(v.number()),
  handoffCount: v.optional(v.number()),
  version: v.optional(v.number()),
  attemptCount: v.optional(v.number()),
  lastHeartbeatAt: v.optional(v.number()),

  // Handoff payload (agent→agent context)
  handoffPayload: v.optional(v.object({
    contextSummary: v.string(),
    filesChanged: v.array(v.string()),
    testsPassed: v.boolean(),
    remainingRisk: v.string(),
  })),
})
```

### 0.2 Actual API Endpoints (built in Sprint 2)

| Method | Path | Status | Query Function |
|--------|------|--------|---------------|
| GET | /api/board | ✅ Built | `api.tasks.getByStatus` |
| GET | /api/tasks | ✅ Built | `api.tasks.listFiltered` |
| GET | /api/tasks/:id | ✅ Built | `api.tasks.getById` |
| POST | /api/tasks | ✅ Built | `api.tasks.create` |
| PATCH | /api/tasks/:id | ✅ Built | `api.tasks.update` |
| GET | /api/workload | ✅ Built | `api.tasks.getWorkload` |
| GET | /api/health | ✅ Built | inline |
| POST | /api/tasks/:id/claim | ❌ Not built | — |
| POST | /api/push/register | ❌ Not built (Phase 3) | — |

**Note:** PRD Section 3.1 references `internal.tasks.getBoard` — the actual function is `api.tasks.getByStatus`.

### 0.3 Actual Tech Versions

| PRD Says | Reality |
|----------|---------|
| Tailwind v3 | **Tailwind v4** |
| convex ^1.25 | **convex ^1.31** |
| TanStack Query v5 | v5 ✅ |
| TanStack Router v1 | v1 ✅ |

### 0.4 Kanban Columns (Corrected)

PRD Section 5.1 lists 5 columns. Actual board has **7 columns** (6 active + cancelled):

`Planning → Ready → In Progress → In Review → Done → Blocked → Cancelled`

Legacy statuses `pending` and `active` should be mapped to `Planning` and `In Progress` in the UI.

### 0.5 Queries Not Yet Built

These are referenced in PRD Section 4.2 but don't exist yet:
- `getMetrics(timeframe)` — aggregate stats by time window
- `searchTasks(query)` — text search across title/description

These are backlog items, not Sprint 3 scope.

### 0.6 Known Agent Names

Dashboard should expect these agent values in `assignedAgent`:
`forge`, `sentinel`, `oracle`, `friday`, `pepper`, `main`, `code`, `research`, `ha`, `unassigned`

Each should have a distinct color/avatar in the UI.

---

## 1. Executive Summary

### Purpose
Build a real-time web dashboard for the Convex-backed task board system that provides visibility into multi-agent workflows. This dashboard will serve as the foundation for the Phase 3 iOS application.

### Goals
- Provide real-time visibility into agent task distribution and status
- Enable human oversight of autonomous agent workflows
- Support both web and future mobile (iOS) clients via shared API
- Maintain the existing CLI workflow while adding visual interfaces

### Success Criteria
- [ ] Sub-100ms dashboard load time with live updates
- [ ] Support for 100+ concurrent tasks with real-time sync
- [ ] Mobile-responsive web interface
- [ ] REST API enabling native iOS consumption
- [ ] Push notification infrastructure for critical events

---

## 2. Architecture

### 2.1 High-Level Design

**CLIENT LAYER**
- Web Dashboard (TanStack Start)
  - React Router (file-based routing)
  - TanStack Query + convexQuery
  - Tailwind + shadcn/ui components
- iOS Application (Phase 3)
  - SwiftUI Views
  - Convex Swift SDK
  - APNS Integration

**CONVEX PLATFORM**
- Real-time Subscriptions (WebSocket)
  - getBoard query
  - getWorkload query
- HTTP Actions (REST API)
  - /api/board
  - /api/tasks
  - /api/push/register
- Actions (side effects)
  - APNS token management
  - Push notification send
- Schema
  - tasks (existing)
  - pushTokens (new)
  - activityLog (new)
  - userPreferences (new)

### 2.2 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend Framework | TanStack Start | Full-stack React with SSR |
| State Management | TanStack Query + Convex | Real-time subscriptions |
| Styling | Tailwind CSS + shadcn/ui | UI components |
| Backend | Convex | Real-time database |
| iOS (Phase 3) | SwiftUI + Convex Swift SDK | Native mobile |
| Push Notifications | APNS + Convex Actions | Server notifications |

### 2.3 TanStack Start + Convex Integration

Based on [Convex documentation](https://docs.convex.dev/client/tanstack/tanstack-start/):

```typescript
// SSR + live updates pattern
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'

export const Route = createFileRoute('/dashboard')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.tasks.getBoard, {})
    )
  },
  component: Dashboard,
})

function Dashboard() {
  const { data: board } = useSuspenseQuery(
    convexQuery(api.tasks.getBoard, {})
  )
  // Auto-updates via WebSocket after SSR
}
```

**Key Decisions:**
1. SSR uses consistent query timestamps across all data
2. WebSocket resumes automatically after hydration
3. TanStack Query gcTime (5 min) keeps subscriptions active
4. Use createServerFn() for server operations

---

## 3. API Design

### 3.1 REST API (HTTP Actions)

Endpoints at `https://<deployment>.convex.site`:

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/board | Full Kanban board state |
| GET | /api/tasks | List tasks with filters |
| GET | /api/tasks/:id | Single task details |
| POST | /api/tasks | Create new task |
| PATCH | /api/tasks/:id | Update task |
| POST | /api/tasks/:id/claim | Claim task |
| GET | /api/workload | Agent workload stats |
| POST | /api/push/register | Register push token |
| GET | /api/health | Health check |

**Example Implementation:**

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/api/board",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const board = await ctx.runQuery(internal.tasks.getBoard, {});
    return Response.json(board, { headers: corsHeaders(request) });
  }),
});

// CORS preflight
http.route({
  path: "/api/*",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    return new Response(null, { headers: corsHeaders(request) });
  }),
});

export default http;
```

### 3.2 WebSocket API

**Web Dashboard:**
```typescript
const { data: board } = useQuery(convexQuery(api.tasks.getBoard, {}));
const { data: workload } = useQuery(convexQuery(api.tasks.getWorkload, {}));
```

**iOS (Phase 3):**
```swift
let client = ConvexClient(deploymentUrl: Config.convexUrl)
let subscription = client.subscribe(to: "tasks:getBoard")
    .sink { board in self.boardState = board }
```

### 3.3 Authentication

JWT Bearer tokens via Convex Auth:

```typescript
http.route({
  path: "/api/board",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return new Response("Unauthorized", { status: 401 });
    const board = await ctx.runQuery(internal.tasks.getBoard, {});
    return Response.json(board);
  }),
});
```

---

## 4. Schema Extensions

### 4.1 New Tables

```typescript
// Push notification tokens
pushTokens: defineTable({
  userId: v.string(),
  deviceId: v.string(),
  token: v.string(),
  platform: v.literal("ios"),
  createdAt: v.number(),
  lastUsedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_device", ["deviceId"]),

// Audit log
activityLog: defineTable({
  taskId: v.id("tasks"),
  actor: v.string(),
  actorType: v.union(v.literal("agent"), v.literal("user"), v.literal("system")),
  action: v.union(
    v.literal("created"), v.literal("claimed"), v.literal("started"),
    v.literal("completed"), v.literal("updated"), v.literal("blocked"), v.literal("handed_off")
  ),
  metadata: v.optional(v.object({
    fromStatus: v.optional(v.string()),
    toStatus: v.optional(v.string()),
    notes: v.optional(v.string()),
  })),
  timestamp: v.number(),
})
  .index("by_task", ["taskId"])
  .index("by_timestamp", ["timestamp"]),

// User preferences
userPreferences: defineTable({
  userId: v.string(),
  defaultView: v.union(v.literal("kanban"), v.literal("list"), v.literal("workload")),
  filterProject: v.optional(v.string()),
  filterAgent: v.optional(v.string()),
  notificationEnabled: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"]),
```

### 4.2 Extended Queries

```typescript
// Aggregated metrics
export const getMetrics = query({
  args: { timeframe: v.union(v.literal("24h"), v.literal("7d"), v.literal("30d")) },
  handler: async (ctx, { timeframe }) => {
    const cutoff = Date.now() - (timeframe === "24h" ? 86400000 : timeframe === "7d" ? 604800000 : 2592000000);
    const tasks = await ctx.db.query("tasks").withIndex("by_created_at", q => q.gte("createdAt", cutoff)).collect();
    return {
      totalCreated: tasks.length,
      totalCompleted: tasks.filter(t => t.status === "done").length,
      blockedCount: tasks.filter(t => t.status === "blocked").length,
    };
  },
});

// Search
export const searchTasks = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { query, limit = 20 }) => {
    const all = await ctx.db.query("tasks").take(200);
    return all.filter(t => 
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.description?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, limit);
  },
});
```

---

## 5. UI Specifications

### 5.1 Kanban Board View

**Columns:**
- Planning -> Ready -> In Progress -> In Review -> Blocked

**Task Card:**
- Title (truncated)
- Priority badge (low/normal/high/urgent)
- Assigned agent avatar
- Due date (if set)
- Tags

**Interactions:**
- Drag to move between columns
- Click to open detail drawer
- Hover for quick actions (claim, block, etc.)

### 5.2 Workload View

**Layout:** Bar chart showing tasks per agent by status

**Metrics:**
- Total active tasks
- Completion rate
- Average time in status
- Blocked tasks count

### 5.3 Health View

**Indicators:**
- Convex connection status
- Last sync timestamp
- Active subscription count
- API error rate

---

## 6. iOS Compatibility (Phase 3)

### 6.1 Connection Options

| Approach | Pros | Cons |
|----------|------|------|
| REST Polling | Simple, works everywhere | Latency, battery drain |
| WebSocket Direct | Real-time, efficient | Complex reconnection logic |
| Hybrid | Best of both | More code to maintain |

**Recommendation:** Start with REST polling for Phase 3 MVP, add WebSocket later.

### 6.2 Push Notification Architecture

```
Task Blocked / Completed
       |
  Convex Mutation
       |
  Convex Action (Node.js)
       |
  APNS HTTP/2 API
       |
   iOS Device
```

**Implementation:**

```typescript
// convex/push.ts (Node.js runtime)
"use node";
import { action } from "./_generated/server";
import apn from "apn";

export const sendPushNotification = internalAction({
  args: { userId: v.string(), title: v.string(), body: v.string() },
  handler: async (ctx, { userId, title, body }) => {
    const tokens = await ctx.runQuery(internal.push.getUserTokens, { userId });
    
    const provider = new apn.Provider({
      cert: process.env.APNS_CERT,
      key: process.env.APNS_KEY,
      production: true,
    });
    
    for (const token of tokens) {
      const notification = new apn.Notification();
      notification.alert = { title, body };
      notification.topic = "com.yourapp.taskboard";
      await provider.send(notification, token);
    }
  },
});
```

### 6.3 Auth Flow for iOS

1. User authenticates via WebView or native flow
2. Server returns JWT token
3. iOS stores token in Keychain
4. Token included in all API requests (Authorization: Bearer <token>)
5. Token refresh before expiry

---

## 7. Implementation Sprints

### Sprint 1: Foundation (Week 1)
**Goal:** TanStack Start scaffold + Convex connection

**Tasks:**
- [ ] Initialize TanStack Start project with pnpm create cloudflare@latest
- [ ] Configure vite.config.ts with tanstackStart plugin
- [ ] Install Convex client dependencies: convex, @convex-dev/react-query
- [ ] Set up Convex client provider in root component
- [ ] Create route structure: /, /dashboard, /tasks/$taskId
- [ ] Add Tailwind CSS and shadcn/ui configuration

**Deliverable:** Running dev server with Convex connection

### Sprint 2: Kanban Board (Week 2)
**Goal:** Real-time Kanban view

**Tasks:**
- [ ] Create getBoard query subscription
- [ ] Build Kanban column components
- [ ] Implement drag-and-drop with @dnd-kit
- [ ] Add task card component with priority badges
- [ ] Implement filters (project, agent, priority)
- [ ] Add real-time update indicators

**Deliverable:** Functional Kanban board with live updates

### Sprint 3: Task Management (Week 3)
**Goal:** Full CRUD operations

**Tasks:**
- [ ] Create task detail drawer/modal
- [ ] Implement create task form
- [ ] Add update task mutations
- [ ] Build claim/complete/block actions
- [ ] Add optimistic UI updates
- [ ] Implement error handling and retry

**Deliverable:** Complete task lifecycle management

### Sprint 4: Workload & Metrics (Week 4)
**Goal:** Agent visibility and analytics

**Tasks:**
- [ ] Create getWorkload aggregation query
- [ ] Build workload bar chart view
- [ ] Add agent filter sidebar
- [ ] Implement metrics cards (24h/7d/30d)
- [ ] Create activity log view
- [ ] Add export functionality

**Deliverable:** Workload analytics dashboard

### Sprint 5: REST API (Week 5)
**Goal:** iOS-ready HTTP endpoints

**Tasks:**
- [ ] Create convex/http.ts with httpRouter
- [ ] Implement /api/board endpoint
- [ ] Implement /api/tasks with filtering
- [ ] Add /api/tasks/:id CRUD endpoints
- [ ] Implement /api/workload endpoint
- [ ] Add CORS configuration
- [ ] Create API documentation

**Deliverable:** Documented REST API for iOS team

### Sprint 6: Push Notifications (Week 6)
**Goal:** APNS infrastructure

**Tasks:**
- [ ] Add pushTokens table to schema
- [ ] Create registerDevice mutation
- [ ] Set up APNS certificate/key storage
- [ ] Implement sendPushNotification action (Node.js)
- [ ] Add triggers for blocked/completed tasks
- [ ] Test with development APNS environment

**Deliverable:** Push notification system ready for iOS integration

### Sprint 7: Auth & Polish (Week 7)
**Goal:** Security and production readiness

**Tasks:**
- [ ] Implement Convex Auth or Better Auth
- [ ] Add protected route middleware
- [ ] Create login/logout flows
- [ ] Add loading states and skeletons
- [ ] Implement error boundaries
- [ ] Add keyboard shortcuts
- [ ] Mobile responsive polish

**Deliverable:** Production-ready dashboard

### Sprint 8: Testing & Deploy (Week 8)
**Goal:** Quality assurance and launch

**Tasks:**
- [ ] Write integration tests for critical flows
- [ ] Add E2E tests with Playwright
- [ ] Performance testing (100+ tasks)
- [ ] Configure Cloudflare Workers deployment
- [ ] Set up CI/CD pipeline
- [ ] Create monitoring dashboards
- [ ] Documentation finalization

**Deliverable:** Deployed dashboard with monitoring

---

## 8. Open Questions

### 8.1 Technical Decisions

| Question | Options | Recommendation |
|----------|---------|----------------|
| iOS WebSocket? | Direct vs REST polling | Start with REST, add WebSocket later |
| Auth provider? | Convex Auth vs Better Auth vs Clerk | Better Auth for flexibility |
| Charting library? | Recharts vs Tremor vs custom | Tremor for dashboard consistency |
| Drag-and-drop? | @dnd-kit vs react-beautiful-dnd | @dnd-kit (actively maintained) |

### 8.2 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| TanStack Start breaking changes | High | Pin versions, follow beta closely |
| Convex subscription limits | Medium | Implement pagination, optimize queries |
| APNS certificate complexity | Medium | Use .p8 key instead of certificates |
| iOS team blocked on API | High | Sprint 5 (REST API) before iOS work |

### 8.3 Open Questions for Team

1. **Authentication:** Do we need social login (GitHub/Google) or just email?
2. **Mobile strategy:** Should web dashboard be PWA-ready for Phase 2.5?
3. **Notifications:** Which events trigger push? (all updates vs blocked only)
4. **Multi-tenant:** Do we need org/workspace isolation for future growth?
5. **Offline support:** Does iOS need offline queue for mutations?

---

##
## Appendix A: Project File Structure

```
~/clawd/tools/taskboard-dashboard/
├── app/
│   ├── routes/
│   │   ├── __root.tsx           # Root layout with Convex provider
│   │   ├── index.tsx            # Landing / redirect
│   │   ├── dashboard.tsx        # Main dashboard (Kanban view)
│   │   ├── workload.tsx         # Workload analytics view
│   │   ├── tasks/
│   │   │   └── $taskId.tsx      # Task detail view
│   │   └── api/
│   │       └── health.ts        # Health check endpoint
│   ├── components/
│   │   ├── kanban/
│   │   │   ├── Board.tsx
│   │   │   ├── Column.tsx
│   │   │   └── TaskCard.tsx
│   │   ├── workload/
│   │   │   ├── AgentChart.tsx
│   │   │   └── MetricsCard.tsx
│   │   └── ui/                  # shadcn/ui components
│   ├── hooks/
│   │   ├── useBoard.ts          # Convex subscription wrapper
│   │   └── useWorkload.ts
│   └── lib/
│       ├── convex.ts            # Convex client setup
│       └── utils.ts
├── convex/
│   ├── schema.ts                # Extended schema
│   ├── tasks.ts                 # Existing + new queries/mutations
│   ├── http.ts                  # REST API routes
│   ├── push.ts                  # Push notification actions
│   └── _generated/              # Auto-generated
├── public/
├── tests/
│   ├── e2e/
│   └── integration/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── wrangler.jsonc               # Cloudflare deployment
```

## Appendix B: Environment Variables

```bash
# .env.local
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_SITE_URL=https://your-deployment.convex.site

# Dashboard-specific
CLIENT_ORIGIN=http://localhost:3000  # For CORS

# APNS (for push notifications)
APNS_KEY_ID=YOUR_KEY_ID
APNS_TEAM_ID=YOUR_TEAM_ID
APNS_P8_KEY_PATH=/path/to/AuthKey.p8
```

## Appendix C: Key Dependencies

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.x",
    "@tanstack/react-router": "^1.x",
    "@tanstack/react-start": "^1.x",
    "@convex-dev/react-query": "^0.x",
    "convex": "^1.25",
    "tailwindcss": "^3.x",
    "@radix-ui/react-*": "latest",
    "@dnd-kit/core": "^6.x",
    "@dnd-kit/sortable": "^8.x"
  },
  "devDependencies": {
    "@cloudflare/vite-plugin": "^0.x",
    "wrangler": "^3.x",
    "playwright": "^1.x"
  }
}
```

---

*Document generated: 2026-02-15*
*Next review: Sprint 4 checkpoint*
