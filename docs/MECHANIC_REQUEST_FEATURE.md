# Fitur Permohonan Stock Mekanik (Mechanic Stock Request)

Dokumen desain & kontrak API untuk fitur **Permohonan Stock Mekanik** (Backend, Web, Android).

## 1. Ringkasan
- Mekanik memiliki **akun sendiri** (role `MECHANIC`, terhubung ke master karyawan via `users.employee_id`).
- Mekanik dapat mengajukan permohonan; **Admin Kontainer** juga dapat menginput permohonan atas nama mekanik.
- **POS Issue tetap ada** di Admin Kontainer (alur lama tidak berubah).
- Approval **cukup 1 level oleh Admin Kontainer** gudang terkait (Supervisor/Manager hanya memantau).
- Admin Kontainer bisa **mengubah qty langsung** saat approve, **mengembalikan untuk revisi**, atau **menolak**.
- Stok dipotong saat Admin Kontainer klik **Serahkan Barang** (serah terima fisik) → otomatis terbit transaksi POS (`ISS-...`).

### Jenis Permohonan
| Tipe | Deskripsi | Wajib | Efek saat Fulfill |
|---|---|---|---|
| `REPLACEMENT` (Penggantian) | Part rusak diganti part baru | Unit, HM/KM, Site, deskripsi kerusakan, **foto bukti kerusakan** | Terbit `issue_transactions` (COMPLETED), stok kontainer berkurang (`ISSUE_OUT`), **setiap item** otomatis dibuat `used_part_returns` (PENDING_RETURN) → part bekas wajib dikembalikan ke kontainer (alur Retur Part Bekas yang sudah ada) |
| `RETURN` (Pengembalian) | Mekanik mengembalikan part tidak terpakai | Alasan pengembalian, kondisi item | Stok kontainer bertambah (`RETURN_IN`) sebesar qty yang diterima |

## 2. State Machine
```
SUBMITTED ──(Admin Kontainer: approve, qty bisa diubah)──► APPROVED ──(Admin Kontainer: fulfill / serah terima)──► COMPLETED
    │  ▲
    │  └──(mekanik edit & submit ulang)── REVISION_REQUESTED ◄──(Admin Kontainer: request-revision)── SUBMITTED
    ├──(Admin Kontainer: reject)──► REJECTED
    └──(cancel oleh pemohon, dari SUBMITTED / REVISION_REQUESTED)──► CANCELLED
```
Catatan: permohonan yang dibuat langsung oleh Admin Kontainer tetap berstatus `SUBMITTED` dan harus di-approve (boleh oleh admin yang sama).

## 3. Hak Akses (Permissions)
| Permission | MECHANIC | CONTAINER_ADMIN_* | SUPERVISOR* | MANAGER / SUPER_ADMIN |
|---|---|---|---|---|
| `mechanic_request.view` | ✅ (hanya milik sendiri) | ✅ | ✅ (monitoring) | ✅ |
| `mechanic_request.create` | ✅ | ✅ (atas nama mekanik) | | ✅ |
| `mechanic_request.approve` | | ✅ (approve / ubah / revisi / tolak) | | ✅ |
| `mechanic_request.fulfill` | | ✅ | | ✅ |

Mekanik juga mendapat `inventory.view` (lihat ketersediaan stok kontainer). Seluruh akses tetap dibatasi `user_warehouses`.

Akun demo (password `password123`): `mekanik_he` (Yusuf Mansur, EMP-101, WH-CONT-HE), `mekanik_dt` (Rahmat Hidayat, EMP-103, WH-CONT-DT).

## 4. Kontrak API (`/api/v1`)
Semua endpoint memerlukan header `Authorization: Bearer <token>`.

### `GET /mechanic-requests`
Query: `warehouse_id?`, `status?`, `request_type?`, `search?`, `mine?=true`.
Response: `MechanicRequest[]` (maks 200, terbaru dulu).

### `GET /mechanic-requests/summary?warehouse_id=`
Response: `{ "total": n, "by_status": { "SUBMITTED": n, ... }, "awaiting_my_action": n }`

### `GET /mechanic-requests/me/context`
Response: `{ "employee": { "id","name","position","department_id" } | null, "warehouses": [{ "id","name","warehouse_type","category" }] }`

