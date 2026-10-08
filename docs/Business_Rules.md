# LogisticQu — Business Rules & Workflow Specification

## 1. Konsep Dasar Pergudangan & Kepemilikan Stok
* **BR-001 (Container Stock Ownership)**: Saldo fisik on-hand persediaan (inventory_stock) dikelola dan dimonitor secara real-time pada level **Gudang Kontainer** (Gudang Kontainer Alat Berat & Gudang Kontainer Dump Truck).
* **BR-002 (Main Warehouse Supply/Drop Record)**: Gudang Utama (Alat Berat & Dump Truck) bertindak sebagai supply hub pusat. Sistem tidak mengunci persediaan on-hand Gudang Utama, melainkan mencatat akumulasi & riwayat pasokan yang di-drop ke masing-masing Gudang Kontainer (main_warehouse_drops / stock_transfer_orders).
* **BR-003 (Non-Negative Stock)**: Saldo fisik persediaan di Gudang Kontainer tidak boleh bernilai negatif (\qty_on_hand >= 0\). Setiap transaksi pengurangan stok diverifikasi secara atomik dengan database lock (\FOR UPDATE\).

## 2. Pengambilan Spare Part (POS Issue Transaction & Full Traceability)
* **BR-010 (Mandatory Traceability)**: Admin Kontainer tidak dapat menyelesaikan transaksi pengeluaran spare part jika data berikut tidak terisi:
  1. Site Pengguna (Site A, Site B, Workshop, dll.)
  2. Nama Pengambil / Penanggung Jawab
  3. Identitas Unit (Nomor Lambung, Nama Unit, Tipe Alat)
  4. Nama Mekanik yang bertugas
  5. Kuantitas & Spare Part yang diambil
* **BR-011 (Duplicate Issue Prevention Warning)**: Jika unit yang sama mengajukan pengambilan spare part yang sama dalam rentang waktu < 30 menit dari transaksi sebelumnya, sistem memunculkan pop-up konfirmasi peringatan guna mencegah duplikasi atau penyalahgunaan.
* **BR-012 (Critical Part Release Approval)**: Untuk spare part yang ditandai sebagai *Critical Component* (\equires_issue_approval = true\), transaksi POS menghasilkan status PENDING_APPROVAL dan memerlukan persetujuan Supervisor sebelum stok dipotong dan barang diserahkan.

## 3. Alur Replenishment & Multi-Tier Approval
* **BR-020 (Rekomendasi Pemesanan Otomatis)**:
  \  Recommended Order = (Average Daily Usage 30 Hari * Lead Time) + Safety Stock - Current On-Hand Stock
  \* **BR-021 (Lifecycle Permintaan Stok)**:
  1. **REQUESTED**: Admin Kontainer mengajukan draft replenishment ke Gudang Utama.
  2. **VERIFIED**: Admin Gudang Utama menelaah request. Admin Utama berhak mengedit kuantitas, menambah atau mencoret item sesuai ketersediaan suplai, lalu meneruskan ke Supervisor.
  3. **RETURNED_TO_CONTAINER_ADMIN (dari Admin Utama)**: Jika Admin Utama menolak permohonan di awal, request dikembalikan ke Admin Kontainer dengan alasan tertulis.
  4. **APPROVED**: Supervisor menyetujui pengajuan yang telah diverifikasi Admin Utama. Surat Transfer Order (STO / Drop Order) otomatis diterbitkan.
  5. **RETURNED_TO_MAIN_ADMIN (dari Supervisor)**: Jika Supervisor menolak, permohonan dikembalikan ke Admin Gudang Utama beserta catatan koreksi.
     - Admin Gudang Utama dapat merevisi dan mengajukan kembali ke Supervisor (\RESUBMIT_TO_SUPERVISOR\), atau
     - Mengembalikan permohonan ke Admin Kontainer (\RETURN_TO_CONTAINER_ADMIN\).
  6. **IN_TRANSIT**: Admin Gudang Utama mengeksekusi pengiriman/drop barang ke kontainer.
  7. **COMPLETED**: Admin Kontainer melakukan penerimaan fisik, kuantitas dikonfirmasi, saldo on-hand kontainer bertambah, dan tercatat dalam Drop History.

## 4. Penyesuaian Stok (Stock Adjustment / Opname)
* **BR-030 (Stock Opname Governance)**: Penyesuaian stok manual (selisih fisik vs sistem) wajib menyertakan alasan (rusak, hilang, koreksi hitung) dan memerlukan persetujuan Supervisor sebelum saldo disesuaikan. Setiap penyesuaian dicatat pada buku besar mutasi stok (\stock_movements\).

## 5. Keamanan & RBAC (Role-Based Access Control)
* **BR-040 (Warehouse Scoping)**: Setiap pengguna terikat pada satu atau lebih gudang penugasan. Admin Kontainer Dump Truck hanya berhak melihat dan memutasikan data Gudang Kontainer Dump Truck.
* **BR-041 (Immutable Audit Log)**: Seluruh aksi modifikasi (insert, update status, perubahan kuantitas) tercatat dalam tabel \udit_logs\ beserta user ID, IP address, waktu, old value, dan new value.
