# Agent Dashboard REST API

## Base URL

The API is served from your Convex deployment's site URL:

```
https://<your-deployment>.convex.site
```

You can find this URL in the Convex dashboard or via `npx convex dashboard`.

## Authentication

Currently, the API does not require authentication tokens for read operations. Write operations (POST, PATCH) are open but should be protected in production by configuring `ALLOWED_ORIGINS` and/or adding a reverse proxy with auth.

> **Note:** If you add token-based auth, pass it as:
> ```
> Authorization: Bearer <SYSTEM_TOKEN>
> ```

## CORS Configuration

All endpoints support CORS. Configure allowed origins via the `ALLOWED_ORIGINS` environment variable in your Convex deployment:

| Setting | Behavior |
|---------|----------|
| Not set / empty | Allows all origins (`*`) — development mode |
| `https://app.example.com` | Restricts to that single origin |
| `https://a.com,https://b.com` | Comma-separated list of allowed origins |

CORS headers returned:
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
- `Access-Control-Max-Age: 86400`

All endpoints have corresponding `OPTIONS` handlers for preflight requests.

## Error Response Format

All errors return JSON with an `error` field:

```json
{
  "error": "Description of what went wrong"
}
```

Common HTTP status codes:
| Code | Meaning |
|------|---------|
| 400 | Bad request (missing fields, invalid values) |
| 404 | Resource not found |
| 201 | Created successfully (POST) |
| 200 | Success |
| 204 | No content (OPTIONS preflight) |

---

## Endpoints

### GET /api/health

Health check endpoint.

**Response** `200`
```json
{
  "status": "ok"
}
```

**Example:**
```bash
curl https://<your-deployment>.convex.site/api/health
```

---

### GET /api/board

Returns the full kanban board with tasks grouped by status.

**Response** `200`
```json
{
  "planning": [{ ... }],
  "ready": [{ ... }],
  "in_progress": [{ ... }],
  "in_review": [{ ... }],
  "done": [{ ... }],
  "blocked": [{ ... }],
  "meta": {
    "total": 42,
    "lastUpdated": 1708200000000
  }
}
```

Each task object contains:
```json
{
  "_id": "j57d...",
  "_creationTime": 1708200000000,
  "title": "Implement login flow",
  "status": "in_progress",
  "priority": "high",
  "project": "auth",
  "assignedAgent": "forge",
  "createdBy": "user",
  "createdAt": 1708200000000,
  "notes": "Optional notes",
  "description": "Optional description",
  "tags": ["frontend"],
  "startedAt": 1708200000000,
  "completedAt": null,
  "dueAt": null,
  "parentTask": null,
  "dependsOn": [],
  "result": null,
  "blockedReason": null
}
```

**Example:**
```bash
curl https://<your-deployment>.convex.site/api/board
```

---

### GET /api/tasks

Returns a filtered, paginated list of tasks.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | — | Filter by status: `planning`, `ready`, `in_progress`, `in_review`, `done`, `blocked`, `cancelled` |
| `priority` | string | — | Filter by priority: `low`, `normal`, `high`, `urgent` |
| `project` | string | — | Filter by project name |
| `assignedAgent` | string | — | Filter by assigned agent |
| `limit` | number | `50` | Max results to return |
| `offset` | number | `0` | Number of results to skip |

**Response** `200`
```json
{
  "tasks": [{ ... }],
  "total": 15,
  "limit": 50,
  "offset": 0,
  "hasMore": false
}
```

**Examples:**
```bash
# All tasks
curl "https://<your-deployment>.convex.site/api/tasks"

# Filter by status and priority
curl "https://<your-deployment>.convex.site/api/tasks?status=in_progress&priority=high"

# Paginate
curl "https://<your-deployment>.convex.site/api/tasks?limit=10&offset=20"

# Filter by agent
curl "https://<your-deployment>.convex.site/api/tasks?assignedAgent=forge"
```

---

### GET /api/tasks/:id

Returns a single task by its Convex document ID.

**Path Parameters:**
- `id` — Convex document ID (e.g., `j57dqjdex468cp0855v142v8pd81aj6d`)

**Response** `200` — Task object (see shape above)

**Response** `404`
```json
{ "error": "Task not found" }
```

**Response** `400`
```json
{ "error": "Invalid task ID" }
```

**Example:**
```bash
curl "https://<your-deployment>.convex.site/api/tasks/j57dqjdex468cp0855v142v8pd81aj6d"
```

---

### POST /api/tasks

Create a new task.

**Request Body** (JSON):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | Task title |
| `priority` | string | ✅ | `low`, `normal`, `high`, or `urgent` |
| `project` | string | ✅ | Project name |
| `notes` | string | — | Optional notes |
| `assignedAgent` | string | — | Agent to assign (defaults to `"unassigned"`) |
| `createdBy` | string | — | Creator identifier (defaults to `"api"`) |
| `status` | string | — | Initial status (defaults to `"planning"`) |

**Response** `201`
```json
{ "id": "j57d..." }
```

**Response** `400`
```json
{ "error": "Missing or invalid required field: title" }
```

**Example:**
```bash
curl -X POST "https://<your-deployment>.convex.site/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Build user settings page",
    "priority": "high",
    "project": "dashboard",
    "assignedAgent": "forge",
    "notes": "Include theme toggle"
  }'
```

---

### PATCH /api/tasks/:id

Update an existing task. Only provided fields are changed.

**Path Parameters:**
- `id` — Convex document ID

**Request Body** (JSON):

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | New status |
| `priority` | string | New priority |
| `assignedAgent` | string | New agent assignment |
| `notes` | string | Updated notes |

**Response** `200`
```json
{ "success": true }
```

**Response** `404`
```json
{ "error": "Task not found: <id>" }
```

**Example:**
```bash
curl -X PATCH "https://<your-deployment>.convex.site/api/tasks/j57dqjdex468cp0855v142v8pd81aj6d" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "assignedAgent": "forge"
  }'
```

---

### GET /api/workload

Returns agent workload statistics aggregated across all tasks.

**Response** `200`
```json
{
  "forge": {
    "total": 5,
    "byStatus": {
      "in_progress": 2,
      "done": 3
    },
    "byPriority": {
      "high": 1,
      "normal": 4
    }
  },
  "unassigned": {
    "total": 3,
    "byStatus": { "planning": 3 },
    "byPriority": { "normal": 3 }
  }
}
```

**Example:**
```bash
curl "https://<your-deployment>.convex.site/api/workload"
```

---

## Valid Enum Values

**Status:** `planning`, `ready`, `in_progress`, `in_review`, `done`, `blocked`, `cancelled`

**Priority:** `low`, `normal`, `high`, `urgent`
