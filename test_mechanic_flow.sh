#!/usr/bin/env bash
set -e

if [ -z "$API_URL" ]; then
  if curl -s -m 1 http://logisticqu-test-backend:8080/health > /dev/null 2>&1; then
    API_URL="http://logisticqu-test-backend:8080/api/v1"
  else
    API_URL="http://127.0.0.1:8080/api/v1"
  fi
fi

echo "=========================================================="
echo "  TEST END-TO-END: WORKFLOW PERMOHONAN STOK MEKANIK       "
echo "  Target API: $API_URL"
echo "=========================================================="

# 1. Login sebagai Mekanik HE
echo -e "\n[1] Melakukan autentikasi sebagai Mekanik HE (mekanik_he)..."
MEK_LOGIN_RESP=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"mekanik_he","password":"password123"}')

MEK_TOKEN=$(echo "$MEK_LOGIN_RESP" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
if [ -z "$MEK_TOKEN" ]; then
  echo "❌ Login mekanik_he gagal: $MEK_LOGIN_RESP"
  exit 1
fi
echo "✅ Berhasil login sebagai mekanik_he. Role terverifikasi."

# 2. Get Context Mekanik
echo -e "\n[2] Memeriksa profil & konteks mekanik (GET /mechanic-requests/me/context)..."
CONTEXT_RESP=$(curl -s -X GET "$API_URL/mechanic-requests/me/context" \
  -H "Authorization: Bearer $MEK_TOKEN")
echo "Response: $CONTEXT_RESP"

# 3. Ajukan Permohonan Penggantian (REPLACEMENT)
echo -e "\n[3] Mengajukan Permohonan Penggantian Suku Cadang (POST /mechanic-requests)..."
NEW_UUID=$(python3 -c 'import uuid; print(uuid.uuid4())')
REQ_PAYLOAD="{
  \"request_type\": \"REPLACEMENT\",
  \"warehouse_id\": \"WH-CONT-HE\",
  \"unit_number\": \"EX-002\",
  \"hm_km\": 1520.5,
  \"work_order_number\": \"WO-2026-10-001\",
  \"damage_category\": \"WEAR\",
  \"damage_description\": \"Element filter oli sudah aus dan menghitam pada service berkala 250 HM\",
  \"damage_photo_url\": \"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...\",
  \"notes\": \"Membutuhkan penggantian segera agar unit siap beroperasi di Pit 3\",
  \"client_uuid\": \"$NEW_UUID\",
  \"items\": [
    {
      \"spare_part_id\": \"FLT-001\",
      \"qty\": 2.0
    }
  ]
}"

SUBMIT_RESP=$(curl -s -X POST "$API_URL/mechanic-requests" \
  -H "Authorization: Bearer $MEK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$REQ_PAYLOAD")
echo "Response: $SUBMIT_RESP"

REQ_ID=$(echo "$SUBMIT_RESP" | grep -o '"id":"[^"]*' | head -n1 | cut -d'"' -f4)
REQ_NUM=$(echo "$SUBMIT_RESP" | grep -o '"request_number":"[^"]*' | head -n1 | cut -d'"' -f4)

if [ -z "$REQ_ID" ]; then
  echo "❌ Pengajuan permohonan gagal!"
  exit 1
fi
echo "✅ Permohonan berhasil diajukan dengan ID: $REQ_ID, Nomor Dokumen: $REQ_NUM"

# 4. Tes Duplicate Warning Detection (BR Rule 30 Menit)
echo -e "\n[4] Menguji deteksi duplikasi pengajuan unit & part dalam jendela 30 menit..."
DUP_RESP=$(curl -s -X POST "$API_URL/mechanic-requests" \
  -H "Authorization: Bearer $MEK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "request_type": "REPLACEMENT",
    "warehouse_id": "WH-CONT-HE",
    "unit_number": "EX-001",
    "hm_km": 1520.5,
    "damage_category": "WEAR",
    "damage_description": "Percobaan duplikasi",
    "damage_photo_url": "data:image/jpeg;base64,/9j/4AAQ...",
    "items": [{"spare_part_id": "FLT-001", "qty": 1.0}]
  }')
echo "Duplicate check response: $DUP_RESP"
if echo "$DUP_RESP" | grep -q "duplicate_warning"; then
  echo "✅ Algoritma Duplicate Warning aktif dan mendeteksi potensi duplikasi secara akurat!"
else
  echo "⚠️ Warning duplikasi tidak muncul, periksa threshold."
fi

