use crate::{
    api::{handlers::auth::AppState, middleware::AuthUser},
    domain::models::{Employee, Equipment, Site, SparePart, WarehouseInfo},
    error::AppError,
};
use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;

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
               lead_time_days, default_min_stock, default_max_stock, qr_code, is_active
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
