# Developer Guide — LogistikQu Enterprise WMS

Panduan ini ditujukan bagi engineer yang mengembangkan dan memelihara repository **LogistikQu**.

---

## 1. Clean Architecture Standards

Backend disusun mengikuti arsitektur bersih 4 lapis:

```
backend/src/
├── api/             # Transport layer: HTTP routes, handlers, middleware (Axum)
├── application/     # Orchestration layer: Services, use cases, workflow logic
├── domain/          # Core domain: Entities, value objects, pure business rules
└── infrastructure/  # External adapters: Database (SQLx), repositories, security, metrics
```

### Aturan Arsitektur:
1. **Pemisahan Tanggung Jawab (Separation of Concerns)**:
   - Handler HTTP (`api/handlers/`) **dilarang keras** memanggil SQLx query langsung.
   - Semua manipulasi data dan orkestrasi transaksi wajib melalui Application Service (`application/services/`).
   - Rumus matematika murni dan evaluasi threshold wajib diletakkan pada Domain Rules (`domain/business_rules/`).
2. **Error Handling Terpusat**:
   - Selalu gunakan `AppError` dari `crate::error::AppError`.
   - Hindari penggunaan `.unwrap()` atau `.expect()` pada alur produksi.
   - Manfaatkan operator `?` untuk bubbling error ke handler.
3. **Database Transactions**:
   - Setiap operasi yang mengubah lebih dari satu tabel (contoh: penerimaan STO, pengeluaran POS, stock adjustment) **wajib** menggunakan `let mut tx = pool.begin().await?` dan diakhiri dengan `tx.commit().await?`.

---

## 2. Standar Frontend (React 19 + TypeScript)

### Struktur Folder:
```
frontend/src/
├── components/      # Reusable UI primitives (Glassmorphism, modal, badge, button)
├── context/         # Global state (AuthContext, ThemeContext)
├── features/        # Modular business domains
│   ├── inventory/
│   ├── replenishment/
│   ├── users/
│   ├── reports/
│   └── audit/
├── pages/           # Operational view pages
├── services/        # Axios API clients
├── tests/           # Component & workflow test suites
└── utils/           # Formatters, Excel export, PDF print generator
```

### Standar Koding:
- Gunakan TypeScript strict mode (`tsc -b` harus lulus 0 error).
- Styling menggunakan Tailwind CSS utility classes dengan konsistensi Glassmorphism design system.
- Hindari inline styling hardcode untuk warna palet standar tambang (slate, emerald, amber, rose).
- Pastikan seluruh tabel memiliki fallback `LoadingState` dan `EmptyState`.

---

## 3. Database Migration & SQLx Guidelines

### Menambahkan Migration Baru:
Semua perubahan skema database harus dibuat melalui SQL migration di folder `backend/migrations/`:
```bash
# Format penamaan file:
backend/migrations/<TIMESTAMP>_<deskripsi_singkat>.sql
```

Aturan Skema Enterprise:
- Setiap tabel transaksional wajib menyertakan kolom `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- Tabel master entitas wajib mendukung soft-delete dengan kolom `deleted_at TIMESTAMPTZ DEFAULT NULL`.
- Gunakan UUID v4 (`uuid_generate_v4()`) sebagai primary key untuk tabel transaksi dan log.
- Jangan pernah menghapus kolom yang sudah aktif di produksi tanpa masa deprecation.

---

## 4. Menjalankan Pengujian (Testing Guidelines)

### A. Unit Tests (Rust Domain Rules):
```bash
cd backend
DATABASE_URL="postgres://logisticqu:logisticqu_secret@127.0.0.1:5440/logisticqu_dev" cargo test --test unit_domain_rules_test
```

### B. Frontend Component & Workflow Tests:
```bash
cd frontend
npm test
```

### C. Enterprise Full Integration & API Test Suite:
```bash
./test_enterprise_test_suite.sh
```

### D. End-to-End Operational Flow Test:
```bash
./test_e2e_flow.sh
```

---

## 5. Pull Request & Deployment Checklist

Sebelum mengajukan Pull Request ke branch `main`:
- [ ] Backend berhasil di-compile release: `cargo build --release` (0 error).
- [ ] Frontend berhasil di-build: `npm run build` (0 error).
- [ ] Linter lulus: `oxlint` (frontend) & `cargo clippy` (backend).
- [ ] Seluruh unit test Rust & workflow test TypeScript lulus 100%.
- [ ] Script `./test_enterprise_test_suite.sh` berhasil lulus dengan coverage 100%.
- [ ] Setiap endpoint baru memiliki dokumentasi di `docs/API_DOCUMENTATION.md`.
- [ ] Perubahan skema tercatat dalam file migrasi SQL.
