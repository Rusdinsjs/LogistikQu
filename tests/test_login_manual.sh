#!/usr/bin/env bash
cd /home/rus/projects/LogistikQu/backend

echo "Starting backend on 8090..."
SERVER_PORT=8090 nohup ./target/debug/logisticqu-backend > /tmp/logisticqu_backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

sleep 2

echo "Health check:"
curl -i http://127.0.0.1:8090/health
echo ""

echo "Testing login superadmin:"
curl -i -X POST http://127.0.0.1:8090/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"password123"}'
echo ""