### `POST /mechanic-requests?force=false`
```json
{
  "request_type": "REPLACEMENT",          // atau "RETURN"
  "warehouse_id": "WH-CONT-HE",
  "site_id": "SITE-01",                    // wajib REPLACEMENT
  "unit_number": "EX-001",                 // wajib REPLACEMENT
  "unit_name": "Excavator PC2000", "unit_type": "EXCAVATOR",
  "ct_number": null, "serial_number": null,
  "hm_km": 12500.5,                        // wajib REPLACEMENT
  "work_order_number": "WO-123", "maintenance_type": "CORRECTIVE", "priority": "NORMAL",
  "mechanic_id": "EMP-101", "mechanic_name": "Yusuf Mansur",  // diabaikan bila pemohon role MECHANIC (diisi otomatis)
  "damage_category": "WEAR",               // WEAR | BROKEN | LEAK | BURNT | ACCIDENT | OTHER (REPLACEMENT)
  "damage_description": "Filter tersumbat", // wajib REPLACEMENT
  "damage_photo_url": "data:image/jpeg;base64,...",   // wajib REPLACEMENT (data URL / URL)
  "old_part_photo_url": null, "document_url": null,
  "return_reason": null,                   // UNUSED | EXCESS | WRONG_PART | WO_CANCELLED | OTHER (wajib RETURN)
  "reference_issue_number": null,          // opsional: no. ISS asal (RETURN)
  "notes": "...",
  "client_uuid": "uuid-opsional-untuk-idempotensi-mobile",
  "device_id": "opsional",
  "items": [ { "spare_part_id": "FLT-001", "qty": 2, "item_condition": null, "notes": null } ]
}
```
`item_condition` (RETURN): `NEW` | `GOOD` | `DAMAGED`.
Response sukses: `{ "success": true, "id", "request_number", "status": "SUBMITTED", "message" }`.
Jika ada permohonan aktif lain (SUBMITTED/APPROVED) untuk unit & part sama dalam 30 menit dan `force=false`:
`{ "duplicate_warning": true, "message": "..." }` (HTTP 200) — kirim ulang dengan `?force=true`.
Jika `client_uuid` sudah pernah dipakai → mengembalikan permohonan yang sudah ada (idempoten) dengan `"idempotent": true`.

### `GET /mechanic-requests/{id}`
Response: `{ "request": MechanicRequest, "items": MechanicRequestItem[], "history": MechanicRequestHistory[] }`

### `PUT /mechanic-requests/{id}`
Body sama seperti POST (tanpa `client_uuid`). Hanya saat status `SUBMITTED` / `REVISION_REQUESTED`, oleh pemohon (atau user dengan `mechanic_request.create` di gudang tsb). Status kembali `SUBMITTED` (revision_count +1 bila dari revisi).

### Aksi alur
| Endpoint | Body | Transisi | Permission |
|---|---|---|---|
| `POST /{id}/approve` | `{ "notes"?, "items"?: [{ "item_id", "qty" }] }` | SUBMITTED → APPROVED | approve |
| `POST /{id}/request-revision` | `{ "notes" }` (wajib) | SUBMITTED → REVISION_REQUESTED | approve |
| `POST /{id}/reject` | `{ "reason" }` (wajib) | SUBMITTED → REJECTED | approve |
| `POST /{id}/cancel` | `{ "reason"? }` | SUBMITTED / REVISION_REQUESTED → CANCELLED | pemohon |
| `POST /{id}/fulfill` | `{ "notes"?, "items"?: [{ "item_id", "qty" }] }` | APPROVED → COMPLETED | fulfill |

`qty` pada items: `>= 0` (0 = item dikeluarkan), minimal satu item > 0. Pada fulfill, qty ≤ approved_qty.
Response aksi: `{ "success": true, "status": "...", "message": "...", "issue_transaction_number"?: "ISS-..." }`.

### `PUT /users/{id}/employee`
Body `{ "employee_id": "EMP-101" | null }` — menautkan akun pengguna ke master karyawan (perm `users.manage`).

### Objek `MechanicRequest`
```json
{
  "id": "uuid", "request_number": "MRQ-20261012-00001", "request_type": "REPLACEMENT",
  "warehouse_id": "WH-CONT-HE", "site_id": "SITE-01", "status": "SUBMITTED",
  "unit_number": "EX-001", "unit_name": "...", "unit_type": "...", "ct_number": null, "serial_number": null,
  "hm_km": "12500.50", "work_order_number": null, "maintenance_type": null, "priority": "NORMAL",
  "mechanic_id": "EMP-101", "mechanic_name": "Yusuf Mansur",
  "requester_user_id": "uuid", "requester_name": "Yusuf Mansur (Mekanik HE)", "input_channel": "MECHANIC",
  "damage_category": "WEAR", "damage_description": "...", "damage_photo_url": "...", "old_part_photo_url": null, "document_url": null,
  "return_reason": null, "reference_issue_number": null, "notes": null,
  "revision_notes": null, "revision_count": 0,
  "approved_by_name": null, "approved_at": null, "approve_notes": null,
  "rejected_by_name": null, "rejected_at": null, "reject_reason": null,
  "fulfilled_by_name": null, "fulfilled_at": null, "fulfill_notes": null,
  "issue_transaction_id": null, "issue_transaction_number": null,
  "items_count": 1, "total_qty": "2.000",
  "created_at": "...", "updated_at": "..."
}
```
`input_channel`: `MECHANIC` (web oleh mekanik), `ADMIN_CONTAINER` (diinput admin), `MOBILE` (dari aplikasi Android, bila `device_id` terisi).
Angka `NUMERIC` diserialisasi sebagai **string** (rust_decimal).

### Objek `MechanicRequestItem`
`{ "id", "request_id", "spare_part_id", "part_name", "unit_of_measure", "requested_qty", "approved_qty", "fulfilled_qty", "item_condition", "notes", "stock_on_hand" }`

### Objek `MechanicRequestHistory`
`{ "id", "action", "from_status", "to_status", "actor_name", "actor_role", "notes", "changes", "created_at" }`
