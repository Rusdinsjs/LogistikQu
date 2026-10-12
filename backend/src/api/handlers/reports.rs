use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_financial_access, check_permission, AuthUser},
    },
    application::services::report_service::{
        MechanicConsumptionReport, SiteConsumptionReport, UnitConsumptionReport,
    },
    domain::entities::{
        ConsumptionTrendReportItem, EquipmentConsumptionReportItem, IssueHistoryReportItem,
        ReplenishmentEfficiencyReportItem, StockAgingReportItem, StockBalanceReportItem,
        StockValuationReportItem, WarehousePerformanceReportItem,
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
pub struct ReportFilterParams {
    pub warehouse_id: Option<String>,
    pub site_id: Option<String>,
    pub unit_number: Option<String>,
    pub limit: Option<i64>,
}

// --- Legacy / Basic Operational Reports ---

pub async fn report_by_unit(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<UnitConsumptionReport>>, AppError> {
    check_permission(&state.pool, &user, "reports.view").await?;
    let reports = state.services.report.report_by_unit().await?;
    Ok(Json(reports))
}

pub async fn report_by_site(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<SiteConsumptionReport>>, AppError> {
    check_permission(&state.pool, &user, "reports.view").await?;
    let reports = state.services.report.report_by_site().await?;
    Ok(Json(reports))
}

pub async fn report_by_mechanic(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<MechanicConsumptionReport>>, AppError> {
    check_permission(&state.pool, &user, "reports.view").await?;
    let reports = state.services.report.report_by_mechanic().await?;
    Ok(Json(reports))
}

// --- Phase 11: Enterprise Inventory Reports ---

pub async fn report_stock_balance(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(params): Query<ReportFilterParams>,
) -> Result<Json<Vec<StockBalanceReportItem>>, AppError> {
    check_permission(&state.pool, &user, "reports.view").await?;
    let reports = state
        .services
        .report
        .stock_balance_report(params.warehouse_id.as_deref())
        .await?;
    Ok(Json(reports))
}

pub async fn report_stock_valuation(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(params): Query<ReportFilterParams>,
) -> Result<Json<Vec<StockValuationReportItem>>, AppError> {
    check_permission(&state.pool, &user, "reports.view").await?;
    check_financial_access(&state.pool, &user).await?;
    let reports = state
        .services
        .report
        .stock_valuation_report(params.warehouse_id.as_deref())
        .await?;
    Ok(Json(reports))
}

pub async fn report_stock_aging(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(params): Query<ReportFilterParams>,
) -> Result<Json<Vec<StockAgingReportItem>>, AppError> {
    check_permission(&state.pool, &user, "reports.view").await?;
    let mut reports = state
        .services
        .report
        .stock_aging_report(params.warehouse_id.as_deref())
        .await?;
    if !user.can_access_financials() {
        for r in &mut reports {
            r.unit_cost = Decimal::ZERO;
            r.total_value = Decimal::ZERO;
        }
    }
    Ok(Json(reports))
}

// --- Phase 11: Enterprise Operational Reports ---

pub async fn report_issue_history(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(params): Query<ReportFilterParams>,
) -> Result<Json<Vec<IssueHistoryReportItem>>, AppError> {
    check_permission(&state.pool, &user, "reports.view").await?;
    let mut reports = state
        .services
        .report
        .issue_history_report(
            params.warehouse_id.as_deref(),
            params.unit_number.as_deref(),
            params.limit,
        )
        .await?;
    if !user.can_access_financials() {
        for r in &mut reports {
            r.unit_price = Decimal::ZERO;
            r.total_price = Decimal::ZERO;
        }
    }
    Ok(Json(reports))
}

pub async fn report_consumption_trend(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(params): Query<ReportFilterParams>,
) -> Result<Json<Vec<ConsumptionTrendReportItem>>, AppError> {
    check_permission(&state.pool, &user, "reports.view").await?;
    let mut reports = state
        .services
        .report
        .consumption_trend_report(params.warehouse_id.as_deref())
        .await?;
    if !user.can_access_financials() {
        for r in &mut reports {
            r.total_value = Decimal::ZERO;
        }
    }
    Ok(Json(reports))
}

pub async fn report_equipment_consumption(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(params): Query<ReportFilterParams>,
) -> Result<Json<Vec<EquipmentConsumptionReportItem>>, AppError> {
    check_permission(&state.pool, &user, "reports.view").await?;
    let mut reports = state
        .services
        .report
        .equipment_consumption_report(params.site_id.as_deref(), params.unit_number.as_deref())
        .await?;
    if !user.can_access_financials() {
        for r in &mut reports {
            r.total_cost = Decimal::ZERO;
            r.cost_per_hm = Decimal::ZERO;
        }
    }
    Ok(Json(reports))
}

// --- Phase 11: Enterprise Management Reports ---

pub async fn report_warehouse_performance(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<WarehousePerformanceReportItem>>, AppError> {
    check_permission(&state.pool, &user, "reports.view").await?;
    let mut reports = state.services.report.warehouse_performance_report().await?;
    if !user.can_access_financials() {
        for r in &mut reports {
            r.total_valuation = Decimal::ZERO;
        }
    }
    Ok(Json(reports))
}

pub async fn report_replenishment_efficiency(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(params): Query<ReportFilterParams>,
) -> Result<Json<Vec<ReplenishmentEfficiencyReportItem>>, AppError> {
    check_permission(&state.pool, &user, "reports.view").await?;
    let reports = state
        .services
        .report
        .replenishment_efficiency_report(params.warehouse_id.as_deref())
        .await?;
    Ok(Json(reports))
}
