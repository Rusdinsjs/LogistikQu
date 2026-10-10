use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_permission, AuthUser},
    },
    domain::models::{
        CreateEmployeeRequest, CreateEquipmentRequest, CreateSiteRequest, CreateWarehouseRequest,
        Employee, Equipment, Site, SparePart, UpdateSiteRequest, UpdateSparePartRequest,
        UpdateWarehouseRequest, WarehouseInfo,
        WarehouseCategory, CreateWarehouseCategoryRequest, UpdateWarehouseCategoryRequest,
    },
    error::AppError,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use rust_decimal::Decimal;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct MasterQuery {
    pub search: Option<String>,
    pub category: Option<String>,
}

pub async fn list_spare_parts(
    State(state): State<AppState>,
    _user: AuthUser,
    Query(query): Query<MasterQuery>,
) -> Result<Json<Vec<SparePart>>, AppError> {
    let search = query.search.unwrap_or_default();
    let search_pattern = format!("%{}%", search);

    let parts = sqlx::query_as!(
        SparePart,
        r#"
        SELECT id, part_name, category_id, brand, equipment_category,
               unit_of_measure, critical_level, requires_issue_approval,
               lead_time_days, default_min_stock, default_max_stock, qr_code, is_active,
               requires_core_return
        FROM spare_parts
        WHERE ($1 = '' OR id ILIKE $2 OR part_name ILIKE $2 OR brand ILIKE $2)
        ORDER BY id
        "#,
        search,
        search_pattern
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(parts))
}

pub async fn list_equipment(
    State(state): State<AppState>,
    _user: AuthUser,
    Query(query): Query<MasterQuery>,
) -> Result<Json<Vec<Equipment>>, AppError> {
    let search = query.search.unwrap_or_default();
    let search_pattern = format!("%{}%", search);

    let items = sqlx::query_as!(
        Equipment,
        r#"
        SELECT id, unit_number, ct_number, name, equipment_type_id,
               serial_number, current_hm_km, current_site_id, qr_code, is_active
        FROM equipment
        WHERE ($1 = '' OR unit_number ILIKE $2 OR name ILIKE $2 OR ct_number ILIKE $2)
        ORDER BY unit_number
        "#,
        search,
        search_pattern
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(items))
}

