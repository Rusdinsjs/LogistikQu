-- Migration 002: Seed Data for LogisticQu (Warehouses, Roles, Permissions, Demo Users, Master Data, Initial Stock)

-- 1. Warehouses
INSERT INTO warehouses (id, name, warehouse_type, category, description) VALUES
('WH-MAIN-HE', 'Gudang Utama Spare Part Alat Berat', 'MAIN', 'HEAVY_EQUIPMENT', 'Gudang pusat penyimpanan spare part alat berat'),
('WH-MAIN-DT', 'Gudang Utama Spare Part Dump Truck', 'MAIN', 'DUMP_TRUCK', 'Gudang pusat penyimpanan spare part dump truck'),
('WH-CONT-HE', 'Gudang Kontainer Spare Part Alat Berat', 'CONTAINER', 'HEAVY_EQUIPMENT', 'Gudang operasional kontainer untuk servis alat berat di site'),
('WH-CONT-DT', 'Gudang Kontainer Spare Part Dump Truck', 'CONTAINER', 'DUMP_TRUCK', 'Gudang operasional kontainer untuk servis dump truck di site')
ON CONFLICT (id) DO NOTHING;

-- 2. Roles
INSERT INTO roles (id, name, description) VALUES
('SUPER_ADMIN', 'Super Admin', 'Akses penuh seluruh warehouse dan administrasi sistem'),
('SUPERVISOR', 'Supervisor Gudang Utama', 'Approval replenishment, adjustment, dan part kritikal'),
('MAIN_ADMIN_HE', 'Admin Gudang Utama Alat Berat', 'Verifikasi permohonan & supply drop kontainer alat berat'),
('MAIN_ADMIN_DT', 'Admin Gudang Utama Dump Truck', 'Verifikasi permohonan & supply drop kontainer dump truck'),
('CONTAINER_ADMIN_HE', 'Admin Kontainer Alat Berat', 'POS Issue & manajemen stok kontainer alat berat'),
('CONTAINER_ADMIN_DT', 'Admin Kontainer Dump Truck', 'POS Issue & manajemen stok kontainer dump truck')
ON CONFLICT (id) DO NOTHING;

-- 3. Permissions
INSERT INTO permissions (id, name, category) VALUES
('users.manage', 'Manajemen Pengguna & Role', 'ADMIN'),
('master.manage', 'Manajemen Master Data', 'MASTER'),
('inventory.view', 'Melihat Stok & Ledger', 'INVENTORY'),
('stock.import', 'Import Saldo Awal', 'INVENTORY'),
('issue.create', 'Input Pengeluaran POS', 'TRANSACTION'),
('issue.approve', 'Approval Pengeluaran Part Kritikal', 'TRANSACTION'),
('request.create', 'Buat Request Replenishment', 'REPLENISHMENT'),
('request.verify', 'Verifikasi Request Replenishment', 'REPLENISHMENT'),
('request.approve', 'Approval Request Replenishment', 'REPLENISHMENT'),
('sto.ship', 'Eksekusi Drop Supply', 'REPLENISHMENT'),
('sto.receive', 'Penerimaan Drop Supply', 'REPLENISHMENT'),
('adjustment.create', 'Ajukan Stock Adjustment', 'ADJUSTMENT'),
('adjustment.approve', 'Approval Stock Adjustment', 'ADJUSTMENT'),
('reports.view', 'Melihat Laporan & Analitik', 'REPORT'),
('audit.view', 'Melihat Jejak Audit', 'AUDIT')
ON CONFLICT (id) DO NOTHING;

-- Assign All Permissions to SUPER_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'SUPER_ADMIN', id FROM permissions
ON CONFLICT DO NOTHING;

-- SUPERVISOR Permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
('SUPERVISOR', 'inventory.view'),
('SUPERVISOR', 'issue.approve'),
('SUPERVISOR', 'request.approve'),
('SUPERVISOR', 'adjustment.approve'),
('SUPERVISOR', 'reports.view'),
('SUPERVISOR', 'audit.view')
ON CONFLICT DO NOTHING;

