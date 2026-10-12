# Workflow Diagrams — LogistikQu Enterprise WMS

Dokumen ini memuat diagram alur operasional, state machine, dan arsitektur data LogistikQu menggunakan standar diagram Mermaid.

---

## 1. Alur Siklus Replenishment & Drop STO (State Machine)

Diagram ini mengilustrasikan siklus hidup pengajuan buffer stock dari kontainer tambang ke gudang utama, verifikasi, approval supervisor, penerbitan drop STO, hingga penerimaan fisik barang.

```mermaid
sequenceDiagram
    autonumber
    actor ContAdmin as Admin Kontainer Lapangan
    actor MainAdmin as Admin Gudang Utama
    actor Spv as Supervisor Gudang
    participant WMS as Core WMS Engine (Backend)
    participant DB as PostgreSQL 17 (Ledger)

    Note over ContAdmin,WMS: Status Awal: Evaluasi Reorder Point
    ContAdmin->>WMS: GET /replenishment/intelligence (Cek ROP & Buffer)
    WMS-->>ContAdmin: Menampilkan Rekomendasi Qty & Low Stock Alerts
    ContAdmin->>WMS: POST /replenishment/requests (Pengajuan Permohonan)
    WMS->>DB: INSERT replenishment_requests (Status: REQUESTED)
    WMS-->>ContAdmin: No Tiket Terbit: REQ-2026XXXX-XXXXX
    WMS-->>MainAdmin: In-App & Email Alert (Permohonan Masuk)

    Note over MainAdmin,WMS: Tahap 2: Verifikasi Stok Gudang Utama
    MainAdmin->>WMS: PUT /replenishment/requests/{id}/verify (Penyesuaian Qty Koli)
    WMS->>DB: UPDATE status = VERIFIED, verified_qty tersimpan
    WMS-->>Spv: In-App Alert (Menunggu Approval Supervisor)

    Note over Spv,WMS: Tahap 3: Otorisasi Supervisor
    alt Supervisor Menolak Permohonan
        Spv->>WMS: PUT /replenishment/requests/{id}/supervisor-reject
        WMS->>DB: UPDATE status = RETURNED_TO_MAIN_ADMIN
        WMS-->>MainAdmin: Notifikasi Revisi Permohonan
    else Supervisor Menyetujui Permohonan
        Spv->>WMS: PUT /replenishment/requests/{id}/approve
        WMS->>DB: UPDATE status = IN_TRANSIT
        WMS->>DB: INSERT main_warehouse_drops (Terbit No Surat Jalan: DROP-XXXXX)
        WMS-->>MainAdmin: Cetak Dokumen STO Drop Fisik
        WMS-->>ContAdmin: Alert: Barang Sedang Dalam Perjalanan ke Site
    end

    Note over ContAdmin,WMS: Tahap 4: Penerimaan Fisik di Site
    ContAdmin->>WMS: POST /replenishment/requests/{id}/receive (Konfirmasi Masuk Rak)
    WMS->>DB: BEGIN TRANSACTION
    WMS->>DB: UPDATE status = COMPLETED
    WMS->>DB: UPDATE inventory_stock (Saldo on-hand bertambah)
    WMS->>DB: INSERT stock_movements (Tipe: DROP_IN, Immutable Ledger)
    WMS->>DB: COMMIT TRANSACTION
    WMS-->>ContAdmin: Saldo Kontainer Bertambah & Status Selesai
```

---

## 2. Diagram Transaksi Pengeluaran POS (Traceability BR-001 s/d BR-004)

Semua transaksi pengeluaran suku cadang dari gudang kontainer wajib memenuhi aturan validasi traceability ketat sebelum stok dipotong.

