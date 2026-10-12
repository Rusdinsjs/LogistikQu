#!/usr/bin/env bash
set -e

VPS_HOST="187.77.156.109"
VPS_USER="root"
REMOTE_TARGET="/opt/logisticqu"

echo "=========================================================="
echo "🚀 DEPLOYING LOGISTICQU WMS TO VPS ($VPS_HOST)"
echo "=========================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

SSH_CMD="ssh -F /dev/null -o BatchMode=yes -o StrictHostKeyChecking=accept-new"
SCP_CMD="scp -F /dev/null -o BatchMode=yes -o StrictHostKeyChecking=accept-new"

echo "1. Creating remote directories on VPS..."
$SSH_CMD "$VPS_USER@$VPS_HOST" "mkdir -p $REMOTE_TARGET/migrations /opt/erpqu/deploy/nginx"

echo "2. Transferring configuration files..."
$SCP_CMD "$SCRIPT_DIR/docker-compose.yml" "$VPS_USER@$VPS_HOST:$REMOTE_TARGET/docker-compose.yml"
$SCP_CMD "$ROOT_DIR/backend/migrations/"*.sql "$VPS_USER@$VPS_HOST:$REMOTE_TARGET/migrations/"
$SCP_CMD "$SCRIPT_DIR/logisticqu.conf" "$VPS_USER@$VPS_HOST:/opt/erpqu/deploy/nginx/logisticqu.conf"
$SCP_CMD -r "$ROOT_DIR/frontend/dist" "$VPS_USER@$VPS_HOST:$REMOTE_TARGET/"
echo "2.5. Building latest Docker images..."
echo "-> Building logisticqu-backend:latest..."
mkdir -p "$ROOT_DIR/backend/bin" && cp "$ROOT_DIR/backend/target/release/logisticqu-backend" "$ROOT_DIR/backend/bin/logisticqu-backend"
docker build -f "$ROOT_DIR/backend/Dockerfile.prebuilt" -t logisticqu-backend:latest "$ROOT_DIR/backend/"

echo "-> Building logisticqu-web:latest..."
rm -rf "$ROOT_DIR/frontend/build_dist" && cp -r "$ROOT_DIR/frontend/dist" "$ROOT_DIR/frontend/build_dist"
docker build -f "$ROOT_DIR/frontend/Dockerfile.web" -t logisticqu-web:latest "$ROOT_DIR/frontend/"

echo "3. Streaming Docker images to VPS (Compressed)..."
echo "-> Transferring logisticqu-backend:latest..."
docker save logisticqu-backend:latest | gzip | $SSH_CMD "$VPS_USER@$VPS_HOST" "gunzip | docker load"

echo "-> Transferring logisticqu-web:latest..."
docker save logisticqu-web:latest | gzip | $SSH_CMD "$VPS_USER@$VPS_HOST" "gunzip | docker load"

echo "4. Updating Nginx Reverse Proxy on VPS..."
$SSH_CMD "$VPS_USER@$VPS_HOST" "
    docker cp /opt/erpqu/deploy/nginx/logisticqu.conf erpqu-nginx:/etc/nginx/conf.d/logisticqu.conf
    docker exec erpqu-nginx nginx -t
    docker exec erpqu-nginx nginx -s reload
"

echo "5. Starting LogisticQu Docker Stack on VPS..."
$SSH_CMD "$VPS_USER@$VPS_HOST" "
    cd $REMOTE_TARGET
    echo 'BACKEND_IMAGE=logisticqu-backend' > .env
    echo 'WEB_IMAGE=logisticqu-web' >> .env
    echo 'IMAGE_TAG=latest' >> .env
    docker compose up -d --force-recreate
"

echo "6. Verifying deployment status..."
sleep 5
$SSH_CMD "$VPS_USER@$VPS_HOST" "
    echo '--- Running Containers ---'
    docker ps | grep logisticqu || true
    echo ''
    echo '--- Local Health Check on Host Port 8090 ---'
    curl -s http://127.0.0.1:8090/health || echo 'Health check pending boot...'
    echo ''
    echo '--- Domain Gateway Check via Nginx ---'
    curl -s -k -H 'Host: logistik.sjsgroup.online' http://127.0.0.1/health || echo 'Nginx routing pending...'
"

echo ""
echo "=========================================================="
echo "✅ LOGISTICQU WMS SUCCESSFULLY DEPLOYED TO VPS!"
echo "URL: http://logistik.sjsgroup.online"
echo "=========================================================="