-- MAIN_ADMIN_HE & MAIN_ADMIN_DT Permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
('MAIN_ADMIN_HE', 'inventory.view'),
('MAIN_ADMIN_HE', 'request.verify'),
('MAIN_ADMIN_HE', 'sto.ship'),
('MAIN_ADMIN_HE', 'reports.view'),
('MAIN_ADMIN_DT', 'inventory.view'),
('MAIN_ADMIN_DT', 'request.verify'),
('MAIN_ADMIN_DT', 'sto.ship'),
('MAIN_ADMIN_DT', 'reports.view')
ON CONFLICT DO NOTHING;

-- CONTAINER_ADMIN_HE & CONTAINER_ADMIN_DT Permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
('CONTAINER_ADMIN_HE', 'inventory.view'),
('CONTAINER_ADMIN_HE', 'stock.import'),
('CONTAINER_ADMIN_HE', 'issue.create'),
('CONTAINER_ADMIN_HE', 'request.create'),
('CONTAINER_ADMIN_HE', 'sto.receive'),
('CONTAINER_ADMIN_HE', 'adjustment.create'),
('CONTAINER_ADMIN_HE', 'reports.view'),
('CONTAINER_ADMIN_DT', 'inventory.view'),
('CONTAINER_ADMIN_DT', 'stock.import'),
('CONTAINER_ADMIN_DT', 'issue.create'),
('CONTAINER_ADMIN_DT', 'request.create'),
('CONTAINER_ADMIN_DT', 'sto.receive'),
('CONTAINER_ADMIN_DT', 'adjustment.create'),
('CONTAINER_ADMIN_DT', 'reports.view')
ON CONFLICT DO NOTHING;

-- 4. Demo Users (All with password: password123)
-- Password Hash: $argon2id$v=19$m=19456,t=2,p=1$MVLtUSvFax3O4Fn+rM817w$yM5Xj4lBmd7Nr50QD0Muij4kIJ0bnjfmpFSTnm+Ojwc
INSERT INTO users (id, username, password_hash, full_name, role_id) VALUES
('00000000-0000-0000-0000-000000000001', 'superadmin', '$argon2id$v=19$m=19456,t=2,p=1$MVLtUSvFax3O4Fn+rM817w$yM5Xj4lBmd7Nr50QD0Muij4kIJ0bnjfmpFSTnm+Ojwc', 'Budi Santoso (Super Admin)', 'SUPER_ADMIN'),
('00000000-0000-0000-0000-000000000002', 'supervisor', '$argon2id$v=19$m=19456,t=2,p=1$MVLtUSvFax3O4Fn+rM817w$yM5Xj4lBmd7Nr50QD0Muij4kIJ0bnjfmpFSTnm+Ojwc', 'Hendra Gunawan (Supervisor)', 'SUPERVISOR'),
('00000000-0000-0000-0000-000000000003', 'admin_main_he', '$argon2id$v=19$m=19456,t=2,p=1$MVLtUSvFax3O4Fn+rM817w$yM5Xj4lBmd7Nr50QD0Muij4kIJ0bnjfmpFSTnm+Ojwc', 'Rian Hidayat (Admin Utama HE)', 'MAIN_ADMIN_HE'),
('00000000-0000-0000-0000-000000000004', 'admin_main_dt', '$argon2id$v=19$m=19456,t=2,p=1$MVLtUSvFax3O4Fn+rM817w$yM5Xj4lBmd7Nr50QD0Muij4kIJ0bnjfmpFSTnm+Ojwc', 'Fajar Pratama (Admin Utama DT)', 'MAIN_ADMIN_DT'),
('00000000-0000-0000-0000-000000000005', 'admin_cont_he', '$argon2id$v=19$m=19456,t=2,p=1$MVLtUSvFax3O4Fn+rM817w$yM5Xj4lBmd7Nr50QD0Muij4kIJ0bnjfmpFSTnm+Ojwc', 'Ahmad Dani (Admin Kontainer HE)', 'CONTAINER_ADMIN_HE'),
('00000000-0000-0000-0000-000000000006', 'admin_cont_dt', '$argon2id$v=19$m=19456,t=2,p=1$MVLtUSvFax3O4Fn+rM817w$yM5Xj4lBmd7Nr50QD0Muij4kIJ0bnjfmpFSTnm+Ojwc', 'Slamet Riyadi (Admin Kontainer DT)', 'CONTAINER_ADMIN_DT')
ON CONFLICT (id) DO NOTHING;

