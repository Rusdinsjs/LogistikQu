use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_permission, check_warehouse_access, AuthUser},
    },
    domain::models::{
        CreateIssueRequest, IssueTransaction, IssueTransactionItemDetail,
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
pub struct IssueFilterQuery {
    pub warehouse_id: Option<String>,
    pub search: Option<String>,
    pub status: Option<String>,
    pub force: Option<bool>,
}

pub async fn create_issue(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<IssueFilterQuery>,
    Json(payload): Json<CreateIssueRequest>,
) -> Result<Json<Value>, AppError> {
    check_warehouse_access(&state.pool, &user, &payload.warehouse_id).await?;

    if payload.items.is_empty() {
        return Err(AppError::BadRequest("Minimal harus ada 1 item spare part yang dikeluarkan".to_string()));
    }

    // 1. Validasi 30-Menit Duplicate Issue Prevention
    let force_submit = query.force.unwrap_or(false);
    if !force_submit {
        let part_ids: Vec<String> = payload.items.iter().map(|i| i.spare_part_id.clone()).collect();
        let recent_dup = sqlx::query!(
            r#"
            SELECT t.transaction_number, t.created_at, i.spare_part_id
            FROM issue_transactions t
            JOIN issue_transaction_items i ON t.id = i.transaction_id
            WHERE t.unit_number = $1
              AND i.spare_part_id = ANY($2)
              AND t.created_at >= NOW() - INTERVAL '30 minutes'
            LIMIT 1
            "#,
            payload.unit_number,
            &part_ids
        )
        .fetch_optional(&state.pool)
        .await?;

        if let Some(dup) = recent_dup {
            return Ok(Json(json!({
                "duplicate_warning": true,
                "message": format!(
                    "Peringatan: Unit {} baru saja mengambil spare part {} pada {} (No: {}). Lanjutkan transaksi?",
                    payload.unit_number, dup.spare_part_id, dup.created_at.format("%H:%M"), dup.transaction_number
                )
            })));
        }
    }

    let mut tx = state.pool.begin().await?;

    // Generate atomic document number
    let transaction_no = next_document_number(&mut tx, "ISS").await?;

    // 2. Check if any item requires supervisor approval
    let mut requires_approval = false;
    for item in &payload.items {
        let is_crit = sqlx::query_scalar!(
            r#"
            SELECT requires_issue_approval FROM spare_parts WHERE id = $1
            "#,
            item.spare_part_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or(false);

        if is_crit {
            requires_approval = true;
            break;
        }
    }

    let status = if requires_approval {
        "PENDING_APPROVAL"
    } else {
        "COMPLETED"
    };

    let priority = payload.priority.unwrap_or_else(|| "NORMAL".to_string());

    // Insert issue header
    let issue_id = sqlx::query_scalar!(
        r#"
        INSERT INTO issue_transactions (
            transaction_number, warehouse_id, site_id, receiver_name,
            receiver_employee_id, receiver_department, unit_number, unit_name,
            unit_type, ct_number, serial_number, hm_km, mechanic_name,
            mechanic_id, work_order_number, maintenance_type, priority,
            status, notes, latitude, longitude, device_id, client_uuid,
            evidence_photo_url, document_url, created_by
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
        )
        RETURNING id
        "#,
        transaction_no,
        payload.warehouse_id,
        payload.site_id,
        payload.receiver_name,
        payload.receiver_employee_id,
        payload.receiver_department,
        payload.unit_number,
        payload.unit_name,
        payload.unit_type,
        payload.ct_number,
        payload.serial_number,
        payload.hm_km,
        payload.mechanic_name,
        payload.mechanic_id,
        payload.work_order_number,
        payload.maintenance_type,
        priority,
        status,
        payload.notes,
        payload.latitude,
        payload.longitude,
        payload.device_id,
        payload.client_uuid,
        payload.evidence_photo_url,
        payload.document_url,
        user.sub
    )
    .fetch_one(&mut *tx)
    .await?;

    // 3. Process items and deduct stock if COMPLETED
    for item in &payload.items {
        // Insert item record
        sqlx::query!(
            r#"
            INSERT INTO issue_transaction_items (transaction_id, spare_part_id, qty, unit_of_measure)
            VALUES ($1, $2, $3, $4)
            "#,
            issue_id,
            item.spare_part_id,
            item.qty,
            item.unit_of_measure
        )
        .execute(&mut *tx)
        .await?;

        // Check if item requires core return
        let requires_core_return = sqlx::query_scalar!(
            "SELECT requires_core_return FROM spare_parts WHERE id = $1",
            item.spare_part_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or(false);

        if requires_core_return {
            let return_no = next_document_number(&mut tx, "RET").await?;
            sqlx::query!(
                r#"
                INSERT INTO used_part_returns (
                    return_number, issue_transaction_id, spare_part_id, qty, unit_of_measure,
                    unit_number, mechanic_name, mechanic_id, warehouse_id,
                    status, current_holder_type, current_holder_name
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_RETURN', 'MECHANIC', $10)
                "#,
                return_no,
                issue_id,
                item.spare_part_id,
                item.qty,
                item.unit_of_measure,
                payload.unit_number,
                payload.mechanic_name,
                payload.mechanic_id,
                payload.warehouse_id,
                payload.mechanic_name
            )
            .execute(&mut *tx)
            .await?;
        }

        if status == "COMPLETED" {
            // Lock and verify stock
            let current_qty = sqlx::query_scalar!(
                r#"
                SELECT qty_on_hand FROM inventory_stock
                WHERE warehouse_id = $1 AND spare_part_id = $2
                FOR UPDATE
                "#,
                payload.warehouse_id,
                item.spare_part_id
            )
            .fetch_optional(&mut *tx)
            .await?
            .unwrap_or(Decimal::ZERO);

            if current_qty < item.qty {
                return Err(AppError::BadRequest(format!(
                    "Stok spare part {} di {} tidak mencukupi (Tersedia: {}, Diminta: {})",
                    item.spare_part_id, payload.warehouse_id, current_qty, item.qty
                )));
            }

            let new_qty = current_qty - item.qty;

            // Deduct stock
            sqlx::query!(
                r#"
                UPDATE inventory_stock
                SET qty_on_hand = $1, updated_at = NOW()
                WHERE warehouse_id = $2 AND spare_part_id = $3
                "#,
                new_qty,
                payload.warehouse_id,
                item.spare_part_id
            )
            .execute(&mut *tx)
            .await?;

            // Record ledger
            sqlx::query!(
                r#"
                INSERT INTO stock_movements (
                    warehouse_id, spare_part_id, movement_type, qty,
                    balance_after, reference_number, notes, created_by
                ) VALUES (
                    $1, $2, 'ISSUE_OUT', $3, $4, $5, $6, $7
                )
                "#,
                payload.warehouse_id,
                item.spare_part_id,
                item.qty,
                new_qty,
                transaction_no,
                format!("Pengeluaran untuk unit {} (Mekanik: {})", payload.unit_number, payload.mechanic_name),
                user.sub
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    // Record audit log
    sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'CREATE_ISSUE', 'ISSUE_TRANSACTION', $3, $4)
        "#,
        user.sub,
        user.username,
        transaction_no,
        json!({
            "status": status,
            "unit_number": payload.unit_number,
            "mechanic": payload.mechanic_name,
            "items_count": payload.items.len()
        })
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(json!({
        "success": true,
        "issue_id": issue_id,
        "transaction_number": transaction_no,
        "status": status,
        "message": if status == "PENDING_APPROVAL" {
            "Transaksi berhasil dibuat dan menunggu persetujuan Supervisor (terdapat komponen kritikal)"
        } else {
            "Transaksi berhasil diselesaikan dan stok langsung terpotong"
        }
    })))
}

pub async fn list_issues(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<IssueFilterQuery>,
) -> Result<Json<Vec<IssueTransaction>>, AppError> {
    let warehouse_id = query.warehouse_id.unwrap_or_else(|| "WH-CONT-HE".to_string());
    check_warehouse_access(&state.pool, &user, &warehouse_id).await?;

    let search = query.search.unwrap_or_default();
    let search_pattern = format!("%{}%", search);
    let status_filter = query.status.unwrap_or_default();

    let items = sqlx::query_as!(
        IssueTransaction,
        r#"
        SELECT id, transaction_number, warehouse_id, site_id, receiver_name,
               receiver_employee_id, receiver_department, unit_number, unit_name,
               unit_type, ct_number, serial_number, hm_km, mechanic_name,
               mechanic_id, work_order_number, maintenance_type, priority,
               status, notes, evidence_photo_url, document_url, created_by, approved_by, created_at
        FROM issue_transactions
        WHERE warehouse_id = $1
          AND ($2 = '' OR transaction_number ILIKE $3 OR unit_number ILIKE $3 OR mechanic_name ILIKE $3)
          AND ($4 = '' OR status = $4)
        ORDER BY created_at DESC
        LIMIT 100
        "#,
        warehouse_id,
        search,
        search_pattern,
        status_filter
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(items))
}

pub async fn get_issue_detail(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    let tx_record = sqlx::query_as!(
        IssueTransaction,
        r#"
        SELECT id, transaction_number, warehouse_id, site_id, receiver_name,
               receiver_employee_id, receiver_department, unit_number, unit_name,
               unit_type, ct_number, serial_number, hm_km, mechanic_name,
               mechanic_id, work_order_number, maintenance_type, priority,
               status, notes, evidence_photo_url, document_url, created_by, approved_by, created_at
        FROM issue_transactions
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Bukti transaksi pengeluaran tidak ditemukan".to_string()))?;

    check_warehouse_access(&state.pool, &user, &tx_record.warehouse_id).await?;

    let items = sqlx::query_as!(
        IssueTransactionItemDetail,
        r#"
        SELECT iti.id, iti.transaction_id, iti.spare_part_id, p.part_name,
               iti.qty, iti.unit_of_measure
        FROM issue_transaction_items iti
        JOIN spare_parts p ON iti.spare_part_id = p.id
        WHERE iti.transaction_id = $1
        "#,
        id
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(json!({
        "transaction": tx_record,
        "items": items
    })))
}

pub async fn approve_critical_issue(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_permission(&state.pool, &user, "issue.approve").await?;

    let mut tx = state.pool.begin().await?;

    let issue = sqlx::query!(
        r#"
        SELECT id, transaction_number, warehouse_id, unit_number, mechanic_name, mechanic_id, status
        FROM issue_transactions
        WHERE id = $1
        FOR UPDATE
        "#,
        id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound("Transaksi tidak ditemukan".to_string()))?;

    check_warehouse_access(&state.pool, &user, &issue.warehouse_id).await?;

    if issue.status != "PENDING_APPROVAL" {
        return Err(AppError::BadRequest("Transaksi tidak dalam status menunggu approval".to_string()));
    }

    let items = sqlx::query!(
        r#"
        SELECT spare_part_id, qty, unit_of_measure FROM issue_transaction_items
        WHERE transaction_id = $1
        "#,
        id
    )
    .fetch_all(&mut *tx)
    .await?;

    // Deduct stocks
    for itm in &items {
        let current_qty = sqlx::query_scalar!(
            r#"
            SELECT qty_on_hand FROM inventory_stock
            WHERE warehouse_id = $1 AND spare_part_id = $2
            FOR UPDATE
            "#,
            issue.warehouse_id,
            itm.spare_part_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or(Decimal::ZERO);

        if current_qty < itm.qty {
            return Err(AppError::BadRequest(format!(
                "Stok part {} tidak mencukupi saat approval (tersedia: {})",
                itm.spare_part_id, current_qty
            )));
        }

        let new_qty = current_qty - itm.qty;
        sqlx::query!(
            r#"
            UPDATE inventory_stock
            SET qty_on_hand = $1, updated_at = NOW()
            WHERE warehouse_id = $2 AND spare_part_id = $3
            "#,
            new_qty,
            issue.warehouse_id,
            itm.spare_part_id
        )
        .execute(&mut *tx)
        .await?;

        sqlx::query!(
            r#"
            INSERT INTO stock_movements (
                warehouse_id, spare_part_id, movement_type, qty,
                balance_after, reference_number, notes, created_by
            ) VALUES ($1, $2, 'ISSUE_OUT', $3, $4, $5, $6, $7)
            "#,
            issue.warehouse_id,
            itm.spare_part_id,
            itm.qty,
            new_qty,
            issue.transaction_number,
            format!("Approved by Supervisor for unit {}", issue.unit_number),
            user.sub
        )
        .execute(&mut *tx)
        .await?;

        // Check if item requires core return and create record if not exists
        let requires_core_return = sqlx::query_scalar!(
            "SELECT requires_core_return FROM spare_parts WHERE id = $1",
            itm.spare_part_id
        )
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or(false);

        if requires_core_return {
            let exists = sqlx::query_scalar!(
                "SELECT EXISTS(SELECT 1 FROM used_part_returns WHERE issue_transaction_id = $1 AND spare_part_id = $2)",
                id,
                itm.spare_part_id
            )
            .fetch_one(&mut *tx)
            .await?
            .unwrap_or(false);

            if !exists {
                let return_no = next_document_number(&mut tx, "RET").await?;
                sqlx::query!(
                    r#"
                    INSERT INTO used_part_returns (
                        return_number, issue_transaction_id, spare_part_id, qty, unit_of_measure,
                        unit_number, mechanic_name, mechanic_id, warehouse_id,
                        status, current_holder_type, current_holder_name
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_RETURN', 'MECHANIC', $10)
                    "#,
                    return_no,
                    id,
                    itm.spare_part_id,
                    itm.qty,
                    itm.unit_of_measure,
                    issue.unit_number,
                    issue.mechanic_name,
                    issue.mechanic_id,
                    issue.warehouse_id,
                    issue.mechanic_name
                )
                .execute(&mut *tx)
                .await?;
            }
        }
    }

    sqlx::query!(
        r#"
        UPDATE issue_transactions
        SET status = 'COMPLETED', approved_by = $1
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
        "message": format!("Transaksi {} berhasil disetujui dan stok dipotong", issue.transaction_number)
    })))
}
