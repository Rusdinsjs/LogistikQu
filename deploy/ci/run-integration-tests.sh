#!/usr/bin/env bash
# Menjalankan suite API test terhadap backend yang SUDAH berjalan di :8080
# (dipakai oleh job "integration" di .github/workflows/ci.yml, bisa juga lokal).
#
# Tambahkan suite baru ke array SUITES di bawah.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SUITES=(
  test_smoke.sh
  test_e2e_flow.sh
  test_rbac_permissions.sh
  test_matrix_hak_akses.sh
  test_financial_rbac_restriction.sh
  test_stock_photo_and_qr.sh
  test_replenishment_maintenance.sh
  test_notifications_dashboard.sh
)

curl -fs http://127.0.0.1:8080/health >/dev/null || { echo "Backend tidak berjalan di :8080"; exit 1; }

failed=()
for suite in "${SUITES[@]}"; do
  echo "::group::${suite}"
  if timeout 300 bash "$suite"; then
    echo "✅ ${suite}"
  else
    echo "❌ ${suite} (exit $?)"
    failed+=("$suite")
  fi
  echo "::endgroup::"
done

echo "================================================="
echo "Total: ${#SUITES[@]}  Gagal: ${#failed[@]}"
if (( ${#failed[@]} )); then
  printf '  - %s\n' "${failed[@]}"
  exit 1
fi
echo "Semua suite integrasi lulus."
