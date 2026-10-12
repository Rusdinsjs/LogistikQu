use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{
            check_financial_access, check_permission, get_user_fleet_category, is_unit_in_category,
            AuthUser,
        },
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
    let fleet_cat = get_user_fleet_category(&state.pool, &user).await?;
    let reports = state.services.maintenance.get_cost_per_equipment().await?;
    let filtered = reports
        .into_iter()
        .filter(|r| {
            is_unit_in_category(
                &r.unit_number,
                r.equipment_type_id.as_deref(),
                r.model.as_deref(),
                fleet_cat.as_deref(),
            )
        })
        .collect();
    Ok(Json(filtered))
}

pub async fn get_hierarchical_consumption(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<ConsumptionQuery>,
) -> Result<Json<Vec<HierarchicalConsumptionItem>>, AppError> {
    check_permission(&state.pool, &user, "reports.view").await?;
    let fleet_cat = get_user_fleet_category(&state.pool, &user).await?;
    let items = state
        .services
        .maintenance
        .get_hierarchical_consumption(query.equipment_id)
        .await?;
    let filtered = items
        .into_iter()
        .filter(|r| is_unit_in_category(&r.unit_number, None, None, fleet_cat.as_deref()))
        .collect();
    Ok(Json(filtered))
}

pub async fn list_maintenance_history(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<MaintenanceQuery>,
) -> Result<Json<Vec<EquipmentMaintenanceRecord>>, AppError> {
    let fleet_cat = get_user_fleet_category(&state.pool, &user).await?;
    let records = state
        .services
        .maintenance
        .list_maintenance_history(query)
        .await?;
    let mut filtered: Vec<EquipmentMaintenanceRecord> = records
        .into_iter()
        .filter(|r| is_unit_in_category(&r.unit_number, None, None, fleet_cat.as_deref()))
        .collect();
    if !user.can_access_financials() {
        for r in &mut filtered {
            r.parts_cost = Decimal::ZERO;
            r.labor_cost = Decimal::ZERO;
            r.total_cost = Decimal::ZERO;
        }
    }
    Ok(Json(filtered))
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
