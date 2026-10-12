use crate::{
    domain::entities::{
        ConsumptionTrendReportItem, EquipmentConsumptionReportItem, IssueHistoryReportItem,
        ReplenishmentEfficiencyReportItem, StockAgingReportItem, StockBalanceReportItem,
        StockValuationReportItem, WarehousePerformanceReportItem,
    },
    error::AppError,
};
use rust_decimal::Decimal;
use serde::Serialize;
use sqlx::PgPool;

#[derive(Debug, Serialize)]
pub struct UnitConsumptionReport {
    pub unit_number: String,
    pub unit_name: String,
    pub unit_type: String,
    pub total_transactions: i64,
    pub total_parts_consumed: Decimal,
}

#[derive(Debug, Serialize)]
pub struct SiteConsumptionReport {
    pub site_id: String,
    pub site_name: String,
    pub total_transactions: i64,
    pub total_parts_consumed: Decimal,
}

#[derive(Debug, Serialize)]
pub struct MechanicConsumptionReport {
    pub mechanic_name: String,
    pub total_jobs: i64,
    pub total_parts_installed: Decimal,
}

#[derive(Clone)]
pub struct ReportService {
    pool: PgPool,
}

impl ReportService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    // --- Legacy / Basic Operational Reports (Preserved 100% Backward Compatibility) ---

    pub async fn report_by_unit(&self) -> Result<Vec<UnitConsumptionReport>, AppError> {
        let rows = sqlx::query!(
            r#"
            SELECT
                t.unit_number,
                t.unit_name,
                t.unit_type,
                COUNT(DISTINCT t.id)::bigint as total_tx,
                COALESCE(SUM(i.qty), 0) as total_qty
            FROM issue_transactions t
            JOIN issue_transaction_items i ON t.id = i.transaction_id
            WHERE t.status = 'COMPLETED'
            GROUP BY t.unit_number, t.unit_name, t.unit_type
            ORDER BY total_qty DESC
            LIMIT 50
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| UnitConsumptionReport {
                unit_number: r.unit_number,
                unit_name: r.unit_name,
                unit_type: r.unit_type,
                total_transactions: r.total_tx.unwrap_or(0),
                total_parts_consumed: r.total_qty.unwrap_or(Decimal::ZERO),
            })
            .collect();

        Ok(items)
    }

    pub async fn report_by_site(&self) -> Result<Vec<SiteConsumptionReport>, AppError> {
        let rows = sqlx::query!(
            r#"
            SELECT
                t.site_id,
                COALESCE(s.name, t.site_id) as site_name,
                COUNT(DISTINCT t.id)::bigint as total_tx,
                COALESCE(SUM(i.qty), 0) as total_qty
            FROM issue_transactions t
            JOIN issue_transaction_items i ON t.id = i.transaction_id
            LEFT JOIN sites s ON t.site_id = s.id
            WHERE t.status = 'COMPLETED'
            GROUP BY t.site_id, s.name
            ORDER BY total_qty DESC
            LIMIT 50
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| SiteConsumptionReport {
                site_id: r.site_id,
                site_name: r.site_name.unwrap_or_else(|| "-".to_string()),
                total_transactions: r.total_tx.unwrap_or(0),
                total_parts_consumed: r.total_qty.unwrap_or(Decimal::ZERO),
            })
            .collect();

        Ok(items)
    }

    pub async fn report_by_mechanic(&self) -> Result<Vec<MechanicConsumptionReport>, AppError> {
        let rows = sqlx::query!(
            r#"
            SELECT
                t.mechanic_name,
                COUNT(DISTINCT t.id)::bigint as total_jobs,
                COALESCE(SUM(i.qty), 0) as total_qty
            FROM issue_transactions t
            JOIN issue_transaction_items i ON t.id = i.transaction_id
            WHERE t.status = 'COMPLETED'
            GROUP BY t.mechanic_name
            ORDER BY total_qty DESC
            LIMIT 50
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| MechanicConsumptionReport {
                mechanic_name: r.mechanic_name,
                total_jobs: r.total_jobs.unwrap_or(0),
                total_parts_installed: r.total_qty.unwrap_or(Decimal::ZERO),
            })
            .collect();

        Ok(items)
    }

    // --- Phase 11: Enterprise Inventory Reports ---

    pub async fn stock_balance_report(
        &self,
        warehouse_id: Option<&str>,
    ) -> Result<Vec<StockBalanceReportItem>, AppError> {
        let rows = sqlx::query!(
            r#"
            SELECT
                s.spare_part_id,
                p.part_name,
                c.name as category_name,
                s.warehouse_id,
                w.name as warehouse_name,
                s.rack_location,
                s.qty_on_hand,
                s.min_stock,
                s.max_stock,
                s.safety_stock,
                p.unit_of_measure,
                CASE
                    WHEN s.qty_on_hand <= s.min_stock THEN 'CRITICAL'
                    WHEN s.qty_on_hand <= (s.min_stock * 1.2) THEN 'WARNING'
                    ELSE 'NORMAL'
                END as status
            FROM inventory_stock s
            JOIN spare_parts p ON s.spare_part_id = p.id
            JOIN warehouses w ON s.warehouse_id = w.id
            LEFT JOIN part_categories c ON p.category_id = c.id
            WHERE ($1::text IS NULL OR s.warehouse_id = $1)
            ORDER BY s.warehouse_id, s.spare_part_id
            "#,
            warehouse_id
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| StockBalanceReportItem {
                spare_part_id: r.spare_part_id,
                part_name: r.part_name,
                category_name: Some(r.category_name),
                warehouse_id: r.warehouse_id,
                warehouse_name: r.warehouse_name,
                rack_location: r.rack_location,
                qty_on_hand: r.qty_on_hand,
                min_stock: r.min_stock,
                max_stock: r.max_stock,
                safety_stock: r.safety_stock,
                unit_of_measure: r.unit_of_measure,
                status: r.status.unwrap_or_else(|| "NORMAL".to_string()),
            })
            .collect();

        Ok(items)
    }

    pub async fn stock_valuation_report(
        &self,
        warehouse_id: Option<&str>,
    ) -> Result<Vec<StockValuationReportItem>, AppError> {
        let rows = sqlx::query!(
            r#"
            WITH total AS (
                SELECT COALESCE(SUM(s.qty_on_hand * COALESCE(p.unit_cost, 0)), 0::numeric) as overall_val
                FROM inventory_stock s
                JOIN spare_parts p ON s.spare_part_id = p.id
                WHERE ($1::text IS NULL OR s.warehouse_id = $1)
            )
            SELECT
                s.spare_part_id,
                p.part_name,
                c.name as category_name,
                s.warehouse_id,
                w.name as warehouse_name,
                s.qty_on_hand,
                COALESCE(p.unit_cost, 0::numeric) as "unit_cost!",
                (s.qty_on_hand * COALESCE(p.unit_cost, 0)) as "total_value!",
                CASE 
                    WHEN (SELECT overall_val FROM total) > 0 
                    THEN ROUND(((s.qty_on_hand * COALESCE(p.unit_cost, 0)) / (SELECT overall_val FROM total)) * 100, 2)
                    ELSE 0::numeric
                END as "share_percentage!"
            FROM inventory_stock s
            JOIN spare_parts p ON s.spare_part_id = p.id
            JOIN warehouses w ON s.warehouse_id = w.id
            LEFT JOIN part_categories c ON p.category_id = c.id
            WHERE ($1::text IS NULL OR s.warehouse_id = $1)
            ORDER BY (s.qty_on_hand * COALESCE(p.unit_cost, 0)) DESC
            "#,
            warehouse_id
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| StockValuationReportItem {
                spare_part_id: r.spare_part_id,
                part_name: r.part_name,
                category_name: Some(r.category_name),
                warehouse_id: r.warehouse_id,
                warehouse_name: r.warehouse_name,
                qty_on_hand: r.qty_on_hand,
                unit_cost: r.unit_cost,
                total_value: r.total_value,
                share_percentage: r.share_percentage,
            })
            .collect();

        Ok(items)
    }

    pub async fn stock_aging_report(
        &self,
        warehouse_id: Option<&str>,
    ) -> Result<Vec<StockAgingReportItem>, AppError> {
        let rows = sqlx::query!(
            r#"
            SELECT
                s.spare_part_id,
                p.part_name,
                s.warehouse_id,
                w.name as warehouse_name,
                s.qty_on_hand as "qty!",
                COALESCE(p.unit_cost, 0::numeric) as "unit_cost!",
                (s.qty_on_hand * COALESCE(p.unit_cost, 0)) as "total_value!",
                COALESCE(EXTRACT(DAY FROM (NOW() - MAX(sm.created_at)))::bigint, 0) as "days_in_inventory!",
                CASE
                    WHEN COALESCE(EXTRACT(DAY FROM (NOW() - MAX(sm.created_at)))::bigint, 0) <= 30 THEN '< 30 Hari'
                    WHEN COALESCE(EXTRACT(DAY FROM (NOW() - MAX(sm.created_at)))::bigint, 0) <= 90 THEN '31-90 Hari'
                    WHEN COALESCE(EXTRACT(DAY FROM (NOW() - MAX(sm.created_at)))::bigint, 0) <= 180 THEN '91-180 Hari'
                    ELSE '> 180 Hari'
                END as "aging_bucket!"
            FROM inventory_stock s
            JOIN spare_parts p ON s.spare_part_id = p.id
            JOIN warehouses w ON s.warehouse_id = w.id
            LEFT JOIN stock_movements sm ON s.warehouse_id = sm.warehouse_id AND s.spare_part_id = sm.spare_part_id
            WHERE ($1::text IS NULL OR s.warehouse_id = $1)
            GROUP BY s.spare_part_id, p.part_name, s.warehouse_id, w.name, s.qty_on_hand, p.unit_cost
            ORDER BY MAX(sm.created_at) ASC NULLS LAST
            "#,
            warehouse_id
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| StockAgingReportItem {
                spare_part_id: r.spare_part_id,
                part_name: r.part_name,
                warehouse_id: r.warehouse_id,
                warehouse_name: r.warehouse_name,
                qty: r.qty,
                unit_cost: r.unit_cost,
                total_value: r.total_value,
                days_in_inventory: r.days_in_inventory,
                aging_bucket: r.aging_bucket,
            })
            .collect();

        Ok(items)
    }

    // --- Phase 11: Enterprise Operational Reports ---

    pub async fn issue_history_report(
        &self,
        warehouse_id: Option<&str>,
        unit_number: Option<&str>,
        limit: Option<i64>,
    ) -> Result<Vec<IssueHistoryReportItem>, AppError> {
        let max_limit = limit.unwrap_or(100).min(500);

        let rows = sqlx::query!(
            r#"
            SELECT
                t.transaction_number,
                t.created_at as issued_at,
                t.warehouse_id,
                t.unit_number,
                t.hm_km,
                t.site_id,
                t.receiver_name,
                t.mechanic_name,
                t.work_order_number,
                i.spare_part_id,
                p.part_name,
                i.qty,
                COALESCE(i.unit_price, p.unit_cost, 0::numeric) as "unit_price!",
                COALESCE(i.total_price, i.qty * COALESCE(p.unit_cost, 0), 0::numeric) as "total_price!"
            FROM issue_transactions t
            JOIN issue_transaction_items i ON t.id = i.transaction_id
            JOIN spare_parts p ON i.spare_part_id = p.id
            WHERE ($1::text IS NULL OR t.warehouse_id = $1)
              AND ($2::text IS NULL OR t.unit_number ILIKE '%' || $2 || '%')
            ORDER BY t.created_at DESC
            LIMIT $3
            "#,
            warehouse_id,
            unit_number,
            max_limit
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| IssueHistoryReportItem {
                transaction_number: r.transaction_number,
                issued_at: r.issued_at,
                warehouse_id: r.warehouse_id,
                unit_number: r.unit_number,
                hm_km: r.hm_km,
                site_id: r.site_id,
                receiver_name: r.receiver_name,
                mechanic_name: r.mechanic_name,
                work_order_number: r.work_order_number,
                spare_part_id: r.spare_part_id,
                part_name: r.part_name,
                qty: r.qty,
                unit_price: r.unit_price,
                total_price: r.total_price,
            })
            .collect();

        Ok(items)
    }

    pub async fn consumption_trend_report(
        &self,
        warehouse_id: Option<&str>,
    ) -> Result<Vec<ConsumptionTrendReportItem>, AppError> {
        let rows = sqlx::query!(
            r#"
            SELECT
                TO_CHAR(t.created_at, 'YYYY-MM') as "period!",
                COALESCE(c.name, 'Umum') as "category_name!",
                COUNT(DISTINCT t.id)::bigint as "total_transactions!",
                COALESCE(SUM(i.qty), 0::numeric) as "total_qty!",
                COALESCE(SUM(COALESCE(i.total_price, i.qty * COALESCE(p.unit_cost, 0))), 0::numeric) as "total_value!"
            FROM issue_transactions t
            JOIN issue_transaction_items i ON t.id = i.transaction_id
            JOIN spare_parts p ON i.spare_part_id = p.id
            LEFT JOIN part_categories c ON p.category_id = c.id
            WHERE t.status = 'COMPLETED'
              AND ($1::text IS NULL OR t.warehouse_id = $1)
            GROUP BY TO_CHAR(t.created_at, 'YYYY-MM'), c.name
            ORDER BY "period!" DESC, "total_value!" DESC
            LIMIT 50
            "#,
            warehouse_id
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| ConsumptionTrendReportItem {
                period: r.period,
                category_name: r.category_name,
                total_transactions: r.total_transactions,
                total_qty: r.total_qty,
                total_value: r.total_value,
            })
            .collect();

        Ok(items)
    }

    pub async fn equipment_consumption_report(
        &self,
        site_id: Option<&str>,
        unit_number: Option<&str>,
    ) -> Result<Vec<EquipmentConsumptionReportItem>, AppError> {
        let rows = sqlx::query!(
            r#"
            SELECT
                COALESCE(e.equipment_number, e.unit_number) as "equipment_number!",
                COALESCE(e.equipment_type_id, 'HE') as "equipment_type!",
                COALESCE(e.model, '-') as "model!",
                COALESCE(e.current_site_id, '-') as "site!",
                COALESCE(e.current_hm_km, 0::numeric) as "current_hm!",
                COUNT(DISTINCT t.id)::bigint as "total_transactions!",
                COALESCE(SUM(i.qty), 0::numeric) as "total_parts_qty!",
                COALESCE(SUM(COALESCE(i.total_price, i.qty * COALESCE(p.unit_cost, 0))), 0::numeric) as "total_cost!",
                CASE 
                    WHEN COALESCE(e.current_hm_km, 0) > 0 
                    THEN ROUND(COALESCE(SUM(COALESCE(i.total_price, i.qty * COALESCE(p.unit_cost, 0))), 0) / e.current_hm_km, 2)
                    ELSE 0::numeric
                END as "cost_per_hm!"
            FROM equipment e
            LEFT JOIN issue_transactions t ON e.unit_number = t.unit_number AND t.status = 'COMPLETED'
            LEFT JOIN issue_transaction_items i ON t.id = i.transaction_id
            LEFT JOIN spare_parts p ON i.spare_part_id = p.id
            WHERE ($1::text IS NULL OR e.current_site_id = $1)
              AND ($2::text IS NULL OR e.unit_number ILIKE '%' || $2 || '%')
            GROUP BY e.equipment_number, e.unit_number, e.equipment_type_id, e.model, e.current_site_id, e.current_hm_km
            ORDER BY "total_cost!" DESC
            LIMIT 50
            "#,
            site_id,
            unit_number
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| EquipmentConsumptionReportItem {
                equipment_number: r.equipment_number,
                equipment_type: r.equipment_type,
                model: r.model,
                site: r.site,
                current_hm: r.current_hm,
                total_transactions: r.total_transactions,
                total_parts_qty: r.total_parts_qty,
                total_cost: r.total_cost,
                cost_per_hm: r.cost_per_hm,
            })
            .collect();

        Ok(items)
    }

    // --- Phase 11: Enterprise Management Reports ---

    pub async fn warehouse_performance_report(
        &self,
    ) -> Result<Vec<WarehousePerformanceReportItem>, AppError> {
        let rows = sqlx::query!(
            r#"
            SELECT
                w.id as warehouse_id,
                w.name as warehouse_name,
                w.warehouse_type,
                COUNT(s.id)::bigint as "total_skus!",
                COALESCE(SUM(s.qty_on_hand * COALESCE(p.unit_cost, 0)), 0::numeric) as "total_valuation!",
                (
                    SELECT COUNT(id)::bigint 
                    FROM issue_transactions 
                    WHERE warehouse_id = w.id 
                      AND created_at >= NOW() - INTERVAL '30 days'
                ) as "total_issues_30d!",
                (
                    SELECT COUNT(id)::bigint 
                    FROM main_warehouse_drops 
                    WHERE main_warehouse_id = w.id OR container_warehouse_id = w.id
                ) as "total_drops_30d!",
                ROUND(
                    COALESCE(
                        (SELECT SUM(ABS(qty)) FROM stock_movements WHERE warehouse_id = w.id AND created_at >= NOW() - INTERVAL '30 days')
                        / NULLIF(SUM(s.qty_on_hand), 0),
                        0
                    ),
                    2
                ) as "turnover_ratio!",
                COUNT(s.id) FILTER (WHERE s.qty_on_hand <= s.min_stock)::bigint as "low_stock_count!"
            FROM warehouses w
            LEFT JOIN inventory_stock s ON w.id = s.warehouse_id
            LEFT JOIN spare_parts p ON s.spare_part_id = p.id
            WHERE w.is_active = true
            GROUP BY w.id, w.name, w.warehouse_type
            ORDER BY "total_valuation!" DESC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| WarehousePerformanceReportItem {
                warehouse_id: r.warehouse_id,
                warehouse_name: r.warehouse_name,
                warehouse_type: r.warehouse_type,
                total_skus: r.total_skus,
                total_valuation: r.total_valuation,
                total_issues_30d: r.total_issues_30d,
                total_drops_30d: r.total_drops_30d,
                turnover_ratio: r.turnover_ratio,
                low_stock_count: r.low_stock_count,
            })
            .collect();

        Ok(items)
    }

    pub async fn replenishment_efficiency_report(
        &self,
        warehouse_id: Option<&str>,
    ) -> Result<Vec<ReplenishmentEfficiencyReportItem>, AppError> {
        let rows = sqlx::query!(
            r#"
            SELECT
                r.request_number,
                r.container_warehouse_id,
                w.name as container_warehouse_name,
                r.status,
                r.created_at,
                r.verified_at,
                r.approved_at,
                r.received_at,
                CASE 
                    WHEN r.received_at IS NOT NULL 
                    THEN ROUND(EXTRACT(EPOCH FROM (r.received_at - r.created_at))::numeric / 3600, 1)
                    ELSE NULL
                END as lead_time_hours,
                COUNT(ri.id)::bigint as "items_requested!",
                COALESCE(SUM(ri.requested_qty), 0::numeric) as "total_qty_requested!",
                COALESCE(SUM(ri.received_qty), 0::numeric) as "total_qty_received!",
                CASE
                    WHEN COALESCE(SUM(ri.requested_qty), 0) > 0
                    THEN ROUND((COALESCE(SUM(ri.received_qty), 0) / SUM(ri.requested_qty)) * 100, 1)
                    ELSE 100::numeric
                END as "fulfillment_accuracy_percent!"
            FROM replenishment_requests r
            JOIN warehouses w ON r.container_warehouse_id = w.id
            LEFT JOIN replenishment_request_items ri ON r.id = ri.request_id
            WHERE ($1::text IS NULL OR r.container_warehouse_id = $1)
            GROUP BY r.id, r.request_number, r.container_warehouse_id, w.name, r.status, r.created_at, r.verified_at, r.approved_at, r.received_at
            ORDER BY r.created_at DESC
            LIMIT 50
            "#,
            warehouse_id
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| ReplenishmentEfficiencyReportItem {
                request_number: r.request_number,
                container_warehouse_id: r.container_warehouse_id,
                container_warehouse_name: r.container_warehouse_name,
                status: r.status,
                created_at: r.created_at,
                verified_at: r.verified_at,
                approved_at: r.approved_at,
                received_at: r.received_at,
                lead_time_hours: r.lead_time_hours,
                items_requested: r.items_requested,
                total_qty_requested: r.total_qty_requested,
                total_qty_received: r.total_qty_received,
                fulfillment_accuracy_percent: r.fulfillment_accuracy_percent,
            })
            .collect();

        Ok(items)
    }
}
