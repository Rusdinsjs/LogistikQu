# LogisticQu — Role-Based Access Control (RBAC) Matrix

## User Roles
1. **SUPER_ADMIN**: Administrator sistem dengan akses teknis penuh lintas modul, manajemen master, dan konfigurasi server.
2. **MANAGER**: Manager Logistik dengan akses eksekutif seluruh gudang, approval semua modul, dan **Manajemen Pengguna (CRUD user, role, dan alokasi gudang)**.
3. **SUPERVISOR_HE**: Supervisor Gudang Utama Alat Berat (khusus approval replenishment, adjustment opname, part kritikal untuk `WH-MAIN-HE` & `WH-CONT-HE`).
4. **SUPERVISOR_DT**: Supervisor Gudang Utama Dump Truck (khusus approval replenishment, adjustment opname, part kritikal untuk `WH-MAIN-DT` & `WH-CONT-DT`).
5. **MAIN_ADMIN_HE**: Admin Gudang Utama Alat Berat (verifikasi replenishment, supply drop ke Kontainer HE).
6. **MAIN_ADMIN_DT**: Admin Gudang Utama Dump Truck (verifikasi replenishment, supply drop ke Kontainer DT).
7. **CONTAINER_ADMIN_HE**: Admin Gudang Kontainer Alat Berat (import stok awal, transaksi POS, request replenishment).
8. **CONTAINER_ADMIN_DT**: Admin Gudang Kontainer Dump Truck (import stok awal, transaksi POS, request replenishment).

## Permission Matrix

| Fitur / Modul | Super Admin | Manager | Supervisor (HE/DT) | Admin Utama (HE/DT) | Admin Kontainer (HE/DT) |
|---|:---:|:---:|:---:|:---:|:---:|
| **Manajemen Pengguna & Role** | CRUD | CRUD | - | - | - |
| **Master Data (Part, Unit, Site)** | CRUD | View | View | View | View |
| **Import Stok Awal (Excel/Manual)** | Full | Full | - | - | Milik Kontainer |
| **Lihat Dashboard Stok** | Semua | Semua | Gudang Divisi | Gudang Divisi | Kontainer Terkait |
| **POS Issue Spare Part** | Full | Full | - | - | Kontainer Terkait |
| **Approval Part Kritikal** | Full | Full | Approve/Reject Divisi | - | - |
| **Buat Request Replenishment** | Full | Full | - | - | Kontainer Terkait |
| **Verifikasi Request Replenishment**| Full | Full | - | Gudang Terkait | - |
| **Persetujuan Request (Supervisor)**| Full | Full | Approve/Reject Divisi | - | - |
| **Eksekusi Drop / STO** | Full | Full | - | Gudang Terkait | - |
| **Konfirmasi Terima Drop** | Full | Full | - | - | Kontainer Terkait |
| **Stock Adjustment (Opname)** | Full | Full | Approve/Reject Divisi | - | Ajukan Koreksi |
| **Laporan & Analytics** | Semua | Semua | Gudang Divisi | Gudang Divisi | Kontainer Terkait |
| **Audit Logs** | Full | Full | View | - | - |

