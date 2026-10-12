use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_permission, AuthUser},
    },
    domain::entities::{
        CreateEmployeeRequest, CreateEquipmentRequest, CreateSiteRequest,
        CreateWarehouseCategoryRequest, CreateWarehouseRequest, Employee, Equipment, Site,
        SparePart, UpdateSiteRequest, UpdateSparePartRequest, UpdateWarehouseCategoryRequest,
        UpdateWarehouseRequest, WarehouseCategory, WarehouseInfo,
    },
    error::AppError,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::Value;

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct MasterQuery {
    pub search: Option<String>,
    pub category: Option<String>,
}

// Spare parts
pub async fn list_spare_parts(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<MasterQuery>,
) -> Result<Json<Vec<SparePart>>, AppError> {
    let search = query.search.unwrap_or_default();
    let mut parts = state.services.master.list_spare_parts(&search).await?;
    if !user.can_access_financials() {
        for part in &mut parts {
            part.unit_cost = None;
        }
    }
    Ok(Json(parts))
}

pub async fn update_spare_part(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSparePartRequest>,
) -> Result<Json<SparePart>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;
    let mut updated = state
        .services
        .master
        .update_spare_part(&user, &id, payload)
        .await?;
    if !user.can_access_financials() {
        updated.unit_cost = None;
    }
    Ok(Json(updated))
}

// Equipment
pub async fn list_equipment(
    State(state): State<AppState>,
    _user: AuthUser,
    Query(query): Query<MasterQuery>,
) -> Result<Json<Vec<Equipment>>, AppError> {
    let search = query.search.unwrap_or_default();
    let eq = state.services.master.list_equipment(&search).await?;
    Ok(Json(eq))
}

pub async fn create_equipment(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateEquipmentRequest>,
) -> Result<Json<Equipment>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;
    let eq = state
        .services
        .master
        .create_equipment(&user, payload)
        .await?;
    Ok(Json(eq))
}

// Employees
pub async fn list_employees(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<Employee>>, AppError> {
    let emps = state.services.master.list_employees().await?;
    Ok(Json(emps))
}

pub async fn create_employee(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateEmployeeRequest>,
) -> Result<Json<Employee>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;
    let emp = state
        .services
        .master
        .create_employee(&user, payload)
        .await?;
    Ok(Json(emp))
}

// Sites
pub async fn list_sites(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<Site>>, AppError> {
    let sites = state.services.master.list_sites().await?;
    Ok(Json(sites))
}

pub async fn create_site(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateSiteRequest>,
) -> Result<Json<Site>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;
    let site = state.services.master.create_site(&user, payload).await?;
    Ok(Json(site))
}

pub async fn update_site(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSiteRequest>,
) -> Result<Json<Site>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;
    let updated = state
        .services
        .master
        .update_site(&user, &id, payload)
        .await?;
    Ok(Json(updated))
}

pub async fn delete_site(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;
    let res = state.services.master.delete_site(&user, &id).await?;
    Ok(Json(res))
}

// Warehouses
pub async fn list_warehouses(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<WarehouseInfo>>, AppError> {
    let whs = state.services.master.list_warehouses().await?;
    Ok(Json(whs))
}

pub async fn create_warehouse(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateWarehouseRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;
    let row = state
        .services
        .master
        .create_warehouse(&user, payload)
        .await?;

    Ok(Json(serde_json::json!({
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
    let row = state
        .services
        .master
        .update_warehouse(&user, &id, payload)
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "warehouse": row,
        "message": format!("Gudang {} berhasil diperbarui", row.name)
    })))
}

pub async fn delete_warehouse(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;
    let res = state.services.master.delete_warehouse(&user, &id).await?;
    Ok(Json(res))
}

// Warehouse categories
pub async fn list_warehouse_categories(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<WarehouseCategory>>, AppError> {
    let cats = state.services.master.list_warehouse_categories().await?;
    Ok(Json(cats))
}

pub async fn create_warehouse_category(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateWarehouseCategoryRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;
    let cat = state
        .services
        .master
        .create_warehouse_category(&user, payload)
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "category": cat,
        "message": format!("Kategori gudang '{}' berhasil disimpan", cat.name)
    })))
}

pub async fn update_warehouse_category(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
    Json(payload): Json<UpdateWarehouseCategoryRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;
    let cat = state
        .services
        .master
        .update_warehouse_category(&user, &id, payload)
        .await?;

    Ok(Json(serde_json::json!({
        "success": true,
        "category": cat,
        "message": format!("Kategori gudang '{}' berhasil diperbarui", cat.name)
    })))
}

pub async fn delete_warehouse_category(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;
    let res = state
        .services
        .master
        .delete_warehouse_category(&user, &id)
        .await?;
    Ok(Json(res))
}
