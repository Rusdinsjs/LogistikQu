use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_warehouse_access, AuthUser},
    },
    domain::models::{
        CompleteReturnRequest, ReceiveContainerReturnRequest, TransferMainReturnRequest,
        UsedPartReturn,
    },
    error::AppError,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct ReturnFilterQuery {
    pub warehouse_id: Option<String>,
    pub status: Option<String>,
    pub search: Option<String>,
}

pub async fn list_returns(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<ReturnFilterQuery>,
) -> Result<Json<Vec<UsedPartReturn>>, AppError> {
    if let Some(ref wh) = query.warehouse_id {
        check_warehouse_access(&state.pool, &user, wh).await?;
    }

    let search = query.search.unwrap_or_default();
    let search_pattern = format!("%{}%", search);
    let status_filter = query.status.unwrap_or_default();
    let wh_filter = query.warehouse_id.unwrap_or_default();

    let items = sqlx::query_as!(
        UsedPartReturn,
        r#"
        SELECT 
            r.id, r.return_number, r.issue_transaction_id, r.spare_part_id,
            p.part_name, r.qty, r.unit_of_measure, r.unit_number,
            r.mechanic_name, r.mechanic_id, r.warehouse_id,
            w.name as warehouse_name, r.status, r.current_holder_type,
            r.current_holder_name, r.container_received_at, r.container_received_by,
            uc.full_name as "container_received_by_name?", r.container_notes,
            r.container_photo_url, r.main_received_at, r.main_received_by,
            um.full_name as "main_received_by_name?", r.main_warehouse_id,
            r.main_notes, r.created_at, r.updated_at
        FROM used_part_returns r
        JOIN spare_parts p ON r.spare_part_id = p.id
        JOIN warehouses w ON r.warehouse_id = w.id
        LEFT JOIN users uc ON r.container_received_by = uc.id
        LEFT JOIN users um ON r.main_received_by = um.id
        WHERE ($1 = '' OR r.warehouse_id = $1)
          AND ($2 = '' OR r.status = $2)
          AND ($3 = '' OR r.return_number ILIKE $4 OR r.unit_number ILIKE $4 OR r.mechanic_name ILIKE $4 OR p.part_name ILIKE $4 OR r.spare_part_id ILIKE $4 OR r.current_holder_name ILIKE $4)
        ORDER BY r.created_at DESC
        LIMIT 150
        "#,
        wh_filter,
        status_filter,
        search,
        search_pattern
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(items))
}

pub async fn get_return_detail(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<UsedPartReturn>, AppError> {
    let item = sqlx::query_as!(
        UsedPartReturn,
        r#"
        SELECT 
            r.id, r.return_number, r.issue_transaction_id, r.spare_part_id,
            p.part_name, r.qty, r.unit_of_measure, r.unit_number,
            r.mechanic_name, r.mechanic_id, r.warehouse_id,
            w.name as warehouse_name, r.status, r.current_holder_type,
            r.current_holder_name, r.container_received_at, r.container_received_by,
            uc.full_name as "container_received_by_name?", r.container_notes,
            r.container_photo_url, r.main_received_at, r.main_received_by,
            um.full_name as "main_received_by_name?", r.main_warehouse_id,
            r.main_notes, r.created_at, r.updated_at
        FROM used_part_returns r
        JOIN spare_parts p ON r.spare_part_id = p.id
        JOIN warehouses w ON r.warehouse_id = w.id
        LEFT JOIN users uc ON r.container_received_by = uc.id
        LEFT JOIN users um ON r.main_received_by = um.id
        WHERE r.id = $1
        "#,
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Data pengembalian part bekas tidak ditemukan".to_string()))?;

    check_warehouse_access(&state.pool, &user, &item.warehouse_id).await?;

    Ok(Json(item))
}

pub async fn receive_at_container(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReceiveContainerReturnRequest>,
) -> Result<Json<Value>, AppError> {
    let current = sqlx::query!(
        "SELECT id, warehouse_id, status, return_number FROM used_part_returns WHERE id = $1 FOR UPDATE",
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Data retur tidak ditemukan".to_string()))?;

    check_warehouse_access(&state.pool, &user, &current.warehouse_id).await?;

    if current.status != "PENDING_RETURN" {
        return Err(AppError::BadRequest("Part bekas ini sudah pernah diterima di kontainer atau telah selesai".to_string()));
    }

    let receiver_name = sqlx::query_scalar!(
        "SELECT full_name FROM users WHERE id = $1",
        user.sub
    )
    .fetch_one(&state.pool)
    .await?;

    let holder_label = format!("Admin Kontainer ({})", receiver_name);

    sqlx::query!(
        r#"
        UPDATE used_part_returns
        SET status = 'RECEIVED_AT_CONTAINER',
            current_holder_type = 'CONTAINER_ADMIN',
            current_holder_name = $1,
            container_received_at = NOW(),
            container_received_by = $2,
            container_notes = $3,
            container_photo_url = $4,
            updated_at = NOW()
        WHERE id = $5
        "#,
        holder_label,
        user.sub,
        payload.container_notes,
        payload.container_photo_url,
        id
    )
    .execute(&state.pool)
    .await?;

    // Audit log
    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'RECEIVE_CORE_RETURN', 'USED_PART_RETURN', $3, $4)
        "#,
        user.sub,
        user.username,
        current.return_number,
        json!({
            "status": "RECEIVED_AT_CONTAINER",
            "received_by": receiver_name,
            "notes": payload.container_notes
        })
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "message": format!("Part bekas {} berhasil diterima di Gudang Kontainer", current.return_number)
    })))
}

