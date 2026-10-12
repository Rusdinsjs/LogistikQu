#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DATABASE_URL="postgres://logisticqu:logisticqu_secret@127.0.0.1:5440/logisticqu_dev"
export PORT=8080
export JWT_SECRET="super-secret-jwt-key-vale-indonesia-logisticqu-2026"
export RUST_LOG=error

# Start backend if not running
if ! curl -s http://127.0.0.1:8080/health | grep -q "OK"; then
    $PROJECT_ROOT/backend/target/debug/logisticqu-backend > /tmp/backend_test.log 2>&1 &
    BACKEND_PID=$!
    cleanup() {
        kill $BACKEND_PID 2>/dev/null || true
    }
    trap cleanup EXIT
    for i in {1..20}; do
        if curl -s http://127.0.0.1:8080/health | grep -q "OK"; then
            break
        fi
        sleep 0.5
    done
fi

echo "======================================================================"
echo "  TEST PEMBATASAN AKSES NILAI HARGA, BIAYA & VALUASI (SUPER ADMIN/MANAGER)"
echo "======================================================================"

# 1. Login sebagai Super Admin
echo "--- 1. Login sebagai superadmin (Role: SUPER_ADMIN) ---"
TOKEN_SA=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"password123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# 2. Login sebagai Manager
echo "--- 2. Login sebagai manager (Role: MANAGER) ---"
TOKEN_MGR=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"password123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# 3. Login sebagai Supervisor HE
echo "--- 3. Login sebagai supervisor_he (Role: SUPERVISOR_HE) ---"
TOKEN_SPV=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"supervisor_he","password":"password123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# 4. Login sebagai Admin Kontainer HE
echo "--- 4. Login sebagai admin_cont_he (Role: CONTAINER_ADMIN_HE) ---"
TOKEN_CONT=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_cont_he","password":"password123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo ""
echo "=== PENGUJIAN 1: AKSES LAPORAN VALUASI STOK (/reports/inventory/valuation) ==="

# Super Admin harus BISA akses (200 OK)
STATUS_SA=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN_SA" http://127.0.0.1:8080/api/v1/reports/inventory/valuation)
echo "Super Admin: HTTP $STATUS_SA (Harus 200)"
if [ "$STATUS_SA" != "200" ]; then echo "FAIL Super Admin valuation"; exit 1; fi

# Manager harus BISA akses (200 OK)
STATUS_MGR=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN_MGR" http://127.0.0.1:8080/api/v1/reports/inventory/valuation)
echo "Manager: HTTP $STATUS_MGR (Harus 200)"
if [ "$STATUS_MGR" != "200" ]; then echo "FAIL Manager valuation"; exit 1; fi

# Supervisor HE DITOLAK (403 Forbidden)
STATUS_SPV=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN_SPV" http://127.0.0.1:8080/api/v1/reports/inventory/valuation)
echo "Supervisor HE: HTTP $STATUS_SPV (Harus 403)"
if [ "$STATUS_SPV" != "403" ]; then echo "FAIL Supervisor valuation should be 403"; exit 1; fi

# Admin Kontainer DITOLAK (403 Forbidden)
STATUS_CONT=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN_CONT" http://127.0.0.1:8080/api/v1/reports/inventory/valuation)
echo "Admin Kontainer: HTTP $STATUS_CONT (Harus 403)"
if [ "$STATUS_CONT" != "403" ]; then echo "FAIL Admin Kontainer valuation should be 403"; exit 1; fi

echo ""
echo "=== PENGUJIAN 2: LAPORAN BIAYA PEMELIHARAAN UNIT (/maintenance/cost-per-equipment) ==="

STATUS_SA_COST=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN_SA" http://127.0.0.1:8080/api/v1/maintenance/cost-per-equipment)
echo "Super Admin: HTTP $STATUS_SA_COST (Harus 200)"
if [ "$STATUS_SA_COST" != "200" ]; then echo "FAIL Super Admin cost report"; exit 1; fi

STATUS_SPV_COST=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN_SPV" http://127.0.0.1:8080/api/v1/maintenance/cost-per-equipment)
echo "Supervisor HE: HTTP $STATUS_SPV_COST (Harus 403)"
if [ "$STATUS_SPV_COST" != "403" ]; then echo "FAIL Supervisor cost report should be 403"; exit 1; fi

echo ""
echo "=== PENGUJIAN 3: MASKING TOTAL VALUASI DI DASHBOARD KPI ==="

# Super Admin dapat melihat total_stock_value nyata
KPI_SA=$(curl -s -H "Authorization: Bearer $TOKEN_SA" http://127.0.0.1:8080/api/v1/dashboard/enterprise-kpis)
VAL_SA=$(echo "$KPI_SA" | grep -o '"total_stock_value":[^,]*' | cut -d':' -f2)
echo "Super Admin total_stock_value: $VAL_SA (Harus > 0)"

# Supervisor HE dimasking menjadi 0.0
KPI_SPV=$(curl -s -H "Authorization: Bearer $TOKEN_SPV" http://127.0.0.1:8080/api/v1/dashboard/enterprise-kpis)
VAL_SPV=$(echo "$KPI_SPV" | grep -o '"total_stock_value":[^,]*' | cut -d':' -f2)
echo "Supervisor HE total_stock_value: $VAL_SPV (Harus 0.0)"
if [ "$VAL_SPV" != "0.0" ] && [ "$VAL_SPV" != "0" ]; then echo "FAIL KPI valuation not masked"; exit 1; fi

echo ""
echo "=== PENGUJIAN 4: MASKING HARGA SATUAN DI MASTER SUKU CADANG ==="

# Super Admin melihat unit_cost
PART_SA=$(curl -s -H "Authorization: Bearer $TOKEN_SA" "http://127.0.0.1:8080/api/v1/master/spare-parts?search=ALT-001")
echo "Super Admin part ALT-001: $(echo "$PART_SA" | grep -o '"unit_cost":[^,}]*')"

# Admin Kontainer TIDAK BISA melihat unit_cost (null)
PART_CONT=$(curl -s -H "Authorization: Bearer $TOKEN_CONT" "http://127.0.0.1:8080/api/v1/master/spare-parts?search=ALT-001")
COST_CONT=$(echo "$PART_CONT" | grep -o '"unit_cost":[^,}]*' | cut -d':' -f2)
echo "Admin Kontainer part ALT-001 unit_cost: $COST_CONT (Harus null)"
if [ "$COST_CONT" != "null" ]; then echo "FAIL unit_cost not null for non-manager"; exit 1; fi

echo ""
echo "=== PENGUJIAN 5: MASKING HARGA DI HISTORI PENGELUARAN (ISSUE) ==="

ISSUE_CONT=$(curl -s -H "Authorization: Bearer $TOKEN_CONT" "http://127.0.0.1:8080/api/v1/reports/operation/issue-history?limit=1")
PRICE_CONT=$(echo "$ISSUE_CONT" | grep -o '"total_price":[^,}]*' | cut -d':' -f2)
echo "Admin Kontainer issue history total_price: $PRICE_CONT (Harus 0.0)"
if [ "$PRICE_CONT" != "0.0" ] && [ "$PRICE_CONT" != "0" ]; then echo "FAIL total_price not masked in issue history"; exit 1; fi

echo ""
echo "======================================================================"
echo "  ✅ SEMUA PENGUJIAN PEMBATASAN AKSES FINANSIAL BERHASIL 100%!"
echo "======================================================================"