pub async fn list_employees(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<Employee>>, AppError> {
    let items = sqlx::query_as!(
        Employee,
        r#"
        SELECT id, name, department_id, is_mechanic, position, is_active
        FROM employees
        ORDER BY name
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(items))
}

pub async fn list_sites(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<Site>>, AppError> {
    let items = sqlx::query_as!(
        Site,
        r#"
        SELECT id, name, description, is_active
        FROM sites
        ORDER BY name
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(items))
}

pub async fn list_warehouses(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<WarehouseInfo>>, AppError> {
    let items = sqlx::query_as!(
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
        ORDER BY w.id
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(items))
}

pub async fn create_equipment(
    State(state): State<AppState>,
    _user: AuthUser,
    Json(payload): Json<CreateEquipmentRequest>,
) -> Result<Json<Value>, AppError> {
    let id = payload.id.unwrap_or_else(|| {
        payload.unit_number.trim().to_uppercase().replace(' ', "-")
    });
    let unit_number = payload.unit_number.trim().to_uppercase();
    let name = payload.name.trim();

    if unit_number.is_empty() || name.is_empty() {
        return Err(AppError::BadRequest("Nomor unit dan nama unit wajib diisi".to_string()));
    }

    let hm_km = payload.current_hm_km.unwrap_or(Decimal::ZERO);
    let valid_type: Option<String> = if let Some(ref tid) = payload.equipment_type_id {
        let exists = sqlx::query_scalar!(
            "SELECT id FROM equipment_types WHERE id = $1",
            tid
        )
        .fetch_optional(&state.pool)
        .await?;
        exists
    } else {
        None
    };
    let site = payload.current_site_id.as_deref().unwrap_or("SITE-VALE-A");

    let row = sqlx::query_as!(
        Equipment,
        r#"
        INSERT INTO equipment (
            id, unit_number, name, equipment_type_id, serial_number, current_hm_km, current_site_id, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            current_hm_km = EXCLUDED.current_hm_km
        RETURNING id, unit_number, ct_number, name, equipment_type_id, serial_number, current_hm_km, current_site_id, qr_code, is_active
        "#,
        id,
        unit_number,
        name,
        valid_type,
        payload.serial_number,
        hm_km,
        site
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(json!({
        "success": true,
        "equipment_id": row.id,
        "id": row.id,
        "unit_number": row.unit_number,
        "name": row.name,
        "equipment_type_id": row.equipment_type_id,
        "serial_number": row.serial_number,
        "current_hm_km": row.current_hm_km,
        "is_active": row.is_active,
        "message": format!("Unit equipment {} berhasil disimpan", row.unit_number)
    })))
}

pub async fn create_employee(
    State(state): State<AppState>,
    _user: AuthUser,
    Json(payload): Json<CreateEmployeeRequest>,
) -> Result<Json<Value>, AppError> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Nama personil wajib diisi".to_string()));
    }

    let id = payload.id.unwrap_or_else(|| {
        format!("EMP-{}", Uuid::new_v4().simple().to_string()[..8].to_uppercase())
    });
    let is_mechanic = payload.is_mechanic.unwrap_or(true);
    let position = payload.position.as_deref().unwrap_or(if is_mechanic { "Field Mechanic" } else { "Operator" });
    let valid_dept: Option<String> = if let Some(ref did) = payload.department_id {
        let exists = sqlx::query_scalar!(
            "SELECT id FROM departments WHERE id = $1",
            did
        )
        .fetch_optional(&state.pool)
        .await?;
        if exists.is_some() {
            exists
        } else if is_mechanic {
            Some("DEPT-MECH-HE".to_string())
        } else {
            Some("DEPT-LOG".to_string())
        }
    } else if is_mechanic {
        Some("DEPT-MECH-HE".to_string())
    } else {
        Some("DEPT-LOG".to_string())
    };

    let row = sqlx::query_as!(
        Employee,
        r#"
        INSERT INTO employees (id, name, department_id, is_mechanic, position, is_active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, position = EXCLUDED.position
        RETURNING id, name, department_id, is_mechanic, position, is_active
        "#,
        id,
        name,
        valid_dept,
        is_mechanic,
        position
    )
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(json!({
        "success": true,
        "employee_id": row.id,
        "id": row.id,
        "name": row.name,
        "department_id": row.department_id,
        "is_mechanic": row.is_mechanic,
        "position": row.position,
        "is_active": row.is_active,
        "message": format!("Karyawan {} berhasil disimpan", row.name)
    })))
}

pub async fn update_spare_part(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSparePartRequest>,
) -> Result<Json<Value>, AppError> {
    if let Some(core_return) = payload.requires_core_return {
        sqlx::query!(
            "UPDATE spare_parts SET requires_core_return = $1 WHERE id = $2",
            core_return,
            id
        )
        .execute(&state.pool)
        .await?;
    }

    if let Some(appr) = payload.requires_issue_approval {
        sqlx::query!(
            "UPDATE spare_parts SET requires_issue_approval = $1 WHERE id = $2",
            appr,
            id
        )
        .execute(&state.pool)
        .await?;
    }

    if let Some(ref crit) = payload.critical_level {
        sqlx::query!(
            "UPDATE spare_parts SET critical_level = $1 WHERE id = $2",
            crit,
            id
        )
        .execute(&state.pool)
        .await?;
    }

    Ok(Json(json!({
        "success": true,
        "message": format!("Spare part {} berhasil diperbarui", id)
    })))
}

pub async fn create_site(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateSiteRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Nama titik site wajib diisi".to_string()));
    }

    let id = payload.id.map(|s| s.trim().to_uppercase()).filter(|s| !s.is_empty()).unwrap_or_else(|| {
        let clean = name.to_uppercase().replace(|c: char| !c.is_alphanumeric(), "-");
        if clean.starts_with("SITE-") {
            clean
        } else {
            format!("SITE-{}", clean)
        }
    });

    let is_active = payload.is_active.unwrap_or(true);

    let site = sqlx::query_as!(
        Site,
        r#"
        INSERT INTO sites (id, name, description, is_active)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            is_active = EXCLUDED.is_active
        RETURNING id, name, description, is_active
        "#,
        id,
        name,
        payload.description,
        is_active
    )
    .fetch_one(&state.pool)
    .await?;

    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'CREATE_SITE', 'SITE', $3, $4)
        "#,
        user.sub,
        user.username,
        site.id,
        json!({
            "name": site.name,
            "description": site.description,
            "is_active": site.is_active
        })
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "site": site,
        "message": format!("Titik site {} berhasil disimpan", site.name)
    })))
}

