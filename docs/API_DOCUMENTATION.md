# API Documentation — LogistikQu Enterprise REST API

Base URL: `http://127.0.0.1:8080/api/v1` (Internal) / `https://logistik.sjsgroup.online/api/v1` (Production VPS)

---

## 1. Authentication & Security Headers

Semua endpoint privat mewajibkan header:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
Content-Type: application/json
```

Format respons standar:
```json
{
  "success": true,
  "message": "Deskripsi hasil operasi",
  "data": { ... }
}
```

Format respon error (RFC 7807 Standard):
```json
{
  "code": "VALIDATION_FAILED",
  "error": "Pesan deskriptif kesalahan",
  "details": null
}
```

---

## 2. Authentication Endpoints

### `POST /auth/login`
Autentikasi pengguna menggunakan Argon2id dan menerbitkan Access Token + Refresh Token.
- **Request Body**:
  ```json
  {
    "username": "superadmin",
    "password": "password123"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "refresh_token": "a1b2c3d4-...",
    "user": {
      "id": "uuid",
      "username": "superadmin",
      "full_name": "Super Admin Logistik",
      "role": "superadmin",
      "warehouse_id": null
    }
  }
  ```

### `POST /auth/refresh`
Melakukan rotasi refresh token untuk memperpanjang session tanpa re-login.
- **Request Body**:
  ```json
  {
    "refresh_token": "a1b2c3d4-..."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "refresh_token": "new-uuid-token"
  }
  ```

### `POST /auth/logout`
Mencabut refresh token saat ini secara instan dari database.

### `GET /auth/me`
Mendapatkan profil pengguna aktif beserta warehouse scope dan custom permissions.

### `GET /auth/sessions` & `DELETE /auth/sessions/{id}`
Manajemen sesi perangkat aktif dan kemampuan remote revoke session.

---

## 3. Inventory & Stock Ledger Endpoints

### `GET /inventory/stock`
Menampilkan daftar saldo on-hand fisik pada gudang kontainer.
- **Query Params**:
  - `warehouse_id`: String (e.g. `WH-CONT-HE`)
  - `search`: String (Pencarian kode atau nama suku cadang)
  - `status`: String (`NORMAL` | `LOW` | `CRITICAL`)

### `GET /inventory/ledger`
Membaca immutable stock movements double-entry ledger.
- **Query Params**:
  - `warehouse_id`: String
  - `spare_part_id`: Optional String
  - `movement_type`: Optional String (`RECEIVE`, `ISSUE`, `DROP_IN`, `TRANSFER`, `RETURN`, `ADJUSTMENT`, `DAMAGE`, `LOST`)
  - `page`: Integer (Default: 1)
  - `limit`: Integer (Default: 20)

### `GET /warehouses/{warehouse_id}/bins`
Menampilkan tata letak rak bin gudang kontainer, zona, tingkat rak, dan kapasitas suku cadang.

### `POST /warehouses/{warehouse_id}/bins/relocate`
Memindahkan posisi bin penempatan suku cadang fisik di dalam kontainer.

---

## 4. Issue & Pengeluaran POS Endpoints

### `POST /issues`
Mencatat pengeluaran suku cadang ke unit armada tambang dengan validasi BR-001 s/d BR-004.
- **Request Body**:
  ```json
  {
    "warehouse_id": "WH-CONT-HE",
    "site_id": "SITE-VALE-C",
    "receiver_name": "Agus Saputra",
    "unit_number": "EX-201",
    "unit_name": "Komatsu PC2000-8",
    "unit_type": "Hydraulic Excavator",
    "hm_km": 12450.5,
    "mechanic_name": "Yusuf Maulana",
    "work_order_number": "WO-2026-0901",
    "maintenance_type": "Corrective Breakdown",
    "priority": "HIGH",
    "items": [
      {
        "spare_part_id": "ENG-001",
        "qty": 2,
        "unit_of_measure": "PCS"
      }
    ]
  }
  ```

---

## 5. Replenishment & Intelligence Endpoints

### `GET /replenishment/intelligence`
Mendapatkan analisa kebutuhan stok otomatis berdasarkan rumus ROP, moving average, tren konsumsi, dan faktor musiman tambang.
- **Query Params**:
  - `warehouse_id`: String (`WH-CONT-HE` atau `WH-CONT-DT`)
- **Response**:
  ```json
  [
    {
      "spare_part_id": "FLT-002",
      "part_name": "Hydraulic Return Filter",
      "current_stock": 8.0,
      "in_transit_qty": 0.0,
      "min_stock": 10.0,
      "max_stock": 50.0,
      "safety_stock": 4.0,
      "lead_time_days": 5,
      "avg_daily_usage": 0.5,
      "consumption_trend": "INCREASING (+15%)",
      "seasonal_factor": 1.15,
      "reorder_point": 6.5,
      "is_reorder_needed": true,
      "recommended_purchase_qty": 42.0
    }
  ]
  ```

### `POST /replenishment/requests`
Pengajuan permohonan pengadaan buffer stock dari Admin Kontainer ke Gudang Utama. Status awal: `REQUESTED`.

### `PUT /replenishment/requests/{id}/verify`
Admin Gudang Utama memverifikasi ketersediaan dan merevisi kuantitas yang dapat disuplai. Status menjadi: `VERIFIED`.

### `PUT /replenishment/requests/{id}/approve`
Supervisor Gudang Utama menyetujui permohonan. Sistem secara otomatis menerbitkan dokumen Drop STO (`DROP-YYYYMMDD-XXXXX`). Status menjadi: `IN_TRANSIT`.

### `PUT /replenishment/requests/{id}/supervisor-reject`
Supervisor menolak permohonan dengan catatan alasan penolakan. Status kembali menjadi `RETURNED_TO_MAIN_ADMIN`.

### `POST /replenishment/requests/{id}/receive`
Admin Kontainer menerima kiriman fisik suku cadang dari Gudang Utama. Saldo on-hand kontainer otomatis bertambah dan ledger mencatat `DROP_IN`. Status akhir: `COMPLETED`.

---

## 6. Equipment Maintenance & Asset Integration Endpoints

### `GET /maintenance/cost-per-equipment`
Menganalisis akumulasi biaya pemakaian suku cadang per unit alat berat / dump truck.

### `GET /maintenance/consumption-analysis`
Menganalisis pohon pemakaian hierarkis: Equipment $\rightarrow$ Komponen $\rightarrow$ Suku Cadang.

### `GET /maintenance/history` & `POST /maintenance/history`
Register dan pencatatan riwayat kerusakan serta perbaikan komponen alat.

---

## 7. Reporting & Analytics Endpoints

### Inventory Reports
- `GET /reports/inventory/balance`: Saldo persediaan gudang.
- `GET /reports/inventory/valuation`: Valuasi finansial inventaris (Total IDR & persentase kontribusi per part).
- `GET /reports/inventory/aging`: Klasifikasi umur tinggal barang di rak (<30 hari, 31-90 hari, 91-180 hari, >180 hari).

### Operation Reports
- `GET /reports/operation/issue-history`: Rekam jejak pengeluaran lengkap dengan unit, mekanik, HM/KM, dan site.
- `GET /reports/operation/consumption`: Tren konsumsi suku cadang bulanan.
- `GET /reports/operation/equipment`: Analisa pemakaian suku cadang spesifik per nomor unit alat.

### Management Reports
- `GET /reports/management/warehouse-performance`: Perbandingan efisiensi pergudangan antar site.
- `GET /reports/management/replenishment-efficiency`: Kecepatan siklus replenishment dari pengajuan hingga penerimaan.

---

## 8. Observability & Health

### `GET /health`
Liveness check probe (Mengembalikan `OK` dengan HTTP 200).

### `GET /metrics`
Prometheus metrics format standar mengekspos:
- `logisticqu_uptime_seconds`
- `logisticqu_db_pool_connections`
- `logisticqu_inventory_total_value_idr`
- `logisticqu_inventory_items_total`
- `logisticqu_low_stock_items_total`
- `logisticqu_unread_notifications_total`
- `logisticqu_pending_replenishments_total`
