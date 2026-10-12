-- Migration 013: Replenishment Intelligence & Maintenance Integration
-- LogistikQu Enterprise WMS Standard Phase 7 & Phase 8

-- ============================================================================
-- 1. ASSET / EQUIPMENT MAINTENANCE ATTRIBUTES
-- ============================================================================
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS equipment_number VARCHAR(50);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS model VARCHAR(100);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(100);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS year_manufactured INT;

UPDATE equipment SET equipment_number = unit_number WHERE equipment_number IS NULL;
UPDATE equipment SET model = 'HD785-7', manufacturer = 'Komatsu', year_manufactured = 2021 WHERE equipment_type_id = 'HD785' AND model IS NULL;
UPDATE equipment SET model = '777D', manufacturer = 'Caterpillar', year_manufactured = 2020 WHERE equipment_type_id = 'CAT777' AND model IS NULL;
UPDATE equipment SET model = 'PC2000-8', manufacturer = 'Komatsu', year_manufactured = 2022 WHERE equipment_type_id = 'PC2000' AND model IS NULL;
UPDATE equipment SET model = 'EX1200-6', manufacturer = 'Hitachi', year_manufactured = 2019 WHERE equipment_type_id = 'EX1200' AND model IS NULL;
UPDATE equipment SET model = 'D85SS-2', manufacturer = 'Komatsu', year_manufactured = 2021 WHERE equipment_type_id = 'D85SS' AND model IS NULL;