-- User Warehouse Assignments
INSERT INTO user_warehouses (user_id, warehouse_id) VALUES
('00000000-0000-0000-0000-000000000001', 'WH-MAIN-HE'),
('00000000-0000-0000-0000-000000000001', 'WH-MAIN-DT'),
('00000000-0000-0000-0000-000000000001', 'WH-CONT-HE'),
('00000000-0000-0000-0000-000000000001', 'WH-CONT-DT'),
('00000000-0000-0000-0000-000000000002', 'WH-MAIN-HE'),
('00000000-0000-0000-0000-000000000002', 'WH-MAIN-DT'),
('00000000-0000-0000-0000-000000000003', 'WH-MAIN-HE'),
('00000000-0000-0000-0000-000000000004', 'WH-MAIN-DT'),
('00000000-0000-0000-0000-000000000005', 'WH-CONT-HE'),
('00000000-0000-0000-0000-000000000006', 'WH-CONT-DT')
ON CONFLICT DO NOTHING;

-- 5. Sites
INSERT INTO sites (id, name, description) VALUES
('SITE-VALE-A', 'Site Sorowako Blok A', 'Area tambang operasional Blok A PT Vale'),
('SITE-VALE-B', 'Site Sorowako Blok B', 'Area tambang operasional Blok B PT Vale'),
('SITE-VALE-C', 'Site Petea / Pomalaa', 'Area tambang operasional site Petea'),
('WORKSHOP-CENTRAL', 'Central Heavy Workshop', 'Bengkel pemeliharaan terpusat alat berat dan dump truck')
ON CONFLICT (id) DO NOTHING;

-- 6. Departments
INSERT INTO departments (id, name) VALUES
('DEPT-MECH-HE', 'Plant Maintenance Heavy Equipment'),
('DEPT-MECH-DT', 'Hauling Maintenance Dump Truck'),
('DEPT-LOG', 'Supply Chain & Warehouse Management')
ON CONFLICT (id) DO NOTHING;

-- 7. Employees & Mechanics
INSERT INTO employees (id, name, department_id, is_mechanic, position) VALUES
('EMP-101', 'Yusuf Mansur', 'DEPT-MECH-HE', TRUE, 'Senior Heavy Equipment Mechanic'),
('EMP-102', 'Agus Wibowo', 'DEPT-MECH-HE', TRUE, 'Hydraulic Specialist Mechanic'),
('EMP-103', 'Rahmat Hidayat', 'DEPT-MECH-DT', TRUE, 'Dump Truck Senior Mechanic'),
('EMP-104', 'Wahyu Setiawan', 'DEPT-MECH-DT', TRUE, 'Brake & Transmission Specialist'),
('EMP-105', 'Dedi Kurniawan', 'DEPT-MECH-DT', FALSE, 'Field Maintenance Supervisor'),
('EMP-106', 'Irfan Bachdim', 'DEPT-LOG', FALSE, 'Logistics Officer')
ON CONFLICT (id) DO NOTHING;

-- 8. Equipment Types
INSERT INTO equipment_types (id, name, category) VALUES
('HD785', 'Komatsu HD785-7 Haul Truck', 'DUMP_TRUCK'),
('CAT777', 'Caterpillar 777D Off-Highway Truck', 'DUMP_TRUCK'),
('PC2000', 'Komatsu PC2000-8 Hydraulic Excavator', 'HEAVY_EQUIPMENT'),
('EX1200', 'Hitachi EX1200 Mining Shovel', 'HEAVY_EQUIPMENT'),
('D85SS', 'Komatsu D85SS Bulldozer', 'HEAVY_EQUIPMENT')
ON CONFLICT (id) DO NOTHING;