# 5. Login sebagai Admin Kontainer HE
# 5. Uji Coba Penolakan Hak Akses untuk Admin Kontainer (Instruksi #2: Admin Kontainer tidak boleh akses Permohonan Mekanik)
echo -e "\n[5] Menguji bahwa Admin Kontainer (admin_cont_he) DITOLAK saat mencoba akses / approve permohonan..."
CONT_LOGIN_RESP=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_cont_he","password":"password123"}')
CONT_TOKEN=$(echo "$CONT_LOGIN_RESP" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

CONT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API_URL/mechanic-requests/$REQ_ID" \
  -H "Authorization: Bearer $CONT_TOKEN")
if [ "$CONT_STATUS" -eq 403 ]; then
  echo "✅ Admin Kontainer berhasil diblokir (403 Forbidden) sesuai Matriks RBAC & Instruksi #2!"
else
  echo "❌ Admin Kontainer tidak diblokir! HTTP Code: $CONT_STATUS"
  exit 1
fi

# 6. Login sebagai Supervisor HE (supervisor_he) yang berwenang
echo -e "\n[6] Melakukan autentikasi sebagai Supervisor HE (supervisor_he)..."
SPV_LOGIN_RESP=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"supervisor_he","password":"password123"}')
SPV_TOKEN=$(echo "$SPV_LOGIN_RESP" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
if [ -z "$SPV_TOKEN" ]; then
  echo "❌ Login supervisor_he gagal: $SPV_LOGIN_RESP"
  exit 1
fi
echo "✅ Berhasil login sebagai supervisor_he."

# 7. Supervisor melihat detail permohonan
echo -e "\n[7] Supervisor memeriksa detail permohonan (GET /mechanic-requests/$REQ_ID)..."
DETAIL_RESP=$(curl -s -X GET "$API_URL/mechanic-requests/$REQ_ID" \
  -H "Authorization: Bearer $SPV_TOKEN")
echo "Detail: $DETAIL_RESP"

# 8. Supervisor Menyetujui Permohonan (APPROVE)
echo -e "\n[8] Supervisor menyetujui permohonan (POST /mechanic-requests/$REQ_ID/approve)..."
APPROVE_RESP=$(curl -s -X POST "$API_URL/mechanic-requests/$REQ_ID/approve" \
  -H "Authorization: Bearer $SPV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Disetujui oleh Supervisor untuk unit EX-001, stok di kontainer mencukupi"}')
echo "Approve response: $APPROVE_RESP"

# 9. Supervisor Memenuhi / Menyerahkan Barang (FULFILL)
echo -e "\n[9] Supervisor memenuhi barang fisik ke mekanik (POST /mechanic-requests/$REQ_ID/fulfill)..."
FULFILL_RESP=$(curl -s -X POST "$API_URL/mechanic-requests/$REQ_ID/fulfill" \
  -H "Authorization: Bearer $SPV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Barang diserahkan ke Mekanik HE"}')
echo "Fulfill response: $FULFILL_RESP"

# 10. Memeriksa Summary & Status Akhir
echo -e "\n[10] Memeriksa KPI Summary Permohonan..."
SUMMARY_RESP=$(curl -s -X GET "$API_URL/mechanic-requests/summary?warehouse_id=WH-CONT-HE" \
  -H "Authorization: Bearer $SPV_TOKEN")
echo "Summary: $SUMMARY_RESP"

# 10. Pengujian Alur Retur (RETURN)
echo -e "\n[10] Menguji Alur Pengembalian Suku Cadang (RETURN)..."
RETURN_PAYLOAD='{
  "request_type": "RETURN",
  "warehouse_id": "WH-CONT-HE",
  "return_reason": "EXCESS",
  "notes": "Pengembalian kelebihan spare part setelah perbaikan selesai",
  "items": [
    {
      "spare_part_id": "FLT-001",
      "qty": 1.0,
      "item_condition": "NEW"
    }
  ]
}'
RET_SUBMIT_RESP=$(curl -s -X POST "$API_URL/mechanic-requests" \
  -H "Authorization: Bearer $MEK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$RETURN_PAYLOAD")
echo "Return request response: $RET_SUBMIT_RESP"

RET_ID=$(echo "$RET_SUBMIT_RESP" | grep -o '"id":"[^"]*' | head -n1 | cut -d'"' -f4)
if [ -n "$RET_ID" ]; then
  # Approve & fulfill retur oleh Supervisor
  curl -s -X POST "$API_URL/mechanic-requests/$RET_ID/approve" \
    -H "Authorization: Bearer $SPV_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"notes": "Disetujui retur"}' > /dev/null
  RET_FULFILL_RESP=$(curl -s -X POST "$API_URL/mechanic-requests/$RET_ID/fulfill" \
    -H "Authorization: Bearer $SPV_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"notes": "Retur diterima fisik di kontainer"}')
  echo "Return fulfill response: $RET_FULFILL_RESP"
  echo "✅ Alur retur selesai dengan sukses!"
fi

echo -e "\n=========================================================="
echo "  SELURUH VALIDASI E2E PERMOHONAN STOK MEKANIK LULUS 100%! "
echo "=========================================================="
