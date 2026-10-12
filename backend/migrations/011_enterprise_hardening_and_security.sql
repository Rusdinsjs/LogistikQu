-- Migration 011: Enterprise Hardening, Audit Trail, Soft Delete, Indexing & Security
-- LogistikQu Enterprise WMS Standard

-- ============================================================================
-- 1. AUDIT TRAIL SYSTEM (Enterprise Standard)
-- ============================================================================
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT now();

-- Backfill data for old records
UPDATE audit_logs
SET old_value = old_values,
    new_value = new_values,
    timestamp = created_at
WHERE timestamp IS NULL OR old_value IS NULL;

ALTER TABLE audit_logs ALTER COLUMN timestamp SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);

-- ============================================================================
-- 2. SOFT DELETE SUPPORT (deleted_at TIMESTAMP)
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at);
CREATE INDEX IF NOT EXISTS idx_spare_parts_deleted_at ON spare_parts (deleted_at);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_deleted_at ON inventory_stock (deleted_at);
CREATE INDEX IF NOT EXISTS idx_warehouses_deleted_at ON warehouses (deleted_at);

-- ============================================================================
-- 3. FAILED LOGIN & BRUTE FORCE PROTECTION
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ DEFAULT NULL;

-- ============================================================================
-- 4. REFRESH TOKEN ROTATION & SESSION MANAGEMENT
-- ============================================================================
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS ip_address VARCHAR(255);
ALTER TABLE refresh_tokens ALTER COLUMN ip_address TYPE VARCHAR(255);
ALTER TABLE audit_logs ALTER COLUMN ip_address TYPE VARCHAR(255);
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_revoked ON refresh_tokens (user_id, revoked_at);

-- ============================================================================
-- 5. DATABASE OPTIMIZATION & PROPER INDEXING
-- ============================================================================
-- Stock Movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_wh_part ON stock_movements (warehouse_id, spare_part_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements (created_at DESC);

-- Issue Transactions
CREATE INDEX IF NOT EXISTS idx_issue_transactions_wh_unit ON issue_transactions (warehouse_id, unit_number);
CREATE INDEX IF NOT EXISTS idx_issue_transactions_status ON issue_transactions (status);
CREATE INDEX IF NOT EXISTS idx_issue_transactions_created ON issue_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_items_trans_id ON issue_transaction_items (transaction_id);

-- Replenishment Requests
CREATE INDEX IF NOT EXISTS idx_replenishment_requests_status ON replenishment_requests (status);
CREATE INDEX IF NOT EXISTS idx_replenishment_requests_wh ON replenishment_requests (container_warehouse_id, main_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_replenishment_requests_created ON replenishment_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replenishment_items_req_id ON replenishment_request_items (request_id);

-- Main Warehouse Drops
CREATE INDEX IF NOT EXISTS idx_drops_status ON main_warehouse_drops (status);
CREATE INDEX IF NOT EXISTS idx_drops_shipped ON main_warehouse_drops (shipped_at DESC);
CREATE INDEX IF NOT EXISTS idx_drop_items_drop_id ON main_warehouse_drop_items (drop_id);

-- Stock Adjustments
CREATE INDEX IF NOT EXISTS idx_adjustments_wh ON stock_adjustments (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_created ON stock_adjustments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_adjustment_items_adj_id ON stock_adjustment_items (adjustment_id);

-- Used Part Returns
CREATE INDEX IF NOT EXISTS idx_returns_status ON used_part_returns (status);
CREATE INDEX IF NOT EXISTS idx_returns_unit ON used_part_returns (unit_number);

-- User Relations
CREATE INDEX IF NOT EXISTS idx_user_warehouses_user_wh ON user_warehouses (user_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_perm ON user_permissions (user_id, permission_id);

-- Spare Parts & Equipment
CREATE INDEX IF NOT EXISTS idx_spare_parts_category ON spare_parts (category_id);
CREATE INDEX IF NOT EXISTS idx_spare_parts_brand ON spare_parts (brand);
CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment (equipment_type_id);
CREATE INDEX IF NOT EXISTS idx_equipment_site ON equipment (current_site_id);

-- ============================================================================
-- 6. DATABASE CONSTRAINTS
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_replenish_item_qty_positive') THEN
        ALTER TABLE replenishment_request_items ADD CONSTRAINT chk_replenish_item_qty_positive CHECK (requested_qty > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_adj_item_qty_non_negative') THEN
        ALTER TABLE stock_adjustment_items ADD CONSTRAINT chk_stock_adj_item_qty_non_negative CHECK (qty_physical >= 0);
    END IF;
END $$;