-- 9. Equipment Units
INSERT INTO equipment (id, unit_number, ct_number, name, equipment_type_id, serial_number, current_hm_km, current_site_id, qr_code) VALUES
('DT-001', 'DT-001', 'CT-DT-01', 'Dump Truck HD785 #001', 'HD785', 'KM-HD-98211', 14250.50, 'SITE-VALE-A', 'QR-UNIT-DT-001'),
('DT-025', 'DT-025', 'CT-DT-25', 'Dump Truck HD785 #025', 'HD785', 'KM-HD-99432', 35200.00, 'SITE-VALE-B', 'QR-UNIT-DT-025'),
('DT-044', 'DT-044', 'CT-DT-44', 'Dump Truck CAT 777 #044', 'CAT777', 'CAT-777-4412', 21800.75, 'SITE-VALE-A', 'QR-UNIT-DT-044'),
('EX-002', 'EX-002', 'CT-EX-02', 'Excavator PC2000 #002', 'PC2000', 'KM-PC-11029', 18740.20, 'SITE-VALE-A', 'QR-UNIT-EX-002'),
('EX-005', 'EX-005', 'CT-EX-05', 'Excavator EX1200 #005', 'EX1200', 'HIT-EX-55410', 9430.00, 'SITE-VALE-B', 'QR-UNIT-EX-005'),
('DZ-010', 'DZ-010', 'CT-DZ-10', 'Bulldozer D85SS #010', 'D85SS', 'KM-DZ-88124', 28100.00, 'WORKSHOP-CENTRAL', 'QR-UNIT-DZ-010')
ON CONFLICT (id) DO NOTHING;

-- 10. Part Categories
INSERT INTO part_categories (id, name) VALUES
('FILTER', 'Filter (Oil, Fuel, Hydraulic, Air)'),
('BRAKE', 'Braking System & Friction Pads'),
('HYDRAULIC', 'Hydraulic Hose, Seal & Valve'),
('ENGINE', 'Engine Components & Belts'),
('LUBRICANT', 'Oils & Greases')
ON CONFLICT (id) DO NOTHING;

-- 11. Spare Parts Master
INSERT INTO spare_parts (id, part_name, category_id, brand, equipment_category, unit_of_measure, critical_level, requires_issue_approval, lead_time_days, default_min_stock, default_max_stock, qr_code) VALUES
('FLT-001', 'Engine Oil Filter 600-211-1340', 'FILTER', 'Komatsu Genuine', 'GENERAL', 'PCS', 'NORMAL', FALSE, 4, 15, 80, 'QR-PART-FLT-001'),
('FLT-002', 'Hydraulic Return Filter', 'FILTER', 'Donaldson', 'HEAVY_EQUIPMENT', 'PCS', 'WARNING', FALSE, 5, 10, 50, 'QR-PART-FLT-002'),
('FLT-003', 'Fuel Water Separator Filter', 'FILTER', 'Fleetguard', 'GENERAL', 'PCS', 'NORMAL', FALSE, 3, 20, 100, 'QR-PART-FLT-003'),
('BRK-001', 'Front Brake Disc Friction Kit HD785', 'BRAKE', 'Komatsu Genuine', 'DUMP_TRUCK', 'SET', 'CRITICAL', TRUE, 7, 5, 25, 'QR-PART-BRK-001'),
('BRK-002', 'Rear Wet Disc Brake Pad Set', 'BRAKE', 'Caterpillar', 'DUMP_TRUCK', 'SET', 'CRITICAL', TRUE, 7, 4, 20, 'QR-PART-BRK-002'),
('HOS-001', 'High Pressure Main Pump Hydraulic Hose', 'HYDRAULIC', 'Parker', 'HEAVY_EQUIPMENT', 'PCS', 'WARNING', FALSE, 5, 8, 30, 'QR-PART-HOS-001'),
('HOS-002', 'Steering Hydraulic Hose Assembly', 'HYDRAULIC', 'Gates', 'DUMP_TRUCK', 'PCS', 'NORMAL', FALSE, 4, 10, 40, 'QR-PART-HOS-002'),
('ENG-001', 'Fan Belt Heavy Duty V-Ribbed', 'ENGINE', 'Bando Mining', 'GENERAL', 'PCS', 'NORMAL', FALSE, 3, 12, 60, 'QR-PART-ENG-001'),
('LUB-001', 'Heavy Duty Diesel Engine Oil 15W-40', 'LUBRICANT', 'Shell Rimula', 'GENERAL', 'LITER', 'NORMAL', FALSE, 2, 200, 1000, 'QR-PART-LUB-001'),
('LUB-002', 'Extreme Pressure Mining Grease NLGI 2', 'LUBRICANT', 'Mobil Mobilgrease', 'GENERAL', 'KG', 'NORMAL', FALSE, 2, 50, 300, 'QR-PART-LUB-002')
ON CONFLICT (id) DO NOTHING;

