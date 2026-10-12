use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_financial_access, check_permission, AuthUser},
    },
    domain::entities::{
        CostPerEquipmentReport, CreateMaintenanceLogRequest, EquipmentComponentItem,
        EquipmentMaintenanceRecord, HierarchicalConsumptionItem, MaintenanceQuery,
    },
    error::AppError,
};
use axum::{
    extract::{Query, State},
    Json,
};
use rust_decimal::Decimal;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ConsumptionQuery {
    pub equipment_id: Option<String>,
}

pub async fn list_components(
    State(state): State<AppState>,
    AuthUser(_user): AuthUser,
) -> Result<Json<Vec<EquipmentComponentItem>>, AppError> {
    let comps = state.services.maintenance.list_components().await?;
    Ok(Json(comps))
}

pub async fn get_cost_per_equipment(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<CostPerEquipmentReport>>, AppError> {
    check_financial_access(&state.pool, &user).await?;
    let reports = state.services.maintenance.get_cost_per_equipment().await?;
    Ok(Json(reports))
}

pub async fn get_hierarchical_consumption(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<ConsumptionQuery>,
) -> Result<Json<Vec<HierarchicalConsumptionItem>>, AppError> {
    check_permission(&state.pool, &user, "reports.view").await?;
    let items = state
        .services
        .maintenance
        .get_hierarchical_consumption(query.equipment_id)
        .await?;
    Ok(Json(items))
}

pub async fn list_maintenance_history(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<MaintenanceQuery>,
) -> Result<Json<Vec<EquipmentMaintenanceRecord>>, AppError> {
    let mut records = state
        .services
        .maintenance
        .list_maintenance_history(query)
        .await?;
    if !user.can_access_financials() {
        for r in &mut records {
            r.parts_cost = Decimal::ZERO;
            r.labor_cost = Decimal::ZERO;
            r.total_cost = Decimal::ZERO;
        }
    }
    Ok(Json(records))
}

pub async fn create_maintenance_log(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateMaintenanceLogRequest>,
) -> Result<Json<EquipmentMaintenanceRecord>, AppError> {
    check_permission(&state.pool, &user, "issue.create").await?;
    let record = state
        .services
        .maintenance
        .create_maintenance_log(&user, payload)
        .await?;
    Ok(Json(record))
}
