use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_permission, check_warehouse_access, get_user_warehouse_ids, AuthUser},
    },
    domain::models::{
        ApproveReplenishmentRequest, CreateReplenishmentRequest, RejectReplenishmentRequest,
        ReplenishmentItemDetail, ReplenishmentRequest, VerifyReplenishmentRequest,
    },
    error::AppError,
    infrastructure::numbering::next_document_number,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use rust_decimal::Decimal;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct ReplenishmentFilterQuery {
    pub warehouse_id: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecommendationItem {
    pub spare_part_id: String,
    pub part_name: String,
    pub unit_of_measure: String,
    pub current_stock: Decimal,
    pub min_stock: Decimal,
    pub max_stock: Decimal,
    pub safety_stock: Decimal,
    pub lead_time_days: i32,
    pub avg_daily_usage: Decimal,
    pub recommended_order_qty: Decimal,
}

use serde::Serialize;

pub async fn get_recommendations(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<ReplenishmentFilterQuery>,
) -> Result<Json<Vec<RecommendationItem>>, AppError> {
    let warehouse_id = query.warehouse_id.unwrap_or_else(|| "WH-CONT-HE".to_string());
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;

    let rows = sqlx::query!(
        r#"
        SELECT
            s.spare_part_id,
            p.part_name,
            p.unit_of_measure,
            s.qty_on_hand,
            s.min_stock,
            s.max_stock,
            s.safety_stock,
            p.lead_time_days,
            COALESCE((
                SELECT SUM(iti.qty) / 30.0
                FROM issue_transactions it
                JOIN issue_transaction_items iti ON it.id = iti.transaction_id
                WHERE it.warehouse_id = s.warehouse_id
                  AND iti.spare_part_id = s.spare_part_id
                  AND it.created_at >= NOW() - INTERVAL '30 days'
                  AND it.status = 'COMPLETED'
            ), 0.5) as avg_daily_usage
        FROM inventory_stock s
        JOIN spare_parts p ON s.spare_part_id = p.id
        WHERE s.warehouse_id = $1
        ORDER BY s.qty_on_hand ASC
        "#,
        warehouse_id
    )
    .fetch_all(&state.pool)
    .await?;

    let mut results = Vec::new();
    for r in rows {
        let adu = r.avg_daily_usage.unwrap_or_else(|| Decimal::from_str_exact("0.5").unwrap());
        let lead_time = Decimal::from(r.lead_time_days);
        // Formula: (ADU * Lead Time) + Safety Stock - Current Stock
        let required = (adu * lead_time) + r.safety_stock;
        let mut rec_qty = if required > r.qty_on_hand {
            required - r.qty_on_hand
        } else if r.qty_on_hand <= r.min_stock {
            r.max_stock - r.qty_on_hand
        } else {
            Decimal::ZERO
        };

        if rec_qty > Decimal::ZERO {
            // Round up to integer
            rec_qty = rec_qty.round_dp(0);
        }

        results.push(RecommendationItem {
            spare_part_id: r.spare_part_id,
            part_name: r.part_name,
            unit_of_measure: r.unit_of_measure,
            current_stock: r.qty_on_hand,
            min_stock: r.min_stock,
            max_stock: r.max_stock,
            safety_stock: r.safety_stock,
            lead_time_days: r.lead_time_days,
            avg_daily_usage: adu.round_dp(2),
            recommended_order_qty: rec_qty,
        });
    }

    Ok(Json(results))
}

pub async fn create_request(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Json(payload): Json<CreateReplenishmentRequest>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &payload.container_warehouse_id).await?;

    if payload.items.is_empty() {
        return Err(AppError::BadRequest("Permohonan harus memuat minimal 1 item suku cadang".to_string()));
    }

    // Determine corresponding main warehouse
    let main_wh = if payload.container_warehouse_id == "WH-CONT-DT" {
        "WH-MAIN-DT"
    } else {
        "WH-MAIN-HE"
    };

    let mut tx = state.pool.begin().await?;

    let req_no = next_document_number(&mut tx, "REQ").await?;

    let req_id = sqlx::query_scalar!(
        r#"
        INSERT INTO replenishment_requests (
            request_number, container_warehouse_id, main_warehouse_id,
            status, notes, requested_by
        ) VALUES ($1, $2, $3, 'REQUESTED', $4, $5)
        RETURNING id
        "#,
        req_no,
        payload.container_warehouse_id,
        main_wh,
        payload.notes,
        user.sub
    )
    .fetch_one(&mut *tx)
    .await?;

    for item in payload.items {
        let rec = item.recommended_qty.unwrap_or(Decimal::ZERO);
        sqlx::query!(
            r#"
            INSERT INTO replenishment_request_items (
                request_id, spare_part_id, requested_qty, recommended_qty,
                verified_qty, approved_qty, notes
            ) VALUES ($1, $2, $3, $4, $3, $3, $5)
            "#,
            req_id,
            item.spare_part_id,
            item.requested_qty,
            rec,
            item.notes
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(Json(json!({
        "success": true,
        "request_id": req_id,
        "request_number": req_no,
        "status": "REQUESTED",
        "message": "Permohonan pengadaan stok berhasil diajukan ke Gudang Utama"
    })))
}

pub async fn list_requests(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<ReplenishmentFilterQuery>,
) -> Result<Json<Vec<ReplenishmentRequest>>, AppError> {
    let user_whs = get_user_warehouse_ids(&state.pool, &user).await?;
    let wh_filter = query.warehouse_id.unwrap_or_default();
    if !wh_filter.is_empty() {
        check_warehouse_access(&state.pool, &user, &wh_filter).await?;
    }
    let status_filter = query.status.unwrap_or_default();

    let items = sqlx::query_as!(
        ReplenishmentRequest,
        r#"
        SELECT id, request_number, container_warehouse_id, main_warehouse_id,
               status, notes, admin_notes, supervisor_notes, requested_by,
               verified_by, verified_at, approved_by, approved_at,
               shipped_by, shipped_at, received_by, received_at,
               created_at, updated_at
        FROM replenishment_requests
        WHERE ($1 = '' OR container_warehouse_id = $1 OR main_warehouse_id = $1)
          AND (container_warehouse_id = ANY($2) OR main_warehouse_id = ANY($2))
          AND ($3 = '' OR status = $3)
        ORDER BY created_at DESC
        LIMIT 100
        "#,
        wh_filter,
        &user_whs[..],
        status_filter
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(items))
}

pub async fn get_request_detail(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    let req = sqlx::query_as!(
        ReplenishmentRequest,
        r#"
        SELECT id, request_number, container_warehouse_id, main_warehouse_id,
               status, notes, admin_notes, supervisor_notes, requested_by,
               verified_by, verified_at, approved_by, approved_at,
               shipped_by, shipped_at, received_by, received_at,
               created_at, updated_at
        FROM replenishment_requests
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Permohonan replenishment tidak ditemukan".to_string()))?;

    // Check user warehouse access
    let user_whs = get_user_warehouse_ids(&state.pool, &user).await?;
    if !user_whs.contains(&req.container_warehouse_id) && !user_whs.contains(&req.main_warehouse_id) {
        return Err(AppError::Forbidden(
            "Anda tidak memiliki izin akses ke permohonan gudang ini".to_string(),
        ));
    }

    let items = sqlx::query_as!(
        ReplenishmentItemDetail,
        r#"
        SELECT rri.id, rri.request_id, rri.spare_part_id, p.part_name,
               rri.requested_qty, rri.recommended_qty, rri.verified_qty,
               rri.approved_qty, rri.shipped_qty, rri.received_qty,
               p.unit_of_measure, rri.notes
        FROM replenishment_request_items rri
        JOIN spare_parts p ON rri.spare_part_id = p.id
        WHERE rri.request_id = $1
        "#,
        id
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(json!({
        "request": req,
        "items": items
    })))
}

// Admin Gudang Utama Verifikasi Permohonan
pub async fn verify_request(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<VerifyReplenishmentRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "request.verify").await?;

    let mut tx = state.pool.begin().await?;

    let req = sqlx::query!(
        r#"
        SELECT id, status, request_number, main_warehouse_id FROM replenishment_requests
        WHERE id = $1 FOR UPDATE
        "#,
        id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

    check_warehouse_access(&state.pool, &user, &req.main_warehouse_id).await?;

    if req.status != "REQUESTED" && req.status != "RETURNED_TO_MAIN_ADMIN" {
        return Err(AppError::BadRequest("Status permohonan tidak dapat diverifikasi".to_string()));
    }

    // Update items verified_qty
    for item in payload.items {
        sqlx::query!(
            r#"
            UPDATE replenishment_request_items
            SET verified_qty = $1, approved_qty = $1, notes = COALESCE($2, notes)
            WHERE request_id = $3 AND spare_part_id = $4
            "#,
            item.verified_qty,
            item.notes,
            id,
            item.spare_part_id
        )
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query!(
        r#"
        UPDATE replenishment_requests
        SET status = 'VERIFIED', admin_notes = $1, verified_by = $2,
            verified_at = NOW(), updated_at = NOW()
        WHERE id = $3
        "#,
        payload.admin_notes,
        user.sub,
        id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(json!({
        "success": true,
        "message": format!("Permohonan {} berhasil diverifikasi dan diteruskan ke Supervisor", req.request_number)
    })))
}

// Supervisor Menyetujui Permohonan (Menerbitkan STO / Drop Order)
pub async fn approve_request(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<ApproveReplenishmentRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "request.approve").await?;

    let mut tx = state.pool.begin().await?;

    let req = sqlx::query!(
        r#"
        SELECT id, request_number, main_warehouse_id, container_warehouse_id, status
        FROM replenishment_requests
        WHERE id = $1 FOR UPDATE
        "#,
        id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

    check_warehouse_access(&state.pool, &user, &req.main_warehouse_id).await?;

    if req.status != "VERIFIED" {
        return Err(AppError::BadRequest("Permohonan harus berstatus VERIFIED sebelum disetujui".to_string()));
    }

    sqlx::query!(
        r#"
        UPDATE replenishment_requests
        SET status = 'APPROVED', supervisor_notes = $1, approved_by = $2,
            approved_at = NOW(), updated_at = NOW()
        WHERE id = $3
        "#,
        payload.supervisor_notes,
        user.sub,
        id
    )
    .execute(&mut *tx)
    .await?;

    // Otomatis terbitkan Stock Transfer / Drop Order
    let drop_no = next_document_number(&mut tx, "DROP").await?;
    let drop_id = sqlx::query_scalar!(
        r#"
        INSERT INTO main_warehouse_drops (
            drop_number, request_id, main_warehouse_id,
            container_warehouse_id, status, dropped_by, shipped_at, notes
        ) VALUES ($1, $2, $3, $4, 'IN_TRANSIT', $5, NOW(), $6)
        RETURNING id
        "#,
        drop_no,
        id,
        req.main_warehouse_id,
        req.container_warehouse_id,
        user.sub,
        format!("Penerbitan STO atas permohonan {}", req.request_number)
    )
    .fetch_one(&mut *tx)
    .await?;

    // Copy items to drop order
    let items = sqlx::query!(
        r#"
        SELECT spare_part_id, approved_qty
        FROM replenishment_request_items
        WHERE request_id = $1
        "#,
        id
    )
    .fetch_all(&mut *tx)
    .await?;

    for itm in items {
        let uom = sqlx::query_scalar!(
            "SELECT unit_of_measure FROM spare_parts WHERE id = $1",
            itm.spare_part_id
        )
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query!(
            r#"
            INSERT INTO main_warehouse_drop_items (drop_id, spare_part_id, qty, unit_of_measure)
            VALUES ($1, $2, $3, $4)
            "#,
            drop_id,
            itm.spare_part_id,
            itm.approved_qty,
            uom
        )
        .execute(&mut *tx)
        .await?;
    }

    // Update status permohonan menjadi IN_TRANSIT
    sqlx::query!(
        r#"
        UPDATE replenishment_requests
        SET status = 'IN_TRANSIT', shipped_by = $1, shipped_at = NOW(), updated_at = NOW()
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
        "drop_number": drop_no,
        "message": format!("Permohonan disetujui Supervisor dan dokumen Drop STO ({}) otomatis diterbitkan", drop_no)
    })))
}

// Supervisor Menolak -> Kembali ke Admin Gudang Utama
pub async fn supervisor_reject(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<RejectReplenishmentRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "request.approve").await?;

    let req = sqlx::query!(
        "SELECT request_number, main_warehouse_id, status FROM replenishment_requests WHERE id = $1",
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

    if req.status != "VERIFIED" {
        return Err(AppError::BadRequest("Permohonan tidak dapat ditolak (bukan berstatus VERIFIED)".to_string()));
    }

    check_warehouse_access(&state.pool, &user, &req.main_warehouse_id).await?;

    sqlx::query!(
        r#"
        UPDATE replenishment_requests
        SET status = 'RETURNED_TO_MAIN_ADMIN', supervisor_notes = $1, updated_at = NOW()
        WHERE id = $2
        "#,
        payload.reason,
        id
    )
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({
        "success": true,
        "message": format!("Permohonan {} ditolak Supervisor dan dikembalikan ke Admin Gudang Utama untuk revisi", req.request_number)
    })))
}

