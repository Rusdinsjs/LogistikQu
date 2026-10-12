# AGENTS.md — Panduan Handover untuk Agen Antigravity di Komputer Lain

Dokumen ini ditujukan sebagai **panduan transfer konteks** bagi asisten AI Antigravity pada perangkat/mesin baru agar dapat langsung memahami arsitektur, status terakhir, dan melanjutkan pengembangan tanpa kehilangan konteks.

---

## 1. Ringkasan Status Proyek (Saat ini)
- **Fase 1 (Arsitektur, Dokumentasi, Desain Sistem)**:  **Selesai 100%**
- **Fase 2 (Core Web & Backend Implementation)**:  **Selesai 100%**
  - Backend: Rust 1.97 + Axum 0.8 + SQLx 0.8 + PostgreSQL 17 (berhasil di-compile `cargo build --release`, single binary 11MB).
  - Database: 27 tabel, 10 index, seed data 4 gudang, master suku cadang, armada unit, dan 6 akun demo.
  - Frontend: React 19 + TypeScript + Vite 8 + Tailwind CSS v4 (Glassmorphism Enterprise UI, 10 halaman operasional lengkap, `pnpm build` lulus 0 error).
  - Validasi E2E: Siklus POS Issue $\rightarrow$ Rekomendasi Reorder $\rightarrow$ Verifikasi Admin Utama $\rightarrow$ Approval Supervisor $\rightarrow$ Drop STO $\rightarrow$ Penerimaan Barang Kontainer teruji 100% lulus.
  - Deployment Ready: Dockerfile backend (debian:bookworm-slim), Dockerfile frontend (nginx:alpine), docker-compose, konfigurasi vhost Nginx `logistik.sjsgroup.online`.
- **Fase 3 (Next Steps)**:
  - Eksekusi deployment ke VPS (`./deploy/deploy.sh` ke `root@187.77.156.109`).
  - Aplikasi Mobile Android (Kotlin offline-first dengan SQLite/Room & sync engine) sesuai roadmap PRD.

---

## 2. Arsitektur & Aturan Bisnis Kunci
1. **Stok Gudang Utama vs Gudang Kontainer**:
   - Sistem **tidak** mengelola saldo fisik on-hand Gudang Utama.
   - Sistem mencatat **akumulasi & log drop/suplai** dari Gudang Utama ke Gudang Kontainer (`main_warehouse_drops`).
   - Saldo on-hand fisik dikelola secara ketat pada level Gudang Kontainer (`inventory_stock`).
2. **Traceability BR-001 s/d BR-004**:
   - Tidak ada transaksi pengeluaran (issue) yang dapat disetujui tanpa: No Unit, HM/KM, Site Tambang, Penerima, Mekanik.
   - Algoritma duplicate warning aktif pada jendela 30 menit untuk unit dan part yang sama.
3. **State Machine Replenishment**:
   - `REQUESTED` $\rightarrow$ `VERIFIED` (oleh Admin Utama) $\rightarrow$ `APPROVED` (oleh Supervisor) $\rightarrow$ `IN_TRANSIT` (Dokumen Drop STO terbit) $\rightarrow$ `COMPLETED` (Diterima Admin Kontainer, saldo fisik kontainer bertambah).
   - Jika ditolak Supervisor: status menjadi `RETURNED_TO_MAIN_ADMIN`. Admin Utama dapat merevisi/mengajukan ulang (`VERIFIED`) atau mengembalikan ke kontainer (`RETURNED_TO_CONTAINER_ADMIN`).
