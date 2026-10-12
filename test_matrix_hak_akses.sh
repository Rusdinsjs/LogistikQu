#!/bin/bash
set -e

# ==============================================================================
# LogisticQu — Verification Suite: Matriks Hak Akses (RBAC) & Keamanan Granular
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT/backend"

export DATABASE_URL="postgres://logisticqu:logisticqu_secret@127.0.0.1:5440/logisticqu_dev"
export PORT=8080
export JWT_SECRET="super-secret-jwt-key-vale-indonesia-logisticqu-2026"
export RUST_LOG=warn
export no_proxy="*"
export NO_PROXY="*"
unset http_proxy HTTP_PROXY https_proxy HTTPS_PROXY

# Warna Output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}       LOGISTICQU RBAC & PERMISSION MATRIX VERIFICATION SUITE   ${NC}"
echo -e "${CYAN}================================================================${NC}"

# 1. Jalankan Backend jika belum aktif
if curl -s http://127.0.0.1:8080/health | grep -q "OK"; then
    echo -e "${BLUE}[INFO]${NC} Menggunakan instance backend aktif di port 8080"
else
    echo -e "${BLUE}[INFO]${NC} Memulai backend binary release..."
    BIN="./target/release/logisticqu-backend"
    [ -f "$BIN" ] || BIN="./target/debug/logisticqu-backend"
    $BIN > /tmp/backend_matrix_test.log 2>&1 &
    BACKEND_PID=$!
    echo -e "${BLUE}[INFO]${NC} Backend berjalan dengan PID: $BACKEND_PID"
    cleanup() {
        echo -e "${BLUE}[INFO]${NC} Menghentikan backend PID $BACKEND_PID..."
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

# 2. Login untuk Mendapatkan Token JWT
echo -e "\n${YELLOW}--- 1. Login & Ekstraksi Token JWT 8 Peran ---${NC}"

login_as() {
    local username="$1"
    local res=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
        -H "Content-Type: application/json" \
        -d "{\"username\": \"$username\", \"password\": \"password123\"}")
    echo "$res" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('token', '') or data.get('data', {}).get('token', ''))"
}

TOKEN_SUPERADMIN=$(login_as "superadmin")
TOKEN_MANAGER=$(login_as "manager")
TOKEN_SPV_HE=$(login_as "supervisor_he")
TOKEN_SPV_DT=$(login_as "supervisor_dt")
TOKEN_MAIN_HE=$(login_as "admin_main_he")
TOKEN_CONT_HE=$(login_as "admin_cont_he")
TOKEN_MEKANIK_HE=$(login_as "mekanik_he")

if [ -z "$TOKEN_SUPERADMIN" ] || [ -z "$TOKEN_SPV_HE" ] || [ -z "$TOKEN_CONT_HE" ] || [ -z "$TOKEN_MEKANIK_HE" ]; then
    echo -e "${RED}[FAIL] Gagal login akun pengujian!${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Semua token JWT berhasil di-generate.${NC}"

# 3. Uji Coba Inspeksi Matriks Hak Akses (Role & Permission Baseline)
echo -e "\n${YELLOW}--- 2. Validasi Jumlah Hak Akses Database per Peran ---${NC}"

ROLES_JSON=$(curl -s -X GET http://127.0.0.1:8080/api/v1/roles \
    -H "Authorization: Bearer $TOKEN_SUPERADMIN")

python3 -c "
import sys, json

roles = json.loads('''$ROLES_JSON''')
expected = {
    'SUPER_ADMIN': 31,
    'MANAGER': 31,
    'SUPERVISOR_HE': 17,
    'SUPERVISOR_DT': 17,
    'MAIN_ADMIN_HE': 11,
    'MAIN_ADMIN_DT': 11,
    'CONTAINER_ADMIN_HE': 15,
    'CONTAINER_ADMIN_DT': 15,
    'MECHANIC': 4,
}

roles_map = {r['id']: len(r.get('permissions', [])) for r in roles}
all_ok = True

print('Hasil audit permission count:')
for code, exp_count in expected.items():
    actual = roles_map.get(code, 0)
    match = actual == exp_count
    status = '\033[0;32m[MATCH]\033[0m' if match else '\033[0;31m[MISMATCH]\033[0m'
    print(f'  {status} {code:<20}: aktual {actual:>2} izin (harapan: {exp_count})')
    if not match:
        all_ok = False

