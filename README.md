# LogisticQu — PT Vale Mining Warehouse Management System (WMS)

**LogisticQu** adalah sistem manajemen pergudangan suku cadang khusus operasional tambang PT Vale Indonesia. Dirancang dengan keandalan tinggi, arsitektur modern berbasis **Rust** dan **React**, antarmuka Glassmorphism Dark Enterprise, serta keterlacakan (*traceability*) 100% dari penerimaan barang hingga instalasi pada unit armada alat berat dan *dump truck*.

---

## 🛠️ Tech Stack

- **Backend**: Rust 1.97, Axum 0.8, SQLx 0.8 (Compile-time checked queries), Tokio Async Runtime, Argon2, JWT.
- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, Glassmorphism UI.
- **Database**: PostgreSQL 17 dengan 27 tabel relasional terindeks.
- **Kontainerisasi & Gateway**: Docker Multi-stage, Docker Compose, Nginx Reverse Proxy.
- **Infrastruktur Target**: VPS Ubuntu Server (`187.77.156.109`), Domain: `logistik.sjsgroup.online`.

---

## ✨ Fitur Utama

1. **Multi-Warehouse Isolation**:
   - Gudang Utama Alat Berat (`WH-MAIN-HE`) & Gudang Utama Dump Truck (`WH-MAIN-DT`).
   - Gudang Kontainer Lapangan (`WH-CONT-HE` & `WH-CONT-DT`).
2. **Keterlacakan Total (Traceability BR-001 s/d BR-004)**:
   - Pengeluaran suku cadang wajib mencatat: Nomor Unit (Alat Berat / DT), Hour Meter / KM, Site Tambang, Penerima, dan Mekanik.
   - Peringatan transaksi duplikat dalam 30 menit.
3. **Kalkulasi Rekomendasi Pemesanan Otomatis (ADU Buffer)**:
   - Rumus: $\text{Reorder Qty} = (\text{Rata-rata Konsumsi Harian} \times \text{Lead Time}) + \text{Safety Stock} - \text{Stok Fisik}$.
4. **Alur Replenishment & Drop STO**:
   - Pengajuan Kontainer $\rightarrow$ Verifikasi & Koreksi Gudang Utama $\rightarrow$ Persetujuan Supervisor $\rightarrow$ Penerbitan Dokumen Drop STO $\rightarrow$ Penerimaan Fisik di Kontainer.
5. **Pencatatan Akumulasi Drop Gudang Utama**:
   - Log terpusat suplai/drop dari Gudang Utama ke Kontainer (`main_warehouse_drops`).
6. **Stock Opname & Immutable Audit Trail**:
   - Penyesuaian stok fisik wajib disetujui Supervisor sebelum mengubah saldo sistem.
   - Rekam jejak seluruh aksi dan snapshot perubahan data JSON.

---

## 👥 Akun Pengguna Demo (Password: `password123`)

| Username | Role | Cakupan Gudang | Keterangan & Tugas |
| :--- | :--- | :--- | :--- |
| `superadmin` | Super Admin | Seluruh Gudang | Akses teknis sistem, master data, konfigurasi |
| `manager` | Manager Logistik | Seluruh Gudang | Akses eksekutif seluruh gudang & **Manajemen Pengguna** |
| `supervisor_he` | Supervisor Alat Berat | `WH-MAIN-HE` & `WH-CONT-HE` | Khusus persetujuan divisi Alat Berat |
| `supervisor_dt` | Supervisor Dump Truck | `WH-MAIN-DT` & `WH-CONT-DT` | Khusus persetujuan divisi Dump Truck |
| `admin_main_he` | Admin Gudang Utama HE | `WH-MAIN-HE` | Verifikasi request & drop suplai ke kontainer HE |
| `admin_main_dt` | Admin Gudang Utama DT | `WH-MAIN-DT` | Verifikasi request & drop suplai ke kontainer DT |
| `admin_cont_he` | Admin Kontainer HE | `WH-CONT-HE` | POS pengeluaran part HE & pengajuan replenishment |
| `admin_cont_dt` | Admin Kontainer DT | `WH-CONT-DT` | POS pengeluaran part DT & pengajuan replenishment |

---

## 🚀 Menjalankan Secara Lokal

### 1. Database Dev (PostgreSQL Docker)
```bash
docker compose -f deploy/docker-compose.dev.yml up -d
```

### 2. Backend (Rust Axum)
```bash
cd backend
export DATABASE_URL="postgres://logisticqu:logisticqu_secret@127.0.0.1:5440/logisticqu_dev"
export PORT=8080
export JWT_SECRET="super-secret-jwt-key-vale-indonesia-logisticqu-2026"
export RUST_LOG=info
cargo run --release
```

### 3. Frontend Web (React Vite)
```bash
cd frontend
pnpm install
pnpm dev
```
Buka browser: `http://localhost:5173`

### 4. Menjalankan Tes Otomatis
```bash
bash test_smoke.sh      # Smoke test endpoint & auth
bash test_e2e_flow.sh   # Full cycle test (POS -> Replenishment -> Approval -> Receipt)
```

---

## 🌐 Deployment ke Production VPS

```bash
bash deploy/deploy.sh
```
Aplikasi akan aktif pada: **`http://logistik.sjsgroup.online`** / **`https://logistik.sjsgroup.online`**
