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

echo "1. Creating remote directories on VPS..."
ssh -o BatchMode=yes "$VPS_USER@$VPS_HOST" "mkdir -p $REMOTE_TARGET/migrations /opt/erpqu/deploy/nginx"

echo "2. Transferring configuration files..."
scp "$SCRIPT_DIR/docker-compose.yml" "$VPS_USER@$VPS_HOST:$REMOTE_TARGET/docker-compose.yml"
scp "$ROOT_DIR/backend/migrations/"*.sql "$VPS_USER@$VPS_HOST:$REMOTE_TARGET/migrations/"
scp "$SCRIPT_DIR/logisticqu.conf" "$VPS_USER@$VPS_HOST:/opt/erpqu/deploy/nginx/logisticqu.conf"

echo "3. Streaming Docker images to VPS (Compressed)..."
echo "-> Transferring logisticqu-backend:latest..."
docker save logisticqu-backend:latest | gzip | ssh -o BatchMode=yes "$VPS_USER@$VPS_HOST" "gunzip | docker load"

echo "-> Transferring logisticqu-web:latest..."
docker save logisticqu-web:latest | gzip | ssh -o BatchMode=yes "$VPS_USER@$VPS_HOST" "gunzip | docker load"

echo "4. Updating Nginx Reverse Proxy on VPS..."
ssh -o BatchMode=yes "$VPS_USER@$VPS_HOST" "
    docker cp /opt/erpqu/deploy/nginx/logisticqu.conf erpqu-nginx:/etc/nginx/conf.d/logisticqu.conf
    docker exec erpqu-nginx nginx -t
    docker exec erpqu-nginx nginx -s reload
"

echo "5. Starting LogisticQu Docker Stack on VPS..."
ssh -o BatchMode=yes "$VPS_USER@$VPS_HOST" "
    cd $REMOTE_TARGET
    docker compose up -d
"

echo "6. Verifying deployment status..."
sleep 5
ssh -o BatchMode=yes "$VPS_USER@$VPS_HOST" "
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
