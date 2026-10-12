#!/usr/bin/env bash
# =============================================================================
# LogisticQu - Remote deploy script (dijalankan DI VPS oleh GitHub Actions CD)
#
# Usage:  remote-deploy.sh <image_tag>
#
# Env (opsional, dikirim oleh workflow):
#   BACKEND_IMAGE, WEB_IMAGE     -> nama image di GHCR
#   GHCR_USER, GHCR_TOKEN        -> kredensial pull image GHCR
#   POSTGRES_PASSWORD, JWT_SECRET-> jika diisi, ditulis ke .env
#
# Alur: pull image -> up -d -> tunggu healthy -> jika gagal rollback ke tag lama
# =============================================================================
set -euo pipefail

NEW_TAG="${1:?Usage: remote-deploy.sh <image_tag>}"
APP_DIR="${APP_DIR:-/opt/logisticqu}"
ENV_FILE="$APP_DIR/.env"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml --env-file $ENV_FILE"
NGINX_CONTAINER="${NGINX_CONTAINER:-erpqu-nginx}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

cd "$APP_DIR"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

# --- helper: set/replace KEY=VALUE di .env --------------------------------
set_env() {
  local key="$1" value="$2"
  { grep -v "^${key}=" "$ENV_FILE" || true; echo "${key}=${value}"; } > "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

get_env() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true; }

# --- 1. Login GHCR ----------------------------------------------------------
if [[ -n "${GHCR_TOKEN:-}" ]]; then
  echo "🔐 Login ke ghcr.io sebagai ${GHCR_USER}"
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
fi

# --- 2. Update .env ---------------------------------------------------------
PREV_TAG="$(get_env IMAGE_TAG)"
[[ -n "${BACKEND_IMAGE:-}" ]]     && set_env BACKEND_IMAGE "$BACKEND_IMAGE"
[[ -n "${WEB_IMAGE:-}" ]]         && set_env WEB_IMAGE "$WEB_IMAGE"
[[ -n "${POSTGRES_PASSWORD:-}" ]] && set_env POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
[[ -n "${JWT_SECRET:-}" ]]        && set_env JWT_SECRET "$JWT_SECRET"
set_env IMAGE_TAG "$NEW_TAG"

echo "📦 Deploy tag: ${PREV_TAG:-<none>} -> $NEW_TAG"

# --- 3. Pull & start --------------------------------------------------------
$COMPOSE pull logisticqu-backend logisticqu-web
$COMPOSE up -d --remove-orphans

# --- 4. Health check --------------------------------------------------------
wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) b w
  while (( SECONDS < deadline )); do
    b="$(docker inspect -f '{{.State.Health.Status}}' logisticqu-backend 2>/dev/null || echo missing)"
    w="$(docker inspect -f '{{.State.Health.Status}}' logisticqu-web 2>/dev/null || echo missing)"
    echo "   backend=$b web=$w"
    if [[ "$b" == "healthy" && "$w" == "healthy" ]] && curl -fs http://127.0.0.1:8090/nginx-health >/dev/null; then
      return 0
    fi
    sleep 5
  done
  return 1
}

echo "🩺 Menunggu container healthy (timeout ${HEALTH_TIMEOUT}s)..."
if ! wait_healthy; then
  echo "❌ Health check gagal untuk tag $NEW_TAG"
  docker logs --tail 80 logisticqu-backend || true
  if [[ -n "$PREV_TAG" && "$PREV_TAG" != "$NEW_TAG" ]]; then
    echo "↩️  Rollback ke tag $PREV_TAG"
    set_env IMAGE_TAG "$PREV_TAG"
    $COMPOSE up -d --remove-orphans
    wait_healthy && echo "✅ Rollback berhasil ($PREV_TAG)" || echo "🚨 Rollback juga gagal, cek manual!"
  fi
  exit 1
fi

# --- 5. Reload Nginx gateway (jika config ikut dikirim) ---------------------
if [[ -f "$APP_DIR/logisticqu.conf" ]] && docker ps --format '{{.Names}}' | grep -qx "$NGINX_CONTAINER"; then
  echo "🌐 Update vhost Nginx gateway ($NGINX_CONTAINER)"
  docker cp "$APP_DIR/logisticqu.conf" "$NGINX_CONTAINER:/etc/nginx/conf.d/logisticqu.conf"
  if docker exec "$NGINX_CONTAINER" nginx -t; then
    docker exec "$NGINX_CONTAINER" nginx -s reload
  else
    echo "⚠️  nginx -t gagal, reload dibatalkan (app tetap berjalan)."
  fi
fi

# --- 6. Catat histori & bersihkan image lama --------------------------------
echo "$(date -Iseconds) $NEW_TAG" >> "$APP_DIR/deploy-history.log"
docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true

echo "✅ Deploy $NEW_TAG berhasil - https://logistik.sjsgroup.online"