// Admin Utama mengembalikan ke Admin Kontainer
pub async fn return_to_container(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<RejectReplenishmentRequest>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "request.verify").await?;

    let req = sqlx::query!(
        "SELECT request_number, main_warehouse_id, status FROM replenishment_requests WHERE id = $1",
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

    if req.status != "REQUESTED" && req.status != "RETURNED_TO_MAIN_ADMIN" {
        return Err(AppError::BadRequest("Permohonan tidak dalam status yang dapat dikembalikan ke kontainer".to_string()));
    }

    check_warehouse_access(&state.pool, &user, &req.main_warehouse_id).await?;

    sqlx::query!(
        r#"
        UPDATE replenishment_requests
        SET status = 'RETURNED_TO_CONTAINER_ADMIN', admin_notes = $1, updated_at = NOW()
        WHERE id = $2
        "#,
        payload.reason,
        id
    )
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({
        "success": true,
        "message": format!("Permohonan {} dikembalikan ke Admin Kontainer", req.request_number)
    })))
}

// Admin Kontainer Konfirmasi Penerimaan Drop Barang
pub async fn receive_drop(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    let mut tx = state.pool.begin().await?;

    let req = sqlx::query!(
        r#"
        SELECT id, request_number, container_warehouse_id, status
        FROM replenishment_requests
        WHERE id = $1 FOR UPDATE
        "#,
        id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Permohonan tidak ditemukan".to_string()))?;

    if req.status != "IN_TRANSIT" {
        return Err(AppError::BadRequest("Barang permohonan belum dalam pengiriman (IN_TRANSIT)".to_string()));
    }

    check_warehouse_access(&state.pool, &user, &req.container_warehouse_id).await?;

    let items = sqlx::query!(
        r#"
        SELECT spare_part_id, approved_qty
        FROM replenishment_request_items
        WHERE request_id = $1
        "#,
        id
    )
    .fetch_all(&mut *tx)
    .await?;

    for itm in items {
        // Upsert container inventory stock
        let current_qty = sqlx::query_scalar!(
            r#"
            SELECT qty_on_hand FROM inventory_stock
            WHERE warehouse_id = $1 AND spare_part_id = $2
            FOR UPDATE
            "#,
            req.container_warehouse_id,
            itm.spare_part_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or(Decimal::ZERO);

        let new_qty = current_qty + itm.approved_qty;

        sqlx::query!(
            r#"
            INSERT INTO inventory_stock (warehouse_id, spare_part_id, qty_on_hand, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (warehouse_id, spare_part_id)
            DO UPDATE SET qty_on_hand = $3, updated_at = NOW()
            "#,
            req.container_warehouse_id,
            itm.spare_part_id,
            new_qty
        )
        .execute(&mut *tx)
        .await?;

        // Record ledger DROP_IN
        sqlx::query!(
            r#"
            INSERT INTO stock_movements (
                warehouse_id, spare_part_id, movement_type, qty,
                balance_after, reference_number, notes, created_by
            ) VALUES ($1, $2, 'DROP_IN', $3, $4, $5, $6, $7)
            "#,
            req.container_warehouse_id,
            itm.spare_part_id,
            itm.approved_qty,
            new_qty,
            req.request_number,
            format!("Penerimaan suplai dari Gudang Utama atas STO {}", req.request_number),
            user.sub
        )
        .execute(&mut *tx)
        .await?;

        // Update item received qty
        sqlx::query!(
            r#"
            UPDATE replenishment_request_items
            SET received_qty = approved_qty
            WHERE request_id = $1 AND spare_part_id = $2
            "#,
            id,
            itm.spare_part_id
        )
        .execute(&mut *tx)
        .await?;
    }

    // Update drop order status to COMPLETED
    sqlx::query!(
        r#"
        UPDATE main_warehouse_drops
        SET status = 'COMPLETED', received_by = $1, received_at = NOW()
        WHERE request_id = $2
        "#,
        user.sub,
        id
    )
    .execute(&mut *tx)
    .await?;

    // Update request status to COMPLETED
    sqlx::query!(
        r#"
        UPDATE replenishment_requests
        SET status = 'COMPLETED', received_by = $1, received_at = NOW(), updated_at = NOW()
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
        "message": format!("Barang permohonan {} berhasil diterima dan stok kontainer telah bertambah!", req.request_number)
    })))
}
