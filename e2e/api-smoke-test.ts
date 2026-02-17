#!/usr/bin/env npx tsx
/**
 * E2E Smoke Test — TypeScript version
 * Usage: npx tsx e2e/api-smoke-test.ts [BASE_URL]
 */
import { createApiClient, ApiError } from "../docs/examples/api-client.js";

const BASE = process.argv[2] || "https://curious-dolphin-134.convex.site";
const client = createApiClient(BASE);

let pass = 0, fail = 0, total = 0;
const failures: string[] = [];
let createdId = "";

function ok(name: string) { pass++; total++; console.log(`  ✅ PASS: ${name}`); }
function nok(name: string, detail: string) { fail++; total++; failures.push(name); console.log(`  ❌ FAIL: ${name}\n     Detail: ${detail}`); }

async function run() {
  console.log(`=== E2E API Smoke Test (TS) ===\nBase URL: ${BASE}\n`);

  // 1. Health
  console.log("1. GET /api/health");
  try {
    const h = await client.health();
    h.status === "ok" ? ok("Health check") : nok("Health check", JSON.stringify(h));
  } catch (e: any) { nok("Health check", e.message); }

  // 2. Board
  console.log("2. GET /api/board");
  try {
    const b = await client.getBoard();
    (b.meta?.total > 0 && "planning" in b && "done" in b) ? ok("Board endpoint") : nok("Board endpoint", JSON.stringify(b).slice(0, 500));
  } catch (e: any) { nok("Board endpoint", e.message); }

  // 3. Tasks list
  console.log("3. GET /api/tasks");
  try {
    const t = await client.getTasks();
    const first = t.tasks?.[0];
    (first && "title" in first && "status" in first && "priority" in first) ? ok("Tasks list") : nok("Tasks list", JSON.stringify(t).slice(0, 500));
  } catch (e: any) { nok("Tasks list", e.message); }

  // 4. Filter
  console.log("4. GET /api/tasks?status=done&limit=5");
  try {
    const t = await client.getTasks({ status: "done", limit: 5 });
    t.tasks.length <= 5 ? ok(`Filter status=done&limit=5 (got ${t.tasks.length})`) : nok("Filter", `Got ${t.tasks.length}`);
  } catch (e: any) { nok("Filter status=done&limit=5", e.message); }

  // 5. Agent filter
  console.log("5. GET /api/tasks?assignedAgent=forge");
  try {
    const t = await client.getTasks({ assignedAgent: "forge" });
    ok("Filter assignedAgent=forge");
  } catch (e: any) { nok("Filter assignedAgent=forge", e.message); }

  // 6. Create
  console.log("6. POST /api/tasks");
  try {
    const r = await client.createTask({ title: "E2E Smoke Test Task", priority: "low", project: "agent-dashboard" });
    createdId = r.id;
    ok(`Create task (id=${createdId})`);
  } catch (e: any) { nok("Create task", e.message); }

  // 7. Get created
  console.log("7. GET /api/tasks/:id");
  if (createdId) {
    try {
      const t = await client.getTask(createdId);
      t.title === "E2E Smoke Test Task" ? ok("Get created task") : nok("Get created task", JSON.stringify(t).slice(0, 500));
    } catch (e: any) { nok("Get created task", e.message); }
  } else { nok("Get created task", "No ID"); }

  // 8. Update
  console.log("8. PATCH /api/tasks/:id");
  if (createdId) {
    try {
      await client.updateTask(createdId, { status: "ready" });
      ok("Update task status");
    } catch (e: any) { nok("Update task status", e.message); }
  } else { nok("Update task status", "No ID"); }

  // 9. Verify update
  console.log("9. GET /api/tasks/:id (verify)");
  if (createdId) {
    try {
      const t = await client.getTask(createdId);
      t.status === "ready" ? ok("Verify update persisted") : nok("Verify update persisted", `status=${t.status}`);
    } catch (e: any) { nok("Verify update persisted", e.message); }
  } else { nok("Verify update persisted", "No ID"); }

  // 10. Workload
  console.log("10. GET /api/workload");
  try {
    const w = await client.getWorkload();
    typeof w === "object" ? ok("Workload endpoint") : nok("Workload endpoint", typeof w);
  } catch (e: any) { nok("Workload endpoint", e.message); }

  // 11. CORS
  console.log("11. CORS check");
  try {
    const res = await fetch(`${BASE}/api/health`, { headers: { Origin: "http://localhost:3000" } });
    res.headers.get("access-control-allow-origin") ? ok("CORS headers present") : nok("CORS headers", "No ACAO header");
  } catch (e: any) { nok("CORS headers", e.message); }

  // 12. Error cases
  console.log("12a. GET /api/tasks/invalid-id");
  try {
    await client.getTask("invalid-id");
    nok("Invalid ID", "Expected error, got success");
  } catch (e: any) {
    (e instanceof ApiError && (e.status === 400 || e.status === 404)) ? ok(`Invalid ID returns ${e.status}`) : nok("Invalid ID", e.message);
  }

  console.log("12b. POST /api/tasks (missing title)");
  try {
    await client.createTask({ title: "", priority: "low", project: "x" });
    nok("Missing title", "Expected error");
  } catch (e: any) {
    (e instanceof ApiError && e.status === 400) ? ok("Missing title returns 400") : nok("Missing title", `${e.status}: ${e.message}`);
  }

  console.log("12c. PATCH nonexistent");
  try {
    await client.updateTask("nonexistent-id-12345", { status: "ready" });
    nok("Nonexistent PATCH", "Expected error");
  } catch (e: any) {
    (e instanceof ApiError && (e.status === 400 || e.status === 404)) ? ok(`Nonexistent PATCH returns ${e.status}`) : nok("Nonexistent PATCH", `${e.status}: ${e.message}`);
  }

  // Summary
  console.log(`\n=== SUMMARY ===\nPassed: ${pass} / ${total}\nFailed: ${fail} / ${total}`);
  if (failures.length) { console.log("Failures:"); failures.forEach(f => console.log(`  - ${f}`)); }
  process.exit(fail > 0 ? 1 : 0);
}

run();
