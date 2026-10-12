# LogistikQu Android Mobile — Enterprise Architecture & Developer Guide

Aplikasi Android Mobile LogistikQu dibangun sebagai klien operasional lapangan (*handheld scanner* dan tablet industri) untuk memfasilitasi aktivitas pergudangan suku cadang tambang SJS-VIPO secara **offline-first**, cepat, dan aman.

---

## 1. Spesifikasi Platform & Tech Stack

| Komponen | Spesifikasi & Teknologi |
| :--- | :--- |
| **Bahasa Pemrograman** | Kotlin 2.1 (100% Kotlin Coroutines & Flow) |
| **UI Toolkit** | Jetpack Compose + Material 3 (High Contrast Dark Theme) |
| **Arsitektur** | Clean Architecture + MVVM + Single Activity (`MainActivity`) |
| **Dependency Injection** | Dagger Hilt 2.53 |
| **Basis Data Lokal** | Room Database 2.6 (SQLite Offline Storage) |
| **Jaringan & REST API** | Retrofit 2.11 + OkHttp 4.12 + Gson Serialization |
| **Background Sync** | AndroidX WorkManager 2.10 (Periodic & Opportunistic Workers) |
| **Keamanan Data** | Jetpack DataStore Preferences + AndroidX Security Crypto |
| **Pemindaian Barcode** | CameraX 1.4 + Google ML Kit Barcode Scanning |
| **Autentikasi Perangkat** | AndroidX Biometric (BiometricPrompt / Fingerprint) |
| **Lokasi & Push Notif** | Play Services Location (GPS Audit) & Firebase Cloud Messaging (FCM) |
| **Target Perangkat** | Android Enterprise Rugged Handhelds (Zebra, Honeywell, Point Mobile) & Tablets |
| **OS Requirement** | Android 10+ (API 29) s/d Android 15+ (API 35) |

---

## 2. Struktur Proyek Clean Architecture

```
android/app/src/main/java/com/sjs/logistikqu/
├── LogistikQuApp.kt              # @HiltAndroidApp, WorkManager initialization
├── MainActivity.kt               # Single Activity, FLAG_SECURE, Compose NavHost
├── di/                           # Dagger Hilt Modules:
│   ├── NetworkModule             # OkHttpClient, Retrofit, AuthInterceptor
│   ├── DatabaseModule            # Room Database & DAOs
│   └── RepositoryModule          # Interface to Implementation bindings
├── domain/                       # Core Business Logic (Framework Independent):
│   ├── entities/                 # User, InventoryStock, Equipment, SyncQueueItem
│   ├── repository/               # Auth, Inventory, Issue, Receive, Transfer, Sync
│   └── usecase/                  # Login, StockCheck, IssuePart, ProcessBarcode
├── data/                         # Data Access & Adapters:
│   ├── api/                      # Retrofit Service, AuthInterceptor, Network DTOs
│   ├── database/                 # Room Database, DAOs, Room Entities (sync_queue)
│   ├── datastore/                # UserPreferencesManager (DataStore)
│   ├── mapper/                   # Entity <-> DTO <-> Domain converters
│   └── repository/               # Repository Implementations (Offline-First Engine)
├── presentation/                 # User Interface Layer:
│   ├── theme/                    # High contrast industrial colors & typography
│   ├── navigation/               # Screen routes & NavHost graph
│   ├── components/               # IndustrialButton (56dp), TextFields, Badges
│   └── screens/
│       ├── auth/                 # LoginScreen (Username, Password, Biometric)
│       ├── dashboard/            # DashboardScreen (Action tiles, metrics, sync)
│       ├── stockcheck/           # StockCheckScreen (Scan Bin -> Scan Part -> Count)
│       ├── issue/                # SparePartIssueScreen (BR-001 - BR-004 POS flow)
│       ├── receive/              # GoodsReceiveScreen (Scan STO -> Verify -> Proof)
│       ├── transfer/             # WarehouseTransferScreen (Inter-WH movements)
│       ├── scanner/              # CameraXScannerScreen + ML Kit Analyzer
│       └── sync/                 # SyncQueueScreen (Offline pending operations)
├── worker/                       # WorkManager SyncWorker & SyncScheduler
├── security/                     # SecurityManager (FLAG_SECURE, Root check, Biometric)
└── fcm/                          # LogistikQuFirebaseService (Push notifications)
```

