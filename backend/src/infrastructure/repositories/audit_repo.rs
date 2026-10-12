use crate::{
    domain::entities::{AuditLogQuery, AuditLogRecord, PaginatedResponse},
    error::AppError,
};
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct AuditRepository {
    pool: PgPool,
}

impl AuditRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn record_log_full(
        &self,
        user_id: Option<Uuid>,
        username: Option<&str>,
        action: &str,
        entity: &str,
        entity_id: Option<&str>,
        old_value: Option<Value>,
        new_value: Option<Value>,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<(), AppError> {
        let _ = sqlx::query!(
            r#"
            INSERT INTO audit_logs (
                user_id, username, action, entity, entity_id,
                old_value, new_value, old_values, new_values,
                ip_address, user_agent, timestamp, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $7, $8, $9, NOW(), NOW())
            "#,
            user_id,
            username,
            action,
            entity,
            entity_id,
            old_value,
            new_value,
            ip_address,
            user_agent
        )
        .execute(&self.pool)
        .await;

        Ok(())
    }

    pub async fn record_log(
        &self,
        user_id: Option<Uuid>,
        username: Option<&str>,
        action: &str,
        entity: &str,
        entity_id: Option<&str>,
        new_values: Option<Value>,
    ) -> Result<(), AppError> {
        self.record_log_full(
            user_id, username, action, entity, entity_id, None, new_values, None, None,
        )
        .await
    }

    pub async fn list_logs(&self) -> Result<Vec<AuditLogRecord>, AppError> {
        let logs = sqlx::query_as!(
            AuditLogRecord,
            r#"
            SELECT id, user_id, username, action, entity, entity_id,
                   old_value, new_value, old_values, new_values,
                   ip_address, user_agent, timestamp as "timestamp!", created_at
            FROM audit_logs
            ORDER BY timestamp DESC
            LIMIT 100
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(logs)
    }

    pub async fn list_logs_paginated(
        &self,
        query: AuditLogQuery,
    ) -> Result<PaginatedResponse<AuditLogRecord>, AppError> {
        let page = query.page.unwrap_or(1).max(1);
        let limit = query.limit.unwrap_or(20).clamp(1, 100);
        let offset = (page - 1) * limit;

        let total = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) FROM audit_logs
            WHERE ($1::text IS NULL OR action = $1)
              AND ($2::text IS NULL OR entity = $2)
              AND ($3::uuid IS NULL OR user_id = $3)
            "#,
            query.action,
            query.entity,
            query.user_id
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let data = sqlx::query_as!(
            AuditLogRecord,
            r#"
            SELECT id, user_id, username, action, entity, entity_id,
                   old_value, new_value, old_values, new_values,
                   ip_address, user_agent, timestamp as "timestamp!", created_at
            FROM audit_logs
            WHERE ($1::text IS NULL OR action = $1)
              AND ($2::text IS NULL OR entity = $2)
              AND ($3::uuid IS NULL OR user_id = $3)
            ORDER BY timestamp DESC
            LIMIT $4 OFFSET $5
            "#,
            query.action,
            query.entity,
            query.user_id,
            limit,
            offset
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(PaginatedResponse::new(data, total, page, limit))
    }
}
