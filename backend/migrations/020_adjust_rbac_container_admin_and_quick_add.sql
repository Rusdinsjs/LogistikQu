-- Migration 020: Adjust RBAC for Container Admin, Supervisor, and Quick-Add Permissions
-- 1. Cabut seluruh hak akses permohonan mekanik dari Admin Kontainer
DELETE FROM role_permissions
WHERE role_id IN ('CONTAINER_ADMIN_HE', 'CONTAINER_ADMIN_DT')
  AND permission_id LIKE 'mechanic_request%';

-- 2. Alihkan approval & fulfill permohonan mekanik ke Supervisor
INSERT INTO role_permissions (role_id, permission_id) VALUES
('SUPERVISOR', 'mechanic_request.approve'),
('SUPERVISOR', 'mechanic_request.fulfill'),
('SUPERVISOR_HE', 'mechanic_request.approve'),
('SUPERVISOR_HE', 'mechanic_request.fulfill'),
('SUPERVISOR_DT', 'mechanic_request.approve'),
('SUPERVISOR_DT', 'mechanic_request.fulfill')
ON CONFLICT DO NOTHING;

-- 3. Pastikan izin issue.create dan mechanic_request.create tetap aman
INSERT INTO role_permissions (role_id, permission_id) VALUES
('CONTAINER_ADMIN_HE', 'issue.create'),
('CONTAINER_ADMIN_DT', 'issue.create'),
('MECHANIC', 'mechanic_request.create'),
('MECHANIC', 'mechanic_request.view'),
('MECHANIC', 'inventory.view')
ON CONFLICT DO NOTHING;

-- 4. Tambahkan tipe unit umum agar Quick-Add tidak gagal relasi FK
INSERT INTO equipment_types (id, name, category) VALUES
('HEAVY_EQUIPMENT', 'General Heavy Equipment', 'HEAVY_EQUIPMENT'),
('DUMP_TRUCK', 'General Dump Truck', 'DUMP_TRUCK')
ON CONFLICT (id) DO NOTHING;
