use crate::{
    api::{
        handlers::auth::AppState,
        middleware::{
            check_any_permission, check_warehouse_access, get_user_fleet_category,
            get_user_warehouse_ids, is_unit_in_category, AuthUser,
        },
    },
    domain::entities::{
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
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct ReturnFilterQuery {
    pub warehouse_id: Option<String>,
    pub status: Option<String>,
    pub search: Option<String>,
    pub mechanic_id: Option<String>,
}

pub async fn list_returns(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Query(query): Query<ReturnFilterQuery>,
) -> Result<Json<Vec<UsedPartReturn>>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &[
            "returns.view",
            "returns.receive",
            "returns.transfer",
            "returns.complete",
        ],
    )
    .await?;

    let user_whs = get_user_warehouse_ids(&state.pool, &user).await?;
    let fleet_cat = get_user_fleet_category(&state.pool, &user).await?;

    if let Some(ref wh) = query.warehouse_id {
        check_warehouse_access(&state.pool, &user, wh).await?;
    }

    let wh_filter = query.warehouse_id.unwrap_or_default();
    let status_filter = query.status.unwrap_or_default();
    let search = query.search.unwrap_or_default();

    let mut mechanic_filter = query.mechanic_id.unwrap_or_default();
    if user.role_id == "MECHANIC" {
        let mech_info: Option<(Option<String>, Option<String>, String)> = sqlx::query_as(
            r#"
            SELECT u.employee_id, e.name as employee_name, u.full_name
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE u.id = $1
            "#,
        )
        .bind(user.sub)
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten();

        if let Some((employee_id, employee_name, _full_name)) = mech_info {
            if let Some(ename) = employee_name {
                mechanic_filter = ename;
            } else if let Some(empid) = employee_id {
                mechanic_filter = empid;
            } else {
                mechanic_filter = user.username.clone();
            }
        } else {
            mechanic_filter = user.username.clone();
        }
    }

    let items = state
        .services
        .returns
        .list_returns(
            &wh_filter,
            &status_filter,
            &search,
            &mechanic_filter,
            &user_whs,
        )
        .await?;
    let filtered = items
        .into_iter()
        .filter(|r| is_unit_in_category(&r.unit_number, None, None, fleet_cat.as_deref()))
        .collect();
    Ok(Json(filtered))
}

pub async fn get_return_detail(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<UsedPartReturn>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &[
            "returns.view",
            "returns.receive",
            "returns.transfer",
            "returns.complete",
        ],
    )
    .await?;
    let item = state.services.returns.get_return_detail(id).await?;
    let user_whs = get_user_warehouse_ids(&state.pool, &user).await?;
    let has_access = user.role_id == "SUPER_ADMIN"
        || user.role_id == "MANAGER"
        || user_whs.contains(&item.warehouse_id)
        || item
            .main_warehouse_id
            .as_ref()
            .map_or(false, |mwh| user_whs.contains(mwh))
        || {
            let is_linked = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM warehouse_supply_links WHERE sub_warehouse_id = $1 AND main_warehouse_id = ANY($2))",
            )
            .bind(&item.warehouse_id)
            .bind(&user_whs)
            .fetch_one(&state.pool)
            .await
            .unwrap_or(false);
            is_linked
        };

    if !has_access {
        return Err(AppError::Forbidden(format!(
            "Anda tidak memiliki izin akses untuk pengembalian di gudang {}",
            item.warehouse_id
        )));
    }
    Ok(Json(item))
}

pub async fn receive_at_container(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReceiveContainerReturnRequest>,
) -> Result<Json<Value>, AppError> {
    check_any_permission(&state.pool, &user, &["returns.receive", "issue.create"]).await?;
    let return_item = state.services.returns.get_return_detail(id).await?;
    check_warehouse_access(&state.pool, &user, &return_item.warehouse_id).await?;
    let res = state
        .services
        .returns
        .receive_at_container(&user, id, payload)
        .await?;
    Ok(Json(res))
}

pub async fn transfer_to_main(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<TransferMainReturnRequest>,
) -> Result<Json<Value>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &["returns.transfer", "request.verify", "sto.ship"],
    )
    .await?;
    let return_item = state.services.returns.get_return_detail(id).await?;
    check_warehouse_access(&state.pool, &user, &return_item.warehouse_id).await?;
    let res = state
        .services
        .returns
        .transfer_to_main(&user, id, payload)
        .await?;
    Ok(Json(res))
}

pub async fn complete_return(
    State(state): State<AppState>,
    AuthUser(user): AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<CompleteReturnRequest>,
) -> Result<Json<Value>, AppError> {
    check_any_permission(
        &state.pool,
        &user,
        &["returns.complete", "issue.approve", "request.approve"],
    )
    .await?;
    let return_item = state.services.returns.get_return_detail(id).await?;
    if let Some(ref mwh) = return_item.main_warehouse_id {
        check_warehouse_access(&state.pool, &user, mwh).await?;
    } else {
        check_warehouse_access(&state.pool, &user, &return_item.warehouse_id).await?;
    }
    let res = state
        .services
        .returns
        .complete_return(&user, id, payload)
        .await?;
    Ok(Json(res))
}