pub async fn update_site(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSiteRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;

    let existing = sqlx::query_as!(
        Site,
        "SELECT id, name, description, is_active FROM sites WHERE id = $1",
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Titik site dengan ID '{}' tidak ditemukan", id)))?;

    let name = payload.name.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).unwrap_or(existing.name);
    let description = payload.description.or(existing.description);
    let is_active = payload.is_active.unwrap_or(existing.is_active);

    let updated = sqlx::query_as!(
        Site,
        r#"
        UPDATE sites
        SET name = $1, description = $2, is_active = $3
        WHERE id = $4
        RETURNING id, name, description, is_active
        "#,
        name,
        description,
        is_active,
        id
    )
    .fetch_one(&state.pool)
    .await?;

    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'UPDATE_SITE', 'SITE', $3, $4)
        "#,
        user.sub,
        user.username,
        id,
        json!({
            "name": updated.name,
            "description": updated.description,
            "is_active": updated.is_active
        })
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "site": updated,
        "message": format!("Titik site {} berhasil diperbarui", updated.name)
    })))
}

pub async fn delete_site(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;

    let existing = sqlx::query_as!(
        Site,
        "SELECT id, name, description, is_active FROM sites WHERE id = $1",
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Titik site dengan ID '{}' tidak ditemukan", id)))?;

    let has_equipment = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM equipment WHERE current_site_id = $1)",
        id
    )
    .fetch_one(&state.pool)
    .await?
    .unwrap_or(false);

    let has_issues = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM issue_transactions WHERE site_id = $1)",
        id
    )
    .fetch_one(&state.pool)
    .await?
    .unwrap_or(false);

    if has_equipment || has_issues {
        sqlx::query!("UPDATE sites SET is_active = FALSE WHERE id = $1", id)
            .execute(&state.pool)
            .await?;

        let _ = sqlx::query!(
            r#"
            INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
            VALUES ($1, $2, 'DEACTIVATE_SITE', 'SITE', $3, $4)
            "#,
            user.sub,
            user.username,
            id,
            json!({"reason": "referenced by equipment or transactions", "is_active": false})
        )
        .execute(&state.pool)
        .await;

        return Ok(Json(json!({
            "success": true,
            "is_soft_deleted": true,
            "message": format!("Site {} memiliki riwayat unit/transaksi sehingga statusnya dinonaktifkan (soft delete)", existing.name)
        })));
    }

    sqlx::query!("DELETE FROM sites WHERE id = $1", id)
        .execute(&state.pool)
        .await?;

    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'DELETE_SITE', 'SITE', $3, $4)
        "#,
        user.sub,
        user.username,
        id,
        json!({"name": existing.name})
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "is_soft_deleted": false,
        "message": format!("Titik site {} berhasil dihapus permanen", existing.name)
    })))
}

