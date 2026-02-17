/**
 * Agent Dashboard API Client
 *
 * Lightweight TypeScript fetch wrapper for the Agent Dashboard REST API.
 * Works in Node.js 18+, Deno, Bun, and modern browsers.
 *
 * Usage:
 *   const client = createApiClient("https://your-deployment.convex.site");
 *   const board = await client.getBoard();
 *   const task = await client.createTask({ title: "Fix bug", priority: "high", project: "dashboard" });
 */

// ── Types ──────────────────────────────────────────────────────────────

export type TaskStatus =
  | "planning"
  | "ready"
  | "in_progress"
  | "in_review"
  | "done"
  | "blocked"
  | "cancelled";

export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface Task {
  _id: string;
  _creationTime: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  project?: string;
  assignedAgent?: string;
  createdBy: string;
  createdAt: number;
  notes?: string;
  description?: string;
  tags?: string[];
  startedAt?: number;
  completedAt?: number;
  dueAt?: number;
  parentTask?: string;
  dependsOn?: string[];
  result?: string;
  blockedReason?: string;
}

export interface Board {
  planning: Task[];
  ready: Task[];
  in_progress: Task[];
  in_review: Task[];
  done: Task[];
  blocked: Task[];
  meta: { total: number; lastUpdated: number };
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  project?: string;
  assignedAgent?: string;
  limit?: number;
  offset?: number;
}

export interface CreateTaskInput {
  title: string;
  priority: TaskPriority;
  project: string;
  notes?: string;
  assignedAgent?: string;
  createdBy?: string;
  status?: TaskStatus;
}

export interface UpdateTaskInput {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedAgent?: string;
  notes?: string;
}

export interface WorkloadEntry {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export type WorkloadResponse = Record<string, WorkloadEntry>;

// ── Client ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApiClient(baseUrl: string, headers?: Record<string, string>) {
  const base = baseUrl.replace(/\/$/, "");
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...defaultHeaders, ...init?.headers },
    });
    const body = await res.json();
    if (!res.ok) {
      throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
    }
    return body as T;
  }

  return {
    /** Health check */
    health: () => request<{ status: string }>("/api/health"),

    /** Get kanban board grouped by status */
    getBoard: () => request<Board>("/api/board"),

    /** List tasks with optional filters and pagination */
    getTasks: (filters?: TaskFilters) => {
      const params = new URLSearchParams();
      if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          if (v !== undefined) params.set(k, String(v));
        }
      }
      const qs = params.toString();
      return request<TaskListResponse>(`/api/tasks${qs ? `?${qs}` : ""}`);
    },

    /** Get a single task by ID */
    getTask: (id: string) => request<Task>(`/api/tasks/${id}`),

    /** Create a new task */
    createTask: (input: CreateTaskInput) =>
      request<{ id: string }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    /** Update an existing task (partial update) */
    updateTask: (id: string, input: UpdateTaskInput) =>
      request<{ success: boolean }>(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),

    /** Get agent workload statistics */
    getWorkload: () => request<WorkloadResponse>("/api/workload"),
  };
}

// ── Example usage ──────────────────────────────────────────────────────

async function main() {
  const client = createApiClient("https://your-deployment.convex.site");

  // Health check
  const health = await client.health();
  console.log("API status:", health.status);

  // Get the board
  const board = await client.getBoard();
  console.log(`Board has ${board.meta.total} tasks`);

  // List high-priority in-progress tasks
  const urgent = await client.getTasks({
    status: "in_progress",
    priority: "high",
    limit: 10,
  });
  console.log(`Found ${urgent.total} high-priority in-progress tasks`);

  // Create a task
  const created = await client.createTask({
    title: "Write integration tests",
    priority: "normal",
    project: "dashboard",
    assignedAgent: "forge",
  });
  console.log("Created task:", created.id);

  // Update it
  await client.updateTask(created.id, { status: "in_progress" });

  // Check workload
  const workload = await client.getWorkload();
  for (const [agent, stats] of Object.entries(workload)) {
    console.log(`${agent}: ${stats.total} tasks`);
  }
}

// Run if executed directly
main().catch(console.error);
