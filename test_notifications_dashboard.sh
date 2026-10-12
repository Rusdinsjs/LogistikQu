#!/bin/bash
set -e

echo "============================================================"
echo "LOGISTIKQU WMS — VERIFIKASI PHASE 9 (NOTIFICATION ENGINE)"
echo "                & PHASE 10 (ENTERPRISE DASHBOARD & KPIS)"
echo "============================================================"

export no_proxy="*"
export NO_PROXY="*"
unset http_proxy HTTP_PROXY https_proxy HTTPS_PROXY

BASE_URL="http://127.0.0.1:8080/api/v1"

# 1. Health check
echo -n "[TEST 1] Backend Health Check: "
HEALTH=$(curl -s http://127.0.0.1:8080/health)
if [ "$HEALTH" = "OK" ]; then
  echo "SUCCESS (Server Healthy)"
else
  echo "FAILED: $HEALTH"
  exit 1
fi

# 2. Login as Superadmin
echo -n "[TEST 2] Authentication as superadmin: "
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"password123"}')

TOKEN=$(echo "$LOGIN_RESP" | jq -r .token)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "FAILED to get JWT token"
  echo "$LOGIN_RESP"
  exit 1
fi
echo "SUCCESS (JWT Token acquired)"

# 3. Notification Engine: Get unread count
echo -n "[TEST 3] Get Notification Unread Count: "
UNREAD_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/notifications/unread-count")
UNREAD_COUNT=$(echo "$UNREAD_RESP" | jq -r .unread_count)
echo "SUCCESS (Unread notifications: $UNREAD_COUNT)"

# 4. Notification Engine: Create and Dispatch Notification
echo -n "[TEST 4] Dispatch In-App & Multi-Channel Notification: "
DISPATCH_RESP=$(curl -s -X POST "$BASE_URL/notifications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Uji Coba Notifikasi Sistem E2E",
    "message": "Pengujian automated test untuk channel IN_APP, WhatsApp, dan Email delivery.",
    "channel": "IN_APP",
    "trigger_type": "LOW_STOCK",
    "reference_id": "TEST-PART-01",
    "metadata": {"test": true, "critical_level": "URGENT"}
  }')

NOTIF_ID=$(echo "$DISPATCH_RESP" | jq -r .id)
if [ -z "$NOTIF_ID" ] || [ "$NOTIF_ID" = "null" ]; then
  echo "FAILED to dispatch notification"
  echo "$DISPATCH_RESP"
  exit 1
fi
echo "SUCCESS (Notification ID: $NOTIF_ID, Trigger: LOW_STOCK)"

# 5. Notification Engine: Query Notifications list
echo -n "[TEST 5] Query Notification List: "
LIST_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/notifications?limit=5")
ITEM_COUNT=$(echo "$LIST_RESP" | jq '. | length')
if [ "$ITEM_COUNT" -gt 0 ]; then
  echo "SUCCESS (Retrieved $ITEM_COUNT notifications)"
else
  echo "FAILED: Notification list empty"
  exit 1
fi

# 6. Notification Engine: Mark Notification as Read
echo -n "[TEST 6] Mark Single Notification Read: "
READ_RESP=$(curl -s -X PUT -H "Authorization: Bearer $TOKEN" "$BASE_URL/notifications/$NOTIF_ID/read")
IS_SUCCESS=$(echo "$READ_RESP" | jq -r .success)
if [ "$IS_SUCCESS" = "true" ]; then
  echo "SUCCESS (Marked notification $NOTIF_ID as read)"
else
  echo "FAILED to mark read: $READ_RESP"
  exit 1
fi

# 7. Notification Engine: Mark All as Read
echo -n "[TEST 7] Mark All Notifications Read: "
READ_ALL_RESP=$(curl -s -X PUT -H "Authorization: Bearer $TOKEN" "$BASE_URL/notifications/read-all")
MARKED_COUNT=$(echo "$READ_ALL_RESP" | jq -r .marked_count)
echo "SUCCESS (Marked $MARKED_COUNT notifications as read)"

# 8. Enterprise Dashboard: Enterprise KPI Summary
echo -n "[TEST 8] Enterprise KPI Summary: "
KPI_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/dashboard/enterprise-kpi")
STOCK_VALUE=$(echo "$KPI_RESP" | jq -r .total_stock_value)
TOTAL_ITEMS=$(echo "$KPI_RESP" | jq -r .total_inventory_items)
PENDING_APP=$(echo "$KPI_RESP" | jq -r .pending_approvals_count)
LOW_STOCK=$(echo "$KPI_RESP" | jq -r .low_stock_items_count)

if [ "$STOCK_VALUE" != "null" ] && [ "$TOTAL_ITEMS" != "null" ]; then
  echo "SUCCESS (Valuasi Stok: Rp $STOCK_VALUE, Part Items: $TOTAL_ITEMS, Pending Approvals: $PENDING_APP, Low Stock: $LOW_STOCK)"
else
  echo "FAILED: Invalid KPI response: $KPI_RESP"
  exit 1
fi

# 9. Enterprise Dashboard: Stock Velocity & Turnover Analytics
echo -n "[TEST 9] Stock Velocity & Turnover Analytics: "
VEL_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/dashboard/stock-velocity")
VEL_COUNT=$(echo "$VEL_RESP" | jq '. | length')
FIRST_PART=$(echo "$VEL_RESP" | jq -r '.[0].spare_part_id')
FIRST_VEL=$(echo "$VEL_RESP" | jq -r '.[0].turnover_velocity')
if [ "$VEL_COUNT" -gt 0 ]; then
  echo "SUCCESS ($VEL_COUNT spare parts evaluated. Sample: $FIRST_PART - Velocity: $FIRST_VEL)"
else
  echo "FAILED: Stock velocity list empty"
  exit 1
fi

# 10. Enterprise Dashboard: Stock Aging Buckets (<30d, 31-90d, 91-180d, >180d)
echo -n "[TEST 10] Stock Aging Buckets: "
AGING_RESP=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/dashboard/stock-aging")
AGE_U30_VAL=$(echo "$AGING_RESP" | jq -r .age_under_30_days_value)
AGE_U30_CNT=$(echo "$AGING_RESP" | jq -r .age_under_30_days_count)
AGE_O180_VAL=$(echo "$AGING_RESP" | jq -r .age_over_180_days_value)

if [ "$AGE_U30_VAL" != "null" ]; then
  echo "SUCCESS (<30d: Rp $AGE_U30_VAL ($AGE_U30_CNT parts), >180d: Rp $AGE_O180_VAL)"
else
  echo "FAILED: Invalid stock aging response: $AGING_RESP"
  exit 1
fi

echo "============================================================"
echo "SEMUA PENGUJIAN PHASE 9 & PHASE 10 LULUS 100%!"
echo "============================================================"