async fn fetch_warehouse_info(
    pool: &sqlx::PgPool,
    warehouse_id: &str,
) -> Result<WarehouseInfo, AppError> {
    sqlx::query_as!(
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
        warehouse_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Gudang dengan ID '{}' tidak ditemukan", warehouse_id)))
}

pub async fn create_warehouse(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateWarehouseRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Nama gudang wajib diisi".to_string()));
    }

    let wh_type = payload.warehouse_type.trim().to_uppercase();
    if wh_type != "MAIN" && wh_type != "CONTAINER" {
        return Err(AppError::BadRequest("Tipe gudang harus 'MAIN' atau 'CONTAINER'".to_string()));
    }

    let category = payload.category.trim().to_uppercase();
    if category.is_empty() {
        return Err(AppError::BadRequest("Kategori armada gudang wajib diisi".to_string()));
    }

    let id = payload.id.map(|s| s.trim().to_uppercase()).filter(|s| !s.is_empty()).unwrap_or_else(|| {
        let prefix = if wh_type == "MAIN" { "WH-MAIN" } else { "WH-CONT" };
        let clean = name.to_uppercase().replace(|c: char| !c.is_alphanumeric(), "-");
        format!("{}-{}", prefix, clean.trim_matches('-'))
    });

    let is_active = payload.is_active.unwrap_or(true);

    // Multi-parent links handling
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
    .execute(&state.pool)
    .await?;

    // Update warehouse_supply_links
    sqlx::query!("DELETE FROM warehouse_supply_links WHERE sub_warehouse_id = $1", id)
        .execute(&state.pool)
        .await?;

    for pid in &target_parent_ids {
        sqlx::query!(
            "INSERT INTO warehouse_supply_links (sub_warehouse_id, main_warehouse_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            id,
            pid
        )
        .execute(&state.pool)
        .await?;
    }

    // Auto assign new warehouse to SUPER_ADMIN & MANAGER
    let _ = sqlx::query!(
        r#"
        INSERT INTO user_warehouses (user_id, warehouse_id)
        SELECT u.id, $1 FROM users u
        WHERE u.role_id IN ('SUPER_ADMIN', 'MANAGER')
        ON CONFLICT DO NOTHING
        "#,
        id
    )
    .execute(&state.pool)
    .await;

    let row = fetch_warehouse_info(&state.pool, &id).await?;

    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'CREATE_WAREHOUSE', 'WAREHOUSE', $3, $4)
        "#,
        user.sub,
        user.username,
        row.id,
        json!({
            "name": row.name,
            "warehouse_type": row.warehouse_type,
            "category": row.category,
            "description": row.description,
            "is_active": row.is_active,
            "parent_warehouse_id": row.parent_warehouse_id,
            "parent_warehouse_ids": row.parent_warehouse_ids
        })
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "warehouse": row,
        "message": format!("Gudang {} berhasil disimpan", row.name)
    })))
}

pub async fn update_warehouse(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
    Json(payload): Json<UpdateWarehouseRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;

    let existing = fetch_warehouse_info(&state.pool, &id).await?;

    let name = payload.name.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).unwrap_or(existing.name);
    let wh_type = payload.warehouse_type.map(|s| s.trim().to_uppercase()).unwrap_or(existing.warehouse_type);
    let category = payload.category.map(|s| s.trim().to_uppercase()).unwrap_or(existing.category);
    let description = payload.description.or(existing.description);
    let is_active = payload.is_active.unwrap_or(existing.is_active);

    // Multi-parent links handling
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
            None // Keep existing
        }
    } else {
        Some(vec![]) // Reset links if changed to MAIN
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
        description,
        is_active,
        parent_id,
        id
    )
    .execute(&state.pool)
    .await?;

    // If supply links were explicitly provided or warehouse became MAIN, sync them
    if let Some(ref links) = target_parent_ids {
        sqlx::query!("DELETE FROM warehouse_supply_links WHERE sub_warehouse_id = $1", id)
            .execute(&state.pool)
            .await?;

        for pid in links {
            sqlx::query!(
                "INSERT INTO warehouse_supply_links (sub_warehouse_id, main_warehouse_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                id,
                pid
            )
            .execute(&state.pool)
            .await?;
        }
    }

    let updated = fetch_warehouse_info(&state.pool, &id).await?;

    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'UPDATE_WAREHOUSE', 'WAREHOUSE', $3, $4)
        "#,
        user.sub,
        user.username,
        id,
        json!({
            "name": updated.name,
            "warehouse_type": updated.warehouse_type,
            "category": updated.category,
            "description": updated.description,
            "is_active": updated.is_active,
            "parent_warehouse_id": updated.parent_warehouse_id,
            "parent_warehouse_ids": updated.parent_warehouse_ids
        })
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "warehouse": updated,
        "message": format!("Gudang {} berhasil diperbarui", updated.name)
    })))
}

