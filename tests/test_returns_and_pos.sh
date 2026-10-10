#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== MEMULAI TEST INTEGRASI CORE RETURN & POS ENHANCEMENTS ==="

# 1. Pastikan Backend Berjalan
PORT=8090
BACKEND_BIN="$PROJECT_ROOT/backend/target/debug/logisticqu-backend"

export DATABASE_URL="postgres://logisticqu:logisticqu_secret@127.0.0.1:5440/logisticqu_dev"
export JWT_SECRET="logisticqu_super_secret_jwt_key_2026_valesite_mining"
export SERVER_PORT="$PORT"
export SERVER_HOST="0.0.0.0"

pkill -f logisticqu-backend 2>/dev/null || true
"$BACKEND_BIN" > /tmp/test_backend.log 2>&1 &
BACKEND_PID=$!

cleanup() {
    kill $BACKEND_PID 2>/dev/null || true
    pkill -f logisticqu-backend 2>/dev/null || true
}
trap cleanup EXIT

echo "Menunggu backend siap..."
for i in {1..20}; do
    if curl -s "http://127.0.0.1:$PORT/health" | grep -q "OK"; then
        break
    fi
    sleep 0.5
done

# 2. Login as Manager / Admin
echo "1. Login sebagai manager..."
LOGIN_RES=$(curl -s -X POST "http://127.0.0.1:$PORT/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"password123"}')

TOKEN=$(echo "$LOGIN_RES" | grep -o '"token":"[^"]*' | head -n 1 | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Gagal login! Response: $LOGIN_RES"
    exit 1
fi
echo "✅ Login berhasil. Token didapatkan."

# 3. Test Master Quick Add Equipment
echo "2. Test Quick Add Equipment..."
RAND_NUM=$((RANDOM % 900 + 100))
EQ_RES=$(curl -s -X POST "http://127.0.0.1:$PORT/api/v1/master/equipment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"unit_number\":\"DT-$RAND_NUM\",\"name\":\"Dump Truck Test $RAND_NUM\",\"equipment_type_id\":\"DUMP_TRUCK\",\"current_hm_km\":1200}")

echo "Response Equipment: $EQ_RES"
if echo "$EQ_RES" | grep -q '"success":true'; then
    echo "✅ Berhasil tambah equipment DT-$RAND_NUM"
else
    echo "❌ Gagal tambah equipment"
    exit 1
fi

# 4. Test Master Quick Add Mechanic
echo "3. Test Quick Add Mechanic..."
EMP_RES=$(curl -s -X POST "http://127.0.0.1:$PORT/api/v1/master/employees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Mekanik Uji $RAND_NUM\",\"position\":\"Senior Mechanic\",\"is_mechanic\":true}")

echo "Response Employee: $EMP_RES"
if echo "$EMP_RES" | grep -q '"success":true'; then
    echo "✅ Berhasil tambah mekanik Mekanik Uji $RAND_NUM"
else
    echo "❌ Gagal tambah mekanik"
    exit 1
fi

# 5. Test Master Update Spare Part (requires_core_return)
echo "4. Test Update requires_core_return pada TUR-001..."
PART_RES=$(curl -s -X PUT "http://127.0.0.1:$PORT/api/v1/master/spare-parts/TUR-001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"requires_core_return":true}')

echo "Response Part: $PART_RES"
if echo "$PART_RES" | grep -q '"success":true'; then
    echo "✅ Berhasil set requires_core_return = true pada TUR-001"
else
    echo "❌ Gagal update spare part"
    exit 1
fi

# 6. Test POS Issue with Core Return Item & Attachments
echo "5. Test POS Issue Item TUR-001 dengan Bukti Foto & Dokumen..."
ISSUE_RES=$(curl -s -X POST "http://127.0.0.1:$PORT/api/v1/issues" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"warehouse_id\":\"WH-CONT-HE\",
    \"site_id\":\"SITE-VALE-A\",
    \"receiver_name\":\"Ahmad Dani\",
    \"unit_number\":\"DT-$RAND_NUM\",
    \"unit_name\":\"Dump Truck Test $RAND_NUM\",
    \"unit_type\":\"DUMP_TRUCK\",
    \"hm_km\":1250,
    \"mechanic_name\":\"Mekanik Uji $RAND_NUM\",
    \"work_order_number\":\"WO-TEST-$RAND_NUM\",
    \"maintenance_type\":\"CORRECTIVE\",
    \"notes\":\"Penggantian turbo unit rusak\",
    \"evidence_photo_url\":\"data:image/jpeg;base64,mockphotodata\",
    \"document_url\":\"data:application/pdf;base64,mockpdfdata\",
    \"items\":[
      {\"spare_part_id\":\"TUR-001\",\"qty\":1,\"unit_of_measure\":\"PCS\"}
    ]
  }")

echo "Response Issue: $ISSUE_RES"
if echo "$ISSUE_RES" | grep -q '"success":true'; then
    echo "✅ Berhasil transaksi issue POS dengan attachments"
else
    echo "❌ Gagal issue POS: $ISSUE_RES"
    exit 1
fi

ISSUE_ID=$(echo "$ISSUE_RES" | grep -o '"issue_id":"[^"]*' | head -n 1 | cut -d'"' -f4)
if echo "$ISSUE_RES" | grep -q "PENDING_APPROVAL"; then
    echo "Komponen kritikal terdeteksi. Melakukan approve transaksi oleh Supervisor/Manager..."
    APPR_RES=$(curl -s -X POST "http://127.0.0.1:$PORT/api/v1/issues/$ISSUE_ID/approve" \
      -H "Authorization: Bearer $TOKEN")
    echo "Response Approve: $APPR_RES"
fi

# 7. Test Query Used Part Returns
echo "6. Memeriksa record used_part_returns yang otomatis diterbitkan..."
RETURNS_RES=$(curl -s -X GET "http://127.0.0.1:$PORT/api/v1/returns?search=TUR-001" \
  -H "Authorization: Bearer $TOKEN")

echo "RETURNS_RES: $RETURNS_RES"

RETURN_ID=$(echo "$RETURNS_RES" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)
HOLDER_TYPE=$(echo "$RETURNS_RES" | grep -o '"current_holder_type":"[^"]*' | head -n 1 | cut -d'"' -f4)
STATUS=$(echo "$RETURNS_RES" | grep -o '"status":"[^"]*' | head -n 1 | cut -d'"' -f4)

echo "Retur ditemukan: ID=$RETURN_ID, Status=$STATUS, Holder=$HOLDER_TYPE"

if [ "$STATUS" = "PENDING_RETURN" ] && [ "$HOLDER_TYPE" = "MECHANIC" ]; then
    echo "✅ Record retur otomatis terbentuk: Dipegang oleh Mekanik!"
else
    echo "❌ Status retur tidak sesuai: Status=$STATUS, Holder=$HOLDER_TYPE"
    exit 1
fi

# 8. Test Receive at Container
echo "7. Test Terima Part Bekas di Gudang Kontainer..."
RCV_RES=$(curl -s -X POST "http://127.0.0.1:$PORT/api/v1/returns/$RETURN_ID/receive-container" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"container_notes":"Bodi turbo retak dan bearing pecah","container_photo_url":"data:image/jpeg;base64,mockdamagedpartphoto"}')

echo "Response Receive: $RCV_RES"
if echo "$RCV_RES" | grep -q '"success":true'; then
    echo "✅ Berhasil diterima di Gudang Kontainer"
else
    echo "❌ Gagal receive container"
    exit 1
fi

# 9. Test Transfer to Main Warehouse
echo "8. Test Serahkan ke Gudang Utama..."
XFER_RES=$(curl -s -X POST "http://127.0.0.1:$PORT/api/v1/returns/$RETURN_ID/transfer-main" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"main_warehouse_id":"WH-MAIN-HE","main_notes":"Dikirim bersama rombongan logistik kontainer"}')

echo "Response Transfer: $XFER_RES"
if echo "$XFER_RES" | grep -q '"success":true'; then
    echo "✅ Berhasil diserahkan ke Gudang Utama"
else
    echo "❌ Gagal transfer ke gudang utama"
    exit 1
fi

# 10. Test Complete Return / Disposition (Scrap)
echo "9. Test Selesaikan / Disposisi Scrap..."
CMPL_RES=$(curl -s -X POST "http://127.0.0.1:$PORT/api/v1/returns/$RETURN_ID/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"disposition":"SCRAP","final_notes":"Dibuang ke penampungan besi tua limbah B3"}')

echo "Response Complete: $CMPL_RES"
if echo "$CMPL_RES" | grep -q '"success":true'; then
    echo "✅ Berhasil menyelesaikan disposisi retur (SCRAP)"
else
    echo "❌ Gagal complete return"
    exit 1
fi

# 11. Verifikasi Detail Akhir
echo "10. Verifikasi detail riwayat audit akhir..."
DETAIL_RES=$(curl -s -X GET "http://127.0.0.1:$PORT/api/v1/returns/$RETURN_ID" \
  -H "Authorization: Bearer $TOKEN")

FINAL_STATUS=$(echo "$DETAIL_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
FINAL_HOLDER=$(echo "$DETAIL_RES" | grep -o '"current_holder_name":"[^"]*' | cut -d'"' -f4)

echo "Final Status: $FINAL_STATUS | Final Holder: $FINAL_HOLDER"

if [ "$FINAL_STATUS" = "COMPLETED" ]; then
    echo "=================================================================="
    echo "  🎉 SEMUA 10 PENGUJIAN INTEGRASI BERHASIL 100%!                   "
    echo "=================================================================="
else
    echo "❌ Status akhir tidak COMPLETED"
    exit 1
fi
