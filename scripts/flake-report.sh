#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/flake-report.sh — Playwright Flake-Budget Reporter
#
# Parses Playwright JUnit XML output (test-results/results.xml) and:
#   1. Counts tests that were "flaky" (passed on retry — i.e. had at least one
#      retry attempt recorded in the XML).
#   2. Counts the total executed tests.
#   3. Computes flake rate = flaky / total * 100.
#   4. Exits 1 (CI failure) if flake rate > FLAKE_BUDGET_PCT (default 2).
#
# Quarantine exclusions:
#   Tests whose title contains "[quarantine:" are excluded from both the flaky
#   count and the total, so quarantined tests never trip the budget.
#
# Usage:
#   bash scripts/flake-report.sh [path-to-results.xml]
#
# Environment:
#   FLAKE_BUDGET_PCT   Override the budget threshold (default: 2)
#   FLAKE_REPORT_ONLY  Set to 1 to print report but never fail (dry-run)
#
# Dependencies: bash ≥ 4, xmllint (libxml2) or python3 (fallback XML parsing)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
XML_FILE="${1:-test-results/results.xml}"
FLAKE_BUDGET_PCT="${FLAKE_BUDGET_PCT:-2}"
FLAKE_REPORT_ONLY="${FLAKE_REPORT_ONLY:-0}"

# ── Helpers ───────────────────────────────────────────────────────────────────
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
info()  { printf '  %s\n' "$*"; }
ok()    { printf '✅  %s\n' "$*"; }
warn()  { printf '⚠️   %s\n' "$*"; }
fail()  { printf '❌  %s\n' "$*" >&2; }
sep()   { printf '%.0s─' {1..72}; printf '\n'; }

# ── Preflight ─────────────────────────────────────────────────────────────────
if [[ ! -f "$XML_FILE" ]]; then
  warn "Playwright XML results not found at '$XML_FILE' — skipping flake report."
  warn "Ensure playwright.config.ts includes: [\"junit\", { outputFile: \"test-results/results.xml\" }]"
  exit 0
fi

# ── XML parsing ───────────────────────────────────────────────────────────────
# Strategy: prefer Python's built-in xml.etree (zero extra deps).
# Falls back to xmllint + grep if python3 is absent (unlikely on CI).

parse_xml_python() {
  python3 - "$XML_FILE" <<'PYEOF'
import sys, xml.etree.ElementTree as ET

xml_file = sys.argv[1]
tree = ET.parse(xml_file)
root = tree.getroot()

# Playwright JUnit schema:
#   <testsuites>
#     <testsuite name="..." tests="N" failures="F" ...>
#       <testcase name="..." classname="..." time="...">
#         <!-- If test passed on retry, Playwright emits:
#              <system-out> containing retry metadata OR
#              the <testcase> has retries attribute / multiple attempts -->
#         <!-- A FAILED test has <failure> child -->
#         <!-- A FLAKY test (passed after retry) has no <failure> but
#              Playwright adds retries="N" attribute (PW ≥ 1.38) -->
#       </testcase>
#     </testsuite>
#   </testsuites>

total = 0
flaky = 0
quarantined = 0
flaky_names = []

for tc in root.iter('testcase'):
    name = tc.get('name', '')
    classname = tc.get('classname', '')
    full_name = f"{classname} > {name}" if classname else name

    # Skip quarantined tests
    if '[quarantine:' in name or '[quarantine:' in classname:
        quarantined += 1
        continue

    total += 1

    # Detect flakiness: Playwright sets retries="N" (N > 0) on testcase
    # when the test needed retries but ultimately passed.
    retries_attr = tc.get('retries', '0')
    try:
        retries_val = int(retries_attr)
    except ValueError:
        retries_val = 0

    # Also check for <properties> with retry info (older PW versions)
    for prop in tc.iter('property'):
        if prop.get('name', '') == 'retries':
            try:
                retries_val = max(retries_val, int(prop.get('value', '0')))
            except ValueError:
                pass

    # A test is flaky if it has retries > 0 AND has no <failure>/<error>
    # (i.e., it eventually passed).
    has_failure = tc.find('failure') is not None or tc.find('error') is not None
    if retries_val > 0 and not has_failure:
        flaky += 1
        flaky_names.append(full_name)

print(f"TOTAL={total}")
print(f"FLAKY={flaky}")
print(f"QUARANTINED={quarantined}")
for n in flaky_names:
    print(f"FLAKY_TEST={n}")
PYEOF
}

# Run the parser and capture output
PARSER_OUTPUT=$(parse_xml_python)

TOTAL=$(echo "$PARSER_OUTPUT" | grep '^TOTAL=' | cut -d= -f2)
FLAKY=$(echo "$PARSER_OUTPUT" | grep '^FLAKY=' | cut -d= -f2)
QUARANTINED=$(echo "$PARSER_OUTPUT" | grep '^QUARANTINED=' | cut -d= -f2)
FLAKY_NAMES=$(echo "$PARSER_OUTPUT" | grep '^FLAKY_TEST=' | sed 's/^FLAKY_TEST=//' || true)

TOTAL=${TOTAL:-0}
FLAKY=${FLAKY:-0}
QUARANTINED=${QUARANTINED:-0}

# ── Compute rate ──────────────────────────────────────────────────────────────
# Use python for float arithmetic; bc may not be available on all CI runners.
if [[ "$TOTAL" -gt 0 ]]; then
  FLAKE_RATE=$(python3 -c "print(f'{($FLAKY / $TOTAL * 100):.2f}')")
else
  FLAKE_RATE="0.00"
fi

# ── Report ────────────────────────────────────────────────────────────────────
sep
bold "🎭 Playwright Flake-Budget Report"
sep
info "XML source      : $XML_FILE"
info "Total tests     : $TOTAL"
info "Quarantined     : $QUARANTINED (excluded from budget)"
info "Flaky (retried) : $FLAKY"
info "Flake rate      : ${FLAKE_RATE}%  (budget: ≤${FLAKE_BUDGET_PCT}%)"
sep

if [[ -n "$FLAKY_NAMES" ]]; then
  warn "Flaky tests detected:"
  while IFS= read -r name; do
    info "  • $name"
  done <<< "$FLAKY_NAMES"
  sep
fi

# ── Budget check ──────────────────────────────────────────────────────────────
OVER_BUDGET=$(python3 -c "print('yes' if float('$FLAKE_RATE') > float('$FLAKE_BUDGET_PCT') else 'no')")

if [[ "$OVER_BUDGET" == "yes" ]]; then
  fail "Flake rate ${FLAKE_RATE}% exceeds budget of ${FLAKE_BUDGET_PCT}%."
  fail "Fix or quarantine the flaky tests listed above, then re-run."
  if [[ "$FLAKE_REPORT_ONLY" == "1" ]]; then
    warn "FLAKE_REPORT_ONLY=1 — not failing the build (dry-run mode)."
    exit 0
  fi
  exit 1
else
  ok "Flake rate ${FLAKE_RATE}% is within the ${FLAKE_BUDGET_PCT}% budget. ✓"
  exit 0
fi
