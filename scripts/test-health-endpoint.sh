#!/bin/bash
#
# test-health-endpoint.sh
# Verifies the Convex HTTP health endpoint is accessible
#
# Usage:
#   ./scripts/test-health-endpoint.sh
#   ./scripts/test-health-endpoint.sh https://custom-deployment.convex.site
#

set -e

# Configuration
HEALTH_URL="${1:-https://curious-dolphin-134.convex.site/api/health}"
TIMEOUT=10
VERBOSE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Test health endpoint
test_health() {
  log_info "Testing health endpoint: $HEALTH_URL"
  
  # Make request with timeout
  http_code=$(curl -s -o /tmp/health_response.json -w "%{http_code}" --max-time $TIMEOUT "$HEALTH_URL" 2>/dev/null || echo "000")
  response=$(cat /tmp/health_response.json 2>/dev/null || echo "")
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Response Details:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "HTTP Status: $http_code"
  echo "Response Body:"
  echo "$response"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  
  # Check if HTTP actions are enabled
  if echo "$response" | grep -q "HTTP actions enabled"; then
    log_error "HTTP actions not enabled on this Convex deployment"
    echo ""
    echo "To enable HTTP actions:"
    echo "  1. Run: npx convex dev"
    echo "  2. Deploy functions: npx convex deploy"
    echo "  3. Verify on dashboard: npx convex dashboard"
    echo ""
    exit 2
  fi
  
  # Validate status code
  if [[ "$http_code" == "000" ]]; then
    log_error "Connection failed (timeout or network error)"
    exit 1
  elif [[ "$http_code" == "200" ]]; then
    log_info "✅ HTTP status: 200 OK"
  elif [[ "$http_code" == "404" ]]; then
    log_error "❌ HTTP status: 404 Not Found (endpoint doesn't exist)"
    exit 1
  elif [[ "$http_code" == "500" ]]; then
    log_error "❌ HTTP status: 500 Internal Server Error"
    exit 1
  else
    log_warn "⚠️  HTTP status: $http_code (unexpected)"
  fi
  
  # Validate response format (requires jq)
  if command -v jq &> /dev/null; then
    if echo "$response" | jq -e '.status == "ok"' > /dev/null 2>&1; then
      log_info "✅ Response format: Valid (status=ok)"
    else
      log_error "❌ Response format: Invalid (expected {\"status\":\"ok\"})"
      exit 1
    fi
  else
    log_warn "⚠️  jq not installed, skipping JSON validation"
  fi
  
  # Test CORS headers (verbose mode)
  if $VERBOSE; then
    echo ""
    log_info "Checking CORS headers..."
    
    cors_headers=$(curl -s -I "$HEALTH_URL" 2>/dev/null | grep -i "access-control" || echo "")
    
    if [[ -n "$cors_headers" ]]; then
      log_info "✅ CORS headers present:"
      echo "$cors_headers" | sed 's/^/    /'
    else
      log_warn "⚠️  No CORS headers found"
    fi
  fi
  
  # Test OPTIONS preflight
  echo ""
  log_info "Testing CORS preflight (OPTIONS)..."
  
  options_code=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$HEALTH_URL" 2>/dev/null || echo "000")
  
  if [[ "$options_code" == "204" ]]; then
    log_info "✅ OPTIONS preflight: 204 No Content"
  elif [[ "$options_code" == "200" ]]; then
    log_info "✅ OPTIONS preflight: 200 OK"
  else
    log_warn "⚠️  OPTIONS preflight: $options_code (expected 204)"
  fi
  
  # Measure response time
  echo ""
  log_info "Measuring response time..."
  
  response_time=$(curl -s -o /dev/null -w "%{time_total}" --max-time $TIMEOUT "$HEALTH_URL" 2>/dev/null || echo "0")
  response_time_ms=$(echo "$response_time * 1000" | bc)
  
  if (( $(echo "$response_time < 1.0" | bc -l) )); then
    log_info "✅ Response time: ${response_time_ms}ms (< 1s)"
  elif (( $(echo "$response_time < 5.0" | bc -l) )); then
    log_warn "⚠️  Response time: ${response_time_ms}ms (> 1s)"
  else
    log_error "❌ Response time: ${response_time_ms}ms (> 5s)"
  fi
  
  # Summary
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log_info "✅ Health check PASSED"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# Cleanup
cleanup() {
  rm -f /tmp/health_response.json
}

trap cleanup EXIT

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS] [URL]"
      echo ""
      echo "Options:"
      echo "  -v, --verbose    Show detailed output including CORS headers"
      echo "  -h, --help       Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0"
      echo "  $0 https://custom-deployment.convex.site/api/health"
      echo "  $0 -v"
      exit 0
      ;;
    *)
      HEALTH_URL="$1"
      shift
      ;;
  esac
done

# Run test
test_health
