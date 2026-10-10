#!/usr/bin/env bash
set -e

BASE_URL="http://127.0.0.1:8090/api/v1"
BACKEND_BIN="/home/rus/projects/LogistikQu/backend/target/debug/logisticqu-backend"

echo "=========================================================="
echo "  TEST: Role Scoping (Supervisor HE/DT) & User Manager   "
echo "=========================================================="

# 1. Start Backend on Port 8090
echo "[1/6] Menjalankan backend server pada port 8090..."
SERVER_PORT=8090 $BACKEND_BIN > /tmp/backend_test.log 2>&1 &
BACKEND_PID=$!

cleanup() {
    echo "Membersihkan backend process (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for server to be ready
for i in {1..20}; do
    if curl -s "http://127.0.0.1:8090/health" | grep -q "OK"; then
        echo "Backend server berhasil aktif!"
        break
    fi
    sleep 0.5
done

# Helper function to extract json field
json_val() {
    python3 -c "import sys, json; print(json.load(sys.stdin)$1)"
}

# 2. Test Login Manager
echo ""
echo "[2/6] Menguji Akun Manager Logistik (Bambang Irawan)..."
MGR_RES=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"manager","password":"password123"}')

MGR_TOKEN=$(echo "$MGR_RES" | json_val "['token']")
MGR_ROLE=$(echo "$MGR_RES" | json_val "['user']['role_id']")

if [ "$MGR_ROLE" != "MANAGER" ]; then
    echo "FAIL: Role manager bukan MANAGER, didapat: $MGR_ROLE"
    exit 1
fi
echo "SUCCESS: Login Manager berhasil, role=$MGR_ROLE"

# Test Manager Access to All Warehouses
echo "Menguji akses executive Manager ke semua gudang..."
for WH in "WH-MAIN-HE" "WH-MAIN-DT" "WH-CONT-HE" "WH-CONT-DT"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $MGR_TOKEN" "$BASE_URL/inventory/stock?warehouse_id=$WH")
    if [ "$STATUS" -ne 200 ]; then
        echo "FAIL: Manager gagal mengakses gudang $WH (HTTP $STATUS)"
        exit 1
    fi
    echo "  - Akses $WH: HTTP $STATUS (Diizinkan)"
done

# Test Manager User Management (CRUD)
echo "Menguji kapabilitas Manajemen Pengguna oleh Manager..."
ROLES_COUNT=$(curl -s -H "Authorization: Bearer $MGR_TOKEN" "$BASE_URL/roles" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))")
echo "  - Total roles tersedia: $ROLES_COUNT"

USERS_COUNT=$(curl -s -H "Authorization: Bearer $MGR_TOKEN" "$BASE_URL/users" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))")
echo "  - Total existing users: $USERS_COUNT"

# Buat User Baru oleh Manager
TEST_UNAME="mekanik_test_$(date +%s)"
CREATE_RES=$(curl -s -X POST "$BASE_URL/users" \
    -H "Authorization: Bearer $MGR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_UNAME\",\"password\":\"SecretPass123!\",\"full_name\":\"Test Operator Baru\",\"role_id\":\"CONTAINER_ADMIN_HE\",\"warehouse_ids\":[\"WH-CONT-HE\"]}")

CREATED_ID=$(echo "$CREATE_RES" | json_val "['user_id']")
echo "  - Berhasil membuat user baru: $TEST_UNAME (ID: $CREATED_ID)"

# 3. Test Login New User & Scoping
echo ""
echo "[3/6] Menguji User Baru ($TEST_UNAME) dengan Scoping Gudang..."
NEW_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_UNAME\",\"password\":\"SecretPass123!\"}")

NEW_TOKEN=$(echo "$NEW_LOGIN" | json_val "['token']")

# Cek akses gudang yang diizinkan (WH-CONT-HE)
ALLOWED_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $NEW_TOKEN" "$BASE_URL/inventory/stock?warehouse_id=WH-CONT-HE")
if [ "$ALLOWED_STATUS" -ne 200 ]; then
    echo "FAIL: User baru ditolak di gudang izinnya sendiri (HTTP $ALLOWED_STATUS)"
    exit 1
fi
echo "  - Akses ke gudang haknya (WH-CONT-HE): HTTP $ALLOWED_STATUS (Diizinkan)"

# Cek akses gudang yang DILARANG (WH-CONT-DT)
FORBIDDEN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $NEW_TOKEN" "$BASE_URL/inventory/stock?warehouse_id=WH-CONT-DT")
if [ "$FORBIDDEN_STATUS" -ne 403 ]; then
    echo "FAIL: User baru harusnya 403 Forbidden pada WH-CONT-DT, didapat: HTTP $FORBIDDEN_STATUS"
    exit 1
fi
echo "  - Akses ke gudang lain (WH-CONT-DT): HTTP $FORBIDDEN_STATUS (DITOLAK - 403 Forbidden Sempurna)"

