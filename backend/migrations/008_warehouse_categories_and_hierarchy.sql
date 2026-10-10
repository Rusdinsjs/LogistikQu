-- Migration 008: Warehouse Categories Master and Parent-Child Hierarchy

CREATE TABLE IF NOT EXISTS warehouse_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial warehouse categories
INSERT INTO warehouse_categories (id, name, description, is_active)
VALUES
    ('HEAVY_EQUIPMENT', 'Alat Berat (Heavy Equipment)', 'Suku cadang dan perlengkapan armada alat berat tambang (excavator, dozer, loader, grader)', TRUE),
    ('DUMP_TRUCK', 'Dump Truck', 'Suku cadang armada pengangkut tambang dump truck & heavy hauler', TRUE),
    ('SUPPORT_FLEET', 'Kendaraan Penunjang / LV', 'Suku cadang armada penunjang lapangan, light vehicle, genset, kompresor, mobile workshop', TRUE),
    ('GENERAL', 'Umum & Fasilitas Penunjang', 'Barang konsumabel, perkakas bengkel umum, APD, dan fasilitas penunjang pergudangan', TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Add parent_warehouse_id to warehouses table for Induk - Sub relationship
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS parent_warehouse_id VARCHAR(50) REFERENCES warehouses(id) ON DELETE SET NULL;

-- Link default container warehouses to their respective main warehouses
UPDATE warehouses SET parent_warehouse_id = 'WH-MAIN-HE' WHERE id = 'WH-CONT-HE';
UPDATE warehouses SET parent_warehouse_id = 'WH-MAIN-DT' WHERE id = 'WH-CONT-DT';
