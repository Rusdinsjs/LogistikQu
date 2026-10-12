-- Migration 012: Immutable Stock Ledger, Batch & Serial Tracking, Multi-Location & Movement Types
-- LogistikQu Enterprise WMS Standard Phase 5

-- ============================================================================
-- 1. ENHANCE STOCK MOVEMENTS FOR BATCH, SERIAL, BIN & IMMUTABILITY
-- ============================================================================
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS bin_id UUID REFERENCES warehouse_bins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_batch ON stock_movements (batch_number) WHERE batch_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_serial ON stock_movements (serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements (movement_type);

-- Trigger: IMMUTABLE STOCK LEDGER (Disallow UPDATE & DELETE)
CREATE OR REPLACE FUNCTION prevent_stock_movement_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Stock movement ledger is strictly immutable. UPDATE and DELETE are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_stock_movements ON stock_movements;
CREATE TRIGGER trg_immutable_stock_movements
BEFORE UPDATE OR DELETE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION prevent_stock_movement_mutation();

-- ============================================================================
-- 2. ENHANCE INVENTORY STOCK FOR BATCH, SERIAL & EXPIRY
-- ============================================================================
ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS bin_id UUID REFERENCES warehouse_bins(id) ON DELETE SET NULL;
ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);
ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);
ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS expiry_date DATE;

CREATE INDEX IF NOT EXISTS idx_inventory_stock_batch ON inventory_stock (batch_number) WHERE batch_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_stock_serial ON inventory_stock (serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_stock_bin ON inventory_stock (bin_id) WHERE bin_id IS NOT NULL;

-- ============================================================================
-- 3. ENHANCE TRANSACTION ITEMS FOR BATCH & SERIAL TRACEABILITY
-- ============================================================================
ALTER TABLE issue_transaction_items ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);
ALTER TABLE issue_transaction_items ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);

ALTER TABLE replenishment_request_items ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);
ALTER TABLE replenishment_request_items ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);

ALTER TABLE main_warehouse_drop_items ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);
ALTER TABLE main_warehouse_drop_items ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);
