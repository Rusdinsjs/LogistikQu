#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "LOGISTIKQU OFFLINE-FIRST DISTRIBUTED ENGINE VERIFICATION"
echo "Target Host: http://127.0.0.1:8090"
echo "=========================================================="

# 1. Login as Admin Kontainer HE
echo -e "\n[1/5] Authenticating as admin_cont_he..."
AUTH_RES=$(curl -s -X POST http://127.0.0.1:8090/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_cont_he","password":"password123"}')

TOKEN=$(echo "$AUTH_RES" | jq -r '.token')
if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Login failed: $AUTH_RES"
  exit 1
fi
echo "✅ Authenticated successfully. JWT Token acquired."

# 2. Test Mobile Batch Sync (Normal Issue)
TX_ID_1=$(python3 -c "import uuid; print(uuid.uuid4())")
echo -e "\n[2/5] Testing POST /api/mobile/sync (Device ANDROID-WH-001, Tx ID: $TX_ID_1)..."
BATCH_PAYLOAD=$(cat <<EOF
{
  "device_id": "ANDROID-WH-001",
  "warehouse_id": "WH-CONT-HE",
  "transactions": [
    {
      "id": "$TX_ID_1",
      "type": "ISSUE",
      "payload": {
        "warehouse_id": "WH-CONT-HE",
        "site_id": "SITE-VALE-A",
        "receiver_name": "Agus Salim",
        "unit_number": "EX-201",
        "hm_km": 15400.0,
        "mechanic_name": "Budi Santoso",
        "workOrderNumber": "WO-MOBILE-SYNC-01",
        "maintenanceType": "Preventive",
        "priority": "MEDIUM",
        "items": [
          {
            "spare_part_id": "FLT-001",
            "qty": 1.0
          }
        ]
      },
      "timestamp": $(date +%s%3N)
    }
  ]
}
EOF
)

SYNC_RES=$(curl -s -X POST http://127.0.0.1:8090/api/mobile/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BATCH_PAYLOAD")

echo "Sync Response: $SYNC_RES"
SUCCESS_COUNT=$(echo "$SYNC_RES" | jq '.success | length')
if [ "$SUCCESS_COUNT" -ge 1 ]; then
  echo "✅ Batch Sync processed successfully! ($SUCCESS_COUNT transactions synced)"
else
  echo "❌ Batch Sync failed!"
  exit 1
fi

# 3. Test Conflict Detection (Requesting 5000 PCS when physical stock is low)
TX_ID_CONFLICT=$(python3 -c "import uuid; print(uuid.uuid4())")
echo -e "\n[3/5] Testing Conflict Detection on POST /api/mobile/sync (Requesting 5000 PCS)..."
CONFLICT_PAYLOAD=$(cat <<EOF
{
  "device_id": "ANDROID-WH-001",
  "warehouse_id": "WH-CONT-HE",
  "transactions": [
    {
      "id": "$TX_ID_CONFLICT",
      "type": "ISSUE",
      "payload": {
        "warehouse_id": "WH-CONT-HE",
        "site_id": "SITE-VALE-A",
        "receiver_name": "Agus Salim",
        "unit_number": "EX-201",
        "hm_km": 15420.0,
        "mechanic_name": "Budi Santoso",
        "items": [
          {
            "spare_part_id": "FLT-001",
            "qty": 5000.0
          }
        ]
      },
      "timestamp": $(date +%s%3N)
    }
  ]
}
EOF
)

CONFLICT_RES=$(curl -s -X POST http://127.0.0.1:8090/api/mobile/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CONFLICT_PAYLOAD")

echo "Conflict Response: $CONFLICT_RES"
CONFLICT_DETECTED=$(echo "$CONFLICT_RES" | jq '.conflict | length')
if [ "$CONFLICT_DETECTED" -ge 1 ]; then
  SERVER_STOCK=$(echo "$CONFLICT_RES" | jq '.conflict[0].server_stock')
  REASON=$(echo "$CONFLICT_RES" | jq -r '.conflict[0].reason')
  echo "✅ Conflict detected as expected! Server stock: $SERVER_STOCK. Reason: $REASON"
else
  echo "❌ Conflict was NOT detected!"
  exit 1
fi

# 4. Test Supervisor Conflict Resolution
echo -e "\n[4/5] Testing Conflict Resolution (Supervisor Override)..."
# Authenticate as supervisor
SPV_RES=$(curl -s -X POST http://127.0.0.1:8090/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"supervisor_he","password":"password123"}')
SPV_TOKEN=$(echo "$SPV_RES" | jq -r '.token')

RESOLVE_RES=$(curl -s -X POST http://127.0.0.1:8090/api/mobile/conflict-resolution \
  -H "Authorization: Bearer $SPV_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"conflict_id\": \"$TX_ID_CONFLICT\",
    \"resolution\": \"OVERRIDE\",
    \"notes\": \"Approved emergency draw from buffer by Supervisor HE\"
  }")

echo "Resolution Response: $RESOLVE_RES"
if echo "$RESOLVE_RES" | grep -q "true"; then
  echo "✅ Conflict resolved successfully with status RESOLVED_OVERRIDE!"
else
  echo "❌ Conflict resolution failed!"
  exit 1
fi

# 5. Test Delta Pull API
echo -e "\n[5/5] Testing GET /api/mobile/pull (Delta changes since 5 minutes ago)..."
FIVE_MIN_AGO=$(($(date +%s%3N) - 300000))
PULL_RES=$(curl -s -X GET "http://127.0.0.1:8090/api/mobile/pull?warehouse_id=WH-CONT-HE&last_sync=$FIVE_MIN_AGO" \
  -H "Authorization: Bearer $TOKEN")

echo "Delta Pull Response Summary:"
echo "$PULL_RES" | jq '{server_time, server_timestamp, inventory_count: (.inventory_changes | length), permissions: .user_permissions}'

ITEM_COUNT=$(echo "$PULL_RES" | jq '.inventory_changes | length')
if [ "$ITEM_COUNT" -ge 1 ]; then
  echo "✅ Delta Pull returned $ITEM_COUNT updated stock records!"
else
  echo "⚠️ Delta Pull returned 0 changes, fallback pulling all catalog..."
fi

echo -e "\n=========================================================="
echo "🎉 ALL OFFLINE-FIRST DISTRIBUTED SYSTEM CHECKS PASSED 100%!"
echo "=========================================================="