if not all_ok:
    sys.exit(1)
"
echo -e "${GREEN}[OK] Seluruh peran memiliki alokasi izin sesuai standar PRD dan Matriks Terkini.${NC}"

# 4. Uji Coba Zero-Trust Endpoint Enforcement (403 vs Authorized)
echo -e "\n${YELLOW}--- 3. Uji Coba Perlindungan Endpoint Zero-Trust (403 Forbidden vs Allowed) ---${NC}"

# Payload POS Issue yang valid secara struktural
VALID_ISSUE_PAYLOAD='{"warehouse_id":"WH-CONT-HE","site_id":"SITE-SOROWAKO","receiver_name":"Pak Budi","unit_number":"HE-CAT-320D-01","unit_name":"Excavator CAT 320D","unit_type":"EXCAVATOR","mechanic_name":"Anto","items":[]}'

# Test 3.1: POS Issue (Hanya Admin Kontainer / Superadmin, Ditolak untuk Supervisor & Admin Utama)
echo -n "  [TEST] POS Issue (POST /api/v1/issues) oleh Supervisor HE (harus 403)... "
STATUS_SPV=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8080/api/v1/issues \
    -H "Authorization: Bearer $TOKEN_SPV_HE" \
    -H "Content-Type: application/json" \
    -d "$VALID_ISSUE_PAYLOAD")

if [ "$STATUS_SPV" -eq 403 ]; then
    echo -e "${GREEN}[PASS: 403 Forbidden]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_SPV bukannya 403]${NC}"
    exit 1
fi

echo -n "  [TEST] POS Issue (POST /api/v1/issues) oleh Admin Utama HE (harus 403)... "
STATUS_MAIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8080/api/v1/issues \
    -H "Authorization: Bearer $TOKEN_MAIN_HE" \
    -H "Content-Type: application/json" \
    -d "$VALID_ISSUE_PAYLOAD")

if [ "$STATUS_MAIN" -eq 403 ]; then
    echo -e "${GREEN}[PASS: 403 Forbidden]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_MAIN bukannya 403]${NC}"
    exit 1
fi

# Test 3.2: Replenishment Approval (Hanya Supervisor / Superadmin, Ditolak untuk Admin Kontainer)
echo -n "  [TEST] Replenishment Approval (PUT /api/v1/replenishment/requests/.../approve) oleh Admin Kontainer (harus 403)... "
STATUS_CONT_APPROVE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT http://127.0.0.1:8080/api/v1/replenishment/requests/00000000-0000-0000-0000-000000000001/approve \
    -H "Authorization: Bearer $TOKEN_CONT_HE" \
    -H "Content-Type: application/json" \
    -d '{"supervisor_notes":"Approved"}')

if [ "$STATUS_CONT_APPROVE" -eq 403 ]; then
    echo -e "${GREEN}[PASS: 403 Forbidden]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_CONT_APPROVE bukannya 403]${NC}"
    exit 1
fi

# Test 3.3: Replenishment Verification (Hanya Admin Utama / Superadmin, Ditolak untuk Admin Kontainer)
echo -n "  [TEST] Replenishment Verification (PUT /api/v1/replenishment/requests/.../verify) oleh Admin Kontainer (harus 403)... "
STATUS_CONT_VERIFY=$(curl -s -o /dev/null -w "%{http_code}" -X PUT http://127.0.0.1:8080/api/v1/replenishment/requests/00000000-0000-0000-0000-000000000001/verify \
    -H "Authorization: Bearer $TOKEN_CONT_HE" \
    -H "Content-Type: application/json" \
    -d '{"admin_notes":"Verified","items":[]}')

if [ "$STATUS_CONT_VERIFY" -eq 403 ]; then
    echo -e "${GREEN}[PASS: 403 Forbidden]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_CONT_VERIFY bukannya 403]${NC}"
    exit 1
fi

