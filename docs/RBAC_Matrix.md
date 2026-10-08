# LogisticQu — Role-Based Access Control (RBAC) Matrix

## User Roles
1. **SUPER_ADMIN**: Administrator sistem dengan akses penuh lintas modul, manajemen user, role, dan konfigurasi master.
2. **SUPERVISOR**: Penanggung jawab persetujuan replenishment, stock adjustment opname, dan approval part kritikal.
3. **MAIN_ADMIN_HE**: Admin Gudang Utama Alat Berat (verifikasi replenishment, supply drop ke Kontainer HE).
4. **MAIN_ADMIN_DT**: Admin Gudang Utama Dump Truck (verifikasi replenishment, supply drop ke Kontainer DT).
5. **CONTAINER_ADMIN_HE**: Admin Gudang Kontainer Alat Berat (import stok awal, transaksi POS, request replenishment).
6. **CONTAINER_ADMIN_DT**: Admin Gudang Kontainer Dump Truck (import stok awal, transaksi POS, request replenishment).

## Permission Matrix

| Fitur / Modul | Super Admin | Supervisor | Admin Utama (HE/DT) | Admin Kontainer (HE/DT) |
|---|:---:|:---:|:---:|:---:|
| **Manajemen Pengguna & Role** | CRUD | View | - | - |
| **Master Data (Part, Unit, Site)** | CRUD | View | View | View |
| **Import Stok Awal (Excel/Manual)** | Full | - | - | Milik Kontainer |
| **Lihat Dashboard Stok** | Semua | Gudang Terkait | Gudang Terkait | Kontainer Terkait |
| **POS Issue Spare Part** | Full | - | - | Kontainer Terkait |
| **Approval Part Kritikal** | Full | Approve/Reject | - | - |
| **Buat Request Replenishment** | Full | - | - | Kontainer Terkait |
| **Verifikasi Request Replenishment**| Full | - | Gudang Terkait | - |
| **Persetujuan Request (Supervisor)**| Full | Approve/Reject | - | - |
| **Eksekusi Drop / STO** | Full | - | Gudang Terkait | - |
| **Konfirmasi Terima Drop** | Full | - | - | Kontainer Terkait |
| **Stock Adjustment (Opname)** | Full | Approve/Reject | - | Ajukan Koreksi |
| **Laporan & Analytics** | Semua | Gudang Terkait | Gudang Terkait | Kontainer Terkait |
| **Audit Logs** | Full | View | - | - |