pub async fn delete_warehouse(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;

    let existing = sqlx::query!("SELECT id, name FROM warehouses WHERE id = $1", id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Gudang dengan ID '{}' tidak ditemukan", id)))?;

    let has_stock = sqlx::query_scalar!("SELECT EXISTS(SELECT 1 FROM inventory_stock WHERE warehouse_id = $1)", id)
        .fetch_one(&state.pool).await?.unwrap_or(false);
    let has_issues = sqlx::query_scalar!("SELECT EXISTS(SELECT 1 FROM issue_transactions WHERE warehouse_id = $1)", id)
        .fetch_one(&state.pool).await?.unwrap_or(false);
    let has_drops = sqlx::query_scalar!("SELECT EXISTS(SELECT 1 FROM main_warehouse_drops WHERE main_warehouse_id = $1 OR container_warehouse_id = $1)", id)
        .fetch_one(&state.pool).await?.unwrap_or(false);
    let has_requests = sqlx::query_scalar!("SELECT EXISTS(SELECT 1 FROM replenishment_requests WHERE main_warehouse_id = $1 OR container_warehouse_id = $1)", id)
        .fetch_one(&state.pool).await?.unwrap_or(false);
    let has_returns = sqlx::query_scalar!("SELECT EXISTS(SELECT 1 FROM used_part_returns WHERE warehouse_id = $1 OR main_warehouse_id = $1)", id)
        .fetch_one(&state.pool).await?.unwrap_or(false);

    let is_referenced = has_stock || has_issues || has_drops || has_requests || has_returns;

    if is_referenced {
        sqlx::query!("UPDATE warehouses SET is_active = FALSE WHERE id = $1", id)
            .execute(&state.pool)
            .await?;

        let _ = sqlx::query!(
            r#"
            INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
            VALUES ($1, $2, 'DEACTIVATE_WAREHOUSE', 'WAREHOUSE', $3, $4)
            "#,
            user.sub,
            user.username,
            id,
            json!({"reason": "referenced by transactions or stock", "is_active": false})
        )
        .execute(&state.pool)
        .await;

        return Ok(Json(json!({
            "success": true,
            "is_soft_deleted": true,
            "message": format!("Gudang {} memiliki transaksi/stok terkait sehingga statusnya dinonaktifkan (soft delete)", existing.name)
        })));
    }

    sqlx::query!("DELETE FROM warehouse_supply_links WHERE sub_warehouse_id = $1 OR main_warehouse_id = $1", id)
        .execute(&state.pool)
        .await?;

    sqlx::query!("DELETE FROM user_warehouses WHERE warehouse_id = $1", id)
        .execute(&state.pool)
        .await?;

    sqlx::query!("DELETE FROM warehouses WHERE id = $1", id)
        .execute(&state.pool)
        .await?;

    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'DELETE_WAREHOUSE', 'WAREHOUSE', $3, $4)
        "#,
        user.sub,
        user.username,
        id,
        json!({"name": existing.name})
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "is_soft_deleted": false,
        "message": format!("Gudang {} berhasil dihapus permanen", existing.name)
    })))
}

// ==============================================================================
// MASTER KATEGORI GUDANG (WAREHOUSE CATEGORIES CRUD)
// ==============================================================================

