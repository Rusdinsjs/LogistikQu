# LogisticQu — REST API Specification (v1)

Base URL: /api/v1

## 1. Authentication & Session
- POST /auth/login — Login user (mendapatkan access token JWT & refresh token)
- POST /auth/refresh — Rotasi token baru
- POST /auth/logout — Revoke sesi
- GET /auth/me — Profil user, peran, dan daftar gudang yang ditugaskan

## 2. Master Data
- GET, POST /master/spare-parts — Daftar & tambah master suku cadang
- GET, PUT /master/spare-parts/{id} — Detail & update master suku cadang
- GET, POST /master/equipment — Daftar & tambah unit alat berat / dump truck
- GET, POST /master/employees — Daftar karyawan / mekanik
- GET, POST /master/sites — Daftar lokasi kerja tambang / workshop
- GET /master/warehouses — Daftar 4 gudang operasional

## 3. Inventory & Monitoring (Kontainer)
- GET /inventory/stock — Saldo stok per gudang kontainer (status Normal/Warning/Critical)
- GET /inventory/stock/{id}/movements — Kartu stok & riwayat mutasi
- POST /inventory/import-initial — Upload file Excel stok awal / input manual
- GET /inventory/dashboard-summary — KPI card (Total Stock, Critical Items, Hari ini)

## 4. POS Issue Spare Part (Traceability)
- POST /issues — Eksekusi transaksi pengeluaran spare part dengan kelengkapan data unit, mekanik, site
- GET /issues — Riwayat transaksi pengeluaran spare part
- GET /issues/{id} — Detail bukti transaksi pengeluaran spare part (struk digital)
- POST /issues/{id}/approve — Approval supervisor untuk part bertipe kritikal

## 5. Replenishment & Multi-Tier Workflow
- GET /replenishment/recommendations — Perhitungan otomatis rekomendasi order kontainer
- POST /replenishment/requests — Pengajuan permintaan replenishment oleh Admin Kontainer
- GET /replenishment/requests — Daftar permohonan stok (filter status, gudang)
- GET /replenishment/requests/{id} — Detail permohonan beserta riwayat tahapan
- PUT /replenishment/requests/{id}/verify — Verifikasi kuantitas oleh Admin Gudang Utama
- PUT /replenishment/requests/{id}/approve — Persetujuan oleh Supervisor (STO diterbitkan)
- PUT /replenishment/requests/{id}/supervisor-reject — Supervisor menolak -> kembali ke Admin Utama
- PUT /replenishment/requests/{id}/main-resubmit — Admin Utama ajukan ulang ke Supervisor
- PUT /replenishment/requests/{id}/return-to-container — Dikembalikan ke Admin Kontainer
- POST /replenishment/requests/{id}/ship — Admin Utama drop/kirim barang
- POST /replenishment/requests/{id}/receive — Admin Kontainer konfirmasi terima barang

## 6. Main Warehouse Drop History
- GET /drops — Riwayat pasokan/drop stok dari Gudang Utama ke Gudang Kontainer

## 7. Stock Adjustment (Opname)
- POST /adjustments — Ajukan penyesuaian stok kontainer
- GET /adjustments — Daftar pengajuan penyesuaian
- PUT /adjustments/{id}/approve — Supervisor menyetujui penyesuaian stok

## 8. Laporan, Audit & Sinkronisasi Mobile
- GET /reports/consumption-by-unit — Analisa pemakaian per unit alat berat / DT
- GET /reports/consumption-by-site — Analisa pemakaian per site kerja
- GET /reports/consumption-by-mechanic — Rekap pemakaian per mekanik
- GET /audit-logs — Jejak audit komprehensif
- POST /sync/push — Endpoint idempotent sinkronisasi transaksi mobile offline
- GET /sync/pull — Tarik master data & stok terbaru berdasarkan timestamp