4. **Fitur Permohonan Stok Mekanik (Mechanic Stock Requests)**:
   - Mekanik memiliki akun sendiri (`role = 'MECHANIC'`) terhubung ke `employees` melalui `users.employee_id`.
   - Mekanik dapat mengajukan penggantian (`REPLACEMENT`) dan pengembalian (`RETURN`) suku cadang via Web dan Android.
   - Sesuai kebijakan RBAC terbaru: **Admin Kontainer diblokir dari menu & endpoint permohonan mekanik** agar pemisahan tugas (*separation of duties*) terjaga.
   - Alur persetujuan diproses oleh **Supervisor** (`SUPERVISOR` / `SUPERVISOR_HE` / `SUPERVISOR_DT`): `SUBMITTED` $\rightarrow$ `APPROVED` $\rightarrow$ `COMPLETED`. Dilengkapi alur revisi (`REVISION_REQUESTED`), tolak (`REJECTED`), dan pembatalan (`CANCELLED`).
   - Dokumen permohonan: `MRQ-...`.
   - Pada pemenuhan (`fulfill`) tipe `REPLACEMENT`: otomatis menerbitkan transaksi POS loket `issue_transactions` (`ISS-...`), memotong saldo fisik `inventory_stock`, mencatat `stock_movements`, dan menerbitkan tanggungan core retur `used_part_returns` (`RET-...`).
   - Pada pemenuhan (`fulfill`) tipe `RETURN`: menambah saldo fisik `inventory_stock` dan mencatat `stock_movements` (`ADJUSTMENT_IN`).
5. **Fitur Quick-Add Data Master Unit & Mekanik (On-the-Fly)**:
   - **Admin Kontainer**: dapat mendaftarkan Unit Equipment baru (`POST /api/v1/master/equipment`) dan Mekanik baru (`POST /api/v1/master/employees`) secara langsung dari popup POS Loket jika nomor lambung atau mekanik belum terdaftar, tanpa membuka menu Master Data global (`master.manage`).
   - **Mekanik**: dapat mendaftarkan Unit Equipment baru (`POST /api/v1/master/equipment`) secara langsung dari dialog form permohonan jika nomor lambung belum ada di database, tanpa dapat menambah mekanik/karyawan (`403 Forbidden`).
   - Di Android, dialog Quick-Add bekerja dengan fallback offline lokal jika jaringan pit terputus.
6. **Matriks Hak Akses & Menu Sidebar/Dashboard Terisolasi**:
   - Web Sidebar dan Android Dashboard memfilter menu secara ketat per peran:
     - **Mekanik**: Hanya Permohonan Stok Mekanik & Cek Katalog Stok.
     - **Admin Kontainer**: POS Loket, Pengembalian Part, Pengajuan Reorder/Penerimaan STO, Stock Opname, Multi-Gudang Bins, Laporan Kontainer (diblokir dari Permohonan Mekanik, Drop STO Pengiriman, dan Master Data & Unit).
     - **Admin Utama**: Verifikasi Reorder, Pengiriman Drop STO, Kelola Pengguna, Laporan Logistik (diblokir dari POS Issue, Permohonan Mekanik, Stock Opname fisik, dan Master Data & Unit).
     - **Supervisor**: Approval Reorder, Approval Stock Opname, Retur Part Bekas, Monitoring Multi-Gudang, Laporan Logistik (diblokir dari Layout & Denah Bin Rak, Permohonan Mekanik, POS Issue Loket, Master Data & Unit, dan Kelola Pengguna).
7. **Fitur Multi-Item Stock Opname (Penyesuaian Fisik Batch)**:
   - Pengajuan Stock Opname dilakukan secara **batch / multi-item dalam 1 paket dokumen** (`ADJ-...`).
   - Admin Kontainer dapat memanfaatkan tombol *"⚡ Muat Semua Stok Gudang"* untuk menarik seluruh suku cadang aktif secara otomatis atau menambah suku cadang pilihan secara manual.
   - Perhitungan variance (selisih = fisik - sistem), rasio akurasi stok (IRA %), dan badge visual (Cocok / Surplus / Shortage) dihitung otomatis realtime.
   - Supervisor dapat memeriksa seluruh rincian item, memfilter hanya item yang berselisih, lalu melakukan **Setujui (Approve)** atau **Tolak (Reject)** secara kolektif per dokumen.
   - Saat disetujui: saldo `inventory_stock` diperbarui dan `stock_movements` dicatat untuk setiap baris barang yang berselisih.
