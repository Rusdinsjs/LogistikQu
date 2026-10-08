-- Migration 001: Initial Schema for LogisticQu

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Warehouses
CREATE TABLE warehouses (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    warehouse_type VARCHAR(20) NOT NULL, -- 'MAIN', 'CONTAINER'
    category VARCHAR(20) NOT NULL,       -- 'HEAVY_EQUIPMENT', 'DUMP_TRUCK'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Roles
CREATE TABLE roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- 3. Permissions
CREATE TABLE permissions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL
);

-- 4. Role Permissions
CREATE TABLE role_permissions (
    role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(50) REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 5. Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role_id VARCHAR(50) REFERENCES roles(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. User Warehouses
CREATE TABLE user_warehouses (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    warehouse_id VARCHAR(50) REFERENCES warehouses(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, warehouse_id)
);

-- 7. Refresh Tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Sites
CREATE TABLE sites (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 9. Departments
CREATE TABLE departments (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- 10. Employees
CREATE TABLE employees (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department_id VARCHAR(50) REFERENCES departments(id),
    is_mechanic BOOLEAN NOT NULL DEFAULT FALSE,
    position VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 11. Equipment Types
CREATE TABLE equipment_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL -- 'HEAVY_EQUIPMENT', 'DUMP_TRUCK'
);

-- 12. Equipment
CREATE TABLE equipment (
    id VARCHAR(50) PRIMARY KEY, -- No Lambung (e.g. DT-001)
    unit_number VARCHAR(50) NOT NULL,
    ct_number VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    equipment_type_id VARCHAR(50) REFERENCES equipment_types(id),
    serial_number VARCHAR(100),
    current_hm_km NUMERIC(12,2) NOT NULL DEFAULT 0,
    current_site_id VARCHAR(50) REFERENCES sites(id),
    qr_code VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 13. Part Categories
CREATE TABLE part_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- 14. Spare Parts
CREATE TABLE spare_parts (
    id VARCHAR(50) PRIMARY KEY, -- Part Number (e.g. FLT-001)
    part_name VARCHAR(150) NOT NULL,
    category_id VARCHAR(50) REFERENCES part_categories(id),
    brand VARCHAR(100),
    equipment_category VARCHAR(20) NOT NULL, -- 'HEAVY_EQUIPMENT', 'DUMP_TRUCK', 'GENERAL'
    unit_of_measure VARCHAR(20) NOT NULL,    -- 'PCS', 'SET', 'LITER', etc.
    critical_level VARCHAR(20) NOT NULL DEFAULT 'NORMAL', -- 'NORMAL', 'WARNING', 'CRITICAL'
    requires_issue_approval BOOLEAN NOT NULL DEFAULT FALSE,
    lead_time_days INT NOT NULL DEFAULT 5,
    default_min_stock NUMERIC(12,2) NOT NULL DEFAULT 10,
    default_max_stock NUMERIC(12,2) NOT NULL DEFAULT 100,
    qr_code VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 15. Inventory Stock (Container Warehouse on-hand stocks)
CREATE TABLE inventory_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id VARCHAR(50) REFERENCES warehouses(id) NOT NULL,
    spare_part_id VARCHAR(50) REFERENCES spare_parts(id) NOT NULL,
    qty_on_hand NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
    min_stock NUMERIC(14,3) NOT NULL DEFAULT 10,
    max_stock NUMERIC(14,3) NOT NULL DEFAULT 100,
    safety_stock NUMERIC(14,3) NOT NULL DEFAULT 5,
    rack_location VARCHAR(50),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (warehouse_id, spare_part_id)
);

-- 16. Stock Movements (Immutable Ledger)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id VARCHAR(50) REFERENCES warehouses(id) NOT NULL,
    spare_part_id VARCHAR(50) REFERENCES spare_parts(id) NOT NULL,
    movement_type VARCHAR(30) NOT NULL, -- 'INITIAL_IMPORT', 'ISSUE_OUT', 'DROP_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'
    qty NUMERIC(14,3) NOT NULL,
    balance_after NUMERIC(14,3) NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Issue Transactions (POS with Full Traceability)
CREATE TABLE issue_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id VARCHAR(50) REFERENCES warehouses(id) NOT NULL,
    site_id VARCHAR(50) REFERENCES sites(id) NOT NULL,
    receiver_name VARCHAR(100) NOT NULL,
    receiver_employee_id VARCHAR(50),
    receiver_department VARCHAR(100),
    unit_number VARCHAR(50) NOT NULL,
    unit_name VARCHAR(100) NOT NULL,
    unit_type VARCHAR(50) NOT NULL,
    ct_number VARCHAR(50),
    serial_number VARCHAR(100),
    hm_km NUMERIC(12,2),
    mechanic_name VARCHAR(100) NOT NULL,
    mechanic_id VARCHAR(50),
    work_order_number VARCHAR(50),
    maintenance_type VARCHAR(50), -- 'PREVENTIVE', 'CORRECTIVE', etc.
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'PENDING_APPROVAL', 'REJECTED'
    notes TEXT,
    latitude NUMERIC(10,6),
    longitude NUMERIC(10,6),
    device_id VARCHAR(100),
    client_uuid UUID,
    created_by UUID REFERENCES users(id) NOT NULL,
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. Issue Transaction Items
CREATE TABLE issue_transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES issue_transactions(id) ON DELETE CASCADE NOT NULL,
    spare_part_id VARCHAR(50) REFERENCES spare_parts(id) NOT NULL,
    qty NUMERIC(14,3) NOT NULL CHECK (qty > 0),
    unit_of_measure VARCHAR(20) NOT NULL
);

-- 19. Replenishment Requests
CREATE TABLE replenishment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(50) UNIQUE NOT NULL,
    container_warehouse_id VARCHAR(50) REFERENCES warehouses(id) NOT NULL,
    main_warehouse_id VARCHAR(50) REFERENCES warehouses(id) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'REQUESTED',
    notes TEXT,
    admin_notes TEXT,
    supervisor_notes TEXT,
    requested_by UUID REFERENCES users(id) NOT NULL,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    shipped_by UUID REFERENCES users(id),
    shipped_at TIMESTAMPTZ,
    received_by UUID REFERENCES users(id),
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. Replenishment Request Items
CREATE TABLE replenishment_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES replenishment_requests(id) ON DELETE CASCADE NOT NULL,
    spare_part_id VARCHAR(50) REFERENCES spare_parts(id) NOT NULL,
    requested_qty NUMERIC(14,3) NOT NULL,
    recommended_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
    verified_qty NUMERIC(14,3) NOT NULL,
    approved_qty NUMERIC(14,3) NOT NULL,
    shipped_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
    received_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
    notes TEXT
);

-- 21. Main Warehouse Drops (Supply to Container Record)
CREATE TABLE main_warehouse_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drop_number VARCHAR(50) UNIQUE NOT NULL,
    request_id UUID REFERENCES replenishment_requests(id),
    main_warehouse_id VARCHAR(50) REFERENCES warehouses(id) NOT NULL,
    container_warehouse_id VARCHAR(50) REFERENCES warehouses(id) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED', -- 'IN_TRANSIT', 'COMPLETED'
    dropped_by UUID REFERENCES users(id) NOT NULL,
    received_by UUID REFERENCES users(id),
    shipped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at TIMESTAMPTZ,
    notes TEXT
);

-- 22. Main Warehouse Drop Items
CREATE TABLE main_warehouse_drop_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drop_id UUID REFERENCES main_warehouse_drops(id) ON DELETE CASCADE NOT NULL,
    spare_part_id VARCHAR(50) REFERENCES spare_parts(id) NOT NULL,
    qty NUMERIC(14,3) NOT NULL CHECK (qty > 0),
    unit_of_measure VARCHAR(20) NOT NULL
);

-- 23. Stock Adjustments (Container Stock Opname)
CREATE TABLE stock_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_number VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id VARCHAR(50) REFERENCES warehouses(id) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    notes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL', -- 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'
    created_by UUID REFERENCES users(id) NOT NULL,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 24. Stock Adjustment Items
CREATE TABLE stock_adjustment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id UUID REFERENCES stock_adjustments(id) ON DELETE CASCADE NOT NULL,
    spare_part_id VARCHAR(50) REFERENCES spare_parts(id) NOT NULL,
    qty_system NUMERIC(14,3) NOT NULL,
    qty_physical NUMERIC(14,3) NOT NULL,
    difference NUMERIC(14,3) NOT NULL
);

-- 25. Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    username VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 26. Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    role_id VARCHAR(50),
    warehouse_id VARCHAR(50),
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 27. Document Sequences (Thread-safe atomic document numbering)
CREATE TABLE document_sequences (
    doc_type VARCHAR(20) NOT NULL,
    date_str VARCHAR(8) NOT NULL,
    last_number INT NOT NULL DEFAULT 0,
    PRIMARY KEY (doc_type, date_str)
);

-- Performance Indexes
CREATE INDEX idx_inventory_stock_wh ON inventory_stock(warehouse_id);
CREATE INDEX idx_stock_movements_wh_part ON stock_movements(warehouse_id, spare_part_id);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX idx_issue_transactions_wh ON issue_transactions(warehouse_id);
CREATE INDEX idx_issue_transactions_created ON issue_transactions(created_at);
CREATE INDEX idx_issue_transactions_unit ON issue_transactions(unit_number);
CREATE INDEX idx_replenishment_status ON replenishment_requests(status);
CREATE INDEX idx_replenishment_container ON replenishment_requests(container_warehouse_id);
CREATE INDEX idx_main_drops_container ON main_warehouse_drops(container_warehouse_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
