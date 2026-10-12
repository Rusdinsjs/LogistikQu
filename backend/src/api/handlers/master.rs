use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{
            check_any_permission, check_permission, get_user_fleet_category,
            is_mechanic_in_category, is_unit_in_category, AuthUser,
        },
    },
    domain::entities::{
        CreateEmployeeRequest, CreateEquipmentRequest, CreateMobileDeviceRequest,
        CreateSiteRequest, CreateWarehouseCategoryRequest, CreateWarehouseRequest, Employee,
        Equipment, MobileDevice, Site, SparePart, UpdateMobileDeviceRequest, UpdateSiteRequest,
        UpdateSparePartRequest, UpdateWarehouseCategoryRequest, UpdateWarehouseRequest,
        WarehouseCategory, WarehouseInfo,
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
    AuthUser(user): AuthUser,
    Query(query): Query<MasterQuery>,
) -> Result<Json<Vec<Equipment>>, AppError> {
    let search = query.search.unwrap_or_default();
    let eq = state.services.master.list_equipment(&search).await?;
    let user_cat = get_user_fleet_category(&state.pool, &user).await?;
    let effective_cat = user_cat.or_else(|| query.category.filter(|c| !c.is_empty()));

    let filtered = if let Some(ref cat) = effective_cat {
        eq.into_iter()
            .filter(|e| {
                is_unit_in_category(
                    &e.unit_number,
                    e.equipment_type_id.as_deref(),
                    Some(&e.name),
                    Some(cat),
                )
            })
            .collect()
    } else {
        eq
    };
    Ok(Json(filtered))
}

pub async fn create_equipment(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateEquipmentRequest>,
) -> Result<Json<Equipment>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &["master.manage", "issue.create", "mechanic_request.create"],
    )
    .await?;
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
    AuthUser(user): AuthUser,
    Query(query): Query<MasterQuery>,
) -> Result<Json<Vec<Employee>>, AppError> {
    let emps = state.services.master.list_employees().await?;
    let user_cat = get_user_fleet_category(&state.pool, &user).await?;
    let effective_cat = user_cat.or_else(|| query.category.filter(|c| !c.is_empty()));

    let filtered = if let Some(ref cat) = effective_cat {
        emps.into_iter()
            .filter(|e| {
                is_mechanic_in_category(
                    e.department_id.as_deref(),
                    e.position.as_deref(),
                    &e.name,
                    Some(cat),
                )
            })
            .collect()
    } else {
        emps
    };
    Ok(Json(filtered))
}

pub async fn create_employee(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateEmployeeRequest>,
) -> Result<Json<Employee>, AppError> {
    check_any_permission(&state.pool, &user, &["master.manage", "issue.create"]).await?;
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
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<WarehouseInfo>>, AppError> {
    let whs = state.services.master.list_warehouses().await?;
    let user_cat = get_user_fleet_category(&state.pool, &user).await?;
    let filtered = if let Some(ref cat) = user_cat {
        let cat_upper = cat.to_uppercase();
        whs.into_iter()
            .filter(|w| {
                let id_upper = w.id.to_uppercase();
                let w_cat = w.category.to_uppercase();
                if cat_upper == "DT" {
                    w_cat == "DUMP_TRUCK" || id_upper.contains("DT")
                } else if cat_upper == "HE" {
                    w_cat == "HEAVY_EQUIPMENT" || id_upper.contains("HE")
                } else {
                    true
                }
            })
            .collect()
    } else {
        whs
    };
    Ok(Json(filtered))
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

// Mobile Devices
pub async fn list_devices(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<MobileDevice>>, AppError> {
    let devices = state.services.master.list_devices().await?;
    Ok(Json(devices))
}

pub async fn create_device(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateMobileDeviceRequest>,
) -> Result<Json<MobileDevice>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;
    let device = state.services.master.create_device(&user, payload).await?;
    Ok(Json(device))
}

pub async fn update_device(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
    Json(payload): Json<UpdateMobileDeviceRequest>,
) -> Result<Json<MobileDevice>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;
    let device = state
        .services
        .master
        .update_device(&user, &id, payload)
        .await?;
    Ok(Json(device))
}

pub async fn delete_device(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<String>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "master.manage").await?;
    let res = state.services.master.delete_device(&user, &id).await?;
    Ok(Json(res))
}
