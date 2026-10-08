use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_permission, check_warehouse_access, AuthUser},
    },
    domain::models::CreateAdjustmentRequest,
    error::AppError,
    infrastructure::numbering::next_document_number,
};
use axum::{
    extract::{Path, State},
    Json,
};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct StockAdjustmentHeader {
    pub id: Uuid,
    pub adjustment_number: String,
    pub warehouse_id: String,
    pub reason: String,
    pub notes: Option<String>,
    pub status: String,
    pub created_by: Uuid,
    pub approved_by: Option<Uuid>,
    pub approved_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct StockAdjustmentItemDetail {
    pub id: Uuid,
    pub adjustment_id: Uuid,
    pub spare_part_id: String,
    pub part_name: String,
    pub qty_system: Decimal,
    pub qty_physical: Decimal,
    pub difference: Decimal,
}

pub async fn create_adjustment(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateAdjustmentRequest>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &payload.warehouse_id).await?;

    if payload.items.is_empty() {
        return Err(AppError::BadRequest("Minimal harus ada 1 item yang disesuaikan".to_string()));
    }

    let mut tx = state.pool.begin().await?;

    let adj_no = next_document_number(&mut tx, "ADJ").await?;

    let adj_id = sqlx::query_scalar!(
        r#"
        INSERT INTO stock_adjustments (
            adjustment_number, warehouse_id, reason, notes,
            status, created_by
        ) VALUES ($1, $2, $3, $4, 'PENDING_APPROVAL', $5)
        RETURNING id
        "#,
        adj_no,
        payload.warehouse_id,
        payload.reason,
        payload.notes,
        user.sub
    )
    .fetch_one(&mut *tx)
    .await?;

    for itm in payload.items {
        let current_qty = sqlx::query_scalar!(
            r#"
            SELECT qty_on_hand FROM inventory_stock
            WHERE warehouse_id = $1 AND spare_part_id = $2
            "#,
            payload.warehouse_id,
            itm.spare_part_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or(Decimal::ZERO);

        let diff = itm.qty_physical - current_qty;

        sqlx::query!(
            r#"
            INSERT INTO stock_adjustment_items (
                adjustment_id, spare_part_id, qty_system, qty_physical, difference
            ) VALUES ($1, $2, $3, $4, $5)
            "#,
            adj_id,
            itm.spare_part_id,
            current_qty,
            itm.qty_physical,
            diff
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(Json(json!({
        "success": true,
        "adjustment_number": adj_no,
        "message": format!("Pengajuan stock opname/penyesuaian {} berhasil diajukan dan menunggu persetujuan Supervisor", adj_no)
    })))
}

pub async fn list_adjustments(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<StockAdjustmentHeader>>, AppError> {
    let items = sqlx::query_as!(
        StockAdjustmentHeader,
        r#"
        SELECT id, adjustment_number, warehouse_id, reason, notes,
               status, created_by, approved_by, approved_at, created_at
        FROM stock_adjustments
        ORDER BY created_at DESC
        LIMIT 100
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(items))
}

pub async fn approve_adjustment(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "adjustment.approve").await?;

    let mut tx = state.pool.begin().await?;

    let adj = sqlx::query!(
        r#"
        SELECT id, adjustment_number, warehouse_id, status
        FROM stock_adjustments
        WHERE id = $1 FOR UPDATE
        "#,
        id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Pengajuan penyesuaian tidak ditemukan".to_string()))?;

    if adj.status != "PENDING_APPROVAL" {
        return Err(AppError::BadRequest("Pengajuan penyesuaian bukan berstatus PENDING_APPROVAL".to_string()));
    }

    let items = sqlx::query!(
        r#"
        SELECT spare_part_id, qty_physical, difference
        FROM stock_adjustment_items
        WHERE adjustment_id = $1
        "#,
        id
    )
    .fetch_all(&mut *tx)
    .await?;

    for itm in items {
        sqlx::query!(
            r#"
            UPDATE inventory_stock
            SET qty_on_hand = $1, updated_at = NOW()
            WHERE warehouse_id = $2 AND spare_part_id = $3
            "#,
            itm.qty_physical,
            adj.warehouse_id,
            itm.spare_part_id
        )
        .execute(&mut *tx)
        .await?;

        let mov_type = if itm.difference >= Decimal::ZERO {
            "ADJUSTMENT_IN"
        } else {
            "ADJUSTMENT_OUT"
        };

        sqlx::query!(
            r#"
            INSERT INTO stock_movements (
                warehouse_id, spare_part_id, movement_type, qty,
                balance_after, reference_number, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, 'Hasil approval stock opname oleh Supervisor', $7)
            "#,
            adj.warehouse_id,
            itm.spare_part_id,
            mov_type,
            itm.difference.abs(),
            itm.qty_physical,
            adj.adjustment_number,
            user.sub
        )
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query!(
        r#"
        UPDATE stock_adjustments
        SET status = 'APPROVED', approved_by = $1, approved_at = NOW()
        WHERE id = $2
        "#,
        user.sub,
        id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(json!({
        "success": true,
        "message": format!("Penyesuaian stok {} disetujui, saldo fisik diselaraskan", adj.adjustment_number)
    })))
}
