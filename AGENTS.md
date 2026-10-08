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
4. **Target VPS**:
   - Host: `187.77.156.109`
   - User: `root`
   - Nginx Gateway VPS melayani domain `logistik.sjsgroup.online` via reverse proxy ke port internal host `172.18.0.1:8090`.

---

## 3. Akun Pengguna Demo (Password: `password123`)
- `admin_cont_he` : Admin Kontainer Heavy Equipment (`WH-CONT-HE`)
- `admin_cont_dt` : Admin Kontainer Dump Truck (`WH-CONT-DT`)
- `admin_main_he` : Admin Gudang Utama HE (`WH-MAIN-HE`)
- `admin_main_dt` : Admin Gudang Utama DT (`WH-MAIN-DT`)
- `supervisor`    : Supervisor Operasional Gudang
- `superadmin`    : Super Admin Sistem

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

### Menjalankan Smoke Test & E2E Test:
```bash
bash test_smoke.sh
bash test_e2e_flow.sh
```

### Deploy ke VPS:
```bash
bash deploy/deploy.sh
```
