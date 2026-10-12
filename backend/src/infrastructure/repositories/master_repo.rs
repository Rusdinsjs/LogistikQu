use crate::{
    domain::entities::{Employee, Equipment, Site, SparePart, WarehouseCategory, WarehouseInfo},
    error::AppError,
};
use sqlx::PgPool;

#[derive(Clone)]
pub struct MasterRepository {
    pool: PgPool,
}

impl MasterRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list_spare_parts(&self, search: &str) -> Result<Vec<SparePart>, AppError> {
        let search_pattern = format!("%{}%", search);

        let parts = sqlx::query_as!(
            SparePart,
            r#"
            SELECT id, part_name, category_id, brand, equipment_category,
                   unit_of_measure, critical_level, requires_issue_approval,
                   lead_time_days, default_min_stock, default_max_stock, qr_code, is_active,
                   requires_core_return, component_id, unit_cost, photo_url
            FROM spare_parts
            WHERE deleted_at IS NULL
              AND ($1 = '' OR id ILIKE $2 OR part_name ILIKE $2 OR brand ILIKE $2)
            ORDER BY id
            "#,
            search,
            search_pattern
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(parts)
    }

    #[allow(dead_code)]
    pub async fn soft_delete_spare_part(&self, id: &str) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            UPDATE spare_parts
            SET deleted_at = NOW(), is_active = FALSE
            WHERE id = $1
            "#,
            id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn list_equipment(&self, search: &str) -> Result<Vec<Equipment>, AppError> {
        let search_pattern = format!("%{}%", search);

        let eq = sqlx::query_as!(
            Equipment,
            r#"
            SELECT id, unit_number, equipment_number, ct_number, name, equipment_type_id,
                   model, serial_number, current_hm_km, current_site_id, qr_code, is_active
            FROM equipment
            WHERE ($1 = '' OR unit_number ILIKE $2 OR name ILIKE $2 OR ct_number ILIKE $2)
            ORDER BY unit_number
            "#,
            search,
            search_pattern
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(eq)
    }

    pub async fn list_employees(&self) -> Result<Vec<Employee>, AppError> {
        let emps = sqlx::query_as!(
            Employee,
            r#"
            SELECT id, name, department_id, is_mechanic, position, is_active
            FROM employees
            ORDER BY name
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(emps)
    }

    pub async fn list_sites(&self) -> Result<Vec<Site>, AppError> {
        let sites = sqlx::query_as!(
            Site,
            r#"
            SELECT id, name, description, is_active
            FROM sites
            ORDER BY name
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(sites)
    }

    pub async fn list_warehouses(&self) -> Result<Vec<WarehouseInfo>, AppError> {
        let whs = sqlx::query_as!(
            WarehouseInfo,
            r#"
            SELECT
                w.id,
                w.name,
                w.warehouse_type,
                w.category,
                w.description,
                w.is_active,
                w.parent_warehouse_id,
                ARRAY(SELECT l.main_warehouse_id FROM warehouse_supply_links l WHERE l.sub_warehouse_id = w.id ORDER BY l.main_warehouse_id)::text[] AS "parent_warehouse_ids?",
                ARRAY(SELECT l.sub_warehouse_id FROM warehouse_supply_links l WHERE l.main_warehouse_id = w.id ORDER BY l.sub_warehouse_id)::text[] AS "supplied_sub_warehouse_ids?"
            FROM warehouses w
            WHERE w.deleted_at IS NULL
            ORDER BY w.warehouse_type, w.category, w.name
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(whs)
    }

    #[allow(dead_code)]
    pub async fn soft_delete_warehouse(&self, id: &str) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            UPDATE warehouses
            SET deleted_at = NOW(), is_active = FALSE
            WHERE id = $1
            "#,
            id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn list_warehouse_categories(&self) -> Result<Vec<WarehouseCategory>, AppError> {
        let cats = sqlx::query_as!(
            WarehouseCategory,
            r#"
            SELECT id, name, description, is_active, created_at
            FROM warehouse_categories
            ORDER BY name
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(cats)
    }
}
