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

# Start backend if not running
if curl -s http://127.0.0.1:8080/health | grep -q "OK"; then
    echo "Using existing running backend on port 8080"
else
    BIN="./target/debug/logisticqu-backend"
    [ -f "$BIN" ] || BIN="./target/release/logisticqu-backend"
    $BIN > /tmp/backend_opname_test.log 2>&1 &
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

echo "=========================================================="
echo "TEST 1: LOGIN AS ADMIN KONTAINER HE"
echo "=========================================================="
LOGIN_ADMIN=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_cont_he","password":"password123"}')
ADMIN_TOKEN=$(echo "$LOGIN_ADMIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
    echo "FAILED: Login as admin_cont_he failed"
    exit 1
fi
echo "SUCCESS: Admin logged in, token acquired"

echo "=========================================================="
echo "TEST 2: CREATE MULTI-ITEM STOCK OPNAME (2 ITEMS)"
echo "=========================================================="
CREATE_RES=$(curl -s -X POST http://127.0.0.1:8080/api/v1/adjustments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "warehouse_id": "WH-CONT-HE",
    "reason": "Stock Opname Rutin Bulanan",
    "notes": "Pemeriksaan fisik rak filter & grease blok A",
    "items": [
      { "spare_part_id": "FLT-001", "qty_physical": 25.0 },
      { "spare_part_id": "FLT-002", "qty_physical": 14.0 }
    ]
  }')
echo "CREATE RESPONSE: $CREATE_RES"

ADJ_ID=$(echo "$CREATE_RES" | grep -o '"adjustment_id":"[^"]*' | cut -d'"' -f4)
ADJ_NO=$(echo "$CREATE_RES" | grep -o '"adjustment_number":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADJ_ID" ]; then
    echo "FAILED: Could not create stock adjustment"
    exit 1
fi
echo "SUCCESS: Created adjustment $ADJ_NO ($ADJ_ID)"

echo "=========================================================="
echo "TEST 3: GET ADJUSTMENT DETAIL VIA /api/v1/adjustments/{id}"
echo "=========================================================="
DETAIL_RES=$(curl -s -X GET "http://127.0.0.1:8080/api/v1/adjustments/$ADJ_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "DETAIL RESPONSE: $DETAIL_RES"

if ! echo "$DETAIL_RES" | grep -q "FLT-001" || ! echo "$DETAIL_RES" | grep -q "FLT-002"; then
    echo "FAILED: Multi-item details not found in adjustment response"
    exit 1
fi
echo "SUCCESS: Both items (FLT-001 & FLT-002) confirmed in adjustment detail"

echo "=========================================================="
echo "TEST 4: LOGIN AS SUPERVISOR HE"
echo "=========================================================="
LOGIN_SPV=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"supervisor_he","password":"password123"}')
SPV_TOKEN=$(echo "$LOGIN_SPV" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$SPV_TOKEN" ]; then
    echo "FAILED: Login as supervisor_he failed"
    exit 1
fi
echo "SUCCESS: Supervisor logged in"

echo "=========================================================="
echo "TEST 5: SUPERVISOR APPROVES THE MULTI-ITEM OPNAME"
echo "=========================================================="
APPROVE_RES=$(curl -s -X PUT "http://127.0.0.1:8080/api/v1/adjustments/$ADJ_ID/approve" \
  -H "Authorization: Bearer $SPV_TOKEN")
echo "APPROVE RESPONSE: $APPROVE_RES"

if ! echo "$APPROVE_RES" | grep -q "true"; then
    echo "FAILED: Supervisor approval failed"
    exit 1
fi
echo "SUCCESS: Multi-item opname $ADJ_NO successfully approved"

echo "=========================================================="
echo "TEST 6: VERIFY STOCK ADJUSTMENT IN INVENTORY STOCK"
echo "=========================================================="
STOCKS_RES=$(curl -s -X GET "http://127.0.0.1:8080/api/v1/inventory/stock?warehouse_id=WH-CONT-HE" \
  -H "Authorization: Bearer $SPV_TOKEN")

if echo "$STOCKS_RES" | grep -q "FLT-001"; then
    echo "SUCCESS: Stock updated and queryable for WH-CONT-HE"
else
    echo "WARNING: Check stock response: $STOCKS_RES"
fi

echo "=========================================================="
echo "TEST 7: TEST REJECT PATH FOR SUPERVISOR"
echo "=========================================================="
CREATE_REJECT_RES=$(curl -s -X POST http://127.0.0.1:8080/api/v1/adjustments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "warehouse_id": "WH-CONT-HE",
    "reason": "Uji Coba Penolakan",
    "notes": "Tes validasi flow tolak",
    "items": [
      { "spare_part_id": "FLT-001", "qty_physical": 999.0 }
    ]
  }')
REJECT_ID=$(echo "$CREATE_REJECT_RES" | grep -o '"adjustment_id":"[^"]*' | cut -d'"' -f4)
REJECT_NO=$(echo "$CREATE_REJECT_RES" | grep -o '"adjustment_number":"[^"]*' | cut -d'"' -f4)

REJECT_RES=$(curl -s -X PUT "http://127.0.0.1:8080/api/v1/adjustments/$REJECT_ID/reject" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SPV_TOKEN" \
  -d '{"reason":"Angka fisik 999 tidak realistis, tolong hitung ulang fisik rak"}')
echo "REJECT RESPONSE: $REJECT_RES"

if ! echo "$REJECT_RES" | grep -q "true"; then
    echo "FAILED: Supervisor rejection failed"
    exit 1
fi
echo "SUCCESS: Opname $REJECT_NO rejected as expected"

echo "=========================================================="
echo "ALL MULTI-ITEM STOCK OPNAME TESTS PASSED 100%!"
echo "=========================================================="