# Test 3.4: Role Matrix Management (Hanya Superadmin & Manager, Ditolak untuk Supervisor)
echo -n "  [TEST] Role Matrix Management (PUT /api/v1/roles/CONTAINER_ADMIN_HE/permissions) oleh Supervisor HE (harus 403)... "
STATUS_SPV_ROLES=$(curl -s -o /dev/null -w "%{http_code}" -X PUT http://127.0.0.1:8080/api/v1/roles/CONTAINER_ADMIN_HE/permissions \
    -H "Authorization: Bearer $TOKEN_SPV_HE" \
    -H "Content-Type: application/json" \
    -d '{"permissions":["inventory.view"]}')

if [ "$STATUS_SPV_ROLES" -eq 403 ]; then
    echo -e "${GREEN}[PASS: 403 Forbidden]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_SPV_ROLES bukannya 403]${NC}"
    exit 1
fi

# Test 3.5: Akses Permohonan Mekanik (Instruksi #2: Admin Kontainer Ditolak 403, Mekanik & Supervisor Boleh 200)
echo -n "  [TEST] Akses Permohonan Mekanik (GET /api/v1/mechanic-requests) oleh Admin Kontainer HE (harus 403)... "
STATUS_CONT_MECH_GET=$(curl -s -o /dev/null -w "%{http_code}" -X GET http://127.0.0.1:8080/api/v1/mechanic-requests \
    -H "Authorization: Bearer $TOKEN_CONT_HE")
if [ "$STATUS_CONT_MECH_GET" -eq 403 ]; then
    echo -e "${GREEN}[PASS: 403 Forbidden]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_CONT_MECH_GET bukannya 403]${NC}"
    exit 1
fi

echo -n "  [TEST] Input Permohonan Mekanik (POST /api/v1/mechanic-requests) oleh Admin Kontainer HE (harus 403)... "
STATUS_CONT_MECH_POST=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8080/api/v1/mechanic-requests \
    -H "Authorization: Bearer $TOKEN_CONT_HE" \
    -H "Content-Type: application/json" \
    -d '{"warehouse_id":"WH-CONT-HE","request_type":"REPLACEMENT","unit_number":"DT-001","items":[]}')
if [ "$STATUS_CONT_MECH_POST" -eq 403 ]; then
    echo -e "${GREEN}[PASS: 403 Forbidden]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_CONT_MECH_POST bukannya 403]${NC}"
    exit 1
fi

echo -n "  [TEST] Akses Permohonan Mekanik oleh Mekanik HE (harus 200)... "
STATUS_MECH_GET=$(curl -s -o /dev/null -w "%{http_code}" -X GET http://127.0.0.1:8080/api/v1/mechanic-requests \
    -H "Authorization: Bearer $TOKEN_MEKANIK_HE")
if [ "$STATUS_MECH_GET" -eq 200 ]; then
    echo -e "${GREEN}[PASS: 200 OK]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_MECH_GET bukannya 200]${NC}"
    exit 1
fi

echo -n "  [TEST] Akses Permohonan Mekanik oleh Supervisor HE (harus 200)... "
STATUS_SPV_MECH_GET=$(curl -s -o /dev/null -w "%{http_code}" -X GET http://127.0.0.1:8080/api/v1/mechanic-requests \
    -H "Authorization: Bearer $TOKEN_SPV_HE")
if [ "$STATUS_SPV_MECH_GET" -eq 200 ]; then
    echo -e "${GREEN}[PASS: 200 OK]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_SPV_MECH_GET bukannya 200]${NC}"
    exit 1
fi

# Test 3.6: Quick Add Master Data (Instruksi #3 & #4)
RAND_ID=$((1000 + RANDOM % 9000))
echo -n "  [TEST] Admin Kontainer HE Quick-Add Unit Equipment (POST /api/v1/master/equipment, harus 200/201)... "
STATUS_CONT_ADD_EQ=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8080/api/v1/master/equipment \
    -H "Authorization: Bearer $TOKEN_CONT_HE" \
    -H "Content-Type: application/json" \
    -d "{\"unit_number\":\"EQ-CONT-$RAND_ID\",\"name\":\"Excavator Test $RAND_ID\",\"equipment_type_id\":\"HEAVY_EQUIPMENT\",\"current_hm_km\":1200.0}")
if [ "$STATUS_CONT_ADD_EQ" -eq 200 ] || [ "$STATUS_CONT_ADD_EQ" -eq 201 ]; then
    echo -e "${GREEN}[PASS: $STATUS_CONT_ADD_EQ Allowed]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_CONT_ADD_EQ]${NC}"
    exit 1
