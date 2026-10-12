use crate::{
    domain::entities::{StockAdjustmentHeader, StockAdjustmentItemDetail},
    error::AppError,
};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct AdjustmentRepository {
    pool: PgPool,
}

impl AdjustmentRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list_adjustments(
        &self,
        wh_filter: &str,
        user_whs: &[String],
    ) -> Result<Vec<StockAdjustmentHeader>, AppError> {
        let items = sqlx::query_as!(
            StockAdjustmentHeader,
            r#"
            SELECT id, adjustment_number, warehouse_id, reason, notes,
                   status, created_by, approved_by, approved_at, created_at
            FROM stock_adjustments
            WHERE ($1 = '' OR warehouse_id = $1)
              AND warehouse_id = ANY($2)
            ORDER BY created_at DESC
            LIMIT 100
            "#,
            wh_filter,
            user_whs
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(items)
    }

    #[allow(dead_code)]
    pub async fn get_adjustment_by_id(
        &self,
        id: Uuid,
    ) -> Result<Option<StockAdjustmentHeader>, AppError> {
        let adj = sqlx::query_as!(
            StockAdjustmentHeader,
            r#"
            SELECT id, adjustment_number, warehouse_id, reason, notes,
                   status, created_by, approved_by, approved_at, created_at
            FROM stock_adjustments
            WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(adj)
    }

    pub async fn get_adjustment_items(
        &self,
        adj_id: Uuid,
    ) -> Result<Vec<StockAdjustmentItemDetail>, AppError> {
        let items = sqlx::query_as!(
            StockAdjustmentItemDetail,
            r#"
            SELECT i.id, i.adjustment_id, i.spare_part_id, p.part_name,
                   i.qty_system, i.qty_physical, i.difference
            FROM stock_adjustment_items i
            JOIN spare_parts p ON i.spare_part_id = p.id
            WHERE i.adjustment_id = $1
            "#,
            adj_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(items)
    }
}