---

## 3. Strategi Arsitektur Offline-First & Sync Engine

Aplikasi dirancang agar **seluruh alur operasional tetap berjalan 100% tanpa jaringan internet**:

```
[Aksi Petugas di Gudang]
         │
         ▼
[Simpan ke Room DB Lokal] ──► [Potong / Tambah Saldo On-Hand Lokal Seketika]
         │
         ▼
[Enkripsi & Antrekan ke Tabel sync_queue (Status: PENDING)]
         │
         ▼
[Cek Konektivitas Jaringan (WorkManager Constraint: CONNECTED)]
         ├── Jika Offline: Data tetap aman di SQLite lokal, siap dipakai transaksi berikutnya.
         └── Jika Online:
                  │
                  ▼
         [Background Sync Engine (SyncWorker)]
                  │
                  ▼
         [Kirim Batch ke Backend /api/v1/sync/push atau Endpoint Spesifik]
                  │
                  ▼
         [Server Merespons Sukses 200 OK]
                  │
                  ▼
         [Update sync_queue (Status: SYNCED, synced_at: Timestamp)]
```

### Skema Tabel `sync_queue`:
- `id`: String (UUID v4)
- `transaction_type`: String (`ISSUE`, `RECEIVE`, `TRANSFER`, `STOCK_CHECK`, `ADJUSTMENT`)
- `payload`: Text (JSON string payload lengkap)
- `status`: String (`PENDING`, `IN_PROGRESS`, `SYNCED`, `FAILED`)
- `retry_count`: Int (Penghitung percobaan pengiriman ulang otomatis)
- `created_at`: Long (Timestamp milidetik saat transaksi dibuat)
- `synced_at`: Long? (Timestamp saat konfirmasi server diterima)
- `error_message`: Text? (Pesan diagnostik kegagalan jaringan jika ada)

---

## 4. Alur 4 Fitur Operasional Gudang (Warehouse Workflows)

### 1. Pengecekan Stok & Rak (Stock Checking)
- **Langkah 1**: Pindai barcode lokasi rak (`RACK-HE-A1` / `WH-CONT-HE`).
- **Langkah 2**: Pindai barcode nomor part suku cadang (`FLT-001`, `HOS-001`).
- **Langkah 3**: Sistem menampilkan part number, deskripsi, saldo on-hand sistem, batas minimum, dan zona rak.
- **Langkah 4**: Petugas menginput kuantitas fisik aktual $\rightarrow$ sistem menyimpan hasil hitung dan mengantrekan penyesuaian.

### 2. Pengeluaran POS Loket (Spare Part Issue)
- **Langkah 1**: Pindai nomor unit armada tambang (`DT-001`, `EX-201`).
- **Langkah 2**: Masukkan Hour Meter (HM/KM) aktual dan Work Order (WO).
- **Langkah 3**: Pindai ID Card mekanik penerima.
- **Langkah 4**: Pindai barcode suku cadang yang dikeluarkan & input kuantitas.
- **Langkah 5**: Ambil foto bukti barang dan kunci koordinat GPS site tambang.
- **Langkah 6**: Submit $\rightarrow$ saldo on-hand lokal terpotong seketika dan transaksi diantrekan secara aman.