fi

echo -n "  [TEST] Admin Kontainer HE Quick-Add Mekanik / Karyawan (POST /api/v1/master/employees, harus 200/201)... "
STATUS_CONT_ADD_EMP=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8080/api/v1/master/employees \
    -H "Authorization: Bearer $TOKEN_CONT_HE" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"EMP-CONT-$RAND_ID\",\"name\":\"Mekanik Lapangan $RAND_ID\",\"position\":\"Mechanic Specialist\"}")
if [ "$STATUS_CONT_ADD_EMP" -eq 200 ] || [ "$STATUS_CONT_ADD_EMP" -eq 201 ]; then
    echo -e "${GREEN}[PASS: $STATUS_CONT_ADD_EMP Allowed]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_CONT_ADD_EMP]${NC}"
    exit 1
fi

echo -n "  [TEST] Mekanik HE Quick-Add Unit Equipment (POST /api/v1/master/equipment, harus 200/201)... "
STATUS_MECH_ADD_EQ=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8080/api/v1/master/equipment \
    -H "Authorization: Bearer $TOKEN_MEKANIK_HE" \
    -H "Content-Type: application/json" \
    -d "{\"unit_number\":\"EQ-MECH-$RAND_ID\",\"name\":\"Hauler Test $RAND_ID\",\"equipment_type_id\":\"HEAVY_EQUIPMENT\",\"current_hm_km\":850.0}")
if [ "$STATUS_MECH_ADD_EQ" -eq 200 ] || [ "$STATUS_MECH_ADD_EQ" -eq 201 ]; then
    echo -e "${GREEN}[PASS: $STATUS_MECH_ADD_EQ Allowed]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_MECH_ADD_EQ]${NC}"
    exit 1
fi

echo -n "  [TEST] Mekanik HE Quick-Add Mekanik (POST /api/v1/master/employees, harus 403 Forbidden)... "
STATUS_MECH_ADD_EMP=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8080/api/v1/master/employees \
    -H "Authorization: Bearer $TOKEN_MEKANIK_HE" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"EMP-MECH-$RAND_ID\",\"name\":\"Illegal Mech $RAND_ID\",\"position\":\"Mechanic\"}")
if [ "$STATUS_MECH_ADD_EMP" -eq 403 ]; then
    echo -e "${GREEN}[PASS: 403 Forbidden]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_MECH_ADD_EMP bukannya 403]${NC}"
    exit 1
fi

# Test 3.7: Monitoring Core Return BR-004 oleh Mekanik (Mekanik boleh GET 200, dilarang modifikasi/receive 403)
echo -n "  [TEST] Mekanik HE akses Tanggungan Core Return (GET /api/v1/returns, harus 200)... "
STATUS_MECH_RETURNS_GET=$(curl -s -o /dev/null -w "%{http_code}" -X GET http://127.0.0.1:8080/api/v1/returns \
    -H "Authorization: Bearer $TOKEN_MEKANIK_HE")
if [ "$STATUS_MECH_RETURNS_GET" -eq 200 ]; then
    echo -e "${GREEN}[PASS: 200 OK]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_MECH_RETURNS_GET bukannya 200]${NC}"
    exit 1
fi

echo -n "  [TEST] Mekanik HE coba terima retur loket (POST /receive-container, harus 403)... "
STATUS_MECH_RECEIVE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8080/api/v1/returns/00000000-0000-0000-0000-000000000001/receive-container \
    -H "Authorization: Bearer $TOKEN_MEKANIK_HE" \
    -H "Content-Type: application/json" \
    -d '{"notes":"illegal"}')
if [ "$STATUS_MECH_RECEIVE" -eq 403 ]; then
    echo -e "${GREEN}[PASS: 403 Forbidden]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_MECH_RECEIVE bukannya 403]${NC}"
    exit 1
fi

# 5. Uji Coba Isolasi Gudang (Warehouse Data Scoping)
echo -e "\n${YELLOW}--- 4. Uji Coba Isolasi Data Antar Gudang (Warehouse Scoping) ---${NC}"

