# LogisticQu — Role-Based Access Control (RBAC) Matrix & Security Architecture

Dokumen ini menjelaskan arsitektur keamanan, matriks hak akses granular, kebijakan *multi-layer defense*, serta pemetaan wewenang pengguna pada sistem **LogisticQu** (PT Vale Indonesia Tbk - Mining Logistics System).

---

## 1. Arsitektur Keamanan (Defense-in-Depth)

LogisticQu menerapkan 5 lapisan proteksi akses (*Defense-in-Depth*):

```
+-------------------------------------------------------------------------+
| Layer 1: JWT Authentication & Session Token                             |
| (Verifikasi integritas token HMAC-SHA256 & masa berlaku)                |
+-------------------------------------------------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------------+
| Layer 2: Zero-Trust Endpoint Authorization                              |
| (Pemeriksaan granular check_permission / check_any_permission di Axum)  |
+-------------------------------------------------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------------+
| Layer 3: Warehouse Data Scoping & Segregation                           |
| (Isolasi data berbasis gudang: WH-MAIN-HE, WH-MAIN-DT, WH-CONT-*)       |
+-------------------------------------------------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------------+
| Layer 4: Field-Level Financial Data Masking                             |
| (Sensor harga & total biaya Rp 0,00 untuk peran non-finansial)          |
+-------------------------------------------------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------------+
| Layer 5: Reactive UI Guarding & Interactive 2D Permission Matrix        |
| (Penyembunyian menu, tombol aksi, serta konfigurasi visual wewenang)    |
+-------------------------------------------------------------------------+
```

---

## 2. Definisi 8 Peran Pengguna (User Roles)

| Kode Peran | Nama Peran | Deskripsi Wewenang | Cakupan Gudang |
|---|---|---|---|
| `SUPER_ADMIN` | Super Administrator | Akses penuh teknis lintas modul, konfigurasi sistem, audit, finansial | Seluruh Gudang (Bypass Scope) |
| `MANAGER` | Logistics Manager | Akses manajemen operasional, approval eksekutif, kelola user & role, laporan | Seluruh Gudang (Semua Divisi) |
| `SUPERVISOR_HE` | Supervisor Alat Berat | Approval pengajuan reorder, part kritikal, opname fisik divisi HE | `WH-MAIN-HE` & `WH-CONT-HE` |
| `SUPERVISOR_DT` | Supervisor Dump Truck | Approval pengajuan reorder, part kritikal, opname fisik divisi DT | `WH-MAIN-DT` & `WH-CONT-DT` |
| `MAIN_ADMIN_HE` | Admin Gudang Utama HE | Verifikasi permintaan barang, drop/shipment STO ke kontainer HE | `WH-MAIN-HE` |
| `MAIN_ADMIN_DT` | Admin Gudang Utama DT | Verifikasi permintaan barang, drop/shipment STO ke kontainer DT | `WH-MAIN-DT` |
| `CONTAINER_ADMIN_HE` | Admin Kontainer HE | Operasional POS issue unit HE, request replenishment, terima drop STO | `WH-CONT-HE` |
| `CONTAINER_ADMIN_DT` | Admin Kontainer DT | Operasional POS issue unit DT, request replenishment, terima drop STO | `WH-CONT-DT` |

---

## 3. Matriks Hak Akses Lengkap (27 Permissions x 8 Roles)

Keterangan simbol:
- ✅ = Diizinkan (*Granted*)
- ❌ = Dilarang (*Denied / 403 Forbidden*)

