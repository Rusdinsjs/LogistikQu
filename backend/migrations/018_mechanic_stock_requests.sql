-- Migration 018: Mechanic Stock Request (Permohonan Stock Mekanik)
-- Mekanik memiliki akun sendiri, dapat mengajukan permohonan PENGGANTIAN (REPLACEMENT)
-- atau PENGEMBALIAN (RETURN). Approval 1 level oleh Admin Kontainer.

-- 1. Role MECHANIC
INSERT INTO roles (id, name, description) VALUES
('MECHANIC', 'Mekanik Lapangan', 'Mengajukan permohonan penggantian / pengembalian spare part ke Gudang Kontainer beserta bukti kerusakan')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. Link user account -> master karyawan
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) REFERENCES employees(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);

-- 3. Permissions
INSERT INTO permissions (id, name, category) VALUES
('mechanic_request.view', 'Melihat Permohonan Stock Mekanik', 'MECHANIC_REQUEST'),
('mechanic_request.create', 'Mengajukan Permohonan Stock Mekanik', 'MECHANIC_REQUEST'),
('mechanic_request.approve', 'Approve / Ubah / Revisi / Tolak Permohonan Mekanik', 'MECHANIC_REQUEST'),
('mechanic_request.fulfill', 'Serah Terima / Penerimaan Barang Permohonan Mekanik', 'MECHANIC_REQUEST')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.id FROM (VALUES ('SUPER_ADMIN'), ('MANAGER')) AS r(role_id)
CROSS JOIN permissions p WHERE p.category = 'MECHANIC_REQUEST'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id) VALUES
('MECHANIC', 'mechanic_request.view'),
('MECHANIC', 'mechanic_request.create'),
('MECHANIC', 'inventory.view'),
('CONTAINER_ADMIN_HE', 'mechanic_request.view'),
('CONTAINER_ADMIN_HE', 'mechanic_request.create'),
('CONTAINER_ADMIN_HE', 'mechanic_request.approve'),
('CONTAINER_ADMIN_HE', 'mechanic_request.fulfill'),
('CONTAINER_ADMIN_DT', 'mechanic_request.view'),
('CONTAINER_ADMIN_DT', 'mechanic_request.create'),
('CONTAINER_ADMIN_DT', 'mechanic_request.approve'),
('CONTAINER_ADMIN_DT', 'mechanic_request.fulfill'),
('SUPERVISOR', 'mechanic_request.view'),
('SUPERVISOR_HE', 'mechanic_request.view'),
('SUPERVISOR_DT', 'mechanic_request.view')
ON CONFLICT DO NOTHING;

-- 4. Header permohonan
CREATE TABLE IF NOT EXISTS mechanic_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(50) UNIQUE NOT NULL,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('REPLACEMENT', 'RETURN')),
    warehouse_id VARCHAR(50) NOT NULL REFERENCES warehouses(id),
    site_id VARCHAR(50) REFERENCES sites(id),
    status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED'
        CHECK (status IN ('SUBMITTED', 'REVISION_REQUESTED', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED')),
    -- Unit & pekerjaan
    unit_number VARCHAR(50),
    unit_name VARCHAR(100),
    unit_type VARCHAR(50),
    ct_number VARCHAR(50),
    serial_number VARCHAR(100),
    hm_km NUMERIC(12,2),
    work_order_number VARCHAR(50),
    maintenance_type VARCHAR(50),
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    -- Mekanik / pemohon
    mechanic_id VARCHAR(50) REFERENCES employees(id) ON DELETE SET NULL,
    mechanic_name VARCHAR(100) NOT NULL,
    requester_user_id UUID REFERENCES users(id),
    input_channel VARCHAR(20) NOT NULL DEFAULT 'MECHANIC',
    -- Bukti kerusakan (REPLACEMENT)
    damage_category VARCHAR(30),
    damage_description TEXT,
    damage_photo_url TEXT,
    old_part_photo_url TEXT,
    document_url TEXT,
    -- Pengembalian (RETURN)
    return_reason VARCHAR(30),
    reference_issue_number VARCHAR(50),
    notes TEXT,
    -- Alur
    revision_notes TEXT,
    revision_count INT NOT NULL DEFAULT 0,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    approve_notes TEXT,
    rejected_by UUID REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    reject_reason TEXT,
    fulfilled_by UUID REFERENCES users(id),
    fulfilled_at TIMESTAMPTZ,
    fulfill_notes TEXT,
    issue_transaction_id UUID REFERENCES issue_transactions(id),
    -- Offline / mobile
    client_uuid UUID UNIQUE,
    device_id VARCHAR(100),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mreq_wh_status ON mechanic_requests(warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_mreq_requester ON mechanic_requests(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_mreq_mechanic ON mechanic_requests(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mreq_created ON mechanic_requests(created_at DESC);

-- 5. Item permohonan
CREATE TABLE IF NOT EXISTS mechanic_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES mechanic_requests(id) ON DELETE CASCADE,
    spare_part_id VARCHAR(50) NOT NULL REFERENCES spare_parts(id),
    unit_of_measure VARCHAR(20) NOT NULL,
    requested_qty NUMERIC(14,3) NOT NULL CHECK (requested_qty > 0),
    approved_qty NUMERIC(14,3) CHECK (approved_qty >= 0),
    fulfilled_qty NUMERIC(14,3) CHECK (fulfilled_qty >= 0),
    item_condition VARCHAR(20),
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_mreq_items_request ON mechanic_request_items(request_id);

-- 6. Riwayat / timeline
CREATE TABLE IF NOT EXISTS mechanic_request_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES mechanic_requests(id) ON DELETE CASCADE,
    action VARCHAR(30) NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    actor_id UUID REFERENCES users(id),
    actor_name VARCHAR(100),
    actor_role VARCHAR(50),
    notes TEXT,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mreq_history_request ON mechanic_request_history(request_id, created_at);

-- 7. Akun demo mekanik (password: password123)
INSERT INTO users (id, username, password_hash, full_name, role_id, employee_id) VALUES
('00000000-0000-0000-0000-000000000009', 'mekanik_he', '$argon2id$v=19$m=19456,t=2,p=1$MVLtUSvFax3O4Fn+rM817w$yM5Xj4lBmd7Nr50QD0Muij4kIJ0bnjfmpFSTnm+Ojwc', 'Yusuf Mansur (Mekanik HE)', 'MECHANIC', 'EMP-101'),
('00000000-0000-0000-0000-000000000010', 'mekanik_dt', '$argon2id$v=19$m=19456,t=2,p=1$MVLtUSvFax3O4Fn+rM817w$yM5Xj4lBmd7Nr50QD0Muij4kIJ0bnjfmpFSTnm+Ojwc', 'Rahmat Hidayat (Mekanik DT)', 'MECHANIC', 'EMP-103')
ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role_id = EXCLUDED.role_id,
    employee_id = EXCLUDED.employee_id;

INSERT INTO user_warehouses (user_id, warehouse_id) VALUES
('00000000-0000-0000-0000-000000000009', 'WH-CONT-HE'),
('00000000-0000-0000-0000-000000000010', 'WH-CONT-DT')
ON CONFLICT DO NOTHING;
