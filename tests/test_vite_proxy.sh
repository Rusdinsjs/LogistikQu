#!/usr/bin/env bash
echo "Testing login via Vite proxy on 5173:"
curl -i -X POST http://127.0.0.1:5173/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"password123"}'
echo ""
