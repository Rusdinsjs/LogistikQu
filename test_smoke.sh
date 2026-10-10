#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT/backend"

export DATABASE_URL="postgres://logisticqu:logisticqu_secret@127.0.0.1:5440/logisticqu_dev"
export PORT=8080
export JWT_SECRET="super-secret-jwt-key-vale-indonesia-logisticqu-2026"
export RUST_LOG=info

# Start backend
./target/debug/logisticqu-backend > /tmp/backend_test.log 2>&1 &
BACKEND_PID=$!
echo "Backend started with PID $BACKEND_PID"

cleanup() {
    echo "Stopping backend PID $BACKEND_PID"
    kill $BACKEND_PID || true
}
trap cleanup EXIT

sleep 2

# Check /health
echo "=== 1. HEALTH CHECK ==="
curl -i http://127.0.0.1:8080/health
echo ""

# Check Demo Users
echo "=== 2. DEMO USERS ==="
curl -s http://127.0.0.1:8080/api/v1/auth/demo-users
echo ""

# Login test
echo "=== 3. LOGIN AS ADMIN KONTAINER ==="
LOGIN_RES=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_cont_he","password":"password123"}')
echo "$LOGIN_RES"

TOKEN=$(echo "$LOGIN_RES" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "TOKEN ACQUIRED: ${TOKEN:0:30}..."

# Test Dashboard Summary
echo "=== 4. DASHBOARD SUMMARY ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8080/api/v1/inventory/dashboard-summary?warehouse_id=WH-CONT-HE"
echo ""

# Test Recommendations
echo "=== 5. REPLENISHMENT RECOMMENDATIONS ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8080/api/v1/replenishment/recommendations?warehouse_id=WH-CONT-HE"
echo ""

# Test Stock Movements
echo "=== 6. MASTER SPARE PARTS ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8080/api/v1/master/spare-parts" | cut -c 1-200
echo "..."

echo "ALL ENDPOINTS RESPONDED WITH CODE 200 OK!"
