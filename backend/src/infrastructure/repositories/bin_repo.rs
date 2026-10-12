use crate::{domain::entities::WarehouseBinItem, error::AppError};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct BinRepository {
    pool: PgPool,
}

impl BinRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list_bins(&self, warehouse_id: &str) -> Result<Vec<WarehouseBinItem>, AppError> {
        let bins = sqlx::query_as!(
            WarehouseBinItem,
            r#"
            SELECT 
                b.id, b.warehouse_id, b.bin_code, b.zone, b.shelf_level, b.capacity_parts, b.description, b.is_active, b.created_at,
                COUNT(s.id) as current_items_count,
                COALESCE(SUM(s.qty_on_hand), 0) as total_qty,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'spare_part_id', s.spare_part_id,
                            'part_name', p.part_name,
                            'qty_on_hand', s.qty_on_hand,
                            'unit_of_measure', p.unit_of_measure,
                            'status', CASE 
                                WHEN s.qty_on_hand <= s.min_stock THEN 'CRITICAL'
                                WHEN s.qty_on_hand <= s.min_stock * 1.25 THEN 'WARNING'
                                ELSE 'NORMAL'
                            END
                        )
                    ) FILTER (WHERE s.spare_part_id IS NOT NULL), '[]'::json
                ) as "parts!"
            FROM warehouse_bins b
            LEFT JOIN inventory_stock s ON s.warehouse_id = b.warehouse_id AND s.rack_location = b.bin_code
            LEFT JOIN spare_parts p ON s.spare_part_id = p.id
            WHERE b.warehouse_id = $1
            GROUP BY b.id
            ORDER BY b.zone, b.shelf_level, b.bin_code
            "#,
            warehouse_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(bins)
    }

    #[allow(dead_code)]
    pub async fn get_bin_by_id(
        &self,
        warehouse_id: &str,
        bin_id: Uuid,
    ) -> Result<Option<WarehouseBinItem>, AppError> {
        let bin = sqlx::query_as!(
            WarehouseBinItem,
            r#"
            SELECT 
                b.id, b.warehouse_id, b.bin_code, b.zone, b.shelf_level, b.capacity_parts, b.description, b.is_active, b.created_at,
                COUNT(s.id) as current_items_count,
                COALESCE(SUM(s.qty_on_hand), 0) as total_qty,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'spare_part_id', s.spare_part_id,
                            'part_name', p.part_name,
                            'qty_on_hand', s.qty_on_hand,
                            'unit_of_measure', p.unit_of_measure,
                            'status', CASE 
                                WHEN s.qty_on_hand <= s.min_stock THEN 'CRITICAL'
                                WHEN s.qty_on_hand <= s.min_stock * 1.25 THEN 'WARNING'
                                ELSE 'NORMAL'
                            END
                        )
                    ) FILTER (WHERE s.spare_part_id IS NOT NULL), '[]'::json
                ) as "parts!"
            FROM warehouse_bins b
            LEFT JOIN inventory_stock s ON s.warehouse_id = b.warehouse_id AND s.rack_location = b.bin_code
            LEFT JOIN spare_parts p ON s.spare_part_id = p.id
            WHERE b.warehouse_id = $1 AND b.id = $2
            GROUP BY b.id
            "#,
            warehouse_id,
            bin_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(bin)
    }
}
