# LogistikQu — Enterprise Mining Warehouse Management System (WMS)

[![CI/CD Pipeline](https://github.com/Rusdinsjs/LogistikQu/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/Rusdinsjs/LogistikQu/actions/workflows/ci-cd.yml)
[![Rust](https://img.shields.io/badge/Rust-1.85%2B-orange.svg)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Production_Ready-2496ED.svg)](https://www.docker.com/)

**LogistikQu** adalah Enterprise Grade Warehouse Management System (WMS) yang dirancang khusus untuk operasional pertambangan skala besar (standar operasional SJS-VIPO). Sistem ini menjamin keterlacakan (*traceability*) 100% dari penerimaan barang, tata letak rak kontainer (*bin location*), pengadaan cerdas (*replenishment intelligence*), hingga pengeluaran suku cadang ke armada alat berat (*Heavy Equipment*) dan *Dump Truck*.

---

## 🏛️ Arsitektur Sistem

LogistikQu dibangun menggunakan prinsip **Clean Architecture (Hexagonal / Onion)** dengan pemisahan tanggung jawab yang ketat:

```
backend/src/
├── api/             # Transport Layer: Axum 0.8 HTTP routes, handlers, middleware, auth extraction
├── application/     # Application Layer: Services & use cases orchestrating transactions
├── domain/          # Domain Layer: Pure entities, value objects, business rule formulas
└── infrastructure/  # Infrastructure Layer: PostgreSQL 17 repositories (SQLx), security, external adapters

frontend/src/
├── features/        # Modular business domains:
│   ├── inventory/   # Stock balance, bin locations, immutable movements, stock transfer
│   ├── replenishment/# State machine requests, verification, supervisor approval, STO drop
│   ├── users/       # Granular RBAC permission matrix, user administration, sessions
│   ├── reports/     # 8 enterprise reports with Excel (.xlsx) & PDF print export
│   └── audit/       # Immutable audit logs tracking user IP, agent, and JSON delta
├── components/      # Glassmorphism Dark Enterprise design system primitives
└── tests/           # TypeScript native test suites (node --test)

android/app/src/main/java/com/sjs/logistikqu/
├── presentation/    # Jetpack Compose UI (Material 3 High Contrast, 56dp Touch Targets)
├── domain/          # Entities, UseCases (StockCheck, IssuePart, Barcode), Repositories
├── data/            # Offline-First Engine (Room DB, sync_queue, Retrofit API, DataStore)
├── di/              # Hilt Modules (Network, Database, Repository)
├── worker/          # WorkManager Background SyncWorker & Periodic Scheduler
└── security/        # FLAG_SECURE Screenshot Protection, Root Detection, Biometric
```

---

## ✨ Fitur Enterprise Utama

### 1. Keamanan & Autentikasi Standard Enterprise (Phase 4)
- **Argon2id Password Hashing**: Standar OWASP terbaru untuk proteksi kredensial.
- **JWT Access + Refresh Token Rotation**: Masa berlaku access token singkat (15 menit) dengan rotasi refresh token otomatis dan tabel pelacakan sesi aktif (`user_sessions`).
- **Granular RBAC + Custom Permission Matrix**: Hak akses per-modul hingga level sub-fitur dengan kemampuan kustomisasi individual pengguna melalui portal superadmin.
- **Proteksi Brute-Force & Rate Limiting**: Penguncian akun otomatis setelah kegagalan login berulang.
- **Enterprise Security Headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy via Nginx reverse proxy.

### 2. Manajemen Stok & Immutable Ledger (Phase 5)
- **Multi-Warehouse Isolation**: Pemisahan tegas Gudang Utama (`WH-MAIN-HE`, `WH-MAIN-DT`) dan Gudang Kontainer Lapangan (`WH-CONT-HE`, `WH-CONT-DT`).
- **Bin Location Management**: Struktur penempatan rak kontainer (Zone, Shelf Level, Bin Code, Capacity Limit).
- **Batch & Serial Number Tracking**: Pelacakan nomor batch pelumas dan nomor seri komponen berbiaya tinggi.
- **Double-Entry Immutable Stock Ledger**: Setiap mutasi fisik (`RECEIVE`, `ISSUE`, `DROP_IN`, `TRANSFER`, `RETURN`, `ADJUSTMENT`, `DAMAGE`, `LOST`) dicatat secara append-only dengan saldo berjalan `balance_after`.

### 3. Replenishment Intelligence & Forecasting (Phase 7)
- **Formula Min/Max Dinamis**:
  $$\text{Reorder Point (ROP)} = (\text{Average Daily Usage} \times \text{Lead Time}) + \text{Safety Stock}$$
- **Analisis Tren Konsumsi & Moving Average**: Moving average 7-hari, 30-hari, dan 90-hari dengan indikator arah tren (*Increasing*, *Decreasing*, *Stable*).
- **Seasonal Factor Tambang**: Penyesuaian otomatis untuk musim hujan (*Wet Season*) dan musim kering (*Dry Season*).
- **Rekomendasi Pembelian Otomatis**: Menghitung kuantitas optimal pemesanan guna mencegah *stock-out* di pit tambang.

### 4. Integrasi Aset & Pemeliharaan Armada (Phase 8)
- **Pohon Relasi Aset**: Equipment $\rightarrow$ Komponen $\rightarrow$ Suku Cadang $\rightarrow$ Riwayat Kerusakan (*Failure History*).
- **Analisa Biaya per Unit (Cost per Equipment)**: Menghitung total konsumsi finansial suku cadang per nomor unit armada tambang.
- **Keterlacakan BR-001 s/d BR-004**: Tidak ada pengeluaran suku cadang tanpa: No Unit, HM/KM, Site Tambang, Penerima, dan Mekanik.

### 5. Multi-Channel Notification Engine (Phase 9)
- **In-App Notification Center**: Popover lonceng notifikasi real-time dengan status belum dibaca (*unread count*).
- **Trigger Otomatis**: Peringatan stok kritis (*low stock*), permohonan butuh persetujuan (*approval required*), penolakan transaksi (*rejected transaction*), dan konsumsi abnormal (>3x rata-rata harian).
- **WhatsApp & Email Ready**: Adapter siap pakai untuk integrasi gateway notifikasi eksternal.

### 6. Pelaporan Komprehensif & Export (Phase 11)
- **8 Laporan Operasional Tambang**:
  - *Inventory*: Saldo Stok, Valuasi Inventaris Finansial, Analisis Umur Stok (*Stock Aging*).
  - *Operation*: Riwayat Pengeluaran POS, Tren Konsumsi Bulanan, Konsumsi per Nomor Unit.
  - *Management*: Kinerja Efisiensi Pergudangan, Efisiensi Siklus Replenishment.
- **Mesin Ekspor Ganda**:
  - **Excel (`.xlsx`)**: Ekspor data terstruktur multi-kolom siap olah.
  - **PDF Standar Tambang**: Layout cetak resmi dilengkapi blok tanda tangan otorisasi (Dibuat, Diperiksa, Disetujui) standar SJS-VIPO.

### 7. Observability & Monitoring Produksi (Phase 12)
- **Prometheus Metrics (`/metrics`)**: Mengekspos metrik sistem, koneksi database pool, valuasi persediaan finansial, dan hitungan stok kritis.
- **Grafana Dashboard**: Template dashboard visual siap pakai (`deploy/monitoring/grafana/`).
- **Resource Limits & Log Rotation**: Konfigurasi Docker compose produksi dengan pembatasan CPU/memori dan rotasi log `json-file` (maks 50MB $\times$ 5 file).

---

## 👥 Akun Pengguna Demo (Password: `password123`)

| Username | Role | Scope Akses | Tanggung Jawab Operasional |
| :--- | :--- | :--- | :--- |
| `superadmin` | Super Admin | Seluruh Gudang | Administrasi teknis, konfigurasi sistem, audit log, RBAC matrix |
| `manager` | Manager Logistik | Seluruh Gudang | Manajemen pengguna, analisa KPI eksekutif, monitoring site |
| `supervisor_he` | Supervisor Alat Berat | `WH-MAIN-HE` & `WH-CONT-HE` | Otorisasi permohonan replenishment & adjustment HE |
| `supervisor_dt` | Supervisor Dump Truck | `WH-MAIN-DT` & `WH-CONT-DT` | Otorisasi permohonan replenishment & adjustment DT |
| `admin_main_he` | Admin Gudang Utama HE | `WH-MAIN-HE` | Verifikasi ketersediaan stok & dispatch Drop STO HE |
| `admin_main_dt` | Admin Gudang Utama DT | `WH-MAIN-DT` | Verifikasi ketersediaan stok & dispatch Drop STO DT |
| `admin_cont_he` | Admin Kontainer HE | `WH-CONT-HE` | POS pengeluaran part HE, pengajuan buffer, penerimaan STO |
| `admin_cont_dt` | Admin Kontainer DT | `WH-CONT-DT` | POS pengeluaran part DT, pengajuan buffer, penerimaan STO |

---

## ⚙️ Environment Variables

| Variable | Deskripsi | Default / Contoh |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://logisticqu:secret@localhost:5440/logisticqu_dev` |
| `PORT` | Port HTTP backend server | `8080` |
| `JWT_SECRET` | Secret key penandatanganan JWT | `super-secret-jwt-key-vale-indonesia-logisticqu-2026` |
| `JWT_EXPIRATION_HOURS` | Masa berlaku access token (jam) | `1` |
| `REFRESH_TOKEN_EXPIRATION_DAYS` | Masa berlaku refresh token (hari) | `30` |
| `RUST_LOG` | Tingkat logging backend | `info` |

---

## 🚀 Panduan Menjalankan Sistem

### 1. Menjalankan Database PostgreSQL Dev (Docker)
```bash
docker compose -f deploy/docker-compose.dev.yml up -d
```
Database akan aktif pada `localhost:5440` (User: `logisticqu`, DB: `logisticqu_dev`, Pass: `logisticqu_secret`).

### 2. Menjalankan Backend (Rust)
```bash
cd backend
export DATABASE_URL="postgres://logisticqu:logisticqu_secret@127.0.0.1:5440/logisticqu_dev"
export PORT=8080
export JWT_SECRET="super-secret-jwt-key-vale-indonesia-logisticqu-2026"
export RUST_LOG=info
cargo run --release
```

### 3. Menjalankan Frontend (React Vite)
```bash
cd frontend
pnpm install
pnpm dev
```
Akses antarmuka web melalui: `http://localhost:5173`.

---

## 🧪 Strategi Pengujian (Testing Strategy)

LogistikQu dilengkapi rangkaian pengujian bertingkat dengan cakupan alur kritis $\ge 80\%$:

```bash
# 1. Rust Domain Business Rules Unit Test (ROP, Recommended Qty, Aging, Velocity)
cd backend
DATABASE_URL="postgres://logisticqu:logisticqu_secret@127.0.0.1:5440/logisticqu_dev" cargo test --test unit_domain_rules_test

# 2. Frontend Component & State Machine Workflow Unit Tests (Node 24 native)
cd frontend
npm test

# 3. Enterprise Integration & API Test Suite (5 Critical Domains, 100% Coverage)
./test_enterprise_test_suite.sh

# 4. End-to-End Operational Workflow Simulation (POS -> Replenishment -> Drop -> Receipt)
./test_e2e_flow.sh
```

---

## 🚢 Panduan Deployment Produksi

### Deployment dengan Docker Compose Produksi:
```bash
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

### Eksekusi Deployment ke VPS:
```bash
bash deploy/deploy.sh
```
Aplikasi akan online pada domain: **`https://logistik.sjsgroup.online`** via Nginx reverse proxy.

---

## 📚 Dokumentasi Teknis Tambahan
- [Entity Relationship Diagram (ERD)](docs/ERD.md)
- [REST API Documentation](docs/API_DOCUMENTATION.md)
- [Operational Workflow Diagrams](docs/WORKFLOW_DIAGRAMS.md)
- [Android Mobile Platform Architecture](docs/MOBILE_ARCHITECTURE.md)
- [Developer & Contributing Guide](docs/DEVELOPER_GUIDE.md)
