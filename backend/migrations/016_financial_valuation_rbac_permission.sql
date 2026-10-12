-- Migration 016: Financial Valuation & Pricing RBAC Restriction (Super Admin & Manager Only)

-- 1. Insert new permission 'financial.view'
INSERT INTO permissions (id, name, category) VALUES
('financial.view', 'Akses Harga Satuan, Biaya & Valuasi Stok', 'FINANCE')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category;

-- 2. Assign ONLY to SUPER_ADMIN and MANAGER
INSERT INTO role_permissions (role_id, permission_id) VALUES
('SUPER_ADMIN', 'financial.view'),
('MANAGER', 'financial.view')
ON CONFLICT DO NOTHING;

-- 3. Ensure no operational or supervisor roles have this permission
DELETE FROM role_permissions
WHERE permission_id = 'financial.view'
  AND role_id NOT IN ('SUPER_ADMIN', 'MANAGER');
