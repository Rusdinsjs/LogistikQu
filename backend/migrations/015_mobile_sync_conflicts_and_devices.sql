-- Migration 015: Mobile Devices Binding and Sync Conflict Resolution Management
CREATE TABLE IF NOT EXISTS mobile_devices (
    device_id VARCHAR(100) PRIMARY KEY,
    device_name VARCHAR(100) NOT NULL,
    assigned_warehouse_id VARCHAR(50) REFERENCES warehouses(id),
    assigned_user_id UUID REFERENCES users(id),
    app_version VARCHAR(50) DEFAULT '2.0.0',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Registered Industrial Handheld Devices
INSERT INTO mobile_devices (device_id, device_name, assigned_warehouse_id, is_active)
VALUES 
    ('ANDROID-WH-001', 'Zebra TC57 Handheld Kontainer HE', 'WH-CONT-HE', TRUE),
    ('ANDROID-WH-002', 'Honeywell EDA51 Kontainer DT', 'WH-CONT-DT', TRUE),
    ('TABLET-SPV-001', 'Samsung Active Tab 4 Supervisor', 'WH-MAIN-HE', TRUE)
ON CONFLICT (device_id) DO NOTHING;

-- Mobile Sync Conflicts Table (Server Authority vs Client Local Transactions)
CREATE TABLE IF NOT EXISTS mobile_sync_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(100) NOT NULL,
    transaction_id UUID NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    spare_part_id VARCHAR(50) NOT NULL,
    warehouse_id VARCHAR(50) NOT NULL,
    server_stock NUMERIC(12,2) NOT NULL,
    client_stock NUMERIC(12,2) NOT NULL,
    requested_qty NUMERIC(12,2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'CONFLICT_PENDING', -- CONFLICT_PENDING, RESOLVED_OVERRIDE, RESOLVED_REJECT
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status ON mobile_sync_conflicts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_device ON mobile_sync_conflicts (device_id);
