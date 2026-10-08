use crate::{
    api::{handlers::auth::AppState, middleware::AuthUser},
    domain::models::{MainDrop, MainDropItemDetail},
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
pub struct DropFilterQuery {
    pub container_warehouse_id: Option<String>,
}

pub async fn list_main_drops(
    State(state): State<AppState>,
    _user: AuthUser,
    Query(query): Query<DropFilterQuery>,
) -> Result<Json<Vec<MainDrop>>, AppError> {
    let wh_filter = query.container_warehouse_id.unwrap_or_default();

    let items = sqlx::query_as!(
        MainDrop,
        r#"
        SELECT id, drop_number, request_id, main_warehouse_id,
               container_warehouse_id, status, dropped_by, received_by,
               shipped_at, received_at, notes
        FROM main_warehouse_drops
        WHERE ($1 = '' OR container_warehouse_id = $1)
        ORDER BY shipped_at DESC
        LIMIT 100
        "#,
        wh_filter
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(items))
}

pub async fn get_drop_detail(
    State(state): State<AppState>,
    _user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    let drop = sqlx::query_as!(
        MainDrop,
        r#"
        SELECT id, drop_number, request_id, main_warehouse_id,
               container_warehouse_id, status, dropped_by, received_by,
               shipped_at, received_at, notes
        FROM main_warehouse_drops
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Data drop/suplai tidak ditemukan".to_string()))?;

    let items = sqlx::query_as!(
        MainDropItemDetail,
        r#"
        SELECT di.id, di.drop_id, di.spare_part_id, p.part_name,
               di.qty, di.unit_of_measure
        FROM main_warehouse_drop_items di
        JOIN spare_parts p ON di.spare_part_id = p.id
        WHERE di.drop_id = $1
        "#,
        id
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(json!({
        "drop": drop,
        "items": items
    })))
}
