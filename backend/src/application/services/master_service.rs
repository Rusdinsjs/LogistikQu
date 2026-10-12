use crate::{
    domain::entities::{
        Claims, CreateEmployeeRequest, CreateEquipmentRequest, CreateSiteRequest,
        CreateWarehouseCategoryRequest, CreateWarehouseRequest, Employee, Equipment, Site,
        SparePart, UpdateSiteRequest, UpdateSparePartRequest, UpdateWarehouseCategoryRequest,
        UpdateWarehouseRequest, WarehouseCategory, WarehouseInfo,
    },
    error::AppError,
    infrastructure::repositories::{AuditRepository, MasterRepository},
};
use serde_json::{json, Value};
use sqlx::PgPool;

#[derive(Clone)]
pub struct MasterService {
    pool: PgPool,
    master_repo: MasterRepository,
    audit_repo: AuditRepository,
}

impl MasterService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            pool: pool.clone(),
            master_repo: MasterRepository::new(pool.clone()),
            audit_repo: AuditRepository::new(pool),
        }
    }

    // --- Spare Parts ---
    pub async fn list_spare_parts(&self, search: &str) -> Result<Vec<SparePart>, AppError> {
        self.master_repo.list_spare_parts(search).await
    }

    pub async fn update_spare_part(
        &self,
        claims: &Claims,
        id: &str,
        payload: UpdateSparePartRequest,
    ) -> Result<SparePart, AppError> {
        let existing = sqlx::query_as!(
            SparePart,
            r#"
            SELECT id, part_name, category_id, brand, equipment_category,
                   unit_of_measure, critical_level, requires_issue_approval,
                   lead_time_days, default_min_stock, default_max_stock, qr_code, is_active,
                   requires_core_return, component_id, unit_cost, photo_url
            FROM spare_parts WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Spare part '{}' tidak ditemukan", id)))?;

        let requires_core = payload
            .requires_core_return
            .unwrap_or(existing.requires_core_return);
        let requires_approval = payload
            .requires_issue_approval
            .unwrap_or(existing.requires_issue_approval);
        let crit_level = payload.critical_level.unwrap_or(existing.critical_level);
        let photo = payload.photo_url.or(existing.photo_url);
        let qr = payload.qr_code.or(existing.qr_code);

        let updated = sqlx::query_as!(
            SparePart,
            r#"
            UPDATE spare_parts
            SET requires_core_return = $1, requires_issue_approval = $2, critical_level = $3,
                photo_url = $4, qr_code = $5
            WHERE id = $6
            RETURNING id, part_name, category_id, brand, equipment_category,
                      unit_of_measure, critical_level, requires_issue_approval,
                      lead_time_days, default_min_stock, default_max_stock, qr_code, is_active,
                      requires_core_return, component_id, unit_cost, photo_url
            "#,
            requires_core,
            requires_approval,
            crit_level,
            photo,
            qr,
            id
        )
        .fetch_one(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "UPDATE_SPARE_PART",
                "SPARE_PART",
                Some(id),
                Some(json!({
                    "requires_core_return": requires_core,
                    "requires_issue_approval": requires_approval,
                    "critical_level": crit_level
                })),
            )
            .await;

        Ok(updated)
    }

    // --- Equipment ---
    pub async fn list_equipment(&self, search: &str) -> Result<Vec<Equipment>, AppError> {
        self.master_repo.list_equipment(search).await
    }

    pub async fn create_equipment(
        &self,
        claims: &Claims,
        payload: CreateEquipmentRequest,
    ) -> Result<Equipment, AppError> {
        let id = payload.id.unwrap_or_else(|| payload.unit_number.clone());
        let current_hm = payload.current_hm_km.unwrap_or(rust_decimal::Decimal::ZERO);

        let eq = sqlx::query_as!(
            Equipment,
            r#"
            INSERT INTO equipment (id, unit_number, equipment_number, name, equipment_type_id, serial_number, current_hm_km, current_site_id, is_active)
            VALUES ($1, $2, $2, $3, $4, $5, $6, $7, TRUE)
            RETURNING id, unit_number, equipment_number, ct_number, name, equipment_type_id, model, serial_number, current_hm_km, current_site_id, qr_code, is_active
            "#,
            id,
            payload.unit_number,
            payload.name,
            payload.equipment_type_id,
            payload.serial_number,
            current_hm,
            payload.current_site_id
        )
        .fetch_one(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "CREATE_EQUIPMENT",
                "EQUIPMENT",
                Some(&eq.id),
                Some(json!({ "unit_number": eq.unit_number, "name": eq.name })),
            )
            .await;

        Ok(eq)
    }

    // --- Employees ---
    pub async fn list_employees(&self) -> Result<Vec<Employee>, AppError> {
        self.master_repo.list_employees().await
    }

    pub async fn create_employee(
        &self,
        claims: &Claims,
        payload: CreateEmployeeRequest,
    ) -> Result<Employee, AppError> {
        let is_mech = payload.is_mechanic.unwrap_or(true);
        let id = payload.id.unwrap_or_else(|| {
            let clean = payload.name.to_lowercase().replace(' ', "_");
            format!("EMP-{}", clean)
        });

        let emp = sqlx::query_as!(
            Employee,
            r#"
            INSERT INTO employees (id, name, department_id, is_mechanic, position, is_active)
            VALUES ($1, $2, $3, $4, $5, TRUE)
            RETURNING id, name, department_id, is_mechanic, position, is_active
            "#,
            id,
            payload.name,
            payload.department_id,
            is_mech,
            payload.position
        )
        .fetch_one(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "CREATE_EMPLOYEE",
                "EMPLOYEE",
                Some(&emp.id),
                Some(json!({ "name": emp.name, "is_mechanic": is_mech })),
            )
            .await;

        Ok(emp)
    }

    // --- Sites ---
    pub async fn list_sites(&self) -> Result<Vec<Site>, AppError> {
        self.master_repo.list_sites().await
    }

    pub async fn create_site(
        &self,
        claims: &Claims,
        payload: CreateSiteRequest,
    ) -> Result<Site, AppError> {
        let id = payload.id.unwrap_or_else(|| {
            let clean = payload.name.to_uppercase().replace(' ', "-");
            format!("SITE-{}", clean)
        });
        let is_act = payload.is_active.unwrap_or(true);

        let s = sqlx::query_as!(
            Site,
            r#"
            INSERT INTO sites (id, name, description, is_active)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, description, is_active
            "#,
            id,
            payload.name,
            payload.description,
            is_act
        )
        .fetch_one(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "CREATE_SITE",
                "SITE",
                Some(&s.id),
                Some(json!({ "name": s.name })),
            )
            .await;

        Ok(s)
    }

    pub async fn update_site(
        &self,
        claims: &Claims,
        id: &str,
        payload: UpdateSiteRequest,
    ) -> Result<Site, AppError> {
        let existing = sqlx::query_as!(
            Site,
            "SELECT id, name, description, is_active FROM sites WHERE id = $1",
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Site '{}' tidak ditemukan", id)))?;

        let name = payload.name.unwrap_or(existing.name);
        let desc = payload.description.or(existing.description);
        let act = payload.is_active.unwrap_or(existing.is_active);

        let updated = sqlx::query_as!(
            Site,
            r#"
            UPDATE sites
            SET name = $1, description = $2, is_active = $3
            WHERE id = $4
            RETURNING id, name, description, is_active
            "#,
            name,
            desc,
            act,
            id
        )
        .fetch_one(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "UPDATE_SITE",
                "SITE",
                Some(id),
                Some(json!({ "name": updated.name, "is_active": updated.is_active })),
            )
            .await;

        Ok(updated)
    }

    pub async fn delete_site(&self, claims: &Claims, id: &str) -> Result<Value, AppError> {
        let existing = sqlx::query_as!(
            Site,
            "SELECT id, name, description, is_active FROM sites WHERE id = $1",
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Site '{}' tidak ditemukan", id)))?;

        let has_eq = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM equipment WHERE current_site_id = $1)",
            id
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(false);
        let has_iss = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM issue_transactions WHERE site_id = $1)",
            id
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(false);

        if has_eq || has_iss {
            sqlx::query!("UPDATE sites SET is_active = FALSE WHERE id = $1", id)
                .execute(&self.pool)
                .await?;

            return Ok(json!({
                "success": true,
                "is_soft_deleted": true,
                "message": format!("Site {} dinonaktifkan (soft delete)", existing.name)
            }));
        }

        sqlx::query!("DELETE FROM sites WHERE id = $1", id)
            .execute(&self.pool)
            .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "DELETE_SITE",
                "SITE",
                Some(id),
                Some(json!({ "name": existing.name })),
            )
            .await;

        Ok(json!({
            "success": true,
            "is_soft_deleted": false,
            "message": format!("Site {} berhasil dihapus", existing.name)
        }))
    }

    // --- Warehouses ---
    pub async fn list_warehouses(&self) -> Result<Vec<WarehouseInfo>, AppError> {
        self.master_repo.list_warehouses().await
    }

    pub async fn create_warehouse(
        &self,
        claims: &Claims,
        payload: CreateWarehouseRequest,
    ) -> Result<WarehouseInfo, AppError> {
        let name = payload.name.trim();
        if name.is_empty() {
            return Err(AppError::BadRequest("Nama gudang wajib diisi".to_string()));
        }

        let wh_type = payload.warehouse_type.trim().to_uppercase();
        let category = payload.category.trim().to_uppercase();

        let id = payload.id.unwrap_or_else(|| {
            let prefix = if wh_type == "MAIN" {
                "WH-MAIN"
            } else {
                "WH-CONT"
            };
            let clean = name
                .to_uppercase()
                .replace(|c: char| !c.is_alphanumeric(), "-");
            format!("{}-{}", prefix, clean.trim_matches('-'))
        });

        let is_active = payload.is_active.unwrap_or(true);

        let mut target_parent_ids: Vec<String> = Vec::new();
        if wh_type == "CONTAINER" {
            if let Some(ids) = payload.parent_warehouse_ids {
                for pid in ids {
                    let trimmed = pid.trim().to_string();
                    if !trimmed.is_empty() && !target_parent_ids.contains(&trimmed) {
                        target_parent_ids.push(trimmed);
                    }
                }
            }
            if target_parent_ids.is_empty() {
                if let Some(pid) = payload.parent_warehouse_id {
                    let trimmed = pid.trim().to_string();
                    if !trimmed.is_empty() {
                        target_parent_ids.push(trimmed);
                    }
                }
            }
        }

        let primary_parent_id = target_parent_ids.first().cloned();

        sqlx::query!(
            r#"
            INSERT INTO warehouses (id, name, warehouse_type, category, description, is_active, parent_warehouse_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                warehouse_type = EXCLUDED.warehouse_type,
                category = EXCLUDED.category,
                description = EXCLUDED.description,
                is_active = EXCLUDED.is_active,
                parent_warehouse_id = EXCLUDED.parent_warehouse_id
            "#,
            id,
            name,
            wh_type,
            category,
            payload.description,
            is_active,
            primary_parent_id
        )
        .execute(&self.pool)
        .await?;

        sqlx::query!(
            "DELETE FROM warehouse_supply_links WHERE sub_warehouse_id = $1",
            id
        )
        .execute(&self.pool)
        .await?;

        for pid in &target_parent_ids {
            sqlx::query!(
                "INSERT INTO warehouse_supply_links (sub_warehouse_id, main_warehouse_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                id,
                pid
            )
            .execute(&self.pool)
            .await?;
        }

        let _ = sqlx::query!(
            r#"
            INSERT INTO user_warehouses (user_id, warehouse_id)
            SELECT u.id, $1 FROM users u
            WHERE u.role_id IN ('SUPER_ADMIN', 'MANAGER')
            ON CONFLICT DO NOTHING
            "#,
            id
        )
        .execute(&self.pool)
        .await;

        let row = sqlx::query_as!(
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
            WHERE w.id = $1
            "#,
            id
        )
        .fetch_one(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "CREATE_WAREHOUSE",
                "WAREHOUSE",
                Some(&row.id),
                Some(json!({ "name": row.name, "type": row.warehouse_type })),
            )
            .await;

        Ok(row)
    }

    pub async fn update_warehouse(
        &self,
        claims: &Claims,
        id: &str,
        payload: UpdateWarehouseRequest,
    ) -> Result<WarehouseInfo, AppError> {
        let existing = sqlx::query_as!(
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
            WHERE w.id = $1
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Gudang '{}' tidak ditemukan", id)))?;

        let name = payload.name.unwrap_or(existing.name);
        let wh_type = payload.warehouse_type.unwrap_or(existing.warehouse_type);
        let category = payload.category.unwrap_or(existing.category);
        let desc = payload.description.or(existing.description);
        let act = payload.is_active.unwrap_or(existing.is_active);

        let target_parent_ids = if wh_type == "CONTAINER" {
            if let Some(ids) = payload.parent_warehouse_ids {
                let mut list = Vec::new();
                for pid in ids {
                    let trimmed = pid.trim().to_string();
                    if !trimmed.is_empty() && !list.contains(&trimmed) {
                        list.push(trimmed);
                    }
                }
                Some(list)
            } else if let Some(pid) = payload.parent_warehouse_id {
                let trimmed = pid.trim().to_string();
                if !trimmed.is_empty() {
                    Some(vec![trimmed])
                } else {
                    Some(vec![])
                }
            } else {
                None
            }
        } else {
            Some(vec![])
        };

        let parent_id = if let Some(ref links) = target_parent_ids {
            links.first().cloned()
        } else {
            existing.parent_warehouse_id
        };

        sqlx::query!(
            r#"
            UPDATE warehouses
            SET name = $1, warehouse_type = $2, category = $3, description = $4, is_active = $5, parent_warehouse_id = $6
            WHERE id = $7
            "#,
            name,
            wh_type,
            category,
            desc,
            act,
            parent_id,
            id
        )
        .execute(&self.pool)
        .await?;

        if let Some(ref links) = target_parent_ids {
            sqlx::query!(
                "DELETE FROM warehouse_supply_links WHERE sub_warehouse_id = $1",
                id
            )
            .execute(&self.pool)
            .await?;

            for pid in links {
                sqlx::query!(
                    "INSERT INTO warehouse_supply_links (sub_warehouse_id, main_warehouse_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                    id,
                    pid
                )
                .execute(&self.pool)
                .await?;
            }
        }

        let updated = sqlx::query_as!(
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
            WHERE w.id = $1
            "#,
            id
        )
        .fetch_one(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "UPDATE_WAREHOUSE",
                "WAREHOUSE",
                Some(id),
                Some(json!({ "name": updated.name, "is_active": updated.is_active })),
            )
            .await;

        Ok(updated)
    }

    pub async fn delete_warehouse(&self, claims: &Claims, id: &str) -> Result<Value, AppError> {
        let existing = sqlx::query!("SELECT id, name FROM warehouses WHERE id = $1", id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Gudang '{}' tidak ditemukan", id)))?;

        let has_stock = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM inventory_stock WHERE warehouse_id = $1)",
            id
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(false);
        let has_issues = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM issue_transactions WHERE warehouse_id = $1)",
            id
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(false);

        if has_stock || has_issues {
            sqlx::query!(
                "UPDATE warehouses SET deleted_at = NOW(), is_active = FALSE WHERE id = $1",
                id
            )
            .execute(&self.pool)
            .await?;

            let _ = self
                .audit_repo
                .record_log(
                    Some(claims.sub),
                    Some(&claims.username),
                    "SOFT_DELETE_WAREHOUSE",
                    "WAREHOUSE",
                    Some(id),
                    Some(json!({ "name": existing.name, "soft_delete": true })),
                )
                .await;

            return Ok(json!({
                "success": true,
                "is_soft_deleted": true,
                "message": format!("Gudang {} dinonaktifkan (soft delete)", existing.name)
            }));
        }

        sqlx::query!("DELETE FROM warehouse_supply_links WHERE sub_warehouse_id = $1 OR main_warehouse_id = $1", id)
            .execute(&self.pool)
            .await?;
        sqlx::query!("DELETE FROM user_warehouses WHERE warehouse_id = $1", id)
            .execute(&self.pool)
            .await?;
        sqlx::query!("DELETE FROM warehouses WHERE id = $1", id)
            .execute(&self.pool)
            .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "DELETE_WAREHOUSE",
                "WAREHOUSE",
                Some(id),
                Some(json!({ "name": existing.name })),
            )
            .await;

        Ok(json!({
            "success": true,
            "is_soft_deleted": false,
            "message": format!("Gudang {} berhasil dihapus permanen", existing.name)
        }))
    }

    // --- Warehouse Categories ---
    pub async fn list_warehouse_categories(&self) -> Result<Vec<WarehouseCategory>, AppError> {
        self.master_repo.list_warehouse_categories().await
    }

    pub async fn create_warehouse_category(
        &self,
        claims: &Claims,
        payload: CreateWarehouseCategoryRequest,
    ) -> Result<WarehouseCategory, AppError> {
        let name = payload.name.trim();
        let id = payload.id.unwrap_or_else(|| {
            name.to_uppercase()
                .replace(|c: char| !c.is_alphanumeric(), "_")
        });
        let act = payload.is_active.unwrap_or(true);

        let cat = sqlx::query_as!(
            WarehouseCategory,
            r#"
            INSERT INTO warehouse_categories (id, name, description, is_active)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                is_active = EXCLUDED.is_active
            RETURNING id, name, description, is_active, created_at
            "#,
            id,
            name,
            payload.description,
            act
        )
        .fetch_one(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "CREATE_WAREHOUSE_CATEGORY",
                "WAREHOUSE_CATEGORY",
                Some(&cat.id),
                Some(json!({ "name": cat.name })),
            )
            .await;

        Ok(cat)
    }

    pub async fn update_warehouse_category(
        &self,
        claims: &Claims,
        id: &str,
        payload: UpdateWarehouseCategoryRequest,
    ) -> Result<WarehouseCategory, AppError> {
        let existing = sqlx::query_as!(
            WarehouseCategory,
            "SELECT id, name, description, is_active, created_at FROM warehouse_categories WHERE id = $1",
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Kategori '{}' tidak ditemukan", id)))?;

        let name = payload.name.unwrap_or(existing.name);
        let desc = payload.description.or(existing.description);
        let act = payload.is_active.unwrap_or(existing.is_active);

        let cat = sqlx::query_as!(
            WarehouseCategory,
            r#"
            UPDATE warehouse_categories
            SET name = $1, description = $2, is_active = $3
            WHERE id = $4
            RETURNING id, name, description, is_active, created_at
            "#,
            name,
            desc,
            act,
            id
        )
        .fetch_one(&self.pool)
        .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "UPDATE_WAREHOUSE_CATEGORY",
                "WAREHOUSE_CATEGORY",
                Some(id),
                Some(json!({ "name": cat.name, "is_active": cat.is_active })),
            )
            .await;

        Ok(cat)
    }

    pub async fn delete_warehouse_category(
        &self,
        claims: &Claims,
        id: &str,
    ) -> Result<Value, AppError> {
        let existing = sqlx::query_as!(
            WarehouseCategory,
            "SELECT id, name, description, is_active, created_at FROM warehouse_categories WHERE id = $1",
            id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Kategori '{}' tidak ditemukan", id)))?;

        let is_ref = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM warehouses WHERE category = $1)",
            id
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(false);

        if is_ref {
            sqlx::query!(
                "UPDATE warehouse_categories SET is_active = FALSE WHERE id = $1",
                id
            )
            .execute(&self.pool)
            .await?;

            return Ok(json!({
                "success": true,
                "is_soft_deleted": true,
                "message": format!("Kategori '{}' dinonaktifkan (soft delete)", existing.name)
            }));
        }

        sqlx::query!("DELETE FROM warehouse_categories WHERE id = $1", id)
            .execute(&self.pool)
            .await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "DELETE_WAREHOUSE_CATEGORY",
                "WAREHOUSE_CATEGORY",
                Some(id),
                Some(json!({ "name": existing.name })),
            )
            .await;

        Ok(json!({
            "success": true,
            "is_soft_deleted": false,
            "message": format!("Kategori '{}' berhasil dihapus", existing.name)
        }))
    }
}