### 3. Penerimaan Barang STO (Goods Receive)
- **Langkah 1**: Pindai dokumen pengiriman Surat Jalan Drop STO (`DROP-YYYYMMDD-XXXXX`).
- **Langkah 2**: Pindai item suku cadang yang diterima.
- **Langkah 3**: Verifikasi kuantitas fisik yang masuk ke rak kontainer.
- **Langkah 4**: Unggah foto bukti surat jalan fisik yang telah ditandatangani.
- **Langkah 5**: Konfirmasi $\rightarrow$ saldo fisik lokal kontainer bertambah.

### 4. Transfer Antar Gudang (Warehouse Transfer)
- **Langkah 1**: Pilih gudang asal (`WH-CONT-HE`) dan gudang tujuan (`WH-CONT-DT` / `WH-MAIN-HE`).
- **Langkah 2**: Pindai barcode barang yang dimutasi.
- **Langkah 3**: Masukkan kuantitas dan catatan keperluan mutasi $\rightarrow$ Submit.

---

## 5. Sistem Barcode & Integrasi Perangkat Keras

Modul pemindai memanfaatkan **CameraX** terintegrasi dengan **Google ML Kit Barcode Scanning**:
- **Format yang Didukung**: QR Code, Code 128, Code 39, EAN-13, EAN-8.
- **Mapping Prefix Otomatis**:
  - `PART-*`, `FLT-*`, `HOS-*`, `ENG-*`, `BRK-*`, `LUB-*` $\rightarrow$ Suku Cadang (*Spare Part*).
  - `DT-*`, `EX-*`, `DZ-*`, `GR-*`, `EQUIP-*` $\rightarrow$ Unit Armada Tambang (*Equipment*).
  - `WH-*`, `RACK-*`, `BIN-*`, `BAY-*` $\rightarrow$ Lokasi Rak Gudang (*Location Bin*).
  - `DROP-*`, `REQ-*`, `STO-*` $\rightarrow$ Dokumen Pengiriman (*Shipment Document*).

---

## 6. Standar Keamanan Seluler (Enterprise Mobile Security)

1. **Screenshot & Recording Protection**:
   - `SecurityManager.applyWindowSecurity(activity)` mengaktifkan flag `WindowManager.LayoutParams.FLAG_SECURE` pada `MainActivity` untuk mencegah tangkapan layar dan *screen snooping* data sensitif tambang.
2. **Autentikasi Biometrik**:
   - `BiometricAuthManager` memanfaatkan `BiometricPrompt` AndroidX untuk otentikasi sidik jari cepat saat operator menggunakan sarung tangan di loket.
3. **Penyimpanan Terenkripsi**:
   - Token otentikasi JWT dan kunci sesi disimpan dalam Jetpack DataStore yang diisolasi di direktori privat aplikasi (`/data/data/com.sjs.logistikqu/`).
4. **Deteksi Root & Tampering**:
   - Memeriksa jejak file superuser (`/system/bin/su`, `/data/local/su`) dan build tags `test-keys` sebelum mengizinkan transaksi finansial persediaan.
5. **Navigasi Berbasis Role**:
   - Operator Kontainer hanya memiliki akses ke menu eksekusi: *Stock Check, Issue, Receive, Transfer*.
   - Supervisor memiliki akses tambahan ke tile *Otorisasi Pengadaan & Approval Koreksi*.

---

## 7. Panduan Build & Konfigurasi APK

### Prasyarat:
- Android Studio Ladybug / Meerkat atau Gradle 8.8+
- JDK 17 (OpenJDK 17)
- Android SDK Build-Tools 35.0.0

### Perintah Build:

```bash
cd android

# 1. Menjalankan Unit Test
./gradlew test

# 2. Build Debug APK (Pengujian Internal / Pit Wi-Fi)
./gradlew assembleDebug
# Output APK: app/build/outputs/apk/debug/app-debug.apk

# 3. Build Release APK (Produksi Handheld Scanner)
./gradlew assembleRelease
# Output APK: app/build/outputs/apk/release/app-release.apk
```

### Instalasi ke Handheld Device (via ADB):
```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
