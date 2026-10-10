-- Migration 007: Container Warehouse Bins / Rack Management
CREATE TABLE IF NOT EXISTS warehouse_bins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id VARCHAR(50) NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    bin_code VARCHAR(50) NOT NULL,
    zone VARCHAR(50) NOT NULL DEFAULT 'BAY-LEFT',
    shelf_level VARCHAR(20) NOT NULL DEFAULT 'LEVEL-1',
    capacity_parts INT NOT NULL DEFAULT 10,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(warehouse_id, bin_code)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_bins_wh ON warehouse_bins(warehouse_id);

-- Seed existing rack locations into warehouse_bins for container warehouses
INSERT INTO warehouse_bins (warehouse_id, bin_code, zone, shelf_level, capacity_parts, description)
VALUES
  -- WH-CONT-HE Bins
  ('WH-CONT-HE', 'RACK-HE-A1', 'BAY-LEFT', 'LEVEL-1', 10, 'Rak Kiri Bawah - Fast Moving Filters'),
  ('WH-CONT-HE', 'RACK-HE-A2', 'BAY-LEFT', 'LEVEL-2', 10, 'Rak Kiri Tengah - Fuel & Oil Filters'),
  ('WH-CONT-HE', 'RACK-HE-A3', 'BAY-LEFT', 'LEVEL-3', 10, 'Rak Kiri Atas - Air Filters & Cartridges'),
  ('WH-CONT-HE', 'RACK-HE-B1', 'BAY-RIGHT', 'LEVEL-1', 10, 'Rak Kanan Bawah - Hydraulic Hoses & Fittings'),
  ('WH-CONT-HE', 'RACK-HE-B2', 'BAY-RIGHT', 'LEVEL-2', 10, 'Rak Kanan Tengah - Engine Belts & Gaskets'),
  ('WH-CONT-HE', 'RACK-HE-C1', 'BAY-RIGHT', 'LEVEL-3', 6, 'Rak Kanan Atas - Turbo & Alternator Components'),
  ('WH-CONT-HE', 'DRUM-BAY-01', 'FLOOR-BAY', 'FLOOR', 4, 'Area Drum Pelumas Drum Oli Engine 200L'),
  ('WH-CONT-HE', 'DRUM-BAY-02', 'FLOOR-BAY', 'FLOOR', 4, 'Area Drum Pelumas Drum Oli Hydraulic 200L'),

  -- WH-CONT-DT Bins
  ('WH-CONT-DT', 'RACK-DT-A1', 'BAY-LEFT', 'LEVEL-1', 10, 'Rak Kiri Bawah - Dump Truck Filters'),
  ('WH-CONT-DT', 'RACK-DT-A2', 'BAY-LEFT', 'LEVEL-2', 10, 'Rak Kiri Tengah - Secondary Filters'),
  ('WH-CONT-DT', 'RACK-DT-B1', 'BAY-RIGHT', 'LEVEL-1', 10, 'Rak Kanan Bawah - Brake & Air Hoses'),
  ('WH-CONT-DT', 'RACK-DT-B2', 'BAY-RIGHT', 'LEVEL-2', 10, 'Rak Kanan Tengah - Engine Components'),
  ('WH-CONT-DT', 'RACK-DT-C1', 'BAY-RIGHT', 'LEVEL-3', 10, 'Rak Kanan Atas - Brake Pads & Linings'),
  ('WH-CONT-DT', 'RACK-DT-C2', 'BAY-RIGHT', 'LEVEL-3', 10, 'Rak Kanan Atas - Valves & Air Dryers'),
  ('WH-CONT-DT', 'DRUM-BAY-03', 'FLOOR-BAY', 'FLOOR', 4, 'Area Drum Pelumas Oli Transmisi & Final Drive')
ON CONFLICT (warehouse_id, bin_code) DO NOTHING;