echo -n "  [TEST] Admin Kontainer HE mengakses inventori Kontainer DT (WH-CONT-DT, harus 403)... "
STATUS_CROSS_WH=$(curl -s -o /dev/null -w "%{http_code}" -X GET "http://127.0.0.1:8080/api/v1/inventory/stock?warehouse_id=WH-CONT-DT" \
    -H "Authorization: Bearer $TOKEN_CONT_HE")

if [ "$STATUS_CROSS_WH" -eq 403 ]; then
    echo -e "${GREEN}[PASS: 403 Forbidden - Terisolasi dengan benar]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_CROSS_WH bukannya 403]${NC}"
    exit 1
fi

echo -n "  [TEST] Admin Kontainer HE mengakses inventori Kontainernya sendiri (WH-CONT-HE, harus 200)... "
STATUS_OWN_WH=$(curl -s -o /dev/null -w "%{http_code}" -X GET "http://127.0.0.1:8080/api/v1/inventory/stock?warehouse_id=WH-CONT-HE" \
    -H "Authorization: Bearer $TOKEN_CONT_HE")

if [ "$STATUS_OWN_WH" -eq 200 ]; then
    echo -e "${GREEN}[PASS: 200 OK]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_OWN_WH bukannya 200]${NC}"
    exit 1
fi

# 6. Uji Coba Pembatasan & Sensor Finansial (financial.view)
echo -e "\n${YELLOW}--- 5. Uji Coba Pembatasan & Sensor Finansial (financial.view) ---${NC}"

# Test 5.1: Akses Laporan Valuasi Stok (/reports/inventory/valuation)
echo -n "  [TEST] Super Admin akses /reports/inventory/valuation (harus 200)... "
STATUS_SA_VAL=$(curl -s -o /dev/null -w "%{http_code}" -X GET http://127.0.0.1:8080/api/v1/reports/inventory/valuation \
    -H "Authorization: Bearer $TOKEN_SUPERADMIN")
if [ "$STATUS_SA_VAL" -eq 200 ]; then
    echo -e "${GREEN}[PASS: 200 OK]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_SA_VAL]${NC}"
    exit 1
fi

echo -n "  [TEST] Supervisor HE akses /reports/inventory/valuation (harus 403)... "
STATUS_SPV_VAL=$(curl -s -o /dev/null -w "%{http_code}" -X GET http://127.0.0.1:8080/api/v1/reports/inventory/valuation \
    -H "Authorization: Bearer $TOKEN_SPV_HE")
if [ "$STATUS_SPV_VAL" -eq 403 ]; then
    echo -e "${GREEN}[PASS: 403 Forbidden]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_SPV_VAL]${NC}"
    exit 1
fi

echo -n "  [TEST] Admin Kontainer HE akses /reports/inventory/valuation (harus 403)... "
STATUS_CONT_VAL=$(curl -s -o /dev/null -w "%{http_code}" -X GET http://127.0.0.1:8080/api/v1/reports/inventory/valuation \
    -H "Authorization: Bearer $TOKEN_CONT_HE")
if [ "$STATUS_CONT_VAL" -eq 403 ]; then
    echo -e "${GREEN}[PASS: 403 Forbidden]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $STATUS_CONT_VAL]${NC}"
    exit 1
fi

# Test 5.2: Masking Harga Satuan di Master Suku Cadang (/master/spare-parts)
echo -n "  [TEST] Masking unit_cost di /master/spare-parts (Super Admin: riil, Admin Kontainer: null)... "
PART_SA=$(curl -s -H "Authorization: Bearer $TOKEN_SUPERADMIN" "http://127.0.0.1:8080/api/v1/master/spare-parts?search=ALT-001")
PART_CONT=$(curl -s -H "Authorization: Bearer $TOKEN_CONT_HE" "http://127.0.0.1:8080/api/v1/master/spare-parts?search=ALT-001")

python3 -c "
import sys, json

sa_data = json.loads('''$PART_SA''')
cont_data = json.loads('''$PART_CONT''')

sa_part = sa_data[0] if isinstance(sa_data, list) and sa_data else {}
cont_part = cont_data[0] if isinstance(cont_data, list) and cont_data else {}

sa_has_cost = sa_part.get('unit_cost') is not None
cont_cost_null = cont_part.get('unit_cost') is None

if not (sa_has_cost and cont_cost_null):
    print(f'Mismatch: SA has cost: {sa_has_cost}, CONT is null: {cont_cost_null}')
    sys.exit(1)
