use crate::{
    domain::{
        business_rules::ReplenishmentRules,
        entities::{
            RecommendationItem, ReplenishmentIntelligenceItem, ReplenishmentItemDetail,
            ReplenishmentRequest,
        },
    },
    error::AppError,
};
use chrono::{Datelike, Utc};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct ReplenishmentRepository {
    pool: PgPool,
}

impl ReplenishmentRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn get_recommendations(
        &self,
        warehouse_id: &str,
    ) -> Result<Vec<RecommendationItem>, AppError> {
        let intel = self.get_replenishment_intelligence(warehouse_id).await?;

        let recs = intel
            .into_iter()
            .map(|i| {
                let rec_qty = if i.recommended_purchase_qty > Decimal::ZERO {
                    i.recommended_purchase_qty
                } else if i.current_stock <= i.min_stock {
                    let diff = i.max_stock - i.current_stock;
                    if diff > Decimal::ZERO {
                        diff
                    } else {
                        Decimal::ZERO
                    }
                } else {
                    Decimal::ZERO
                };

                RecommendationItem {
                    spare_part_id: i.spare_part_id,
                    part_name: i.part_name,
                    unit_of_measure: i.unit_of_measure,
                    current_stock: i.current_stock,
                    min_stock: i.min_stock,
                    max_stock: i.max_stock,
                    safety_stock: i.safety_stock,
                    lead_time_days: i.lead_time_days,
                    avg_daily_usage: i.avg_daily_usage,
                    recommended_order_qty: rec_qty,
                    reorder_point: Some(i.reorder_point),
                    in_transit_qty: Some(i.in_transit_qty),
                    moving_avg_7d: Some(i.moving_avg_7d),
                    moving_avg_30d: Some(i.moving_avg_30d),
                    moving_avg_90d: Some(i.moving_avg_90d),
                    consumption_trend: Some(i.consumption_trend),
                    seasonal_factor: Some(i.seasonal_factor),
                }
            })
            .collect();

        Ok(recs)
    }

    pub async fn get_replenishment_intelligence(
        &self,
        warehouse_id: &str,
    ) -> Result<Vec<ReplenishmentIntelligenceItem>, AppError> {
        let current_month = Utc::now().month();

        let rows = sqlx::query!(
            r#"
            SELECT
                s.spare_part_id,
                p.part_name,
                c.name as category_name,
                p.unit_of_measure,
                s.qty_on_hand,
                s.min_stock,
                s.max_stock,
                s.safety_stock,
                p.lead_time_days,
                COALESCE((
                    SELECT SUM(rri.shipped_qty)
                    FROM replenishment_requests rr
                    JOIN replenishment_request_items rri ON rr.id = rri.request_id
                    WHERE rr.container_warehouse_id = s.warehouse_id
                      AND rr.status = 'IN_TRANSIT'
                      AND rri.spare_part_id = s.spare_part_id
                ), 0::numeric) as in_transit_qty,
                COALESCE((
                    SELECT SUM(i.qty)
                    FROM issue_transaction_items i
                    JOIN issue_transactions t ON i.transaction_id = t.id
                    WHERE i.spare_part_id = s.spare_part_id
                      AND t.warehouse_id = s.warehouse_id
                      AND t.created_at >= NOW() - INTERVAL '7 days'
                ), 0::numeric) as usage_7d,
                COALESCE((
                    SELECT SUM(i.qty)
                    FROM issue_transaction_items i
                    JOIN issue_transactions t ON i.transaction_id = t.id
                    WHERE i.spare_part_id = s.spare_part_id
                      AND t.warehouse_id = s.warehouse_id
                      AND t.created_at >= NOW() - INTERVAL '30 days'
                ), 0::numeric) as usage_30d,
                COALESCE((
                    SELECT SUM(i.qty)
                    FROM issue_transaction_items i
                    JOIN issue_transactions t ON i.transaction_id = t.id
                    WHERE i.spare_part_id = s.spare_part_id
                      AND t.warehouse_id = s.warehouse_id
                      AND t.created_at >= NOW() - INTERVAL '60 days'
                      AND t.created_at < NOW() - INTERVAL '30 days'
                ), 0::numeric) as usage_prior_30d,
                COALESCE((
                    SELECT SUM(i.qty)
                    FROM issue_transaction_items i
                    JOIN issue_transactions t ON i.transaction_id = t.id
                    WHERE i.spare_part_id = s.spare_part_id
                      AND t.warehouse_id = s.warehouse_id
                      AND t.created_at >= NOW() - INTERVAL '90 days'
                ), 0::numeric) as usage_90d
            FROM inventory_stock s
            JOIN spare_parts p ON s.spare_part_id = p.id
            LEFT JOIN part_categories c ON p.category_id = c.id
            WHERE s.warehouse_id = $1
            ORDER BY
                CASE WHEN s.qty_on_hand <= s.min_stock THEN 1 ELSE 2 END,
                s.qty_on_hand ASC
            "#,
            warehouse_id
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| {
                let current_stock = r.qty_on_hand;
                let in_transit_qty = r.in_transit_qty.unwrap_or(Decimal::ZERO);
                let effective_stock = current_stock + in_transit_qty;

                let usage_7d = r.usage_7d.unwrap_or(Decimal::ZERO);
                let usage_30d = r.usage_30d.unwrap_or(Decimal::ZERO);
                let usage_prior_30d = r.usage_prior_30d.unwrap_or(Decimal::ZERO);
                let usage_90d = r.usage_90d.unwrap_or(Decimal::ZERO);

                let moving_avg_7d = (usage_7d / Decimal::from(7)).round_dp(2);
                let moving_avg_30d = (usage_30d / Decimal::from(30)).round_dp(2);
                let moving_avg_90d = (usage_90d / Decimal::from(90)).round_dp(2);

                let avg_daily_usage = if moving_avg_30d > Decimal::ZERO {
                    moving_avg_30d
                } else {
                    Decimal::new(5, 1) // default 0.5 usage
                };

                let (trend_percentage, trend_dir) =
                    ReplenishmentRules::calculate_trend(usage_30d, usage_prior_30d);

                let category_name_str = r.category_name.clone();
                let (seasonal_factor, seasonal_desc) =
                    ReplenishmentRules::get_seasonal_analysis(current_month, &category_name_str);

                let reorder_point = ReplenishmentRules::calculate_reorder_point(
                    avg_daily_usage,
                    r.lead_time_days,
                    r.safety_stock,
                );

                let is_reorder_needed = effective_stock <= reorder_point;

                let recommended_purchase_qty =
                    ReplenishmentRules::calculate_recommended_purchase_qty(
                        current_stock,
                        in_transit_qty,
                        reorder_point,
                        r.max_stock,
                    );

                ReplenishmentIntelligenceItem {
                    spare_part_id: r.spare_part_id,
                    part_name: r.part_name,
                    category_name: Some(r.category_name),
                    unit_of_measure: r.unit_of_measure,
                    current_stock,
                    in_transit_qty,
                    effective_stock,
                    min_stock: r.min_stock,
                    max_stock: r.max_stock,
                    safety_stock: r.safety_stock,
                    lead_time_days: r.lead_time_days,
                    avg_daily_usage,
                    moving_avg_7d,
                    moving_avg_30d,
                    moving_avg_90d,
                    consumption_trend: trend_dir.to_string(),
                    trend_percentage,
                    seasonal_factor,
                    seasonal_description: seasonal_desc.to_string(),
                    reorder_point,
                    is_reorder_needed,
                    recommended_purchase_qty,
                }
            })
            .collect();

        Ok(items)
    }

    #[allow(dead_code)]
    pub async fn list_requests(
        &self,
        wh_filter: &str,
        status_filter: &str,
        user_whs: &[String],
    ) -> Result<Vec<ReplenishmentRequest>, AppError> {
        let requests = sqlx::query_as!(
            ReplenishmentRequest,
            r#"
            SELECT id, request_number, container_warehouse_id, main_warehouse_id,
                   status, notes, admin_notes, supervisor_notes, requested_by,
                   verified_by, verified_at, approved_by, approved_at,
                   shipped_by, shipped_at, received_by, received_at,
                   created_at, updated_at
            FROM replenishment_requests
            WHERE ($1 = '' OR container_warehouse_id = $1)
              AND ($2 = '' OR status = $2)
              AND (container_warehouse_id = ANY($3) OR main_warehouse_id = ANY($3))
            ORDER BY created_at DESC
            LIMIT 100
            "#,
            wh_filter,
            status_filter,
            user_whs
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(requests)
    }

    pub async fn get_request_by_id(
        &self,
        id: Uuid,
    ) -> Result<Option<ReplenishmentRequest>, AppError> {
        let req = sqlx::query_as!(
            ReplenishmentRequest,
            r#"
            SELECT id, request_number, container_warehouse_id, main_warehouse_id,
                   status, notes, admin_notes, supervisor_notes, requested_by,
                   verified_by, verified_at, approved_by, approved_at,
                   shipped_by, shipped_at, received_by, received_at,
                   created_at, updated_at
            FROM replenishment_requests
            WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(req)
    }

    pub async fn get_request_items(
        &self,
        request_id: Uuid,
    ) -> Result<Vec<ReplenishmentItemDetail>, AppError> {
        let items = sqlx::query_as!(
            ReplenishmentItemDetail,
            r#"
            SELECT i.id, i.request_id, i.spare_part_id, p.part_name,
                   i.requested_qty, i.recommended_qty, i.verified_qty,
                   i.approved_qty, i.shipped_qty, i.received_qty,
                   p.unit_of_measure, i.notes
            FROM replenishment_request_items i
            JOIN spare_parts p ON i.spare_part_id = p.id
            WHERE i.request_id = $1
            "#,
            request_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(items)
    }

    pub async fn get_drop_by_request_id(
        &self,
        request_id: Uuid,
    ) -> Result<Option<serde_json::Value>, AppError> {
        let row = sqlx::query!(
            r#"
            SELECT id, drop_number, main_warehouse_id, container_warehouse_id, status, shipped_at, notes
            FROM main_warehouse_drops
            WHERE request_id = $1
            LIMIT 1
            "#,
            request_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| {
            serde_json::json!({
                "id": r.id,
                "drop_number": r.drop_number,
                "main_warehouse_id": r.main_warehouse_id,
                "container_warehouse_id": r.container_warehouse_id,
                "status": r.status,
                "shipped_at": r.shipped_at,
                "notes": r.notes
            })
        }))
    }
}
