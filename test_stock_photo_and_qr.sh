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
if curl --noproxy "*" -s http://127.0.0.1:8080/health | grep -q "OK"; then
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
        if curl --noproxy "*" -s http://127.0.0.1:8080/health | grep -q "OK"; then
            break
        fi
        sleep 0.5
    done
fi

echo "=== 1. LOGIN AS ADMIN CONTAINER HE ==="
LOGIN_RES=$(curl --noproxy "*" -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_cont_he","password":"password123"}')

TOKEN=$(echo "$LOGIN_RES" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
    echo "FAIL: Could not acquire JWT token"
    exit 1
fi
echo "SUCCESS: Token acquired."

echo "=== 2. VERIFY STOCK LIST CONTAINS PHOTO_URL AND QR_CODE ==="
STOCK_LIST=$(curl --noproxy "*" -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8080/api/v1/inventory/stock?warehouse_id=WH-CONT-HE")

echo "$STOCK_LIST" | grep -q "photo_url" || { echo "FAIL: photo_url not in stock list"; exit 1; }
echo "$STOCK_LIST" | grep -q "qr_code" || { echo "FAIL: qr_code not in stock list"; exit 1; }
echo "SUCCESS: Stock list includes photo_url and qr_code fields."

echo "=== 3. GET SINGLE STOCK DETAIL (WH-CONT-HE / FLT-001) ==="
DETAIL_RES=$(curl --noproxy "*" -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8080/api/v1/inventory/stock/WH-CONT-HE/FLT-001")

echo "$DETAIL_RES"
echo "$DETAIL_RES" | grep -q "FLT-001" || { echo "FAIL: FLT-001 not found in detail"; exit 1; }
echo "$DETAIL_RES" | grep -q "photo_url" || { echo "FAIL: photo_url not in detail"; exit 1; }
echo "$DETAIL_RES" | grep -q "QR-PART-FLT-001" || { echo "FAIL: qr_code not in detail"; exit 1; }
echo "SUCCESS: Stock detail returned correctly."

echo "=== 4. UPDATE STOCK PHOTO VIA API ==="
NEW_PHOTO="https://images.unsplash.com/photo-custom-filter-test.jpg"
UPDATE_RES=$(curl --noproxy "*" -s -X PUT http://127.0.0.1:8080/api/v1/inventory/stock/WH-CONT-HE/FLT-001/photo \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"photo_url\":\"$NEW_PHOTO\"}")

echo "$UPDATE_RES"
echo "$UPDATE_RES" | grep -q "Foto stok berhasil diperbarui" || { echo "FAIL: Photo update failed"; exit 1; }
echo "SUCCESS: Photo updated."

echo "=== 5. VERIFY PERSISTENCE OF UPDATED PHOTO ==="
VERIFY_RES=$(curl --noproxy "*" -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8080/api/v1/inventory/stock/WH-CONT-HE/FLT-001")

echo "$VERIFY_RES" | grep -q "$NEW_PHOTO" || { echo "FAIL: Updated photo did not persist"; exit 1; }
echo "SUCCESS: Updated photo persisted in database."

echo "=== 6. MASTER SPARE PARTS INCLUDES PHOTO AND QR ==="
MASTER_RES=$(curl --noproxy "*" -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:8080/api/v1/master/spare-parts")

echo "$MASTER_RES" | grep -q "photo_url" || { echo "FAIL: photo_url not in master parts"; exit 1; }
echo "$MASTER_RES" | grep -q "QR-PART-" || { echo "FAIL: qr_code not in master parts"; exit 1; }
echo "SUCCESS: Master parts includes photo_url and qr_code."

echo ""
echo "=========================================="
echo "ALL STOCK PHOTO & QR CODE TESTS PASSED 100%!"
echo "=========================================="
