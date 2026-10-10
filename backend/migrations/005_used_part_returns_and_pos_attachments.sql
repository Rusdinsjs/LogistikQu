-- Migration 005: Core Return Tracking and POS Attachments

-- 1. Add requires_core_return to spare_parts
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS requires_core_return BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark high-value remanufacturable / core components as requiring core return
UPDATE spare_parts SET requires_core_return = TRUE
WHERE id IN ('TUR-001', 'ALT-001', 'STR-001', 'INJ-001', 'HYD-001', 'WTR-001')
   OR id LIKE 'TUR%' OR id LIKE 'ALT%' OR id LIKE 'STR%' OR id LIKE 'INJ%' OR id LIKE 'HYD%';

-- 2. Add attachments to issue_transactions
ALTER TABLE issue_transactions ADD COLUMN IF NOT EXISTS evidence_photo_url TEXT;
ALTER TABLE issue_transactions ADD COLUMN IF NOT EXISTS document_url TEXT;

-- 3. Create used_part_returns table
CREATE TABLE IF NOT EXISTS used_part_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number VARCHAR(50) UNIQUE NOT NULL,
    issue_transaction_id UUID NOT NULL REFERENCES issue_transactions(id) ON DELETE CASCADE,
    spare_part_id VARCHAR(50) NOT NULL REFERENCES spare_parts(id),
    qty NUMERIC(14, 3) NOT NULL,
    unit_of_measure VARCHAR(20) NOT NULL,
    unit_number VARCHAR(50) NOT NULL,
    mechanic_name VARCHAR(100) NOT NULL,
    mechanic_id VARCHAR(50),
    warehouse_id VARCHAR(50) NOT NULL REFERENCES warehouses(id),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_RETURN',
    current_holder_type VARCHAR(30) NOT NULL DEFAULT 'MECHANIC',
    current_holder_name VARCHAR(100) NOT NULL,
    container_received_at TIMESTAMPTZ,
    container_received_by UUID REFERENCES users(id),
    container_notes TEXT,
    container_photo_url TEXT,
    main_received_at TIMESTAMPTZ,
    main_received_by UUID REFERENCES users(id),
    main_warehouse_id VARCHAR(50) REFERENCES warehouses(id),
    main_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_status ON used_part_returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_wh ON used_part_returns(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_returns_mechanic ON used_part_returns(mechanic_name);

-- 4. Seed core return parts & inventory stock
UPDATE spare_parts SET requires_core_return = TRUE WHERE id IN ('BRK-001', 'HOS-001');

INSERT INTO spare_parts (id, part_name, category_id, brand, equipment_category, unit_of_measure, critical_level, requires_issue_approval, lead_time_days, default_min_stock, default_max_stock, qr_code, is_active, requires_core_return)
VALUES
('TUR-001', 'Turbocharger Wastegate Assembly Komatsu', 'ENGINE', 'Garrett', 'HEAVY_EQUIPMENT', 'SET', 'CRITICAL', true, 14, 2, 5, 'QR-TUR-001', true, true),
('ALT-001', 'Heavy Duty 24V 85A Alternator Delco', 'ENGINE', 'Delco Remy', 'HEAVY_EQUIPMENT', 'UNIT', 'NORMAL', false, 7, 2, 6, 'QR-ALT-001', true, true),
('STR-001', 'Direct Drive Starter Motor 24V 7.5kW', 'ENGINE', 'Denso', 'DUMP_TRUCK', 'UNIT', 'NORMAL', false, 7, 3, 8, 'QR-STR-001', true, true)
ON CONFLICT (id) DO UPDATE SET requires_core_return = TRUE;

INSERT INTO inventory_stock (warehouse_id, spare_part_id, qty_on_hand, min_stock, max_stock)
VALUES
('WH-CONT-HE', 'TUR-001', 3, 1, 5),
('WH-CONT-HE', 'ALT-001', 4, 1, 6),
('WH-CONT-DT', 'STR-001', 5, 2, 8)
ON CONFLICT (warehouse_id, spare_part_id) DO NOTHING;

