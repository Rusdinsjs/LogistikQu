use crate::{
    api::{handlers::auth::AppState, middleware::AuthUser},
    domain::models::{
        CreateEmployeeRequest, CreateEquipmentRequest, Employee, Equipment, Site, SparePart,
        UpdateSparePartRequest, WarehouseInfo,
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
        SELECT id, name, warehouse_type, category
        FROM warehouses
        ORDER BY id
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
