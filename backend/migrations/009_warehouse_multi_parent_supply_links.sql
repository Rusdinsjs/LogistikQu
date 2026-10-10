-- Migration 009: Multi-Parent Warehouse Supply Links (Many-to-Many)

CREATE TABLE IF NOT EXISTS warehouse_supply_links (
    sub_warehouse_id VARCHAR(50) NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    main_warehouse_id VARCHAR(50) NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (sub_warehouse_id, main_warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_wh_supply_links_sub ON warehouse_supply_links(sub_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wh_supply_links_main ON warehouse_supply_links(main_warehouse_id);

-- Migrate existing parent_warehouse_id links into the new supply links table
INSERT INTO warehouse_supply_links (sub_warehouse_id, main_warehouse_id)
SELECT id, parent_warehouse_id
FROM warehouses
WHERE parent_warehouse_id IS NOT NULL AND warehouse_type = 'CONTAINER'
ON CONFLICT DO NOTHING;
