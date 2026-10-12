use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{get_user_warehouse_ids, resolve_warehouse_filter, AuthUser},
    },
    domain::entities::{EnterpriseKpiSummary, FastSlowMovingPartItem, StockAgingSummary},
    error::AppError,
};
use axum::{
    extract::{Query, State},
    Json,
};
use rust_decimal::Decimal;
use serde::Deserialize;

#[derive(Debug, Deserialize, Default)]
pub struct DashboardQuery {
    pub warehouse_id: Option<String>,
}

async fn resolve_dashboard_whs(
    state: &AppState,
    user: &crate::domain::models::Claims,
    warehouse_id: Option<&str>,
) -> Result<Vec<String>, AppError> {
    if let Some(wh) = warehouse_id.map(|s| s.trim()).filter(|s| !s.is_empty()) {
        return resolve_warehouse_filter(&state.pool, user, Some(wh)).await;
    }
    if user.role_id == "SUPER_ADMIN" || user.role_id == "MANAGER" {
        Ok(vec![])
    } else {
        get_user_warehouse_ids(&state.pool, user).await
    }
}

pub async fn get_enterprise_kpis(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<DashboardQuery>,
) -> Result<Json<EnterpriseKpiSummary>, AppError> {
    let user_whs = resolve_dashboard_whs(&state, &user, query.warehouse_id.as_deref()).await?;

    let mut summary = state
        .services
        .dashboard
        .get_enterprise_kpis(&user_whs)
        .await?;
    if !user.can_access_financials() {
        summary.total_stock_value = Decimal::ZERO;
    }
    Ok(Json(summary))
}

pub async fn get_stock_velocity(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<DashboardQuery>,
) -> Result<Json<Vec<FastSlowMovingPartItem>>, AppError> {
    let user_whs = resolve_dashboard_whs(&state, &user, query.warehouse_id.as_deref()).await?;

    let mut items = state
        .services
        .dashboard
        .get_stock_velocity(&user_whs)
        .await?;
    if !user.can_access_financials() {
        for item in &mut items {
            item.unit_cost = Decimal::ZERO;
            item.total_value = Decimal::ZERO;
        }
    }
    Ok(Json(items))
}

pub async fn get_stock_aging(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<DashboardQuery>,
) -> Result<Json<StockAgingSummary>, AppError> {
    let user_whs = resolve_dashboard_whs(&state, &user, query.warehouse_id.as_deref()).await?;

    let mut aging = state.services.dashboard.get_stock_aging(&user_whs).await?;
    if !user.can_access_financials() {
        aging.age_under_30_days_value = Decimal::ZERO;
        aging.age_31_to_90_days_value = Decimal::ZERO;
        aging.age_91_to_180_days_value = Decimal::ZERO;
        aging.age_over_180_days_value = Decimal::ZERO;
    }
    Ok(Json(aging))
}
