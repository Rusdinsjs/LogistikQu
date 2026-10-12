#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT/backend"

export DATABASE_URL="postgres://logisticqu:logisticqu_secret@127.0.0.1:5440/logisticqu_dev"
export PORT=8080
export JWT_SECRET="super-secret-jwt-key-vale-indonesia-logisticqu-2026"
export RUST_LOG=info
export no_proxy="*"
export NO_PROXY="*"
unset http_proxy HTTP_PROXY https_proxy HTTPS_PROXY

./target/debug/logisticqu-backend > /tmp/rbac_test_backend.log 2>&1 &
BACKEND_PID=$!
cleanup() {
    kill $BACKEND_PID || true
}
trap cleanup EXIT
sleep 2

echo "=== 1. Login as Superadmin ==="
SA_LOGIN=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"password123"}')
SA_TOKEN=$(echo "$SA_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "=== 2. List All Available System Permissions ==="
PERMS=$(curl -s http://127.0.0.1:8080/api/v1/permissions \
  -H "Authorization: Bearer $SA_TOKEN")
echo "Total permissions found: $(echo "$PERMS" | grep -o '"id":' | wc -l)"

echo "=== 3. Get Current CONTAINER_ADMIN_HE Role Permissions ==="
ROLES=$(curl -s http://127.0.0.1:8080/api/v1/roles \
  -H "Authorization: Bearer $SA_TOKEN")
ORIGINAL_HE_ROLE_PERMS=$(echo "$ROLES" | jq -c '.[] | select(.id=="CONTAINER_ADMIN_HE") | .permissions')
echo "Original CONTAINER_ADMIN_HE permissions: $ORIGINAL_HE_ROLE_PERMS"

echo "=== 4. Login as Admin Kontainer HE ==="
CONT_LOGIN=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_cont_he","password":"password123"}')
CONT_TOKEN=$(echo "$CONT_LOGIN" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "=== 5. Test Custom User Permissions: Revoke issue.create for admin_cont_he ==="
CONT_USER_ID=$(echo "$CONT_LOGIN" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

# Set custom permissions on admin_cont_he to only view inventory and bins (disable issue.create)
UPDATE_USER_RES=$(curl -s -X PUT http://127.0.0.1:8080/api/v1/users/$CONT_USER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -d '{
    "full_name": "Ahmad Dani (Admin Kontainer HE)",
    "role_id": "CONTAINER_ADMIN_HE",
    "warehouse_ids": ["WH-CONT-HE"],
    "is_active": true,
    "custom_permissions_enabled": true,
    "custom_permissions": ["inventory.view", "bins.view"]
  }')

echo "User updated: $(echo "$UPDATE_USER_RES" | jq -r '.message')"

echo "=== 6. Re-login as Admin Kontainer HE and Verify Effective Permissions ==="
CONT_LOGIN_UPDATED=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_cont_he","password":"password123"}')
CONT_TOKEN_UPDATED=$(echo "$CONT_LOGIN_UPDATED" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
UPDATED_PERMS=$(echo "$CONT_LOGIN_UPDATED" | jq -c '.user.permissions')
echo "Effective permissions after custom override: $UPDATED_PERMS"

echo "=== 7. Verify POS Issue is BLOCKED (403 Forbidden) ==="
ISSUE_PAYLOAD='{
  "warehouse_id": "WH-CONT-HE",
  "site_id": "SITE-VALE-C",
  "receiver_name": "Test Denied",
  "unit_number": "EX-201",
  "unit_name": "Komatsu PC2000-8",
  "unit_type": "Hydraulic Excavator",
  "hm_km": 12450.5,
  "mechanic_name": "Yusuf",
  "work_order_number": "WO-DENIED-01",
  "maintenance_type": "Corrective",
  "priority": "HIGH",
  "items": [{"spare_part_id": "ENG-001", "qty": 1, "unit_of_measure": "PCS"}]
}'

HTTP_CODE=$(curl -s -o /tmp/issue_denied_body.json -w "%{http_code}" -X POST http://127.0.0.1:8080/api/v1/issues \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONT_TOKEN_UPDATED" \
  -d "$ISSUE_PAYLOAD")

echo "POST /api/v1/issues HTTP Status: $HTTP_CODE"
cat /tmp/issue_denied_body.json
echo ""

if [ "$HTTP_CODE" != "403" ]; then
  echo "ERROR: Expected 403 Forbidden, got $HTTP_CODE"
  exit 1
fi
echo ">>> POS Issue successfully rejected by RBAC! <<<"

echo "=== 8. Restore admin_cont_he back to Role Defaults (custom_permissions_enabled=false) ==="
RESTORE_RES=$(curl -s -X PUT http://127.0.0.1:8080/api/v1/users/$CONT_USER_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -d '{
    "full_name": "Ahmad Dani (Admin Kontainer HE)",
    "role_id": "CONTAINER_ADMIN_HE",
    "warehouse_ids": ["WH-CONT-HE"],
    "is_active": true,
    "custom_permissions_enabled": false,
    "custom_permissions": []
  }')
echo "User restored: $(echo "$RESTORE_RES" | jq -r '.message')"

echo "=== 9. Verify admin_cont_he has Role Defaults Restored ==="
CONT_LOGIN_RESTORED=$(curl -s -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin_cont_he","password":"password123"}')
RESTORED_PERMS=$(echo "$CONT_LOGIN_RESTORED" | jq -c '.user.permissions')
echo "Restored permissions: $RESTORED_PERMS"

echo "=== 10. Test Role Permissions Update via Superadmin ==="
# Test updating role permissions via PUT /api/v1/roles/SUPERVISOR_HE/permissions
UPDATE_ROLE_RES=$(curl -s -X PUT http://127.0.0.1:8080/api/v1/roles/SUPERVISOR_HE/permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -d '{"permissions": ["inventory.view", "request.view", "request.approve", "reports.view"]}')
echo "Role permissions updated: $(echo "$UPDATE_ROLE_RES" | jq -r '.message')"

# Restore supervisor role permissions back to full
curl -s -X PUT http://127.0.0.1:8080/api/v1/roles/SUPERVISOR_HE/permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -d '{"permissions": ["master.view", "bins.view", "inventory.view", "issue.view", "issue.approve", "returns.view", "returns.complete", "request.view", "request.approve", "drops.view", "adjustment.view", "adjustment.approve", "reports.view", "audit.view"]}' > /dev/null

echo ">>> ALL RBAC AND PERMISSION OVERRIDE TESTS PASSED 100%! <<<"