-- 12. Initial Container Inventory Stocks
-- Gudang Kontainer Alat Berat (WH-CONT-HE)
INSERT INTO inventory_stock (warehouse_id, spare_part_id, qty_on_hand, min_stock, max_stock, safety_stock, rack_location) VALUES
('WH-CONT-HE', 'FLT-001', 35.000, 15.000, 80.000, 5.000, 'RACK-HE-A1'),
('WH-CONT-HE', 'FLT-002', 8.000, 10.000, 50.000, 4.000, 'RACK-HE-A2'),  -- Status Warning/Critical (< min)
('WH-CONT-HE', 'FLT-003', 42.000, 20.000, 100.000, 5.000, 'RACK-HE-A3'),
('WH-CONT-HE', 'HOS-001', 6.000, 8.000, 30.000, 3.000, 'RACK-HE-B1'),    -- Status Warning (< min)
('WH-CONT-HE', 'ENG-001', 25.000, 12.000, 60.000, 4.000, 'RACK-HE-B2'),
('WH-CONT-HE', 'LUB-001', 450.000, 200.000, 1000.000, 50.000, 'DRUM-BAY-01'),
('WH-CONT-HE', 'LUB-002', 120.000, 50.000, 300.000, 15.000, 'DRUM-BAY-02')
ON CONFLICT DO NOTHING;

-- Gudang Kontainer Dump Truck (WH-CONT-DT)
INSERT INTO inventory_stock (warehouse_id, spare_part_id, qty_on_hand, min_stock, max_stock, safety_stock, rack_location) VALUES
('WH-CONT-DT', 'FLT-001', 40.000, 15.000, 80.000, 5.000, 'RACK-DT-A1'),
('WH-CONT-DT', 'FLT-003', 18.000, 20.000, 100.000, 5.000, 'RACK-DT-A2'),  -- Status Warning (< min)
('WH-CONT-DT', 'BRK-001', 3.000, 5.000, 25.000, 2.000, 'RACK-DT-C1'),    -- Status Critical (< min), butuh approval
('WH-CONT-DT', 'BRK-002', 2.000, 4.000, 20.000, 2.000, 'RACK-DT-C2'),    -- Status Critical (< min), butuh approval
('WH-CONT-DT', 'HOS-002', 16.000, 10.000, 40.000, 3.000, 'RACK-DT-B1'),
('WH-CONT-DT', 'ENG-001', 30.000, 12.000, 60.000, 4.000, 'RACK-DT-B2'),
('WH-CONT-DT', 'LUB-001', 380.000, 200.000, 1000.000, 50.000, 'DRUM-BAY-03')
ON CONFLICT DO NOTHING;

-- Initial Ledger Movements
INSERT INTO stock_movements (warehouse_id, spare_part_id, movement_type, qty, balance_after, reference_number, notes)
SELECT warehouse_id, spare_part_id, 'INITIAL_IMPORT', qty_on_hand, qty_on_hand, 'INIT-20261008', 'Saldo awal kontainer'
FROM inventory_stock
ON CONFLICT DO NOTHING;

-- Record Sample Main Warehouse Drop History
INSERT INTO main_warehouse_drops (id, drop_number, main_warehouse_id, container_warehouse_id, status, dropped_by, shipped_at, notes) VALUES
('11111111-1111-1111-1111-111111111101', 'DROP-20261001-00001', 'WH-MAIN-HE', 'WH-CONT-HE', 'COMPLETED', '00000000-0000-0000-0000-000000000003', NOW() - INTERVAL '7 days', 'Pengiriman pasokan berkala awal bulan'),
('11111111-1111-1111-1111-111111111102', 'DROP-20261003-00002', 'WH-MAIN-DT', 'WH-CONT-DT', 'COMPLETED', '00000000-0000-0000-0000-000000000004', NOW() - INTERVAL '5 days', 'Supply filter dan brake pads ke kontainer DT')
ON CONFLICT DO NOTHING;

INSERT INTO main_warehouse_drop_items (drop_id, spare_part_id, qty, unit_of_measure) VALUES
('11111111-1111-1111-1111-111111111101', 'FLT-001', 20.000, 'PCS'),
('11111111-1111-1111-1111-111111111101', 'LUB-001', 200.000, 'LITER'),
('11111111-1111-1111-1111-111111111102', 'FLT-003', 15.000, 'PCS'),
('11111111-1111-1111-1111-111111111102', 'BRK-001', 2.000, 'SET')
ON CONFLICT DO NOTHING;
