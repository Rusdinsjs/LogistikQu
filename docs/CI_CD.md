# Panduan Lengkap: Menjalankan CI/CD LogisticQu

Ikuti langkah **berurutan**. Setiap langkah punya bagian **✅ Cek** — jangan lanjut sebelum cek lulus.

```mermaid
flowchart LR
  A["1. Verifikasi lokal"] --> B["2. Commit & push"]
  B --> C["3. Siapkan VPS"]
  C --> D["4. Deploy key SSH"]
  D --> E["5. Secrets GitHub"]
  E --> F["6. Environment production"]
  F --> G["7. Jalankan CI/CD pertama"]
  G --> H["8. Verifikasi & rollback test"]
  H --> I["9. Branch protection"]
```

> [!NOTE]
> Langkah 1–2 dikerjakan di **laptop**, langkah 3–4 di **laptop + VPS**, langkah 5–6 & 9 di **website GitHub**.

---

## Langkah 1 — Verifikasi lokal (laptop, ±5 menit)

Tujuan: memastikan apa yang akan dijalankan CI sudah lulus di mesin Anda.

```bash
cd ~/Projects/LogistikQu

# 1a. Backend: format + test (mode offline, sama seperti CI)
cd backend
cargo fmt --all -- --check
SQLX_OFFLINE=true cargo test
cd ..

# 1b. Frontend: lint + test + build
cd frontend
pnpm install
pnpm lint
pnpm test
pnpm build
cd ..
```

**✅ Cek:** semua perintah selesai tanpa `error`. (Warning boleh.)

> [!IMPORTANT]
> Jika Anda **mengubah query SQL** setelah panduan ini dibuat, regenerasi metadata SQLx dulu (DB dev harus jalan):
> ```bash
> cargo install sqlx-cli --no-default-features --features postgres,rustls   # sekali saja
> cd backend
> export DATABASE_URL="postgres://logisticqu:logisticqu_secret@127.0.0.1:5440/logisticqu_dev"
> cargo sqlx prepare -- --all-targets
> cd ..
> ```

---

## Langkah 2 — Commit & push ke GitHub (laptop)

Saat ini banyak perubahan belum di-commit (fitur + CI/CD). **Semua harus ikut**, karena folder `backend/.sqlx` dibuat dari kode saat ini — jika kode dan `.sqlx` tidak sama, CI gagal.

```bash
git status                         # tinjau dulu
git add -A
git status                         # pastikan backend/.sqlx/ dan .github/workflows/ ikut,
                                   # dan TIDAK ada android/app/build/ atau .env
git commit -m "ci: add GitHub Actions CI/CD with GHCR deploy"
```

> [!CAUTION]
> **Jangan push dulu** jika ingin CD langsung deploy dengan benar — workflow CD akan jalan otomatis begitu CI lulus di `main`, dan akan **gagal** jika secret `VPS_SSH_KEY` belum ada (aman, tidak merusak apa pun, tapi merah).
> Pilihan yang disarankan: selesaikan **Langkah 3–6 dulu**, baru `git push`.

**✅ Cek:** `git log -1` menampilkan commit Anda; `ls backend/.sqlx | wc -l` ≈ 240.

---

## Langkah 3 — Siapkan VPS (sekali saja)

SSH ke VPS dari laptop:
```bash
ssh root@187.77.156.109
```

### 3a. Pastikan Docker & Compose v2 tersedia
```bash
docker --version
docker compose version        # harus "Docker Compose version v2.x"
curl --version | head -1
```
Jika `docker compose` tidak ada: `apt-get update && apt-get install -y docker-compose-plugin`.

### 3b. Pastikan folder aplikasi ada
```bash
mkdir -p /opt/logisticqu
ls -la /opt/logisticqu
```

### 3c. Cek apakah LogisticQu sudah pernah di-deploy
```bash
docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep logisticqu
docker volume ls | grep logisticqu_db_data
```

| Hasil | Artinya | Tindakan |
|---|---|---|
| Tidak ada apa pun | Deploy pertama | Lanjut 3e |
| Ada container & volume `logisticqu_db_data` | Sudah pernah deploy (via `deploy.sh`) | **Wajib** lakukan 3d |

### 3d. (Jika sudah pernah deploy) Catat password DB yang sedang dipakai
```bash
docker inspect logisticqu-db --format '{{range .Config.Env}}{{println .}}{{end}}' | grep POSTGRES_PASSWORD
```
Catat nilainya → dipakai di Langkah 5 sebagai `PROD_POSTGRES_PASSWORD`.

> [!WARNING]
> Password Postgres **tertanam di volume** saat DB pertama dibuat. Mengubah `PROD_POSTGRES_PASSWORD` ke nilai lain **tidak** mengganti password DB → backend gagal konek → deploy otomatis rollback. Isi dengan nilai yang sama, atau kosongkan secret (default lama dipakai).

