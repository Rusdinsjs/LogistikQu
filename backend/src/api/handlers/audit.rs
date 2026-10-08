use crate::{
    api::{handlers::auth::AppState, middleware::AuthUser},
    error::AppError,
};
use axum::{extract::State, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditLogRecord {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub username: Option<String>,
    pub action: String,
    pub entity: String,
    pub entity_id: Option<String>,
    pub old_values: Option<Value>,
    pub new_values: Option<Value>,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub async fn list_audit_logs(
    State(state): State<AppState>,
    _user: AuthUser,
) -> Result<Json<Vec<AuditLogRecord>>, AppError> {
    let logs = sqlx::query_as!(
        AuditLogRecord,
        r#"
        SELECT id, user_id, username, action, entity, entity_id,
               old_values, new_values, ip_address, created_at
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 100
        "#
    )
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(logs))
}