# Cek User Biasa DILARANG akses /users
USER_MGMT_DENIED=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $NEW_TOKEN" "$BASE_URL/users")
if [ "$USER_MGMT_DENIED" -ne 403 ]; then
    echo "FAIL: User biasa harusnya 403 pada /users, didapat: HTTP $USER_MGMT_DENIED"
    exit 1
fi
echo "  - Akses user biasa ke /users: HTTP $USER_MGMT_DENIED (DITOLAK - 403 Forbidden)"

# 4. Test Scoping Supervisor Heavy Equipment (supervisor_he)
echo ""
echo "[4/6] Menguji Scoping Supervisor Heavy Equipment (Hendra Gunawan)..."
SUP_HE_RES=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"supervisor_he","password":"password123"}')

SUP_HE_TOKEN=$(echo "$SUP_HE_RES" | json_val "['token']")

# Akses yang diizinkan: WH-MAIN-HE & WH-CONT-HE
for HE_WH in "WH-MAIN-HE" "WH-CONT-HE"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $SUP_HE_TOKEN" "$BASE_URL/inventory/stock?warehouse_id=$HE_WH")
    if [ "$STATUS" -ne 200 ]; then
        echo "FAIL: Supervisor HE ditolak di gudang divisinya $HE_WH (HTTP $STATUS)"
        exit 1
    fi
    echo "  - Akses $HE_WH: HTTP $STATUS (Diizinkan)"
done

# Akses yang HARUS DITOLAK (WH-MAIN-DT & WH-CONT-DT)
for DT_WH in "WH-MAIN-DT" "WH-CONT-DT"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $SUP_HE_TOKEN" "$BASE_URL/inventory/stock?warehouse_id=$DT_WH")
    if [ "$STATUS" -ne 403 ]; then
        echo "FAIL: Supervisor HE harusnya 403 Forbidden pada $DT_WH, didapat: HTTP $STATUS"
        exit 1
    fi
    echo "  - Akses lintas divisi $DT_WH: HTTP $STATUS (DITOLAK - 403 Forbidden Sempurna)"
done

# 5. Test Scoping Supervisor Dump Truck (supervisor_dt)
echo ""
echo "[5/6] Menguji Scoping Supervisor Dump Truck (Dedi Kusnadi)..."
SUP_DT_RES=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"supervisor_dt","password":"password123"}')

SUP_DT_TOKEN=$(echo "$SUP_DT_RES" | json_val "['token']")

# Akses yang diizinkan: WH-MAIN-DT & WH-CONT-DT
for DT_WH in "WH-MAIN-DT" "WH-CONT-DT"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $SUP_DT_TOKEN" "$BASE_URL/inventory/stock?warehouse_id=$DT_WH")
    if [ "$STATUS" -ne 200 ]; then
        echo "FAIL: Supervisor DT ditolak di gudang divisinya $DT_WH (HTTP $STATUS)"
        exit 1
    fi
    echo "  - Akses $DT_WH: HTTP $STATUS (Diizinkan)"
done

# Akses yang HARUS DITOLAK (WH-MAIN-HE & WH-CONT-HE)
for HE_WH in "WH-MAIN-HE" "WH-CONT-HE"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $SUP_DT_TOKEN" "$BASE_URL/inventory/stock?warehouse_id=$HE_WH")
    if [ "$STATUS" -ne 403 ]; then
        echo "FAIL: Supervisor DT harusnya 403 Forbidden pada $HE_WH, didapat: HTTP $STATUS"
        exit 1
    fi
    echo "  - Akses lintas divisi $HE_WH: HTTP $STATUS (DITOLAK - 403 Forbidden Sempurna)"
done

# 6. Test Manager Update User (Tambahkan akses WH-CONT-DT ke test user)
echo ""
echo "[6/6] Menguji Manager Mengubah Akses Gudang User..."
UPDATE_RES=$(curl -s -X PUT "$BASE_URL/users/$CREATED_ID" \
    -H "Authorization: Bearer $MGR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"warehouse_ids":["WH-CONT-HE","WH-CONT-DT"]}')

echo "  - Update response: $UPDATE_RES"

# Cek bahwa user sekarang bisa mengakses WH-CONT-DT
NOW_ALLOWED=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $NEW_TOKEN" "$BASE_URL/inventory/stock?warehouse_id=WH-CONT-DT")
if [ "$NOW_ALLOWED" -ne 200 ]; then
    echo "FAIL: Setelah diupdate oleh manager, user masih ditolak di WH-CONT-DT (HTTP $NOW_ALLOWED)"
    exit 1
fi
echo "  - Akses $TEST_UNAME ke WH-CONT-DT setelah diupdate: HTTP $NOW_ALLOWED (Diizinkan!)"

echo ""
echo "=========================================================="
echo "  SEMUA TEST SUKSES! Scoping & Manager Berfungsi 100%     "
echo "=========================================================="