```mermaid
flowchart TD
    Start([Mekanik Meminta Suku Cadang di Loket Kontainer]) --> InputForm[Admin Kontainer Input Data POS]
    InputForm --> CheckData{Kelengkapan Data BR-001 s/d BR-004}
    
    CheckData -->|Tidak Lengkap| RejectMissing[Tolak Transaksi: Wajib No Unit, HM/KM, Site, Mekanik, Work Order]
    CheckData -->|Lengkap| CheckDuplicate{Cek Jendela 30 Menit BR-003}
    
    CheckDuplicate -->|Ada Transaksi Serupa < 30 Mnt| WarnDuplicate[Munculkan Warning Konfirmasi Duplikasi Part & Unit]
    CheckDuplicate -->|Aman| CheckStock{Cek Saldo Fisik On-Hand Kontainer}
    
    WarnDuplicate --> OverrideCheck{Admin Konfirmasi Penggantian Darurat?}
    OverrideCheck -->|Tidak| CancelTx[Batal Transaksi]
    OverrideCheck -->|Ya, Dikonfirmasi| CheckStock
    
    CheckStock -->|Stok Kurang| RejectInsufficient[Tolak: Saldo Fisik On-Hand Tidak Mencukupi]
    CheckStock -->|Stok Cukup| BeginTx[Mulai Database Transaction]
    
    BeginTx --> DeductStock[Kurangi Saldo on-hand di inventory_stock]
    DeductStock --> InsertLedger[Tulis Immutable stock_movements Tipe ISSUE]
    InsertLedger --> InsertIssueHeader[Simpan issue_transactions]
    InsertIssueHeader --> LogAudit[Catat audit_logs Aktivitas Pengeluaran]
    LogAudit --> CheckThreshold{Apakah Pengeluaran > 3x Rata-rata Harian?}
    
    CheckThreshold -->|Ya, Abnormal| TriggerAlert[Kirim Notifikasi Abnormal Consumption ke Supervisor]
    CheckThreshold -->|Normal| CommitTx[COMMIT TRANSACTION]
    TriggerAlert --> CommitTx
    
    CommitTx --> PrintSlip[Cetak Bukti Pengeluaran Barang & Tanda Tangan Mekanik]
    PrintSlip --> End([Selesai])
```

---

## 3. Diagram Alur Pencatatan Immutable Stock Ledger

Setiap pergerakan barang dalam LogistikQu dicatat pada buku besar mutasi yang tidak dapat diubah (append-only ledger).

```mermaid
stateDiagram-v2
    [*] --> Inbound_Drop: Drop Suplai dari Gudang Utama
    [*] --> Inbound_Supplier: Penerimaan Awal / Vendor
    [*] --> Outbound_Issue: Pengeluaran ke Unit Armada
    [*] --> Transfer_Bin: Pindah Rak Kontainer
    [*] --> Adjustment_Opname: Hasil Stock Opname Fisik
    [*] --> Return_Core: Retur Komponen Bekas

    Inbound_Drop --> Immutable_Ledger: Movement Type: DROP_IN (+)
    Inbound_Supplier --> Immutable_Ledger: Movement Type: RECEIVE (+)
    Outbound_Issue --> Immutable_Ledger: Movement Type: ISSUE (-)
    Transfer_Bin --> Immutable_Ledger: Movement Type: TRANSFER (Relocate Bin)
    Adjustment_Opname --> Immutable_Ledger: Movement Type: ADJUSTMENT (+/-)
    Return_Core --> Immutable_Ledger: Movement Type: RETURN (+)

    Immutable_Ledger --> Balance_Verification: Validasi (Balance Lama +/- Qty = Balance Baru)
    Balance_Verification --> Audit_Trail: Catat ID Pelaku & Timestamp di audit_logs
    Audit_Trail --> [*]: Saldo On-Hand Terkini Valid
```

---

## 4. Diagram Integrasi Pemeliharaan & Pohon Konsumsi Aset (Equipment)

Sistem mengaitkan setiap pengeluaran suku cadang ke dalam pohon relasi aset pemeliharaan alat tambang untuk analisa Total Cost of Ownership (TCO).

```mermaid
graph TD
    Site[Site Operasional Tambang e.g. Petea / Sorowako]
    Site --> Equipment[Armada Unit e.g. Dump Truck HD785-7 / Excavator PC2000-8]
    Equipment --> HM_KM[Parameter Operasional: Current HM / KM]
    Equipment --> Component[Komponen Utama Unit]
    
    Component --> Engine[Engine System]
    Component --> Hydraulic[Hydraulic System]
    Component --> Transmission[Transmission & Drive Train]
    Component --> Brake[Braking System]
    
    Engine --> Part1[Filter Oli 600-211-1340]
    Engine --> Part2[Fan Belt Heavy Duty]
    Hydraulic --> Part3[High Pressure Main Pump Hose]
    Brake --> Part4[Heavy Duty Brake Shoe Lining]
    
    Part1 --> CostAnalysis[Cost Per Equipment Metric]
    Part2 --> CostAnalysis
    Part3 --> CostAnalysis
    Part4 --> CostAnalysis
    
    CostAnalysis --> FailureHistory[Component Failure History & MTBF Analytics]
```