8. **Kewajiban Cetak Struk & Tanda Tangan Mekanik (BR-005 Mandatory Receipt & Signature)**:
   - Setiap transaksi pengeluaran loket POS di Gudang Kontainer wajib memiliki tanda tangan sah dari mekanik penanggung jawab.
   - Pilihan tanda tangan:
     1. **Digital di Layar**: mekanik membubuhkan tanda tangan langsung di canvas touchscreen/HP (`signature_type = 'DIGITAL'`).
     2. **Fisik di Struk**: Admin mencetak struk fisik lalu mekanik menandatangani secara basah di struk (`signature_type = 'PHYSICAL'`).
   - Struk pengeluaran (*Store Issue Voucher*) **wajib dicetak** oleh Admin Kontainer. Sistem memblokir penutupan dialog sebelum struk dicetak atau meminta konfirmasi ketat, dan mencatat status `receipt_printed = true` serta `receipt_printed_at` di server via endpoint `POST /api/v1/issues/{id}/print-receipt`.
   - Struk fisik memuat KOP resmi PT SJS, identitas unit/HM/KM/WO, rincian suku cadang, peringatan core return (BR-004), dan 3 kolom otorisasi (Admin Kontainer, Pengambil/Penerima, Mekanik).
   - Di aplikasi mobile Android, struk dapat dicetak via printer sabuk thermal Bluetooth (ESC/POS) maupun sistem print preview standar Android.
9. **Target VPS**:
   - Host: `187.77.156.109`
   - User: `root`
   - Nginx Gateway VPS melayani domain `logistik.sjsgroup.online` via reverse proxy ke port internal host `172.18.0.1:8090`.

---

## 3. Akun Pengguna Demo (Password: `password123`)
- `superadmin`    : Super Admin Sistem (Akses seluruh gudang & konfigurasi)
- `manager`       : Manager Logistik (Akses seluruh gudang & Manajemen Pengguna)
- `supervisor_he` : Supervisor Gudang Utama Alat Berat (`WH-MAIN-HE` & `WH-CONT-HE`)
- `supervisor_dt` : Supervisor Gudang Utama Dump Truck (`WH-MAIN-DT` & `WH-CONT-DT`)
- `admin_main_he` : Admin Gudang Utama HE (`WH-MAIN-HE`)
- `admin_main_dt` : Admin Gudang Utama DT (`WH-MAIN-DT`)
- `admin_cont_he` : Admin Kontainer Heavy Equipment (`WH-CONT-HE`)
- `admin_cont_dt` : Admin Kontainer Dump Truck (`WH-CONT-DT`)
- `mekanik_he`    : Mekanik Alat Berat (`EMP-101`, `WH-CONT-HE`)
- `mekanik_dt`    : Mekanik Dump Truck (`EMP-103`, `WH-CONT-DT`)

---

## 4. Perintah Cepat (Quick Commands)

### Menjalankan Database Dev (Docker):
```bash
docker compose -f deploy/docker-compose.dev.yml up -d
```
Database berjalan di `localhost:5440` (user: `logisticqu`, db: `logisticqu_dev`, pass: `logisticqu_secret`).

### Menjalankan Backend:
```bash
cd backend
export DATABASE_URL="postgres://logisticqu:logisticqu_secret@127.0.0.1:5440/logisticqu_dev"
export PORT=8080
export JWT_SECRET="super-secret-jwt-key-vale-indonesia-logisticqu-2026"
export RUST_LOG=info
cargo run
```

### Menjalankan Frontend:
```bash
cd frontend
pnpm install
pnpm dev
```

### Menjalankan Smoke Test, E2E Test, Mechanic Flow, Opname Flow & POS Signature Test:
```bash
bash test_smoke.sh
bash test_e2e_flow.sh
bash test_mechanic_flow.sh
bash test_opname_flow.sh
bash test_pos_signature_and_receipt.sh
```

### Deploy ke VPS:
```bash
bash deploy/deploy.sh
```
