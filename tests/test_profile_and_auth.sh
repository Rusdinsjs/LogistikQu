#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Starting backend on port 8090..."
SERVER_PORT=8090 nohup "$PROJECT_ROOT/backend/target/debug/logisticqu-backend" > /tmp/logisticqu_test.log 2>&1 &
BACKEND_PID=$!

cleanup() {
  echo "Cleaning up backend PID $BACKEND_PID..."
  kill -9 $BACKEND_PID 2>/dev/null || true
}
trap cleanup EXIT

sleep 2

echo "== 1. Testing login =="
LOGIN_RES=$(curl -s -X POST http://127.0.0.1:8090/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"manager\", \"password\": \"password123\"}")

echo "Login Response: $LOGIN_RES"
TOKEN=$(python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" <<< "$LOGIN_RES")

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Error: Failed to obtain token"
  exit 1
fi

echo "== 2. Testing PUT /api/v1/auth/profile (Update phone and full_name) =="
UPDATE_RES=$(curl -s -X PUT http://127.0.0.1:8090/api/v1/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"full_name\": \"Bambang Irawan S.T.\", \"phone\": \"0811-9999-8888\"}")

echo "Update Response: $UPDATE_RES"
NEW_PHONE=$(python3 -c "import sys, json; print(json.load(sys.stdin)['phone'])" <<< "$UPDATE_RES")
NEW_NAME=$(python3 -c "import sys, json; print(json.load(sys.stdin)['full_name'])" <<< "$UPDATE_RES")

if [ "$NEW_PHONE" != "0811-9999-8888" ]; then
  echo "Error: Phone mismatch ($NEW_PHONE)"
  exit 1
fi

echo "== 3. Testing password change =="
PW_RES=$(curl -s -X PUT http://127.0.0.1:8090/api/v1/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"current_password\": \"password123\", \"new_password\": \"passwordnew123\"}")

echo "Password Change Response: $PW_RES"

echo "== 4. Testing login with new password =="
LOGIN_NEW=$(curl -s -X POST http://127.0.0.1:8090/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"manager\", \"password\": \"passwordnew123\"}")
TOKEN2=$(python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" <<< "$LOGIN_NEW")

if [ "$TOKEN2" = "null" ] || [ -z "$TOKEN2" ]; then
  echo "Error: Failed to login with new password"
  exit 1
fi
echo "Login with new password succeeded!"

echo "== 5. Restoring original password and profile for demo consistency =="
RESTORE_RES=$(curl -s -X PUT http://127.0.0.1:8090/api/v1/auth/profile \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d "{\"full_name\": \"Bambang Irawan (Manager Logistik)\", \"phone\": \"0811-4000-002\", \"current_password\": \"passwordnew123\", \"new_password\": \"password123\"}")

echo "Restore Response: $RESTORE_RES"

echo "== ALL TESTS PASSED SUCCESSFULLY! =="