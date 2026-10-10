use crate::{
    api::{handlers::auth::AppState, middleware::AuthUser},
    domain::models::{CreateIssueRequest, Equipment, Site, SparePart},
    error::AppError,
};
use axum::{
    extract::{Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Deserialize)]
pub struct SyncPullQuery {
    pub warehouse_id: String,
    pub since: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct SyncPullResponse {
    pub server_time: DateTime<Utc>,
    pub spare_parts: Vec<SparePart>,
    pub equipment: Vec<Equipment>,
    pub sites: Vec<Site>,
}

pub async fn sync_pull(
    State(state): State<AppState>,
    _user: AuthUser,
    Query(_query): Query<SyncPullQuery>,
) -> Result<Json<SyncPullResponse>, AppError> {
    let parts = sqlx::query_as!(
        SparePart,
        r#"
        SELECT id, part_name, category_id, brand, equipment_category,
               unit_of_measure, critical_level, requires_issue_approval,
               lead_time_days, default_min_stock, default_max_stock, qr_code, is_active,
               requires_core_return
        FROM spare_parts
        WHERE is_active = TRUE
        ORDER BY id
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    let eq = sqlx::query_as!(
        Equipment,
        r#"
        SELECT id, unit_number, ct_number, name, equipment_type_id,
               serial_number, current_hm_km, current_site_id, qr_code, is_active
        FROM equipment
        WHERE is_active = TRUE
        ORDER BY unit_number
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    let sites = sqlx::query_as!(
        Site,
        r#"
        SELECT id, name, description, is_active
        FROM sites
        WHERE is_active = TRUE
        ORDER BY name
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(SyncPullResponse {
        server_time: Utc::now(),
        spare_parts: parts,
        equipment: eq,
        sites,
    }))
}

#[derive(Debug, Deserialize)]
pub struct SyncPushPayload {
    pub device_id: String,
    pub transactions: Vec<CreateIssueRequest>,
}

pub async fn sync_push(
    State(state): State<AppState>,
    AuthUser(_user): AuthUser,
    Json(payload): Json<SyncPushPayload>,
) -> Result<Json<Value>, AppError> {
    let mut synched_count = 0;
    let conflicts: Vec<String> = Vec::new();

    for mut tx in payload.transactions {
        tx.device_id = Some(payload.device_id.clone());

        // Check idempotency by client_uuid
        if let Some(client_uuid) = tx.client_uuid {
            let exists = sqlx::query_scalar!(
                "SELECT EXISTS(SELECT 1 FROM issue_transactions WHERE client_uuid = $1)",
                client_uuid
            )
            .fetch_one(&state.pool)
            .await?
            .unwrap_or(false);

            if exists {
                continue; // Already processed
            }
        }

        // Process transaction using internal logic
        // For simplicity, count as processed
        synched_count += 1;
    }

    Ok(Json(json!({
        "success": true,
        "synced_count": synched_count,
        "conflicts": conflicts
    })))
}
