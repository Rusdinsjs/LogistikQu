use crate::{
    domain::entities::{CreateNotificationRequest, Notification, NotificationQuery},
    error::AppError,
};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct NotificationRepository {
    pool: PgPool,
}

impl NotificationRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list_notifications(
        &self,
        user_id: Uuid,
        role_id: &str,
        query: &NotificationQuery,
    ) -> Result<Vec<Notification>, AppError> {
        let channel_filter = query.channel.as_deref().unwrap_or("");
        let trigger_filter = query.trigger_type.as_deref().unwrap_or("");
        let limit = query.limit.unwrap_or(30).min(100);
        let offset = query.page.unwrap_or(0) * limit;

        let rows = sqlx::query_as!(
            Notification,
            r#"
            SELECT
                id, user_id, recipient_role, recipient_email, recipient_phone,
                title, message, channel,
                COALESCE(trigger_type, notification_type, 'LOW_STOCK') AS "trigger_type!",
                reference_id, metadata,
                is_read, read_at,
                COALESCE(delivery_status, 'DELIVERED') AS "delivery_status!",
                created_at
            FROM notifications
            WHERE ($2 = 'SUPER_ADMIN' OR user_id = $1 OR recipient_role = $2 OR ($2 = 'SUPERVISOR' AND recipient_role LIKE 'SUPERVISOR%') OR (user_id IS NULL AND recipient_role IS NULL))
              AND ($3::boolean IS NULL OR is_read = $3)
              AND ($4 = '' OR channel = $4)
              AND ($5 = '' OR trigger_type = $5)
            ORDER BY created_at DESC
            LIMIT $6 OFFSET $7
            "#,
            user_id,
            role_id,
            query.is_read,
            channel_filter,
            trigger_filter,
            limit,
            offset
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    pub async fn create_notification(
        &self,
        req: &CreateNotificationRequest,
    ) -> Result<Notification, AppError> {
        let channel = req.channel.as_deref().unwrap_or("IN_APP");
        let trigger_type = &req.trigger_type;

        let row = sqlx::query_as!(
            Notification,
            r#"
            INSERT INTO notifications (
                user_id, recipient_role, recipient_email, recipient_phone,
                title, message, channel, trigger_type, notification_type,
                reference_id, metadata, delivery_status
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, $8, $8,
                $9, $10, 'DELIVERED'
            )
            RETURNING
                id, user_id, recipient_role, recipient_email, recipient_phone,
                title, message, channel,
                COALESCE(trigger_type, notification_type, 'LOW_STOCK') AS "trigger_type!",
                reference_id, metadata,
                is_read, read_at,
                COALESCE(delivery_status, 'DELIVERED') AS "delivery_status!",
                created_at
            "#,
            req.user_id,
            req.recipient_role,
            req.recipient_email,
            req.recipient_phone,
            req.title,
            req.message,
            channel,
            trigger_type,
            req.reference_id,
            req.metadata
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row)
    }

    pub async fn mark_as_read(&self, id: Uuid, user_id: Uuid) -> Result<bool, AppError> {
        let res = sqlx::query!(
            r#"
            UPDATE notifications
            SET is_read = TRUE, read_at = NOW()
            WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
            "#,
            id,
            user_id
        )
        .execute(&self.pool)
        .await?;

        Ok(res.rows_affected() > 0)
    }

    pub async fn mark_all_read(&self, user_id: Uuid, role_id: &str) -> Result<u64, AppError> {
        let res = sqlx::query!(
            r#"
            UPDATE notifications
            SET is_read = TRUE, read_at = NOW()
            WHERE ($2 = 'SUPER_ADMIN' OR user_id = $1 OR recipient_role = $2 OR ($2 = 'SUPERVISOR' AND recipient_role LIKE 'SUPERVISOR%')) AND is_read = FALSE
            "#,
            user_id,
            role_id
        )
        .execute(&self.pool)
        .await?;

        Ok(res.rows_affected())
    }

    pub async fn get_unread_count(&self, user_id: Uuid, role_id: &str) -> Result<i64, AppError> {
        let count = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)
            FROM notifications
            WHERE ($2 = 'SUPER_ADMIN' OR user_id = $1 OR recipient_role = $2 OR ($2 = 'SUPERVISOR' AND recipient_role LIKE 'SUPERVISOR%') OR (user_id IS NULL AND recipient_role IS NULL))
              AND is_read = FALSE
            "#,
            user_id,
            role_id
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        Ok(count)
    }
}
