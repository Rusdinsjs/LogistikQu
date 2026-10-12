use crate::{
    domain::{
        business_rules::KpiRules,
        entities::{EnterpriseKpiSummary, FastSlowMovingPartItem, StockAgingSummary},
    },
    error::AppError,
};
use rust_decimal::Decimal;
use sqlx::PgPool;

#[derive(Clone)]
pub struct DashboardRepository {
    pool: PgPool,
}

impl DashboardRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn get_enterprise_kpi_summary(
        &self,
        user_whs: &[String],
    ) -> Result<EnterpriseKpiSummary, AppError> {
        let is_all = user_whs.is_empty();

        let row = sqlx::query!(
            r#"
            SELECT
                COALESCE(SUM(s.qty_on_hand * COALESCE(p.unit_cost, 0)), 0::numeric) AS "total_stock_value!",
                COUNT(s.id) AS "total_inventory_items!",
                COUNT(DISTINCT s.warehouse_id) AS "total_warehouses!",
                COUNT(s.id) FILTER (WHERE s.qty_on_hand <= s.min_stock) AS "low_stock_items_count!"
            FROM inventory_stock s
            JOIN spare_parts p ON s.spare_part_id = p.id
            WHERE ($1 = TRUE OR s.warehouse_id = ANY($2))
            "#,
            is_all,
            user_whs
        )
        .fetch_one(&self.pool)
        .await?;

        let in_transit = sqlx::query_scalar!(
            r#"
            SELECT COALESCE(SUM(rri.shipped_qty), 0::numeric)
            FROM replenishment_requests rr
            JOIN replenishment_request_items rri ON rr.id = rri.request_id
            WHERE rr.status = 'IN_TRANSIT'
              AND ($1 = TRUE OR rr.container_warehouse_id = ANY($2) OR rr.main_warehouse_id = ANY($2))
            "#,
            is_all,
            user_whs
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(Decimal::ZERO);

        let pending_reqs = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)
            FROM replenishment_requests
            WHERE status IN ('REQUESTED', 'VERIFIED')
              AND ($1 = TRUE OR container_warehouse_id = ANY($2) OR main_warehouse_id = ANY($2))
            "#,
            is_all,
            user_whs
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let pending_adj = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)
            FROM stock_adjustments
            WHERE status = 'PENDING'
              AND ($1 = TRUE OR warehouse_id = ANY($2))
            "#,
            is_all,
            user_whs
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let pending_issues = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)
            FROM issue_transactions
            WHERE status = 'PENDING_APPROVAL'
              AND ($1 = TRUE OR warehouse_id = ANY($2))
            "#,
            is_all,
            user_whs
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        let stock_in_30d = sqlx::query_scalar!(
            r#"
            SELECT COALESCE(SUM(qty), 0::numeric)
            FROM stock_movements
            WHERE movement_type IN ('RECEIVE', 'TRANSFER')
              AND created_at >= NOW() - INTERVAL '30 days'
              AND ($1 = TRUE OR warehouse_id = ANY($2))
            "#,
            is_all,
            user_whs
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(Decimal::ZERO);

        let stock_out_30d = sqlx::query_scalar!(
            r#"
            SELECT COALESCE(SUM(qty), 0::numeric)
            FROM stock_movements
            WHERE movement_type IN ('ISSUE', 'DAMAGE', 'LOST')
              AND created_at >= NOW() - INTERVAL '30 days'
              AND ($1 = TRUE OR warehouse_id = ANY($2))
            "#,
            is_all,
            user_whs
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(Decimal::ZERO);

        Ok(EnterpriseKpiSummary {
            total_stock_value: row.total_stock_value,
            total_inventory_items: row.total_inventory_items,
            total_in_transit_qty: in_transit,
            pending_approvals_count: pending_reqs + pending_adj + pending_issues,
            stock_in_last_30d: stock_in_30d,
            stock_out_last_30d: stock_out_30d,
            total_warehouses: row.total_warehouses,
            low_stock_items_count: row.low_stock_items_count,
        })
    }

    pub async fn get_stock_velocity(
        &self,
        user_whs: &[String],
    ) -> Result<Vec<FastSlowMovingPartItem>, AppError> {
        let is_all = user_whs.is_empty();

        let rows = sqlx::query!(
            r#"
            SELECT
                p.id AS spare_part_id,
                p.part_name,
                c.name AS "category_name?",
                p.unit_of_measure,
                COALESCE(SUM(s.qty_on_hand), 0::numeric) AS "current_stock!",
                COALESCE(p.unit_cost, 0::numeric) AS "unit_cost!",
                COALESCE(SUM(s.qty_on_hand * COALESCE(p.unit_cost, 0)), 0::numeric) AS "total_value!",
                COALESCE((
                    SELECT SUM(iti.qty)
                    FROM issue_transaction_items iti
                    JOIN issue_transactions it ON iti.transaction_id = it.id
                    WHERE iti.spare_part_id = p.id
                      AND it.created_at >= NOW() - INTERVAL '30 days'
                      AND ($1 = TRUE OR it.warehouse_id = ANY($2))
                ), 0::numeric) AS "total_issued_30d!",
                COALESCE((
                    SELECT COUNT(DISTINCT it.id)
                    FROM issue_transaction_items iti
                    JOIN issue_transactions it ON iti.transaction_id = it.id
                    WHERE iti.spare_part_id = p.id
                      AND it.created_at >= NOW() - INTERVAL '30 days'
                      AND ($1 = TRUE OR it.warehouse_id = ANY($2))
                ), 0::bigint) AS "issue_frequency!",
                COALESCE(
                    EXTRACT(DAY FROM NOW() - (
                        SELECT MAX(created_at)
                        FROM stock_movements sm
                        WHERE sm.spare_part_id = p.id
                          AND ($1 = TRUE OR sm.warehouse_id = ANY($2))
                    ))::bigint,
                    999
                ) AS "days_since_last_movement!"
            FROM spare_parts p
            LEFT JOIN part_categories c ON p.category_id = c.id
            JOIN inventory_stock s ON p.id = s.spare_part_id
            WHERE ($1 = TRUE OR s.warehouse_id = ANY($2))
              AND p.deleted_at IS NULL
            GROUP BY p.id, p.part_name, c.name, p.unit_of_measure, p.unit_cost
            ORDER BY "total_issued_30d!" DESC, "total_value!" DESC
            "#,
            is_all,
            user_whs
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| {
                let velocity = KpiRules::classify_velocity(r.total_issued_30d, r.issue_frequency);

                FastSlowMovingPartItem {
                    spare_part_id: r.spare_part_id,
                    part_name: r.part_name,
                    category_name: r.category_name,
                    unit_of_measure: r.unit_of_measure,
                    current_stock: r.current_stock,
                    unit_cost: r.unit_cost,
                    total_value: r.total_value,
                    total_issued_30d: r.total_issued_30d,
                    issue_frequency: r.issue_frequency,
                    turnover_velocity: velocity.to_string(),
                    days_since_last_movement: r.days_since_last_movement,
                }
            })
            .collect();

        Ok(items)
    }

    pub async fn get_stock_aging_summary(
        &self,
        user_whs: &[String],
    ) -> Result<StockAgingSummary, AppError> {
        let is_all = user_whs.is_empty();

        let row = sqlx::query!(
            r#"
            WITH stock_age AS (
                SELECT
                    s.id,
                    (s.qty_on_hand * COALESCE(p.unit_cost, 0)) AS val,
                    COALESCE(
                        EXTRACT(DAY FROM NOW() - (
                            SELECT MAX(created_at)
                            FROM stock_movements sm
                            WHERE sm.spare_part_id = s.spare_part_id
                              AND sm.warehouse_id = s.warehouse_id
                        ))::bigint,
                        EXTRACT(DAY FROM NOW() - s.updated_at)::bigint
                    ) AS age_days
                FROM inventory_stock s
                JOIN spare_parts p ON s.spare_part_id = p.id
                WHERE ($1 = TRUE OR s.warehouse_id = ANY($2))
            )
            SELECT
                COALESCE(SUM(val) FILTER (WHERE age_days <= 30), 0::numeric) AS "val_under_30!",
                COUNT(id) FILTER (WHERE age_days <= 30) AS "cnt_under_30!",
                COALESCE(SUM(val) FILTER (WHERE age_days > 30 AND age_days <= 90), 0::numeric) AS "val_31_to_90!",
                COUNT(id) FILTER (WHERE age_days > 30 AND age_days <= 90) AS "cnt_31_to_90!",
                COALESCE(SUM(val) FILTER (WHERE age_days > 90 AND age_days <= 180), 0::numeric) AS "val_91_to_180!",
                COUNT(id) FILTER (WHERE age_days > 90 AND age_days <= 180) AS "cnt_91_to_180!",
                COALESCE(SUM(val) FILTER (WHERE age_days > 180), 0::numeric) AS "val_over_180!",
                COUNT(id) FILTER (WHERE age_days > 180) AS "cnt_over_180!"
            FROM stock_age
            "#,
            is_all,
            user_whs
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(StockAgingSummary {
            age_under_30_days_value: row.val_under_30,
            age_under_30_days_count: row.cnt_under_30,
            age_31_to_90_days_value: row.val_31_to_90,
            age_31_to_90_days_count: row.cnt_31_to_90,
            age_91_to_180_days_value: row.val_91_to_180,
            age_91_to_180_days_count: row.cnt_91_to_180,
            age_over_180_days_value: row.val_over_180,
            age_over_180_days_count: row.cnt_over_180,
        })
    }
}
