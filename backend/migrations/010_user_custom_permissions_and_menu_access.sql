-- Migration 010: Fine-Grained Menu Permissions, Role Permissions Matrix & User-level Overrides

-- 1. Insert new permissions for fine-grained menu and action control
INSERT INTO permissions (id, name, category) VALUES
-- Master & Inventory view
('master.view', 'Melihat Master Data & Unit', 'MASTER'),
('bins.view', 'Melihat Layout & Denah Bin Rak', 'INVENTORY'),
('bins.manage', 'Manajemen & Relokasi Bin Rak', 'INVENTORY'),
-- Transaction & Returns
('issue.view', 'Melihat Riwayat POS Issue', 'TRANSACTION'),
('returns.view', 'Melihat Riwayat Retur Part Bekas', 'TRANSACTION'),
('returns.receive', 'Penerimaan Fisik Retur di Kontainer', 'TRANSACTION'),
('returns.transfer', 'Pengiriman Retur ke Gudang Utama', 'TRANSACTION'),
('returns.complete', 'Penyelesaian Retur (Restock / Scrap)', 'TRANSACTION'),
-- Replenishment & Drops
('request.view', 'Melihat Alur Permohonan Stok', 'REPLENISHMENT'),
('drops.view', 'Melihat Riwayat Drop Gudang Utama', 'REPLENISHMENT'),
-- Adjustment
('adjustment.view', 'Melihat Stock Opname / Koreksi', 'ADJUSTMENT')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category;

-- 2. Assign All Permissions to SUPER_ADMIN & MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'SUPER_ADMIN', id FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'MANAGER', id FROM permissions
ON CONFLICT DO NOTHING;

-- 3. Assign CONTAINER_ADMIN_HE & CONTAINER_ADMIN_DT
INSERT INTO role_permissions (role_id, permission_id) VALUES
('CONTAINER_ADMIN_HE', 'master.view'),
('CONTAINER_ADMIN_HE', 'bins.view'),
('CONTAINER_ADMIN_HE', 'bins.manage'),
('CONTAINER_ADMIN_HE', 'issue.view'),
('CONTAINER_ADMIN_HE', 'returns.view'),
('CONTAINER_ADMIN_HE', 'returns.receive'),
('CONTAINER_ADMIN_HE', 'request.view'),
('CONTAINER_ADMIN_HE', 'adjustment.view'),
('CONTAINER_ADMIN_DT', 'master.view'),
('CONTAINER_ADMIN_DT', 'bins.view'),
('CONTAINER_ADMIN_DT', 'bins.manage'),
('CONTAINER_ADMIN_DT', 'issue.view'),
('CONTAINER_ADMIN_DT', 'returns.view'),
('CONTAINER_ADMIN_DT', 'returns.receive'),
('CONTAINER_ADMIN_DT', 'request.view'),
('CONTAINER_ADMIN_DT', 'adjustment.view')
ON CONFLICT DO NOTHING;

-- 4. Assign MAIN_ADMIN_HE & MAIN_ADMIN_DT
INSERT INTO role_permissions (role_id, permission_id) VALUES
('MAIN_ADMIN_HE', 'master.view'),
('MAIN_ADMIN_HE', 'bins.view'),
('MAIN_ADMIN_HE', 'drops.view'),
('MAIN_ADMIN_HE', 'returns.view'),
('MAIN_ADMIN_HE', 'returns.transfer'),
('MAIN_ADMIN_HE', 'returns.complete'),
('MAIN_ADMIN_HE', 'request.view'),
('MAIN_ADMIN_DT', 'master.view'),
('MAIN_ADMIN_DT', 'bins.view'),
('MAIN_ADMIN_DT', 'drops.view'),
('MAIN_ADMIN_DT', 'returns.view'),
('MAIN_ADMIN_DT', 'returns.transfer'),
('MAIN_ADMIN_DT', 'returns.complete'),
('MAIN_ADMIN_DT', 'request.view')
ON CONFLICT DO NOTHING;

-- 5. Assign SUPERVISOR, SUPERVISOR_HE, SUPERVISOR_DT
INSERT INTO role_permissions (role_id, permission_id) VALUES
('SUPERVISOR', 'master.view'),
('SUPERVISOR', 'bins.view'),
('SUPERVISOR', 'drops.view'),
('SUPERVISOR', 'issue.view'),
('SUPERVISOR', 'returns.view'),
('SUPERVISOR', 'returns.complete'),
('SUPERVISOR', 'request.view'),
('SUPERVISOR', 'adjustment.view'),
('SUPERVISOR_HE', 'master.view'),
('SUPERVISOR_HE', 'bins.view'),
('SUPERVISOR_HE', 'drops.view'),
('SUPERVISOR_HE', 'issue.view'),
('SUPERVISOR_HE', 'returns.view'),
('SUPERVISOR_HE', 'returns.complete'),
('SUPERVISOR_HE', 'request.view'),
('SUPERVISOR_HE', 'adjustment.view'),
('SUPERVISOR_DT', 'master.view'),
('SUPERVISOR_DT', 'bins.view'),
('SUPERVISOR_DT', 'drops.view'),
('SUPERVISOR_DT', 'issue.view'),
('SUPERVISOR_DT', 'returns.view'),
('SUPERVISOR_DT', 'returns.complete'),
('SUPERVISOR_DT', 'request.view'),
('SUPERVISOR_DT', 'adjustment.view')
ON CONFLICT DO NOTHING;

-- 6. Add custom_permissions_enabled column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_permissions_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 7. Create user_permissions table for individual user-level custom overrides
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permission_id VARCHAR(50) REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, permission_id)
);
