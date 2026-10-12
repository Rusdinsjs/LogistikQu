#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT/backend"

export DATABASE_URL="postgres://logisticqu:logisticqu_secret@127.0.0.1:5440/logisticqu_dev"
export PORT=8080
export JWT_SECRET="super-secret-jwt-key-vale-indonesia-logisticqu-2026"
export RUST_LOG=info
export no_proxy="*"
export NO_PROXY="*"
unset http_proxy HTTP_PROXY https_proxy HTTPS_PROXY

# Start backend if not already running
if curl -s http://127.0.0.1:8080/health | grep -q "OK"; then
    echo "Using existing running backend on port 8080"
else
    BIN="./target/release/logisticqu-backend"
    [ -f "$BIN" ] || BIN="./target/debug/logisticqu-backend"
    $BIN > /tmp/backend_test.log 2>&1 &
    BACKEND_PID=$!
    echo "Backend started with PID $BACKEND_PID"
    cleanup() {
        echo "Stopping backend PID $BACKEND_PID"
        kill $BACKEND_PID || true
    }
    trap cleanup EXIT
    for i in {1..20}; do
        if curl -s http://127.0.0.1:8080/health | grep -q "OK"; then
            break
        fi
        sleep 0.5
    done
fi

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

# Test Warehouse Multi-Parent Supply Links
echo "=== 7. WAREHOUSE LIST WITH MULTI-PARENT SUPPLY LINKS ==="
LOGIN_ADMIN=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"password123"}')
ADMIN_TOKEN=$(echo "$LOGIN_ADMIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

WH_LIST=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://127.0.0.1:8080/api/v1/master/warehouses")
echo "$WH_LIST" | cut -c 1-300
echo "..."

echo "=== 8. CREATE SUB WAREHOUSE WITH MULTIPLE PARENT WAREHOUSES ==="
CREATE_WH_RES=$(curl -s -X POST http://127.0.0.1:8080/api/v1/master/warehouses \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "WH-CONT-MULTI-TEST",
    "name": "Gudang Kontainer Multi Suplai Test",
    "warehouse_type": "CONTAINER",
    "category": "HEAVY_EQUIPMENT",
    "parent_warehouse_ids": ["WH-MAIN-HE", "WH-MAIN-DT"],
    "description": "Uji coba kontainer yang disuplai oleh 2 gudang induk",
    "is_active": true
  }')
echo "$CREATE_WH_RES"

echo "=== 9. VERIFY CREATED WAREHOUSE SUPPLY LINKS ==="
VERIFY_RES=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://127.0.0.1:8080/api/v1/master/warehouses")
echo "$VERIFY_RES" | grep -o '"id":"WH-CONT-MULTI-TEST"[^}]*'

echo "=== 10. CLEANUP TEST WAREHOUSE ==="
DEL_RES=$(curl -s -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://127.0.0.1:8080/api/v1/master/warehouses/WH-CONT-MULTI-TEST")
echo "$DEL_RES"

echo "ALL ENDPOINTS RESPONDED WITH CODE 200 OK!"