-- ============================================================================
-- 2. EQUIPMENT COMPONENTS (Component Group)
-- ============================================================================
CREATE TABLE IF NOT EXISTS equipment_components (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO equipment_components (id, name, description) VALUES
('ENGINE', 'Engine & Power Generation', 'Main diesel engine, fuel injectors, turbochargers, belts'),
('HYDRAULIC', 'Hydraulic Power & Implement', 'Pumps, cylinders, high pressure hoses, control valves'),
('BRAKE', 'Braking & Wheel Group', 'Wet disc brakes, friction pads, brake actuators'),
('TRANSMISSION', 'Transmission & Drivetrain', 'Torque converter, differential, final drive gears'),
('UNDERCARRIAGE', 'Undercarriage & Tracks', 'Track links, rollers, idlers, sprockets, track shoes'),
('ELECTRICAL', 'Electrical & Control System', 'Alternators, starters, wiring harness, ECM controllers'),
('FILTRATION', 'Filtration & Fluid Conditioning', 'Lube oil, hydraulic return, and fuel water separator filters'),
('LUBRICATION', 'Lubrication System', 'Auto-lube injectors, grease lines, heavy-duty engine oil')
ON CONFLICT (id) DO NOTHING;

-- Link Spare Parts to Component and add Unit Cost
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS component_id VARCHAR(50) REFERENCES equipment_components(id) ON DELETE SET NULL;
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0;

UPDATE spare_parts SET component_id = 'FILTRATION', unit_cost = 450000 WHERE id = 'FLT-001';
UPDATE spare_parts SET component_id = 'FILTRATION', unit_cost = 850000 WHERE id = 'FLT-002';
UPDATE spare_parts SET component_id = 'FILTRATION', unit_cost = 620000 WHERE id = 'FLT-003';
UPDATE spare_parts SET component_id = 'BRAKE', unit_cost = 3200000 WHERE id = 'BRK-001';
UPDATE spare_parts SET component_id = 'BRAKE', unit_cost = 2750000 WHERE id = 'BRK-002';
UPDATE spare_parts SET component_id = 'HYDRAULIC', unit_cost = 1850000 WHERE id = 'HOS-001';
UPDATE spare_parts SET component_id = 'HYDRAULIC', unit_cost = 1450000 WHERE id = 'HOS-002';
UPDATE spare_parts SET component_id = 'ENGINE', unit_cost = 380000 WHERE id = 'ENG-001';
UPDATE spare_parts SET component_id = 'LUBRICATION', unit_cost = 55000 WHERE id = 'LUB-001';
UPDATE spare_parts SET component_id = 'LUBRICATION', unit_cost = 95000 WHERE id = 'LUB-002';

-- Add unit price to issue transaction items
ALTER TABLE issue_transaction_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE issue_transaction_items ADD COLUMN IF NOT EXISTS total_price NUMERIC(15,2) NOT NULL DEFAULT 0;

-- Backfill issue item prices
UPDATE issue_transaction_items iti
SET unit_price = p.unit_cost,
    total_price = iti.qty * p.unit_cost
FROM spare_parts p
WHERE iti.spare_part_id = p.id AND iti.unit_price = 0;

-- ============================================================================
-- 3. EQUIPMENT FAILURE & MAINTENANCE HISTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS equipment_maintenance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_number VARCHAR(50) NOT NULL,
    equipment_id VARCHAR(50) NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    unit_number VARCHAR(50) NOT NULL,
    component_id VARCHAR(50) REFERENCES equipment_components(id) ON DELETE SET NULL,
    spare_part_id VARCHAR(50) REFERENCES spare_parts(id) ON DELETE SET NULL,
    failure_code VARCHAR(50) NOT NULL,
    failure_symptom TEXT NOT NULL,
    maintenance_type VARCHAR(50) NOT NULL DEFAULT 'CORRECTIVE',
    hm_km NUMERIC(12,2) NOT NULL DEFAULT 0,
    parts_qty NUMERIC(14,3) NOT NULL DEFAULT 1,
    parts_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    labor_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    downtime_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
    mechanic_name VARCHAR(100),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maint_hist_equip ON equipment_maintenance_history (equipment_id);
CREATE INDEX IF NOT EXISTS idx_maint_hist_unit ON equipment_maintenance_history (unit_number);
CREATE INDEX IF NOT EXISTS idx_maint_hist_comp ON equipment_maintenance_history (component_id);
CREATE INDEX IF NOT EXISTS idx_maint_hist_part ON equipment_maintenance_history (spare_part_id);
CREATE INDEX IF NOT EXISTS idx_maint_hist_failure ON equipment_maintenance_history (failure_code);
CREATE INDEX IF NOT EXISTS idx_maint_hist_performed ON equipment_maintenance_history (performed_at DESC);

-- Seed initial maintenance history
INSERT INTO equipment_maintenance_history (
    work_order_number, equipment_id, unit_number, component_id, spare_part_id,
    failure_code, failure_symptom, maintenance_type, hm_km, parts_qty,
    parts_cost, labor_cost, total_cost, downtime_hours, mechanic_name, performed_at, notes
) VALUES
(
    'WO-2026-0811', 'EX-002', 'EX-002', 'HYDRAULIC', 'HOS-001',
    'HOSE_BURST', 'Tekanan pompa hidrolik drop, selang utama pecah saat menggali ore di Pit Sorowako',
    'BREAKDOWN', 18740.20, 2.0, 3700000, 500000, 4200000, 4.5, 'Agus Santoso', NOW() - INTERVAL '5 days',
    'Diganti selang pompa utama baru Parker dan flushing sistem hidrolik'
),
(
    'WO-2026-0820', 'DT-001', 'DT-001', 'BRAKE', 'BRK-001',
    'BRAKE_WEAR', 'Ketebalan kampas rem depan di bawah batas servis toleransi 3mm',
    'PREVENTIVE', 14250.50, 1.0, 3200000, 700000, 3900000, 6.0, 'Wahyu Setiawan', NOW() - INTERVAL '8 days',
    'Penggantian 1 set front brake disc friction kit HD785'
),
(
    'WO-2026-0835', 'DT-025', 'DT-025', 'FILTRATION', 'FLT-003',
    'CLOGGED_FILTER', 'Engine hunting & kehilangan tenaga pada tanjakan hauling incline 8%',
    'CORRECTIVE', 35200.00, 2.0, 1240000, 300000, 1540000, 2.0, 'Wahyu Setiawan', NOW() - INTERVAL '12 days',
    'Drain fuel tank dan ganti fuel water separator filter baru'
),
(
    'WO-2026-0842', 'DZ-010', 'DZ-010', 'ENGINE', 'ENG-001',
    'BELT_SNAPPED', 'Fan belt putus saat operasional dozing, radiator overheat 108C',
    'BREAKDOWN', 28100.00, 1.0, 380000, 300000, 680000, 3.0, 'Agus Santoso', NOW() - INTERVAL '18 days',
    'Pemasangan fan belt heavy duty baru dan pengecekan bearing alternator'
),
(
    'WO-2026-0850', 'DT-044', 'DT-044', 'HYDRAULIC', 'HOS-002',
    'HOSE_LEAK', 'Rembesan oli hidrolik kemudi terdeteksi saat inspeksi harian P2H',
    'PREVENTIVE', 21800.75, 1.0, 1450000, 400000, 1850000, 2.5, 'Wahyu Setiawan', NOW() - INTERVAL '22 days',
    'Peremajaan selang steering hydraulic assembly'
)
ON CONFLICT DO NOTHING;
