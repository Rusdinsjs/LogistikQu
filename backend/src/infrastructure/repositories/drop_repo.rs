use crate::{
    domain::entities::{MainDrop, MainDropItemDetail},
    error::AppError,
};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct DropRepository {
    pool: PgPool,
}

impl DropRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list_drops(
        &self,
        wh_filter: &str,
        user_whs: &[String],
    ) -> Result<Vec<MainDrop>, AppError> {
        let items = sqlx::query_as!(
            MainDrop,
            r#"
            SELECT id, drop_number, request_id, main_warehouse_id,
                   container_warehouse_id, status, dropped_by, received_by,
                   shipped_at, received_at, notes
            FROM main_warehouse_drops
            WHERE ($1 = '' OR container_warehouse_id = $1)
              AND (main_warehouse_id = ANY($2) OR container_warehouse_id = ANY($2))
            ORDER BY shipped_at DESC
            LIMIT 100
            "#,
            wh_filter,
            user_whs
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(items)
    }

    pub async fn get_drop_by_id(&self, id: Uuid) -> Result<Option<MainDrop>, AppError> {
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
        .fetch_optional(&self.pool)
        .await?;

        Ok(drop)
    }

    pub async fn get_drop_items(&self, drop_id: Uuid) -> Result<Vec<MainDropItemDetail>, AppError> {
        let items = sqlx::query_as!(
            MainDropItemDetail,
            r#"
            SELECT i.id, i.drop_id, i.spare_part_id, p.part_name,
                   i.qty, p.unit_of_measure
            FROM main_warehouse_drop_items i
            JOIN spare_parts p ON i.spare_part_id = p.id
            WHERE i.drop_id = $1
            "#,
            drop_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(items)
    }
}
