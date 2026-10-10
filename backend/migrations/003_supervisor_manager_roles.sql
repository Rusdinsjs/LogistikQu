-- Migration 003: Supervisor Warehouse Isolation & Manager Role

-- 1. Insert New Roles
INSERT INTO roles (id, name, description) VALUES
('MANAGER', 'Manager Logistik', 'Akses menyeluruh seluruh gudang utama dan kontainer, approval eksekutif, dan manajemen pengguna'),
('SUPERVISOR_HE', 'Supervisor Gudang Utama Alat Berat', 'Approval replenishment, adjustment, dan part kritikal khusus divisi Alat Berat (WH-MAIN-HE & WH-CONT-HE)'),
('SUPERVISOR_DT', 'Supervisor Gudang Utama Dump Truck', 'Approval replenishment, adjustment, dan part kritikal khusus divisi Dump Truck (WH-MAIN-DT & WH-CONT-DT)')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 2. Permissions for MANAGER (All permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'MANAGER', id FROM permissions
ON CONFLICT DO NOTHING;

-- 3. Permissions for SUPERVISOR_HE
INSERT INTO role_permissions (role_id, permission_id) VALUES
('SUPERVISOR_HE', 'inventory.view'),
('SUPERVISOR_HE', 'issue.approve'),
('SUPERVISOR_HE', 'request.approve'),
('SUPERVISOR_HE', 'adjustment.approve'),
('SUPERVISOR_HE', 'reports.view'),
('SUPERVISOR_HE', 'audit.view')
ON CONFLICT DO NOTHING;

-- 4. Permissions for SUPERVISOR_DT
INSERT INTO role_permissions (role_id, permission_id) VALUES
('SUPERVISOR_DT', 'inventory.view'),
('SUPERVISOR_DT', 'issue.approve'),
('SUPERVISOR_DT', 'request.approve'),
('SUPERVISOR_DT', 'adjustment.approve'),
('SUPERVISOR_DT', 'reports.view'),
('SUPERVISOR_DT', 'audit.view')
ON CONFLICT DO NOTHING;

-- 5. Update / Insert Demo Users
-- Password hash for 'password123': $argon2id$v=19$m=19456,t=2,p=1$MVLtUSvFax3O4Fn+rM817w$yM5Xj4lBmd7Nr50QD0Muij4kIJ0bnjfmpFSTnm+Ojwc

-- Update supervisor (00000000-0000-0000-0000-000000000002) to supervisor_he
UPDATE users
SET username = 'supervisor_he',
    full_name = 'Hendra Gunawan (Supervisor HE)',
    role_id = 'SUPERVISOR_HE',
    updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000002';

-- Insert manager
INSERT INTO users (id, username, password_hash, full_name, role_id) VALUES
('00000000-0000-0000-0000-000000000007', 'manager', '$argon2id$v=19$m=19456,t=2,p=1$MVLtUSvFax3O4Fn+rM817w$yM5Xj4lBmd7Nr50QD0Muij4kIJ0bnjfmpFSTnm+Ojwc', 'Bambang Irawan (Manager Logistik)', 'MANAGER')
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role_id = EXCLUDED.role_id;

-- Insert supervisor_dt
INSERT INTO users (id, username, password_hash, full_name, role_id) VALUES
('00000000-0000-0000-0000-000000000008', 'supervisor_dt', '$argon2id$v=19$m=19456,t=2,p=1$MVLtUSvFax3O4Fn+rM817w$yM5Xj4lBmd7Nr50QD0Muij4kIJ0bnjfmpFSTnm+Ojwc', 'Dedi Kusnadi (Supervisor DT)', 'SUPERVISOR_DT')
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role_id = EXCLUDED.role_id;

-- 6. Warehouse Scoping Assignments
-- Reset and re-assign supervisor_he warehouse access to HE ONLY
DELETE FROM user_warehouses WHERE user_id = '00000000-0000-0000-0000-000000000002';
INSERT INTO user_warehouses (user_id, warehouse_id) VALUES
('00000000-0000-0000-0000-000000000002', 'WH-MAIN-HE'),
('00000000-0000-0000-0000-000000000002', 'WH-CONT-HE')
ON CONFLICT DO NOTHING;

-- Assign supervisor_dt warehouse access to DT ONLY
DELETE FROM user_warehouses WHERE user_id = '00000000-0000-0000-0000-000000000008';
INSERT INTO user_warehouses (user_id, warehouse_id) VALUES
('00000000-0000-0000-0000-000000000008', 'WH-MAIN-DT'),
('00000000-0000-0000-0000-000000000008', 'WH-CONT-DT')
ON CONFLICT DO NOTHING;

-- Assign manager warehouse access to ALL Warehouses
DELETE FROM user_warehouses WHERE user_id = '00000000-0000-0000-0000-000000000007';
INSERT INTO user_warehouses (user_id, warehouse_id) VALUES
('00000000-0000-0000-0000-000000000007', 'WH-MAIN-HE'),
('00000000-0000-0000-0000-000000000007', 'WH-MAIN-DT'),
('00000000-0000-0000-0000-000000000007', 'WH-CONT-HE'),
('00000000-0000-0000-0000-000000000007', 'WH-CONT-DT')
ON CONFLICT DO NOTHING;
