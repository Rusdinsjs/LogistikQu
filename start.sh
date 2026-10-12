#!/usr/bin/env bash
# ==============================================================================
# LogisticQu WMS — Unified Development Runner
# Memulai PostgreSQL, Backend (Rust Axum), dan Frontend (React Vite)
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "=================================================================="
echo "    🚀 MEMULAI APLIKASI LOGISTICQU WMS (SJS-VIPO)               "
echo "=================================================================="

# 1. Menentukan Port Backend (8090 agar tidak konflik dengan Docker ERP)
BACKEND_PORT=8090

# 2. Memastikan Database PostgreSQL (Docker) Aktif
echo ""
echo "[1/3] Memeriksa & menjalankan container Database PostgreSQL..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker tidak terdeteksi. Silakan aktifkan Docker terlebih dahulu."
    exit 1
fi

docker compose -f deploy/docker-compose.dev.yml up -d

echo "Menunggu database PostgreSQL siap..."
until docker exec logisticqu-dev-db pg_isready -U logisticqu -d logisticqu_dev > /dev/null 2>&1; do
    sleep 0.5
done
echo "✅ Database PostgreSQL aktif pada port 5440 (db: logisticqu_dev)"

# 3. Menyiapkan & Menjalankan Backend Rust Axum
echo ""
echo "[2/3] Menjalankan Backend Server (Rust Axum)..."
export DATABASE_URL="postgres://logisticqu:logisticqu_secret@127.0.0.1:5440/logisticqu_dev"
export JWT_SECRET="logisticqu_super_secret_jwt_key_2026_valesite_mining"
export SERVER_PORT="$BACKEND_PORT"
export SERVER_HOST="0.0.0.0"
unset SQLX_OFFLINE

echo "🔨 Memeriksa & mengompilasi backend (cargo build)..."
(cd "$PROJECT_ROOT/backend" && cargo build --bin logisticqu-backend)

BACKEND_BIN="$PROJECT_ROOT/backend/target/debug/logisticqu-backend"

# Matikan proses/container backend lama jika ada agar port tidak bentrok
docker stop logisticqu-backend-dev >/dev/null 2>&1 || true
pkill -f logisticqu-backend 2>/dev/null || true

# Jalankan backend di background
"$BACKEND_BIN" > /tmp/logisticqu_backend.log 2>&1 &
BACKEND_PID=$!

# Trap untuk mematikan backend ketika script dihentikan (Ctrl+C)
cleanup() {
    echo ""
    echo "🛑 Menghentikan seluruh proses aplikasi..."
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    pkill -f logisticqu-backend 2>/dev/null || true
    echo "👋 LogisticQu berhasil dimatikan."
}
trap cleanup EXIT INT TERM

# Tunggu backend siap melayani request
BACKEND_OK=0
for i in {1..30}; do
    if curl -s "http://127.0.0.1:$BACKEND_PORT/health" | grep -q "OK"; then
        BACKEND_OK=1
        break
    fi
    sleep 0.5
done

if [ $BACKEND_OK -eq 0 ]; then
    echo "❌ Backend server gagal dijalankan! Pesan kesalahan:"
    cat /tmp/logisticqu_backend.log | tail -n 25
    exit 1
fi

echo "✅ Backend aktif pada http://127.0.0.1:$BACKEND_PORT (Log: /tmp/logisticqu_backend.log)"

# 4. Menjalankan Frontend React Vite
echo ""
echo "[3/3] Menjalankan Frontend Web (React 19 + Vite)..."
export VITE_BACKEND_URL="http://127.0.0.1:$BACKEND_PORT"

echo ""
echo "=================================================================="
echo "  🌟 APLIKASI LOGISTICQU SIAP DIGUNAKAN!                          "
echo "=================================================================="
echo "  🌐 URL Frontend Web  : http://localhost:5173"
echo "  🔌 URL Backend API   : http://localhost:$BACKEND_PORT/api/v1"
echo "  🗄️  Database          : localhost:5440 (logisticqu_dev)"
echo "------------------------------------------------------------------"
echo "  👥 AKUN DEMO LOGIN (Password: password123):"
echo "   - manager        : Manager Logistik (Executive All WH & User Mgmt)"
echo "   - superadmin     : Super Administrator"
echo "   - supervisor_he  : Supervisor Gudang Alat Berat (WH-MAIN-HE)"
echo "   - supervisor_dt  : Supervisor Gudang Dump Truck (WH-MAIN-DT)"
echo "   - admin_main_he  : Admin Utama Alat Berat"
echo "   - admin_main_dt  : Admin Utama Dump Truck"
echo "   - admin_cont_he  : Admin Kontainer Alat Berat"
echo "   - admin_cont_dt  : Admin Kontainer Dump Truck"
echo "   - mekanik_he     : Mekanik Alat Berat (EMP-101)"
echo "   - mekanik_dt     : Mekanik Dump Truck (EMP-103)"
echo "=================================================================="
echo "Tekan [Ctrl+C] untuk menghentikan aplikasi."
echo ""

cd "$PROJECT_ROOT/frontend"
npm run dev