pub async fn transfer_to_main(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<TransferMainReturnRequest>,
) -> Result<Json<Value>, AppError> {
    let current = sqlx::query!(
        "SELECT id, warehouse_id, status, return_number FROM used_part_returns WHERE id = $1 FOR UPDATE",
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Data retur tidak ditemukan".to_string()))?;

    if current.status != "RECEIVED_AT_CONTAINER" {
        return Err(AppError::BadRequest("Barang harus berstatus sudah diterima di Kontainer sebelum diserahkan ke Gudang Utama".to_string()));
    }

    let receiver_name = sqlx::query_scalar!(
        "SELECT full_name FROM users WHERE id = $1",
        user.sub
    )
    .fetch_one(&state.pool)
    .await?;

    let main_wh = payload.main_warehouse_id.unwrap_or_else(|| {
        if current.warehouse_id.contains("DT") {
            "WH-MAIN-DT".to_string()
        } else {
            "WH-MAIN-HE".to_string()
        }
    });

    let holder_label = format!("Admin Gudang Utama ({})", receiver_name);

    sqlx::query!(
        r#"
        UPDATE used_part_returns
        SET status = 'TRANSFERRED_TO_MAIN',
            current_holder_type = 'MAIN_ADMIN',
            current_holder_name = $1,
            main_received_at = NOW(),
            main_received_by = $2,
            main_warehouse_id = $3,
            main_notes = $4,
            updated_at = NOW()
        WHERE id = $5
        "#,
        holder_label,
        user.sub,
        main_wh,
        payload.main_notes,
        id
    )
    .execute(&state.pool)
    .await?;

    // Audit log
    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'TRANSFER_CORE_RETURN', 'USED_PART_RETURN', $3, $4)
        "#,
        user.sub,
        user.username,
        current.return_number,
        json!({
            "status": "TRANSFERRED_TO_MAIN",
            "transferred_to_main_by": receiver_name,
            "main_warehouse": main_wh,
            "notes": payload.main_notes
        })
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "message": format!("Part bekas {} berhasil diserahkan dan diterima di Gudang Utama", current.return_number)
    })))
}

pub async fn complete_return(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<CompleteReturnRequest>,
) -> Result<Json<Value>, AppError> {
    let current = sqlx::query!(
        "SELECT id, status, return_number FROM used_part_returns WHERE id = $1 FOR UPDATE",
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Data retur tidak ditemukan".to_string()))?;

    if current.status == "COMPLETED" {
        return Err(AppError::BadRequest("Data retur ini sudah selesai".to_string()));
    }

    let disp = payload.disposition.unwrap_or_else(|| "SCRAPPED".to_string());
    let holder_label = format!("SELESAI ({})", disp);

    sqlx::query!(
        r#"
        UPDATE used_part_returns
        SET status = 'COMPLETED',
            current_holder_type = 'COMPLETED',
            current_holder_name = $1,
            main_notes = COALESCE($2, main_notes),
            updated_at = NOW()
        WHERE id = $3
        "#,
        holder_label,
        payload.final_notes,
        id
    )
    .execute(&state.pool)
    .await?;

    // Audit log
    let _ = sqlx::query!(
        r#"
        INSERT INTO audit_logs (user_id, username, action, entity, entity_id, new_values)
        VALUES ($1, $2, 'COMPLETE_CORE_RETURN', 'USED_PART_RETURN', $3, $4)
        "#,
        user.sub,
        user.username,
        current.return_number,
        json!({
            "status": "COMPLETED",
            "disposition": disp,
            "notes": payload.final_notes
        })
    )
    .execute(&state.pool)
    .await;

    Ok(Json(json!({
        "success": true,
        "message": format!("Siklus pengembalian part bekas {} telah diselesaikan", current.return_number)
    })))
}