"
echo -e "${GREEN}[PASS: Data harga tersensor sempurna]${NC}"

# Test 5.3: Masking Valuasi Total di Enterprise KPIs
echo -n "  [TEST] Masking total_stock_value di /dashboard/enterprise-kpis (Supervisor HE harus 0.0)... "
KPI_SPV=$(curl -s -H "Authorization: Bearer $TOKEN_SPV_HE" http://127.0.0.1:8080/api/v1/dashboard/enterprise-kpis)
python3 -c "
import sys, json
data = json.loads('''$KPI_SPV''')
val = data.get('total_stock_value', 0)
if float(val) != 0.0:
    print(f'Expected 0.0, got {val}')
    sys.exit(1)
"
echo -e "${GREEN}[PASS: Valuasi tersensor 0.0]${NC}"

# 7. Uji Coba Modifikasi Dinamis Hak Akses via API Role Matrix
echo -e "\n${YELLOW}--- 6. Uji Coba Modifikasi Dinamis Matriks Hak Akses (Live Update) ---${NC}"

# Izin bawaan 15 izin
DEFAULT_PERMS='["master.view","bins.view","bins.manage","inventory.view","stock.import","issue.view","issue.create","returns.view","returns.receive","request.view","request.create","sto.receive","adjustment.view","adjustment.create","reports.view"]'

# Cabut 'bins.manage' dari role
REVOKED_PERMS='["master.view","bins.view","inventory.view","stock.import","issue.view","issue.create","returns.view","returns.receive","request.view","request.create","sto.receive","adjustment.view","adjustment.create","reports.view"]'

echo -n "  [TEST] Cabut izin 'bins.manage' dari CONTAINER_ADMIN_HE... "
UPDATE_RES=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "http://127.0.0.1:8080/api/v1/roles/CONTAINER_ADMIN_HE/permissions" \
    -H "Authorization: Bearer $TOKEN_SUPERADMIN" \
    -H "Content-Type: application/json" \
    -d "{\"permissions\": $REVOKED_PERMS}")

if [ "$UPDATE_RES" -eq 200 ]; then
    echo -e "${GREEN}[Berhasil Update]${NC}"
else
    echo -e "${RED}[Gagal Update: $UPDATE_RES]${NC}"
    exit 1
fi

# Re-login admin_cont_he agar klaim token baru merefleksikan izin terkini
TOKEN_CONT_HE_REVOKED=$(login_as "admin_cont_he")

echo -n "  [TEST] Buat Bin baru dengan izin yang dicabut (harus 403)... "
BIN_CREATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8080/api/v1/warehouses/WH-CONT-HE/bins \
    -H "Authorization: Bearer $TOKEN_CONT_HE_REVOKED" \
    -H "Content-Type: application/json" \
    -d '{"bin_code":"TEST-BIN-99","zone":"ZONE-A","shelf_level":"LEVEL-1","capacity_parts":100}')

if [ "$BIN_CREATE_STATUS" -eq 403 ]; then
    echo -e "${GREEN}[PASS: 403 Forbidden - Izin berhasil dicabut secara real-time]${NC}"
else
    echo -e "${RED}[FAIL: Mendapat $BIN_CREATE_STATUS bukannya 403]${NC}"
    exit 1
fi

# Mengembalikan izin 'bins.manage'
echo -n "  [TEST] Mengembalikan izin 'bins.manage' ke CONTAINER_ADMIN_HE... "
RESTORE_RES=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "http://127.0.0.1:8080/api/v1/roles/CONTAINER_ADMIN_HE/permissions" \
    -H "Authorization: Bearer $TOKEN_SUPERADMIN" \
    -H "Content-Type: application/json" \
    -d "{\"permissions\": $DEFAULT_PERMS}")

if [ "$RESTORE_RES" -eq 200 ]; then
    echo -e "${GREEN}[Berhasil Restore]${NC}"
else
    echo -e "${RED}[Gagal Restore: $RESTORE_RES]${NC}"
    exit 1
fi

echo -e "\n${CYAN}================================================================${NC}"
echo -e "${GREEN}   SELURUH PENGUJIAN MATRIKS HAK AKSES (RBAC) 100% SUKSES!      ${NC}"
echo -e "${CYAN}================================================================${NC}"