### 3e. Gateway Nginx & Sertifikat SSL (Selesai Dikonfigurasi)
Container `erpqu-nginx` bertindak sebagai **Reverse Proxy Gateway bersama** untuk semua aplikasi di VPS:
- `app.sjsgroup.online` -> aplikasi ERPQu
- `hermes.sjsgroup.online` -> Hermes AI
- `logistik.sjsgroup.online` -> aplikasi LogisticQu (port 8090)

Sertifikat SSL resmi Let's Encrypt khusus untuk `logistik.sjsgroup.online` sudah terbit di VPS pada:
`/etc/letsencrypt/live/logistik.sjsgroup.online/fullchain.pem`
Konfigurasi `deploy/logisticqu.conf` sudah disetel untuk menggunakan sertifikat resmi ini (bukan menumpang sertifikat `app.sjsgroup.online` lagi).

### 3f. Pastikan port 8090 tidak dipakai aplikasi lain
```bash
ss -ltnp | grep ':8090' || echo "port 8090 bebas"
```
(Port 8090 adalah port internal host yang diteruskan ke container `logisticqu-web`.)

**✅ Cek:** Docker Compose v2 ada, folder `/opt/logisticqu` ada, SSL `logistik.sjsgroup.online` aktif.

Keluar dari VPS: `exit`.

---

## Langkah 4 — Buat deploy key SSH khusus GitHub Actions (laptop)

```bash
# 4a. Buat key baru TANPA passphrase (Actions tidak bisa mengetik passphrase)
ssh-keygen -t ed25519 -f ~/.ssh/logisticqu_deploy -N "" -C "github-actions-logisticqu"

# 4b. Daftarkan public key ke VPS
ssh-copy-id -i ~/.ssh/logisticqu_deploy.pub root@187.77.156.109

# 4c. Uji login memakai key tsb (harus masuk tanpa password)
ssh -i ~/.ssh/logisticqu_deploy -o IdentitiesOnly=yes root@187.77.156.109 "echo SSH OK && docker compose version"

# 4d. Tampilkan PRIVATE key untuk disalin ke GitHub
cat ~/.ssh/logisticqu_deploy
```

**✅ Cek:** perintah 4c mencetak `SSH OK` dan versi compose.

> [!IMPORTANT]
> - Salin **seluruh** isi 4d, termasuk baris `-----BEGIN OPENSSH PRIVATE KEY-----` dan `-----END OPENSSH PRIVATE KEY-----`.
> - Port SSH VPS harus **22** dan terbuka dari internet (runner GitHub). Jika memakai port lain/firewall IP whitelist, beri tahu saya.

---

## Langkah 5 — Isi Secrets & Variables di GitHub

Buka: **https://github.com/Rusdinsjs/LogistikQu/settings/secrets/actions**

### 5a. Tab **Secrets** → *New repository secret*

| Name | Value | Wajib? |
|---|---|---|
| `VPS_SSH_KEY` | Isi private key dari Langkah 4d | ✅ Wajib |
| `PROD_POSTGRES_PASSWORD` | Password dari Langkah 3d (jika sudah pernah deploy). Untuk deploy pertama: buat baru, mis. hasil `openssl rand -hex 24` | Disarankan |
| `PROD_JWT_SECRET` | Hasil `openssl rand -hex 32` | Disarankan |

> [!TIP]
> Gunakan hanya huruf/angka (output `openssl rand -hex`). Karakter `$` akan rusak karena di-interpolasi Docker Compose.
> Mengganti `PROD_JWT_SECRET` membuat semua user harus login ulang — wajar.

### 5b. Tab **Variables** (opsional)
Hanya jika berbeda dari default:

| Name | Default |
|---|---|
| `VPS_HOST` | `187.77.156.109` |
| `VPS_USER` | `root` |

### 5c. Izin workflow
Buka **Settings → Actions → General**:
- *Actions permissions*: **Allow all actions and reusable workflows**
- *Workflow permissions*: boleh tetap **Read** (workflow sudah meminta `packages: write` sendiri).

**✅ Cek:** di halaman secrets terlihat minimal `VPS_SSH_KEY`.

---

## Langkah 6 — Buat Environment `production` (disarankan)

Buka **Settings → Environments → New environment** → nama: `production` (huruf kecil, persis).

Opsional tapi disarankan:
- **Required reviewers**: tambahkan akun Anda → setiap deploy menunggu klik *Approve*.
- **Deployment branches**: pilih *Selected branches* → `main`.

> [!NOTE]
> Jika tidak dibuat, GitHub membuatnya otomatis saat deploy pertama (tanpa approval).

---

## Langkah 7 — Jalankan CI/CD pertama kali

```bash
git push origin main
```

Lalu buka **https://github.com/Rusdinsjs/LogistikQu/actions**:

1. Workflow **CI** berjalan (±8–15 menit pertama kali, berikutnya lebih cepat karena cache). Harus hijau semua:
   - `Backend (Rust)`
   - `SQLx offline metadata up-to-date`
   - `Frontend (React)`
   - `Integration / API tests`
2. Setelah CI hijau, workflow **CD - Deploy Production** otomatis mulai:
   - `Build & push (backend)` dan `Build & push (frontend)` (±10–15 menit pertama kali).
   - `Deploy to VPS` → jika Langkah 6 pakai reviewer, klik **Review deployments → Approve**.

