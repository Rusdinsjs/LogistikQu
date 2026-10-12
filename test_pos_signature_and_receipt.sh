#!/usr/bin/env bash
set -e

echo "================================================================="
echo "  E2E TEST: POS MECHANIC SIGNATURE & MANDATORY RECEIPT (BR-005)  "
echo "================================================================="

BASE_URL="http://127.0.0.1:8080/api/v1"

# 1. Login as Container Admin HE
echo -n "1. Login sebagai Admin Kontainer HE (admin_cont_he)... "
LOGIN_RES=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_cont_he","password":"password123"}')
TOKEN=$(echo "$LOGIN_RES" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "GAGAL LOGIN!"
  echo "$LOGIN_RES"
  exit 1
fi
echo "SUKSES (Token acquired)"

# 2. POS Issue dengan Tanda Tangan Digital Mekanik di Layar HP
echo -n "2. Transaksi POS dengan Digital Signature Mekanik di Layar... "
DIGITAL_SIG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

ISSUE_DIGITAL_PAYLOAD=$(cat <<EOF
{
  "warehouse_id": "WH-CONT-HE",
  "site_id": "SITE-VALE-A",
  "receiver_name": "Rian Hidayat",
  "unit_number": "EX-201",
  "unit_name": "Komatsu PC2000-8 Mining Shovel",
  "unit_type": "HEAVY_EQUIPMENT",
  "hm_km": 14200.0,
  "mechanic_name": "Yusuf Maulana",
  "work_order_number": "WO-2026-POS-01",
  "maintenance_type": "PREVENTIVE",
  "notes": "Penggantian filter oli rutin berkala",
  "signature_type": "DIGITAL",
  "mechanic_signature_url": "$DIGITAL_SIG",
  "items": [
    {
      "spare_part_id": "FLT-001",
      "qty": 1,
      "unit_of_measure": "PCS"
    }
  ]
}
EOF
)

DIGITAL_ISSUE_RES=$(curl -s -X POST "$BASE_URL/issues?force=true" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$ISSUE_DIGITAL_PAYLOAD")

ISSUE_ID_1=$(echo "$DIGITAL_ISSUE_RES" | grep -o '"issue_id":"[^"]*' | cut -d'"' -f4)
TX_NO_1=$(echo "$DIGITAL_ISSUE_RES" | grep -o '"transaction_number":"[^"]*' | cut -d'"' -f4)

if [ -z "$ISSUE_ID_1" ]; then
  echo "GAGAL CREATE ISSUE DIGITAL!"
  echo "$DIGITAL_ISSUE_RES"
  exit 1
fi
echo "SUKSES (No: $TX_NO_1, ID: $ISSUE_ID_1)"

# 3. Verifikasi Status Awal Struk: Belum Dicetak
echo -n "3. Verifikasi Status Awal Struk (receipt_printed = false)... "
DETAIL_1=$(curl -s -X GET "$BASE_URL/issues/$ISSUE_ID_1" \
  -H "Authorization: Bearer $TOKEN")

PRINTED_STATUS=$(echo "$DETAIL_1" | grep -o '"receipt_printed":false' || true)
if [ -z "$PRINTED_STATUS" ]; then
  echo "GAGAL! receipt_printed harus false sebelum dicetak"
  echo "$DETAIL_1"
  exit 1
fi
echo "SUKSES (receipt_printed: false)"

# 4. Pencatatan Cetak Struk POS (POST /issues/{id}/print-receipt)
echo -n "4. Admin Kontainer Mencetak Struk (POST /print-receipt)... "
PRINT_RES=$(curl -s -X POST "$BASE_URL/issues/$ISSUE_ID_1/print-receipt" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"signed_receipt_photo_url": null}')

PRINT_SUCCESS=$(echo "$PRINT_RES" | grep -o '"receipt_printed":true' || true)
if [ -z "$PRINT_SUCCESS" ]; then
  echo "GAGAL MENCATAT CETAK STRUK!"
  echo "$PRINT_RES"
  exit 1
fi
echo "SUKSES (Tercatat receipt_printed: true di server)"

# 5. Verifikasi Detail Struk Setelah Dicetak
echo -n "5. Verifikasi Detail Struk Setelah Dicetak... "
DETAIL_AFTER_PRINT=$(curl -s -X GET "$BASE_URL/issues/$ISSUE_ID_1" \
  -H "Authorization: Bearer $TOKEN")

PRINTED_AFTER=$(echo "$DETAIL_AFTER_PRINT" | grep -o '"receipt_printed":true' || true)
SIG_URL_AFTER=$(echo "$DETAIL_AFTER_PRINT" | grep -o '"mechanic_signature_url":"[^"]*' || true)

if [ -z "$PRINTED_AFTER" ] || [ -z "$SIG_URL_AFTER" ]; then
  echo "GAGAL VERIFIKASI DATA STRUK!"
  echo "$DETAIL_AFTER_PRINT"
  exit 1
fi
echo "SUKSES (Tanda tangan tersimpan & status dicetak aktif)"

# 6. Transaksi POS dengan Mode Tanda Tangan Fisik di Struk
echo -n "6. Transaksi POS dengan Mode Tanda Tangan Fisik di Struk... "
ISSUE_PHYSICAL_PAYLOAD=$(cat <<EOF
{
  "warehouse_id": "WH-CONT-HE",
  "site_id": "SITE-VALE-A",
  "receiver_name": "Agus Saputra",
  "unit_number": "DT-101",
  "unit_name": "Dump Truck Scania P410 8x4 Heavy Tipper",
  "unit_type": "DUMP_TRUCK",
  "hm_km": 85200.0,
  "mechanic_name": "Yusuf Maulana",
  "work_order_number": "WO-2026-PHYS-02",
  "maintenance_type": "CORRECTIVE",
  "notes": "Penggantian selang rem (tangan mekanik berlumur gemuk/oli)",
  "signature_type": "PHYSICAL",
  "items": [
    {
      "spare_part_id": "BRK-001",
      "qty": 2,
      "unit_of_measure": "SET"
    }
  ]
}
EOF
)

PHYSICAL_ISSUE_RES=$(curl -s -X POST "$BASE_URL/issues?force=true" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$ISSUE_PHYSICAL_PAYLOAD")

ISSUE_ID_2=$(echo "$PHYSICAL_ISSUE_RES" | grep -o '"issue_id":"[^"]*' | cut -d'"' -f4)
TX_NO_2=$(echo "$PHYSICAL_ISSUE_RES" | grep -o '"transaction_number":"[^"]*' | cut -d'"' -f4)

if [ -z "$ISSUE_ID_2" ]; then
  echo "GAGAL CREATE ISSUE PHYSICAL!"
  echo "$PHYSICAL_ISSUE_RES"
  exit 1
fi
echo "SUKSES (No: $TX_NO_2, Mode: PHYSICAL)"

# 7. Cetak Struk dan Upload Foto Struk Fisik Bertandatangan
echo -n "7. Cetak Struk Fisik & Unggah Foto Struk Bertandatangan Mekanik... "
SIGNED_PHOTO="data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

PRINT_PHYS_RES=$(curl -s -X POST "$BASE_URL/issues/$ISSUE_ID_2/print-receipt" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"signed_receipt_photo_url\": \"$SIGNED_PHOTO\"}")

PRINT_PHYS_OK=$(echo "$PRINT_PHYS_RES" | grep -o '"receipt_printed":true' || true)
if [ -z "$PRINT_PHYS_OK" ]; then
  echo "GAGAL MENCATAT CETAK STRUK FISIK!"
  echo "$PRINT_PHYS_RES"
  exit 1
fi
echo "SUKSES (Foto struk fisik bertandatangan tersimpan)"

echo ""
echo "================================================================="
echo "  SEMUA PENGUJIAN TANDA TANGAN MEKANIK & CETAK STRUK POS LULUS!  "
echo "================================================================="
