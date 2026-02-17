#!/usr/bin/env bash
# E2E Smoke Test for Agent Dashboard REST API
# Usage: bash e2e/api-smoke-test.sh [BASE_URL]
set -euo pipefail

BASE="${1:-https://curious-dolphin-134.convex.site}"
PASS=0; FAIL=0; FAILURES=(); TOTAL=0
CREATED_ID=""

pass() { ((PASS++)); ((TOTAL++)); echo "  ✅ PASS: $1"; }
fail() { ((FAIL++)); ((TOTAL++)); FAILURES+=("$1"); echo "  ❌ FAIL: $1"; echo "     Detail: $2"; }

echo "=== E2E API Smoke Test ==="
echo "Base URL: $BASE"
echo ""

# 1. Health
echo "1. GET /api/health"
RESP=$(curl -sf "$BASE/api/health" 2>&1) || RESP=""
if echo "$RESP" | jq -e '.status == "ok"' &>/dev/null; then
  pass "Health check"
else
  fail "Health check" "Response: $RESP"
fi

# 2. Board
echo "2. GET /api/board"
RESP=$(curl -sf "$BASE/api/board" 2>&1) || RESP=""
if echo "$RESP" | jq -e '.meta.total > 0 and has("planning") and has("ready") and has("in_progress") and has("in_review") and has("done") and has("blocked")' &>/dev/null; then
  pass "Board endpoint"
else
  fail "Board endpoint" "Response: ${RESP:0:500}"
fi

# 3. Tasks list
echo "3. GET /api/tasks"
RESP=$(curl -sf "$BASE/api/tasks" 2>&1) || RESP=""
if echo "$RESP" | jq -e '.tasks[0] | has("title") and has("status") and has("priority")' &>/dev/null; then
  pass "Tasks list"
else
  fail "Tasks list" "Response: ${RESP:0:500}"
fi

# 4. Filter: status=done&limit=5
echo "4. GET /api/tasks?status=done&limit=5"
RESP=$(curl -sf "$BASE/api/tasks?status=done&limit=5" 2>&1) || RESP=""
COUNT=$(echo "$RESP" | jq '.tasks | length' 2>/dev/null || echo "-1")
if [ "$COUNT" -ge 0 ] && [ "$COUNT" -le 5 ]; then
  pass "Filter status=done&limit=5 (got $COUNT)"
else
  fail "Filter status=done&limit=5" "Count=$COUNT, Response: ${RESP:0:500}"
fi

# 5. Filter: assignedAgent=forge
echo "5. GET /api/tasks?assignedAgent=forge"
RESP=$(curl -sf "$BASE/api/tasks?assignedAgent=forge" 2>&1) || RESP=""
if echo "$RESP" | jq -e '.tasks' &>/dev/null; then
  pass "Filter assignedAgent=forge"
else
  fail "Filter assignedAgent=forge" "Response: ${RESP:0:500}"
fi

# 6. POST /api/tasks — create
echo "6. POST /api/tasks (create)"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"title":"E2E Smoke Test Task","priority":"low","project":"agent-dashboard"}')
HTTP=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
CREATED_ID=$(echo "$BODY" | jq -r '.id // empty' 2>/dev/null || true)
if [ -n "$CREATED_ID" ] && [ "$HTTP" -ge 200 ] && [ "$HTTP" -lt 300 ]; then
  pass "Create task (id=$CREATED_ID)"
else
  fail "Create task" "HTTP=$HTTP, Body: ${BODY:0:500}"
fi

# 7. GET /api/tasks/:id
echo "7. GET /api/tasks/$CREATED_ID"
if [ -n "$CREATED_ID" ]; then
  RESP=$(curl -sf "$BASE/api/tasks/$CREATED_ID" 2>&1) || RESP=""
  if echo "$RESP" | jq -e '.title == "E2E Smoke Test Task"' &>/dev/null; then
    pass "Get created task"
  else
    fail "Get created task" "Response: ${RESP:0:500}"
  fi
else
  fail "Get created task" "No ID from create step"
fi

# 8. PATCH /api/tasks/:id
echo "8. PATCH /api/tasks/$CREATED_ID (status=ready)"
if [ -n "$CREATED_ID" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE/api/tasks/$CREATED_ID" \
    -H "Content-Type: application/json" \
    -d '{"status":"ready"}')
  HTTP=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
  if [ "$HTTP" -ge 200 ] && [ "$HTTP" -lt 300 ]; then
    pass "Update task status"
  else
    fail "Update task status" "HTTP=$HTTP, Body: ${BODY:0:500}"
  fi
else
  fail "Update task status" "No ID from create step"
fi

# 9. GET /api/tasks/:id — verify update
echo "9. GET /api/tasks/$CREATED_ID (verify update)"
if [ -n "$CREATED_ID" ]; then
  RESP=$(curl -sf "$BASE/api/tasks/$CREATED_ID" 2>&1) || RESP=""
  if echo "$RESP" | jq -e '.status == "ready"' &>/dev/null; then
    pass "Verify update persisted"
  else
    fail "Verify update persisted" "Response: ${RESP:0:500}"
  fi
else
  fail "Verify update persisted" "No ID from create step"
fi

# 10. Workload
echo "10. GET /api/workload"
RESP=$(curl -sf "$BASE/api/workload" 2>&1) || RESP=""
if echo "$RESP" | jq -e 'type == "object"' &>/dev/null; then
  pass "Workload endpoint"
else
  fail "Workload endpoint" "Response: ${RESP:0:500}"
fi

# 11. CORS
echo "11. CORS check"
RESP=$(curl -sI -H "Origin: http://localhost:3000" "$BASE/api/health" 2>&1)
if echo "$RESP" | grep -qi "access-control-allow-origin"; then
  pass "CORS headers present"
else
  fail "CORS headers" "Headers: ${RESP:0:500}"
fi

# 12. Error cases
echo "12a. GET /api/tasks/invalid-id"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/tasks/invalid-id")
if [ "$HTTP" -eq 400 ] || [ "$HTTP" -eq 404 ]; then
  pass "Invalid ID returns $HTTP"
else
  fail "Invalid ID" "Expected 400/404, got $HTTP"
fi

echo "12b. POST /api/tasks (missing title)"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/tasks" \
  -H "Content-Type: application/json" -d '{"priority":"low"}')
if [ "$HTTP" -eq 400 ]; then
  pass "Missing title returns 400"
else
  fail "Missing title" "Expected 400, got $HTTP"
fi

echo "12c. PATCH /api/tasks/nonexistent"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/tasks/nonexistent-id-12345" \
  -H "Content-Type: application/json" -d '{"status":"ready"}')
if [ "$HTTP" -eq 404 ]; then
  pass "Nonexistent PATCH returns 404"
else
  fail "Nonexistent PATCH" "Expected 404, got $HTTP"
fi

# Summary
echo ""
echo "=== SUMMARY ==="
echo "Passed: $PASS / $TOTAL"
echo "Failed: $FAIL / $TOTAL"
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo "Failures:"
  for f in "${FAILURES[@]}"; do echo "  - $f"; done
fi
