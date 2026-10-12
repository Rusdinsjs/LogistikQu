use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{check_any_permission, get_user_warehouse_ids, AuthUser},
    },
    domain::entities::MainDrop,
    error::AppError,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct DropFilterQuery {
    pub container_warehouse_id: Option<String>,
}

pub async fn list_main_drops(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<DropFilterQuery>,
) -> Result<Json<Vec<MainDrop>>, AppError> {
    check_any_permission(&state.pool, &user, &["drops.view", "sto.ship"]).await?;
    let wh_filter = query.container_warehouse_id.unwrap_or_default();
    let user_whs = get_user_warehouse_ids(&state.pool, &user).await?;

    let items = state
        .services
        .drop
        .list_main_drops(&wh_filter, &user_whs)
        .await?;
    Ok(Json(items))
}

pub async fn get_drop_detail(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    check_any_permission(&state.pool, &user, &["drops.view", "sto.ship"]).await?;
    let detail = state.services.drop.get_drop_detail(id).await?;

    if let Some(drop_obj) = detail.get("drop") {
        let container_wh = drop_obj
            .get("container_warehouse_id")
            .and_then(|w| w.as_str())
            .unwrap_or_default();
        let main_wh = drop_obj
            .get("main_warehouse_id")
            .and_then(|w| w.as_str())
            .unwrap_or_default();
        let user_whs = get_user_warehouse_ids(&state.pool, &user).await?;
        if !user_whs.contains(&container_wh.to_string()) && !user_whs.contains(&main_wh.to_string())
        {
            return Err(AppError::Forbidden(
                "Akses dokumen drop ditolak".to_string(),
            ));
        }
    }

    Ok(Json(detail))
}