**✅ Cek:** kedua workflow hijau; ringkasan job Deploy menampilkan tag `sha-xxxxxxx`.

---

## Langkah 8 — Verifikasi hasil deploy

### 8a. Di GitHub
- Tab **Packages** pada profil/repo menampilkan `logistikqu-backend` dan `logistikqu-web`.

### 8b. Di VPS
```bash
ssh root@187.77.156.109
cd /opt/logisticqu
cat .env | grep -E 'IMAGE|TAG'           # IMAGE_TAG=sha-xxxxxxx
docker compose ps                         # semua (healthy)
cat deploy-history.log
curl -s http://127.0.0.1:8090/nginx-health
```

### 8c. Di browser
Buka **https://logistik.sjsgroup.online** → login `superadmin` / `password123`.

> [!CAUTION]
> Setelah produksi dipakai sungguhan, **ganti password akun demo** (`password123`).

### 8d. Uji rollback (sekali, agar yakin)
1. Actions → **CD - Deploy Production** → **Run workflow**.
2. Isi `image_tag` dengan tag lama (lihat `deploy-history.log`), mis. `sha-7c942cd` → Run.
3. Build di-skip, langsung deploy tag tsb. Setelah itu jalankan lagi dengan tag terbaru.

---

## Langkah 9 — Lindungi branch `main` (disarankan)

**Settings → Branches → Add branch ruleset / protection rule** untuk `main`:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass → pilih: `Backend (Rust)`, `Frontend (React)`, `Integration / API tests`, `SQLx offline metadata up-to-date`

Mulai sekarang alur kerja tim:
```bash
git checkout -b fitur-xyz
# ... coding ...
git push -u origin fitur-xyz      # buka Pull Request → CI jalan
# merge PR setelah hijau → CD otomatis deploy
```

---

## Troubleshooting

| Gejala (job / pesan) | Penyebab | Solusi |
|---|---|---|
| `Rustfmt` gagal | Kode belum diformat | `cd backend && cargo fmt --all`, commit |
| `SQLx offline metadata` gagal / build error `no cached data for this query` | `.sqlx` tidak sinkron dengan query | Jalankan `cargo sqlx prepare -- --all-targets` (lihat Langkah 1), commit `backend/.sqlx` |
| `Frontend` gagal di `pnpm install --frozen-lockfile` | `pnpm-lock.yaml` tidak sesuai `package.json` | `cd frontend && pnpm install`, commit lockfile |
| `Frontend` gagal `TS6133 ... never read` | Variabel/import tak terpakai | Hapus variabel tsb |
| `Integration` gagal di suite tertentu | Regresi API | Buka grup log suite tsb; jalankan lokal: start backend lalu `bash deploy/ci/run-integration-tests.sh` |
| CD tidak jalan sama sekali | CI gagal, atau push bukan ke `main` | Perbaiki CI; CD hanya jalan setelah CI hijau di `main` |
| `Secret VPS_SSH_KEY belum di-set` | Langkah 5a terlewat | Isi secret, lalu *Re-run jobs* |
| `Permission denied (publickey)` | Public key belum di VPS / private key terpotong | Ulangi Langkah 4b–4d |
| `ssh: connect ... timed out` | Firewall memblokir port 22 dari internet | Buka port 22 atau beri tahu saya untuk setup alternatif |
| `denied: permission_denied` saat push GHCR | Package sudah ada & tidak terhubung ke repo | GitHub → Packages → package → *Package settings* → *Manage Actions access* → tambah repo `LogistikQu` (role Write) |
| `Conflict. The container name "/logisticqu-db" is already in use` | Container lama dibuat dari folder/project lain | Di VPS: `docker rm -f logisticqu-backend logisticqu-web` (jangan hapus volume), lalu re-run deploy |
| `Health check gagal` + `Rollback ke tag ...` | Backend tidak sehat (paling sering: password DB salah) | Lihat log job (80 baris log backend tercetak). Cek Langkah 3d |
| Warning `Domain belum merespons 200` | DNS/SSL/Nginx gateway; sertifikat memakai `app.sjsgroup.online` | Bukan kegagalan deploy. Cek `docker exec erpqu-nginx nginx -t` dan sertifikat SSL untuk `logistik.sjsgroup.online` |

---

## Checklist ringkas

- [ ] Langkah 1: cek lokal lulus
- [ ] Langkah 2: commit semua (termasuk `backend/.sqlx`)
- [ ] Langkah 3: VPS siap, password DB lama tercatat
- [ ] Langkah 4: deploy key dibuat & `SSH OK`
- [ ] Langkah 5: secret `VPS_SSH_KEY` (+ `PROD_POSTGRES_PASSWORD`, `PROD_JWT_SECRET`)
- [ ] Langkah 6: environment `production`
- [ ] Langkah 7: `git push` → CI & CD hijau
- [ ] Langkah 8: aplikasi bisa diakses, rollback teruji
- [ ] Langkah 9: branch protection aktif
