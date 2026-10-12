use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{get_user_warehouse_ids, AuthUser},
    },
    domain::entities::{EnterpriseKpiSummary, FastSlowMovingPartItem, StockAgingSummary},
    error::AppError,
};
use axum::{extract::State, Json};

use rust_decimal::Decimal;

pub async fn get_enterprise_kpis(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<EnterpriseKpiSummary>, AppError> {
    let user_whs = if user.role_id == "SUPER_ADMIN" || user.role_id == "MANAGER" {
        vec![]
    } else {
        get_user_warehouse_ids(&state.pool, &user).await?
    };

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
) -> Result<Json<Vec<FastSlowMovingPartItem>>, AppError> {
    let user_whs = if user.role_id == "SUPER_ADMIN" || user.role_id == "MANAGER" {
        vec![]
    } else {
        get_user_warehouse_ids(&state.pool, &user).await?
    };

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
) -> Result<Json<StockAgingSummary>, AppError> {
    let user_whs = if user.role_id == "SUPER_ADMIN" || user.role_id == "MANAGER" {
        vec![]
    } else {
        get_user_warehouse_ids(&state.pool, &user).await?
    };

    let mut aging = state.services.dashboard.get_stock_aging(&user_whs).await?;
    if !user.can_access_financials() {
        aging.age_under_30_days_value = Decimal::ZERO;
        aging.age_31_to_90_days_value = Decimal::ZERO;
        aging.age_91_to_180_days_value = Decimal::ZERO;
        aging.age_over_180_days_value = Decimal::ZERO;
    }
    Ok(Json(aging))
}