### Kategori 1: Master Data
| Permission Code | Nama Izin | SA | MGR | SPV HE | SPV DT | MAIN HE | MAIN DT | CONT HE | CONT DT |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `parts.view` | Lihat Katalog Suku Cadang | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `parts.manage` | Kelola Katalog Suku Cadang | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `units.view` | Lihat Data Unit Tambang | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `units.manage` | Kelola Data Unit Tambang | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `warehouses.view` | Lihat Master Gudang | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `warehouses.manage` | Kelola Master Gudang | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Kategori 2: Inventori & Lokasi Rak
| Permission Code | Nama Izin | SA | MGR | SPV HE | SPV DT | MAIN HE | MAIN DT | CONT HE | CONT DT |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `inventory.view` | Lihat Saldo & Kartu Stok | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `inventory.adjust` | Penyesuaian / Opname Stok | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `bins.view` | Lihat Denah & Bin Rak | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bins.manage` | Atur Lokasi Rak / Bin | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

### Kategori 3: Pengeluaran Barang (POS Issue)
| Permission Code | Nama Izin | SA | MGR | SPV HE | SPV DT | MAIN HE | MAIN DT | CONT HE | CONT DT |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `issue.create` | Buat Transaksi POS Issue | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `issue.view` | Lihat Riwayat Pengeluaran | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `issue.approve_critical` | Persetujuan Part Kritikal | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Kategori 4: Pengadaan & Replenishment
| Permission Code | Nama Izin | SA | MGR | SPV HE | SPV DT | MAIN HE | MAIN DT | CONT HE | CONT DT |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `request.create` | Buat Permintaan Replenishment | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `request.view` | Lihat Daftar Replenishment | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `request.verify` | Verifikasi Admin Gudang Utama | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `request.approve` | Persetujuan Supervisor | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Kategori 5: Transfer Drop / STO (Stock Transfer Order)
| Permission Code | Nama Izin | SA | MGR | SPV HE | SPV DT | MAIN HE | MAIN DT | CONT HE | CONT DT |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `drops.view` | Lihat Status & Riwayat Drop | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `sto.ship` | Eksekusi Pengiriman Drop STO | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `sto.receive` | Konfirmasi Terima Fisik Kontainer | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

### Kategori 6: Pengembalian Barang (Returns)
| Permission Code | Nama Izin | SA | MGR | SPV HE | SPV DT | MAIN HE | MAIN DT | CONT HE | CONT DT |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `returns.create` | Buat Permohonan Retur | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `returns.view` | Lihat Riwayat Retur | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `returns.process` | Proses & Terima Retur di Gudang Utama | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |

### Kategori 7: Manajemen Sistem & Pengguna
| Permission Code | Nama Izin | SA | MGR | SPV HE | SPV DT | MAIN HE | MAIN DT | CONT HE | CONT DT |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `users.manage` | Kelola Pengguna & Akun | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `roles.manage` | Kelola Matriks Hak Akses | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `reports.view` | Akses Laporan & Audit Log | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Kategori 8: Finansial & Harga
| Permission Code | Nama Izin | SA | MGR | SPV HE | SPV DT | MAIN HE | MAIN DT | CONT HE | CONT DT |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `financial.view` | Lihat Nilai Uang (Harga Satuan & Total) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

### Rekapitulasi Total Wewenang Aktif per Peran
- **SUPER_ADMIN**: 27 / 27 izin (100%)
- **MANAGER**: 27 / 27 izin (100%)
- **SUPERVISOR_HE**: 14 / 27 izin (51.8%)
- **SUPERVISOR_DT**: 14 / 27 izin (51.8%)
- **MAIN_ADMIN_HE**: 11 / 27 izin (40.7%)
- **MAIN_ADMIN_DT**: 11 / 27 izin (40.7%)
- **CONTAINER_ADMIN_HE**: 15 / 27 izin (55.5%)
- **CONTAINER_ADMIN_DT**: 15 / 27 izin (55.5%)

---

## 4. Perlindungan Endpoint REST API

Setiap endpoint backend diproteksi secara deterministik pada tingkat handler:

```rust
// Contoh perlindungan zero-trust pada backend
if !claims.check_permission("issue.create") {
    return Err(AppError::Forbidden("Wewenang issue.create diperlukan untuk menerbitkan barang".into()));
}

// Perlindungan akses multi-alternatif
if !claims.check_any_permission(&["inventory.view", "issue.create"]) {
    return Err(AppError::Forbidden("Akses ditolak: izin inventori diperlukan".into()));
}

// Sensor finansial dinamis
let mask_financial = !claims.check_permission("financial.view");
let unit_cost = if mask_financial { Decimal::ZERO } else { row.unit_cost };
```

---

## 5. Antarmuka Manajemen Matriks (Frontend UI)

Pada halaman **Manajemen Pengguna** (`frontend/src/pages/UsersPage.tsx`), tersedia tab **"Matriks Hak Akses (RBAC)"** dengan 2 mode operasional:

1. **Mode Tabel Matriks Grid (8 Peran x 27 Izin)**:
   - Menampilkan tabel komprehensif dua dimensi.
   - Kolom menampilkan 8 peran dengan indikator jumlah izin aktif.
   - Baris dikelompokkan rapi per kategori modul dengan badge warna.
   - Fitur *Bulk Actions*: Check All / Uncheck All per peran atau per baris izin.
   - Proteksi peran Super Admin (*root role locking* tidak dapat dikurangi secara tidak sengaja).
   - Deteksi perubahan real-time (*dirty state banner*) dan tombol simpan batch ke server.
   - Tombol **"Reset ke Standar PRD"** untuk memulihkan konfigurasi pabrik kapan saja.

2. **Mode Inspeksi Per Peran**:
   - Tampilan kartu fokus untuk satu peran terpilih.
   - Audit visual mendalam per kategori wewenang.

---

## 6. Verifikasi Otomatis

Pengujian matriks hak akses dapat dijalankan melalui skrip:
```bash
# Uji coba end-to-end hak akses, restriksi endpoint, dan sensor finansial
bash test_matrix_hak_akses.sh
```
Skrip ini memvalidasi token JWT dari 8 peran terhadap seluruh endpoint sensitif dan memastikan tidak ada kebocoran wewenang (*privilege escalation*).
