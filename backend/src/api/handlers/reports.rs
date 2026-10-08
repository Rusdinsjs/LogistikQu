use crate::{
    api::{handlers::auth::AppState, middleware::AuthUser},
    error::AppError,
};
use axum::{extract::State, Json};
use rust_decimal::Decimal;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct UnitConsumptionReport {
    pub unit_number: String,
    pub unit_name: String,
    pub unit_type: String,
    pub total_transactions: i64,
    pub total_parts_consumed: Decimal,
}

#[derive(Debug, Serialize)]
pub struct SiteConsumptionReport {
    pub site_id: String,
    pub site_name: String,
    pub total_transactions: i64,
    pub total_parts_consumed: Decimal,
}

#[derive(Debug, Serialize)]
pub struct MechanicConsumptionReport {
    pub mechanic_name: String,
    pub total_jobs: i64,
    pub total_parts_installed: Decimal,
}

pub async fn report_by_unit(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<UnitConsumptionReport>>, AppError> {
    let rows = sqlx::query!(
        r#"
        SELECT
            t.unit_number,
            t.unit_name,
            t.unit_type,
            COUNT(DISTINCT t.id)::bigint as total_tx,
            COALESCE(SUM(i.qty), 0) as total_qty
        FROM issue_transactions t
        JOIN issue_transaction_items i ON t.id = i.transaction_id
        WHERE t.status = 'COMPLETED'
        GROUP BY t.unit_number, t.unit_name, t.unit_type
        ORDER BY total_qty DESC
        LIMIT 50
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    let items = rows
        .into_iter()
        .map(|r| UnitConsumptionReport {
            unit_number: r.unit_number,
            unit_name: r.unit_name,
            unit_type: r.unit_type,
            total_transactions: r.total_tx.unwrap_or(0),
            total_parts_consumed: r.total_qty.unwrap_or(Decimal::ZERO),
        })
        .collect();

    Ok(Json(items))
}

pub async fn report_by_site(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<SiteConsumptionReport>>, AppError> {
    let rows = sqlx::query!(
        r#"
        SELECT
            t.site_id,
            s.name as site_name,
            COUNT(DISTINCT t.id)::bigint as total_tx,
            COALESCE(SUM(i.qty), 0) as total_qty
        FROM issue_transactions t
        JOIN sites s ON t.site_id = s.id
        JOIN issue_transaction_items i ON t.id = i.transaction_id
        WHERE t.status = 'COMPLETED'
        GROUP BY t.site_id, s.name
        ORDER BY total_qty DESC
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    let items = rows
        .into_iter()
        .map(|r| SiteConsumptionReport {
            site_id: r.site_id,
            site_name: r.site_name,
            total_transactions: r.total_tx.unwrap_or(0),
            total_parts_consumed: r.total_qty.unwrap_or(Decimal::ZERO),
        })
        .collect();

    Ok(Json(items))
}

pub async fn report_by_mechanic(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<MechanicConsumptionReport>>, AppError> {
    let rows = sqlx::query!(
        r#"
        SELECT
            t.mechanic_name,
            COUNT(DISTINCT t.id)::bigint as total_jobs,
            COALESCE(SUM(i.qty), 0) as total_qty
        FROM issue_transactions t
        JOIN issue_transaction_items i ON t.id = i.transaction_id
        WHERE t.status = 'COMPLETED'
        GROUP BY t.mechanic_name
        ORDER BY total_qty DESC
        LIMIT 50
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    let items = rows
        .into_iter()
        .map(|r| MechanicConsumptionReport {
            mechanic_name: r.mechanic_name,
            total_jobs: r.total_jobs.unwrap_or(0),
            total_parts_installed: r.total_qty.unwrap_or(Decimal::ZERO),
        })
        .collect();

    Ok(Json(items))
}
