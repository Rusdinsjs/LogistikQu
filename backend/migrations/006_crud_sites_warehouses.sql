-- Migration 006: Add is_active to warehouses and support CRUD for sites and warehouses
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
