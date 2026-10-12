use crate::{domain::entities::UsedPartReturn, error::AppError};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct ReturnRepository {
    pool: PgPool,
}

impl ReturnRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list_returns(
        &self,
        wh_filter: &str,
        status_filter: &str,
        search: &str,
        mechanic_filter: &str,
        user_whs: &[String],
    ) -> Result<Vec<UsedPartReturn>, AppError> {
        let search_pattern = format!("%{}%", search);
        let mechanic_pattern = format!("%{}%", mechanic_filter);
        let items = sqlx::query_as::<_, UsedPartReturn>(
            r#"
            SELECT 
                r.id, r.return_number, r.issue_transaction_id, r.spare_part_id,
                p.part_name, r.qty, r.unit_of_measure, r.unit_number,
                r.mechanic_name, r.mechanic_id, r.warehouse_id,
                w.name as warehouse_name, r.status, r.current_holder_type,
                r.current_holder_name, r.container_received_at, r.container_received_by,
                uc.full_name as container_received_by_name, r.container_notes,
                r.container_photo_url, r.main_received_at, r.main_received_by,
                um.full_name as main_received_by_name, r.main_warehouse_id,
                r.main_notes, r.created_at, r.updated_at
            FROM used_part_returns r
            JOIN spare_parts p ON r.spare_part_id = p.id
            JOIN warehouses w ON r.warehouse_id = w.id
            LEFT JOIN users uc ON r.container_received_by = uc.id
            LEFT JOIN users um ON r.main_received_by = um.id
            WHERE ($1 = '' OR r.warehouse_id = $1)
              AND ($2 = '' OR r.status = $2)
              AND (
                  r.warehouse_id = ANY($7) 
                  OR r.main_warehouse_id = ANY($7)
                  OR r.warehouse_id IN (
                      SELECT sub_warehouse_id 
                      FROM warehouse_supply_links 
                      WHERE main_warehouse_id = ANY($7)
                  )
              )
              AND ($3 = '' OR r.return_number ILIKE $4 OR r.unit_number ILIKE $4 OR p.part_name ILIKE $4 OR r.mechanic_name ILIKE $4)
              AND ($5 = '' OR r.mechanic_id = $5 OR r.mechanic_name ILIKE $6)
            ORDER BY r.created_at DESC
            LIMIT 100
            "#,
        )
        .bind(wh_filter)
        .bind(status_filter)
        .bind(search)
        .bind(&search_pattern)
        .bind(mechanic_filter)
        .bind(&mechanic_pattern)
        .bind(user_whs)
        .fetch_all(&self.pool)
        .await?;

        Ok(items)
    }

    pub async fn get_return_by_id(&self, id: Uuid) -> Result<Option<UsedPartReturn>, AppError> {
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
        .fetch_optional(&self.pool)
        .await?;

        Ok(item)
    }
}