pub async fn list_warehouse_categories(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<WarehouseCategory>>, AppError> {
    let items = sqlx::query_as!(
        WarehouseCategory,
        r#"
        SELECT id, name, description, is_active, created_at
        FROM warehouse_categories
        ORDER BY name
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(items))
}

pub async fn create_warehouse_category(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateWarehouseCategoryRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Nama kategori gudang wajib diisi".to_string()));
    }

    let id = payload.id.map(|s| s.trim().to_uppercase()).filter(|s| !s.is_empty()).unwrap_or_else(|| {
        name.to_uppercase().replace(|c: char| !c.is_alphanumeric(), "_")
    });

    let is_active = payload.is_active.unwrap_or(true);

    let row = sqlx::query_as!(
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
        is_active
    )
    .fetch_one(&state.pool)
    .await?;

    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'CREATE_WAREHOUSE_CATEGORY', 'WAREHOUSE_CATEGORY', $3, $4)
        "#,
        user.sub,
        user.username,
        row.id,
        json!({
            "name": row.name,
            "description": row.description,
            "is_active": row.is_active
        })
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "category": row,
        "message": format!("Kategori gudang '{}' berhasil disimpan", row.name)
    })))
}

pub async fn update_warehouse_category(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
    Json(payload): Json<UpdateWarehouseCategoryRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;

    let existing = sqlx::query_as!(
        WarehouseCategory,
        "SELECT id, name, description, is_active, created_at FROM warehouse_categories WHERE id = $1",
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Kategori gudang '{}' tidak ditemukan", id)))?;

    let name = payload.name.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).unwrap_or(existing.name);
    let description = payload.description.or(existing.description);
    let is_active = payload.is_active.unwrap_or(existing.is_active);

    let updated = sqlx::query_as!(
        WarehouseCategory,
        r#"
        UPDATE warehouse_categories
        SET name = $1, description = $2, is_active = $3
        WHERE id = $4
        RETURNING id, name, description, is_active, created_at
        "#,
        name,
        description,
        is_active,
        id
    )
    .fetch_one(&state.pool)
    .await?;

    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'UPDATE_WAREHOUSE_CATEGORY', 'WAREHOUSE_CATEGORY', $3, $4)
        "#,
        user.sub,
        user.username,
        id,
        json!({
            "name": updated.name,
            "description": updated.description,
            "is_active": updated.is_active
        })
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "category": updated,
        "message": format!("Kategori gudang '{}' berhasil diperbarui", updated.name)
    })))
}

pub async fn delete_warehouse_category(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;

    let existing = sqlx::query_as!(
        WarehouseCategory,
        "SELECT id, name, description, is_active, created_at FROM warehouse_categories WHERE id = $1",
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Kategori gudang '{}' tidak ditemukan", id)))?;

    let is_referenced = sqlx::query_scalar!("SELECT EXISTS(SELECT 1 FROM warehouses WHERE category = $1)", id)
        .fetch_one(&state.pool).await?.unwrap_or(false);

    if is_referenced {
        sqlx::query!("UPDATE warehouse_categories SET is_active = FALSE WHERE id = $1", id)
            .execute(&state.pool)
            .await?;

        let _ = sqlx::query!(
            r#"
            INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
            VALUES ($1, $2, 'DEACTIVATE_WAREHOUSE_CATEGORY', 'WAREHOUSE_CATEGORY', $3, $4)
            "#,
            user.sub,
            user.username,
            id,
            json!({"reason": "referenced by warehouses", "is_active": false})
        )
        .execute(&state.pool)
        .await;

        return Ok(Json(json!({
            "success": true,
            "is_soft_deleted": true,
            "message": format!("Kategori '{}' sedang digunakan oleh gudang sehingga dinonaktifkan (soft delete)", existing.name)
        })));
    }

    sqlx::query!("DELETE FROM warehouse_categories WHERE id = $1", id)
        .execute(&state.pool)
        .await?;

    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'DELETE_WAREHOUSE_CATEGORY', 'WAREHOUSE_CATEGORY', $3, $4)
        "#,
        user.sub,
        user.username,
        id,
        json!({"name": existing.name})
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "is_soft_deleted": false,
        "message": format!("Kategori gudang '{}' berhasil dihapus permanen", existing.name)
    })))
}
