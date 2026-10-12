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

./target/debug/logisticqu-backend > /tmp/enterprise_test.log 2>&1 &
BACKEND_PID=$!
cleanup() {
    kill $BACKEND_PID || true
}
trap cleanup EXIT
sleep 2

echo "========================================================"
echo "TEST 1: Password Policy Enforcement (Phase 4)"
echo "========================================================"
SA_LOGIN=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"password123"}')
SA_TOKEN=$(echo "$SA_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Attempt weak password (less than 8 chars)
WEAK_RES=$(curl -s -X POST http://127.0.0.1:8080/api/v1/users \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"weak_user","password":"123","full_name":"Weak User","role_id":"CONTAINER_ADMIN_HE","warehouse_ids":["WH-CONT-HE"]}')
echo "Weak password rejection: $WEAK_RES"
if echo "$WEAK_RES" | grep -q "Kebijakan Password: Minimal 8 karakter"; then
    echo ">>> Password policy length check PASSED! <<<"
else
    echo "FAILED: Weak password was not rejected"
    exit 1
fi

# Attempt password without digit
NO_DIGIT_RES=$(curl -s -X POST http://127.0.0.1:8080/api/v1/users \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"weak_user2","password":"onlyletters","full_name":"Weak User 2","role_id":"CONTAINER_ADMIN_HE","warehouse_ids":["WH-CONT-HE"]}')
echo "No-digit password rejection: $NO_DIGIT_RES"
if echo "$NO_DIGIT_RES" | grep -q "Harus mengombinasikan huruf dan angka"; then
    echo ">>> Password policy complexity check PASSED! <<<"
else
    echo "FAILED: Password without digit was not rejected"
    exit 1
fi

# Create valid user
UNIQUE_USER="ops_$(date +%s)"
VALID_RES=$(curl -s -X POST http://127.0.0.1:8080/api/v1/users \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$UNIQUE_USER\",\"password\":\"SecurePass123\",\"full_name\":\"Test Ops\",\"role_id\":\"CONTAINER_ADMIN_HE\",\"warehouse_ids\":[\"WH-CONT-HE\"]}")
echo "Valid user created: $VALID_RES"
NEW_USER_ID=$(echo "$VALID_RES" | grep -o '"user_id":"[^"]*' | cut -d'"' -f4)

echo ""
echo "========================================================"
echo "TEST 2: Refresh Token Rotation & Session Management (Phase 4)"
echo "========================================================"
USER_LOGIN=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$UNIQUE_USER\",\"password\":\"SecurePass123\"}")
REFRESH_TOKEN=$(echo "$USER_LOGIN" | grep -o '"refresh_token":"[^"]*' | cut -d'"' -f4)
ACCESS_TOKEN=$(echo "$USER_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Initial refresh token: ${REFRESH_TOKEN:0:15}..."

# Rotate token
REFRESH_RES=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}")
NEW_REFRESH=$(echo "$REFRESH_RES" | grep -o '"refresh_token":"[^"]*' | cut -d'"' -f4)
echo "Rotated refresh token: ${NEW_REFRESH:0:15}..."

if [ "$REFRESH_TOKEN" != "$NEW_REFRESH" ] && [ -n "$NEW_REFRESH" ]; then
    echo ">>> Refresh token rotation PASSED! <<<"
else
    echo "FAILED: Token was not rotated"
    exit 1
fi

# Old token must now be rejected (revoked)
OLD_TRY=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}")
echo "Replay old token response: $OLD_TRY"
if echo "$OLD_TRY" | grep -q "tidak valid"; then
    echo ">>> Old token revocation on rotation PASSED! <<<"
else
    echo "FAILED: Old token was not revoked"
    exit 1
fi

# Active sessions check
SESSIONS_RES=$(curl -s http://127.0.0.1:8080/api/v1/auth/sessions \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "Sessions: $SESSIONS_RES"

echo ""
echo "========================================================"
echo "TEST 3: Brute Force Failed Login Protection (Phase 4)"
echo "========================================================"
for i in {1..5}; do
    curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"$UNIQUE_USER\",\"password\":\"wrongpassword\"}" > /dev/null
done

# 6th attempt must be locked
LOCKED_RES=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$UNIQUE_USER\",\"password\":\"SecurePass123\"}")
echo "Account locked response: $LOCKED_RES"
if echo "$LOCKED_RES" | grep -q "terkunci"; then
    echo ">>> Account lockout after 5 failed attempts PASSED! <<<"
else
    echo "FAILED: Account was not locked"
    exit 1
fi

echo ""
echo "========================================================"
echo "TEST 4: Soft Delete (Phase 3)"
echo "========================================================"
DEL_RES=$(curl -s -X DELETE http://127.0.0.1:8080/api/v1/users/$NEW_USER_ID \
  -H "Authorization: Bearer $SA_TOKEN")
echo "Delete user response: $DEL_RES"

# Verify deleted_at in DB
SOFT_DEL_CHECK=$(docker exec logisticqu-dev-db psql -U logisticqu -d logisticqu_dev -t -c \
  "SELECT deleted_at IS NOT NULL FROM users WHERE id = '$NEW_USER_ID'")
echo "Is soft deleted in DB: $SOFT_DEL_CHECK"
if echo "$SOFT_DEL_CHECK" | grep -q "t"; then
    echo ">>> Soft delete timestamp set in DB PASSED! <<<"
else
    echo "FAILED: deleted_at not set"
    exit 1
fi

echo ""
echo "========================================================"
echo "TEST 5: Inventory Transfer & Immutable Ledger (Phase 5)"
echo "========================================================"
TRANSFER_RES=$(curl -s -X POST http://127.0.0.1:8080/api/v1/inventory/transfer \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from_warehouse_id": "WH-CONT-HE",
    "to_warehouse_id": "WH-CONT-DT",
    "spare_part_id": "HOS-001",
    "qty": 2.0,
    "notes": "Emergency transfer for Pit Haul Truck"
  }')
echo "Stock transfer response: $TRANSFER_RES"
if echo "$TRANSFER_RES" | grep -q "TRF-"; then
    echo ">>> Stock transfer between warehouses PASSED! <<<"
else
    echo "FAILED: Stock transfer failed"
    exit 1
fi

echo ""
echo "========================================================"
echo "TEST 6: Inventory Write-Off (DAMAGE / LOST) (Phase 5)"
echo "========================================================"
WRITEOFF_RES=$(curl -s -X POST http://127.0.0.1:8080/api/v1/inventory/write-off \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "warehouse_id": "WH-CONT-HE",
    "spare_part_id": "HOS-001",
    "movement_type": "DAMAGE",
    "qty": 1.0,
    "notes": "Hose burst test failure during inspection"
  }')
echo "Write-off response: $WRITEOFF_RES"
if echo "$WRITEOFF_RES" | grep -q "DMG-"; then
    echo ">>> Stock write-off PASSED! <<<"
else
    echo "FAILED: Write-off failed"
    exit 1
fi

echo ""
echo "========================================================"
echo "TEST 7: Immutable Ledger Query (Phase 5)"
echo "========================================================"
LEDGER_RES=$(curl -s "http://127.0.0.1:8080/api/v1/inventory/ledger?warehouse_id=WH-CONT-HE&spare_part_id=HOS-001" \
  -H "Authorization: Bearer $SA_TOKEN")
echo "Ledger records found: $(echo "$LEDGER_RES" | grep -o '"movement_type":' | wc -l)"
if echo "$LEDGER_RES" | grep -q "TRANSFER" && echo "$LEDGER_RES" | grep -q "DAMAGE"; then
    echo ">>> Immutable ledger contains TRANSFER and DAMAGE entries PASSED! <<<"
else
    echo "FAILED: Immutable ledger missing entries"
    exit 1
fi

echo ""
echo "========================================================"
echo "TEST 8: Immutability DB Engine Enforcement (Phase 5)"
echo "========================================================"
MUTATION_TRY=$(docker exec logisticqu-dev-db psql -U logisticqu -d logisticqu_dev -c \
  "DELETE FROM stock_movements WHERE spare_part_id = 'HOS-001'" 2>&1 || true)
echo "DB Mutation attempt: $MUTATION_TRY"
if echo "$MUTATION_TRY" | grep -q "strictly immutable"; then
    echo ">>> PostgreSQL engine strictly blocks DELETE on stock_movements PASSED! <<<"
else
    echo "FAILED: Immutability trigger did not block DELETE"
    exit 1
fi

echo ""
echo "========================================================"
echo ">>> ALL ENTERPRISE REQUIREMENTS (PHASE 2-5) VERIFIED! <<<"
echo "========================================================"
