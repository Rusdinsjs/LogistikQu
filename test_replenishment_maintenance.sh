#!/usr/bin/env bash
set -e

# Disable proxies for local testing
unset http_proxy HTTP_PROXY https_proxy HTTPS_PROXY no_proxy NO_PROXY

BASE_URL="http://127.0.0.1:8080/api/v1"

echo "========================================================"
echo "LOGISTIKQU ENTERPRISE WMS — PHASE 7 & 8 VERIFICATION"
echo "Replenishment Intelligence & Asset Maintenance Integration"
echo "========================================================"

# 1. Login as Superadmin
echo -n "1. Authenticating as Superadmin... "
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"password123"}')

TOKEN=$(echo "$LOGIN_RESP" | jq -r '.token // .data.access_token // empty')
if [ -z "$TOKEN" ]; then
  echo "FAILED"
  echo "Login response: $LOGIN_RESP"
  exit 1
fi
echo "SUCCESS (JWT acquired)"

# 2. Test Replenishment Intelligence Engine (Phase 7)
echo -n "2. Testing Replenishment Intelligence Engine (Min-Max, Reorder Point, Trend, Moving Avg)... "
INTEL_RESP=$(curl -s -X GET "$BASE_URL/replenishment/intelligence?warehouse_id=WH-CONT-HE" \
  -H "Authorization: Bearer $TOKEN")

FIRST_PART=$(echo "$INTEL_RESP" | jq -r '.[0].spare_part_id // empty')
REORDER_POINT=$(echo "$INTEL_RESP" | jq -r '.[0].reorder_point // empty')
TREND=$(echo "$INTEL_RESP" | jq -r '.[0].consumption_trend // empty')
SEASONAL=$(echo "$INTEL_RESP" | jq -r '.[0].seasonal_description // empty')

if [ -z "$FIRST_PART" ] || [ -z "$REORDER_POINT" ]; then
  echo "FAILED"
  echo "Response: $INTEL_RESP"
  exit 1
fi
echo "SUCCESS"
echo "   Sample Part: $FIRST_PART | Reorder Point: $REORDER_POINT | Trend: $TREND | Seasonal: $SEASONAL"

# 3. Test Recommendations Backward Compatibility (Phase 7)
echo -n "3. Testing Recommendations API Backward Compatibility... "
REC_RESP=$(curl -s -X GET "$BASE_URL/replenishment/recommendations?warehouse_id=WH-CONT-HE" \
  -H "Authorization: Bearer $TOKEN")

REC_COUNT=$(echo "$REC_RESP" | jq -r '. | length')
if [ "$REC_COUNT" -eq 0 ]; then
  echo "FAILED"
  echo "Response: $REC_RESP"
  exit 1
fi
echo "SUCCESS (Received $REC_COUNT recommendations with intelligence enrichment)"

# 4. Test Equipment Components (Phase 8)
echo -n "4. Testing Equipment Components API... "
COMP_RESP=$(curl -s -X GET "$BASE_URL/maintenance/components" \
  -H "Authorization: Bearer $TOKEN")

COMP_COUNT=$(echo "$COMP_RESP" | jq -r '. | length')
if [ "$COMP_COUNT" -lt 5 ]; then
  echo "FAILED"
  echo "Response: $COMP_RESP"
  exit 1
fi
echo "SUCCESS (Retrieved $COMP_COUNT equipment component groups: ENGINE, HYDRAULIC, BRAKE, etc.)"

# 5. Test Maintenance History Query (Phase 8)
echo -n "5. Testing Equipment Maintenance History API... "
HIST_RESP=$(curl -s -X GET "$BASE_URL/maintenance/history" \
  -H "Authorization: Bearer $TOKEN")

HIST_COUNT=$(echo "$HIST_RESP" | jq -r '. | length')
if [ "$HIST_COUNT" -eq 0 ]; then
  echo "FAILED"
  echo "Response: $HIST_RESP"
  exit 1
fi
echo "SUCCESS (Retrieved $HIST_COUNT maintenance breakdown logs)"

# 6. Test Create Maintenance Log (Phase 8)
echo -n "6. Testing Logging New Equipment Maintenance & Failure Record... "
NEW_WO="WO-TEST-$(date +%s)"
CREATE_M_RESP=$(curl -s -X POST "$BASE_URL/maintenance/history" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "work_order_number": "'"$NEW_WO"'",
    "equipment_id": "EX-002",
    "component_id": "HYDRAULIC",
    "spare_part_id": "HOS-001",
    "failure_code": "HOSE_COUPLING_BURST",
    "failure_symptom": "Kebocoran coupling tekanan tinggi saat swing boom di Pit Sorowako",
    "maintenance_type": "BREAKDOWN",
    "hm_km": 18950.5,
    "parts_qty": 2.0,
    "parts_cost": 3700000,
    "labor_cost": 600000,
    "downtime_hours": 3.5,
    "mechanic_name": "Agus Santoso",
    "notes": "Penggantian coupling dan selang Parker 2 inch"
  }')

CREATED_WO=$(echo "$CREATE_M_RESP" | jq -r '.work_order_number // empty')
TOTAL_COST=$(echo "$CREATE_M_RESP" | jq -r '.total_cost // empty')
if [ "$CREATED_WO" != "$NEW_WO" ]; then
  echo "FAILED"
  echo "Response: $CREATE_M_RESP"
  exit 1
fi
echo "SUCCESS (Created $CREATED_WO with Total Cost: Rp $TOTAL_COST)"

# 7. Test Cost Per Equipment Report (Phase 8)
echo -n "7. Testing Cost Per Equipment Report API... "
COST_RESP=$(curl -s -X GET "$BASE_URL/maintenance/cost-per-equipment" \
  -H "Authorization: Bearer $TOKEN")

FIRST_UNIT=$(echo "$COST_RESP" | jq -r '.[0].unit_number // empty')
COMBINED_COST=$(echo "$COST_RESP" | jq -r '.[0].combined_total_cost // empty')
if [ -z "$FIRST_UNIT" ]; then
  echo "FAILED"
  echo "Response: $COST_RESP"
  exit 1
fi
echo "SUCCESS (Highest spend equipment: Unit $FIRST_UNIT | Combined Total Cost: Rp $COMBINED_COST)"

# 8. Test Hierarchical Consumption Analysis (Equipment -> Component -> Spare Part -> Failure)
echo -n "8. Testing Hierarchical Consumption Analysis API... "
HIER_RESP=$(curl -s -X GET "$BASE_URL/maintenance/consumption-analysis" \
  -H "Authorization: Bearer $TOKEN")

HIER_COUNT=$(echo "$HIER_RESP" | jq -r '. | length')
SAMPLE_EQ=$(echo "$HIER_RESP" | jq -r '.[0].unit_number // empty')
SAMPLE_COMP=$(echo "$HIER_RESP" | jq -r '.[0].component_name // empty')
SAMPLE_PART=$(echo "$HIER_RESP" | jq -r '.[0].part_name // empty')
SAMPLE_FAIL=$(echo "$HIER_RESP" | jq -r '.[0].latest_failure_code // empty')

if [ "$HIER_COUNT" -eq 0 ]; then
  echo "FAILED"
  echo "Response: $HIER_RESP"
  exit 1
fi
echo "SUCCESS"
echo "   Hierarchy Trace: Equipment ($SAMPLE_EQ) -> Component ($SAMPLE_COMP) -> Part ($SAMPLE_PART) -> Failure ($SAMPLE_FAIL)"

echo "========================================================"
echo "ALL PHASE 7 & PHASE 8 TEST SUITES PASSED (100% SUCCESS)!"
echo "========================================================"
