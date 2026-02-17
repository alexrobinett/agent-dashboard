#!/usr/bin/env npx tsx
/**
 * E2E Smoke Test — TypeScript version
 * Usage: BASE_URL=https://curious-dolphin-134.convex.site npx tsx e2e/api-smoke-test.ts
 */
import { createApiClient, ApiError } from "../docs/examples/api-client.js";

const BASE = process.env.BASE_URL;
if (!BASE) {
  console.error("ERROR: BASE_URL environment variable is required.");
  console.error("Usage: BASE_URL=https://curious-dolphin-134.convex.site npx tsx e2e/api-smoke-test.ts");
  process.exit(1);
}

const client = createApiClient(BASE);

let pass = 0, fail = 0, total = 0;
const failures: string[] = [];
const createdIds: string[] = [];

function ok(name: string) { pass++; total++; console.log(`  ✅ PASS: ${name}`); }
function nok(name: string, detail: string) { fail++; total++; failures.push(name); console.log(`  ❌ FAIL: ${name}\n     Detail: ${detail}`); }

async function cleanup() {
  if (createdIds.length === 0) return;
  console.log("\n=== CLEANUP ===");
  for (const id of createdIds) {
    console.log(`  Deleting task ${id}...`);
    try {
      const res = await fetch(`${BASE}/api/tasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        console.log("    ✅ Deleted");
      } else {
        // Fallback: cancel the task
        await client.updateTask(id, { status: "cancelled" as any, notes: "E2E smoke test cleanup" } as any);
        console.log(`    ⚠️  DELETE returned ${res.status}, cancelled instead`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.log(`    ⚠️  Cleanup failed for ${id}: ${message}`);
    }
  }
}

async function run() {
  console.log(`=== E2E API Smoke Test (TS) ===\nBase URL: ${BASE}\n`);

  try {
    // 1. Health
    console.log("1. GET /api/health");
    try {
      const h = await client.health();
      h.status === "ok" ? ok("Health check") : nok("Health check", JSON.stringify(h));
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); nok("Health check", msg); }

    // 2. Board
    console.log("2. GET /api/board");
    try {
      const b = await client.getBoard();
      if (
        b.meta?.total >= 0 &&
        typeof b.meta?.lastUpdated === "number" &&
        "planning" in b && "ready" in b && "in_progress" in b &&
        "in_review" in b && "done" in b && "blocked" in b &&
        Array.isArray(b.planning) && Array.isArray(b.done)
      ) {
        ok("Board endpoint");
      } else {
        nok("Board endpoint", JSON.stringify(b).slice(0, 500));
      }
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); nok("Board endpoint", msg); }

    // 3. Tasks list
    console.log("3. GET /api/tasks");
    try {
      const t = await client.getTasks();
      const first = t.tasks?.[0];
      if (
        Array.isArray(t.tasks) &&
        typeof t.total === "number" &&
        typeof t.limit === "number" &&
        typeof t.offset === "number" &&
        typeof t.hasMore === "boolean" &&
        first && "title" in first && "status" in first && "priority" in first &&
        "_id" in first && "_creationTime" in first
      ) {
        ok("Tasks list");
      } else {
        nok("Tasks list", JSON.stringify(t).slice(0, 500));
      }
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); nok("Tasks list", msg); }

    // 4. Filter
    console.log("4. GET /api/tasks?status=done&limit=5");
    try {
      const t = await client.getTasks({ status: "done", limit: 5 });
      const allDone = t.tasks.every(task => task.status === "done");
      if (t.tasks.length <= 5 && allDone) {
        ok(`Filter status=done&limit=5 (got ${t.tasks.length})`);
      } else {
        nok("Filter", `Got ${t.tasks.length}, allDone=${allDone}`);
      }
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); nok("Filter status=done&limit=5", msg); }

    // 5. Agent filter
    console.log("5. GET /api/tasks?assignedAgent=forge");
    try {
      const t = await client.getTasks({ assignedAgent: "forge" });
      if (
        Array.isArray(t.tasks) &&
        typeof t.total === "number" &&
        (t.tasks.length === 0 || t.tasks.every(task => "title" in task && "status" in task && "_id" in task))
      ) {
        ok("Filter assignedAgent=forge");
      } else {
        nok("Filter assignedAgent=forge", JSON.stringify(t).slice(0, 500));
      }
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); nok("Filter assignedAgent=forge", msg); }

    // 6. Create
    console.log("6. POST /api/tasks");
    try {
      const r = await client.createTask({ title: "E2E Smoke Test Task", priority: "low", project: "agent-dashboard" });
      if (typeof r.id === "string" && r.id.length > 0) {
        createdIds.push(r.id);
        ok(`Create task (id=${r.id})`);
      } else {
        nok("Create task", `Unexpected response: ${JSON.stringify(r)}`);
      }
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); nok("Create task", msg); }

    const createdId = createdIds[0] || "";

    // 7. Get created
    console.log("7. GET /api/tasks/:id");
    if (createdId) {
      try {
        const t = await client.getTask(createdId);
        if (
          t.title === "E2E Smoke Test Task" &&
          t.priority === "low" &&
          typeof t._id === "string" &&
          typeof t.status === "string" &&
          typeof t._creationTime === "number" &&
          typeof t.createdBy === "string"
        ) {
          ok("Get created task");
        } else {
          nok("Get created task", JSON.stringify(t).slice(0, 500));
        }
      } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); nok("Get created task", msg); }
    } else { nok("Get created task", "No ID"); }

    // 8. Update
    console.log("8. PATCH /api/tasks/:id");
    if (createdId) {
      try {
        const r = await client.updateTask(createdId, { status: "ready" });
        if (r.success === true) {
          ok("Update task status");
        } else {
          nok("Update task status", JSON.stringify(r));
        }
      } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); nok("Update task status", msg); }
    } else { nok("Update task status", "No ID"); }

    // 9. Verify update
    console.log("9. GET /api/tasks/:id (verify)");
    if (createdId) {
      try {
        const t = await client.getTask(createdId);
        if (t.status === "ready" && t.title === "E2E Smoke Test Task") {
          ok("Verify update persisted");
        } else {
          nok("Verify update persisted", `status=${t.status}, title=${t.title}`);
        }
      } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); nok("Verify update persisted", msg); }
    } else { nok("Verify update persisted", "No ID"); }

    // 10. Workload
    console.log("10. GET /api/workload");
    try {
      const w = await client.getWorkload();
      const entries = Object.entries(w);
      if (
        typeof w === "object" && w !== null &&
        entries.length > 0 &&
        entries.every(([, v]) => typeof v.total === "number" && typeof v.byStatus === "object" && typeof v.byPriority === "object")
      ) {
        ok("Workload endpoint");
      } else {
        nok("Workload endpoint", JSON.stringify(w).slice(0, 500));
      }
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); nok("Workload endpoint", msg); }

    // 11. CORS
    console.log("11. CORS check");
    try {
      const res = await fetch(`${BASE}/api/health`, { headers: { Origin: "http://localhost:3000" } });
      res.headers.get("access-control-allow-origin") ? ok("CORS headers present") : nok("CORS headers", "No ACAO header");
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); nok("CORS headers", msg); }

    // 12. Error cases
    console.log("12a. GET /api/tasks/invalid-id");
    try {
      await client.getTask("invalid-id");
      nok("Invalid ID", "Expected error, got success");
    } catch (e: unknown) {
      if (e instanceof ApiError && (e.status === 400 || e.status === 404) && typeof e.message === "string" && e.message.length > 0) {
        ok(`Invalid ID returns ${e.status}`);
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        nok("Invalid ID", msg);
      }
    }

    console.log("12b. POST /api/tasks (missing title)");
    try {
      await client.createTask({ title: "", priority: "low", project: "x" });
      nok("Missing title", "Expected error");
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 400 && typeof e.message === "string" && /title/i.test(e.message)) {
        ok("Missing title returns 400 with title-related error");
      } else {
        const msg = e instanceof ApiError ? `${e.status}: ${e.message}` : (e instanceof Error ? e.message : String(e));
        nok("Missing title", msg);
      }
    }

    console.log("12c. PATCH nonexistent");
    try {
      await client.updateTask("nonexistent-id-12345", { status: "ready" });
      nok("Nonexistent PATCH", "Expected error");
    } catch (e: unknown) {
      if (e instanceof ApiError && (e.status === 400 || e.status === 404) && typeof e.message === "string" && e.message.length > 0) {
        ok(`Nonexistent PATCH returns ${e.status}`);
      } else {
        const msg = e instanceof ApiError ? `${e.status}: ${e.message}` : (e instanceof Error ? e.message : String(e));
        nok("Nonexistent PATCH", msg);
      }
    }
  } finally {
    await cleanup();
  }

  // Summary
  console.log(`\n=== SUMMARY ===\nPassed: ${pass} / ${total}\nFailed: ${fail} / ${total}`);
  if (failures.length) { console.log("Failures:"); failures.forEach(f => console.log(`  - ${f}`)); }
  process.exit(fail > 0 ? 1 : 0);
}

run();
