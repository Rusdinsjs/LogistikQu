use crate::{
    domain::entities::{
        CostPerEquipmentReport, CreateMaintenanceLogRequest, EquipmentComponentItem,
        EquipmentMaintenanceRecord, HierarchicalConsumptionItem, MaintenanceQuery,
    },
    error::AppError,
};
use rust_decimal::Decimal;
use sqlx::PgPool;

#[derive(Clone)]
pub struct MaintenanceRepository {
    pool: PgPool,
}

impl MaintenanceRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn list_components(&self) -> Result<Vec<EquipmentComponentItem>, AppError> {
        let items = sqlx::query_as!(
            EquipmentComponentItem,
            r#"
            SELECT id, name, description, is_active, created_at
            FROM equipment_components
            WHERE is_active = TRUE
            ORDER BY id ASC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(items)
    }

    pub async fn list_maintenance_history(
        &self,
        query: &MaintenanceQuery,
    ) -> Result<Vec<EquipmentMaintenanceRecord>, AppError> {
        let equip_filter = query.equipment_id.as_deref().unwrap_or("");
        let comp_filter = query.component_id.as_deref().unwrap_or("");
        let part_filter = query.spare_part_id.as_deref().unwrap_or("");
        let fail_filter = query.failure_code.as_deref().unwrap_or("");
        let fail_pattern = format!("%{}%", fail_filter);

        let limit = query.limit.unwrap_or(50).min(200);
        let offset = query.page.unwrap_or(0) * limit;

        let records = sqlx::query_as!(
            EquipmentMaintenanceRecord,
            r#"
            SELECT
                m.id,
                m.work_order_number,
                m.equipment_id,
                m.unit_number,
                m.component_id,
                c.name as "component_name?",
                m.spare_part_id,
                p.part_name as "part_name?",
                m.failure_code,
                m.failure_symptom,
                m.maintenance_type,
                m.hm_km,
                m.parts_qty,
                m.parts_cost,
                m.labor_cost,
                m.total_cost,
                m.downtime_hours,
                m.mechanic_name,
                m.performed_at,
                m.notes,
                m.created_at
            FROM equipment_maintenance_history m
            LEFT JOIN equipment_components c ON m.component_id = c.id
            LEFT JOIN spare_parts p ON m.spare_part_id = p.id
            WHERE ($1 = '' OR m.equipment_id = $1 OR m.unit_number = $1)
              AND ($2 = '' OR m.component_id = $2)
              AND ($3 = '' OR m.spare_part_id = $3)
              AND ($4 = '' OR m.failure_code ILIKE $5)
            ORDER BY m.performed_at DESC
            LIMIT $6 OFFSET $7
            "#,
            equip_filter,
            comp_filter,
            part_filter,
            fail_filter,
            fail_pattern,
            limit,
            offset
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    pub async fn create_maintenance_log(
        &self,
        req: &CreateMaintenanceLogRequest,
    ) -> Result<EquipmentMaintenanceRecord, AppError> {
        // Find unit_number from equipment
        let equip = sqlx::query!(
            "SELECT unit_number FROM equipment WHERE id = $1",
            req.equipment_id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!("Equipment '{}' tidak ditemukan", req.equipment_id))
        })?;

        // Determine parts cost if not supplied
        let parts_cost = if let Some(pc) = req.parts_cost {
            pc
        } else if let Some(ref pid) = req.spare_part_id {
            let part = sqlx::query!("SELECT unit_cost FROM spare_parts WHERE id = $1", pid)
                .fetch_optional(&self.pool)
                .await?;
            part.map(|p| p.unit_cost * req.parts_qty)
                .unwrap_or(Decimal::ZERO)
        } else {
            Decimal::ZERO
        };

        let labor_cost = req.labor_cost.unwrap_or(Decimal::ZERO);
        let total_cost = parts_cost + labor_cost;
        let downtime_hours = req.downtime_hours.unwrap_or(Decimal::ZERO);
        let m_type = req.maintenance_type.as_deref().unwrap_or("CORRECTIVE");
        let performed_at = req.performed_at.unwrap_or_else(chrono::Utc::now);

        let record = sqlx::query_as!(
            EquipmentMaintenanceRecord,
            r#"
            WITH inserted AS (
                INSERT INTO equipment_maintenance_history (
                    work_order_number, equipment_id, unit_number, component_id, spare_part_id,
                    failure_code, failure_symptom, maintenance_type, hm_km, parts_qty,
                    parts_cost, labor_cost, total_cost, downtime_hours, mechanic_name,
                    performed_at, notes
                ) VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15,
                    $16, $17
                )
                RETURNING *
            )
            SELECT
                i.id as "id!",
                i.work_order_number,
                i.equipment_id as "equipment_id!",
                i.unit_number as "unit_number!",
                i.component_id,
                c.name as "component_name?",
                i.spare_part_id,
                p.part_name as "part_name?",
                i.failure_code,
                i.failure_symptom,
                i.maintenance_type as "maintenance_type!",
                i.hm_km as "hm_km!",
                i.parts_qty as "parts_qty!",
                i.parts_cost as "parts_cost!",
                i.labor_cost as "labor_cost!",
                i.total_cost as "total_cost!",
                i.downtime_hours as "downtime_hours!",
                i.mechanic_name,
                i.performed_at as "performed_at!",
                i.notes,
                i.created_at as "created_at!"
            FROM inserted i
            LEFT JOIN equipment_components c ON i.component_id = c.id
            LEFT JOIN spare_parts p ON i.spare_part_id = p.id
            "#,
            req.work_order_number,
            req.equipment_id,
            equip.unit_number,
            req.component_id,
            req.spare_part_id,
            req.failure_code,
            req.failure_symptom,
            m_type,
            req.hm_km,
            req.parts_qty,
            parts_cost,
            labor_cost,
            total_cost,
            downtime_hours,
            req.mechanic_name,
            performed_at,
            req.notes
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }

    pub async fn get_cost_per_equipment(&self) -> Result<Vec<CostPerEquipmentReport>, AppError> {
        let rows = sqlx::query!(
            r#"
            SELECT
                e.id AS equipment_id,
                e.unit_number,
                e.equipment_type_id,
                e.model,
                COALESCE(SUM(m.parts_cost), 0::numeric) AS total_parts_cost,
                COALESCE(SUM(m.labor_cost), 0::numeric) AS total_labor_cost,
                COALESCE(SUM(m.total_cost), 0::numeric) AS grand_total_cost,
                COALESCE(SUM(m.downtime_hours), 0::numeric) AS total_downtime_hours,
                COUNT(m.id) AS maintenance_count,
                COALESCE((
                    SELECT SUM(iti.total_price)
                    FROM issue_transaction_items iti
                    JOIN issue_transactions it ON iti.transaction_id = it.id
                    WHERE it.unit_number = e.unit_number
                ), 0::numeric) AS issue_parts_cost
            FROM equipment e
            LEFT JOIN equipment_maintenance_history m ON e.id = m.equipment_id
            GROUP BY e.id, e.unit_number, e.equipment_type_id, e.model
            ORDER BY grand_total_cost DESC, e.unit_number ASC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        let reports = rows
            .into_iter()
            .map(|r| {
                let grand_total_cost = r.grand_total_cost.unwrap_or(Decimal::ZERO);
                let issue_parts_cost = r.issue_parts_cost.unwrap_or(Decimal::ZERO);
                let combined_total_cost = grand_total_cost + issue_parts_cost;

                CostPerEquipmentReport {
                    equipment_id: r.equipment_id,
                    unit_number: r.unit_number,
                    equipment_type_id: r.equipment_type_id,
                    model: r.model,
                    total_parts_cost: r.total_parts_cost.unwrap_or(Decimal::ZERO),
                    total_labor_cost: r.total_labor_cost.unwrap_or(Decimal::ZERO),
                    grand_total_cost,
                    total_downtime_hours: r.total_downtime_hours.unwrap_or(Decimal::ZERO),
                    maintenance_count: r.maintenance_count.unwrap_or(0),
                    issue_parts_cost,
                    combined_total_cost,
                }
            })
            .collect();

        Ok(reports)
    }

    pub async fn get_hierarchical_consumption(
        &self,
        equipment_id: Option<&str>,
    ) -> Result<Vec<HierarchicalConsumptionItem>, AppError> {
        let eq_filter = equipment_id.unwrap_or("");

        let rows = sqlx::query!(
            r#"
            SELECT
                e.id AS equipment_id,
                e.unit_number,
                COALESCE(c.id, 'UNASSIGNED') AS component_id,
                COALESCE(c.name, 'Unassigned Component') AS component_name,
                p.id AS spare_part_id,
                p.part_name,
                COALESCE(SUM(m.parts_qty), 0::numeric) AS total_qty_consumed,
                COALESCE(SUM(m.parts_cost), 0::numeric) AS total_spend,
                COUNT(m.id) AS failure_count,
                (
                    SELECT m_sub.failure_code
                    FROM equipment_maintenance_history m_sub
                    WHERE m_sub.equipment_id = e.id
                      AND m_sub.spare_part_id = p.id
                    ORDER BY m_sub.performed_at DESC
                    LIMIT 1
                ) AS latest_failure_code,
                (
                    SELECT m_sub.performed_at
                    FROM equipment_maintenance_history m_sub
                    WHERE m_sub.equipment_id = e.id
                      AND m_sub.spare_part_id = p.id
                    ORDER BY m_sub.performed_at DESC
                    LIMIT 1
                ) AS latest_performed_at
            FROM equipment_maintenance_history m
            JOIN equipment e ON m.equipment_id = e.id
            JOIN spare_parts p ON m.spare_part_id = p.id
            LEFT JOIN equipment_components c ON m.component_id = c.id
            WHERE ($1 = '' OR e.id = $1 OR e.unit_number = $1)
            GROUP BY e.id, e.unit_number, c.id, c.name, p.id, p.part_name
            ORDER BY total_spend DESC, e.unit_number ASC
            "#,
            eq_filter
        )
        .fetch_all(&self.pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|r| HierarchicalConsumptionItem {
                equipment_id: r.equipment_id,
                unit_number: r.unit_number,
                component_id: r.component_id.unwrap_or_else(|| "UNASSIGNED".to_string()),
                component_name: r
                    .component_name
                    .unwrap_or_else(|| "Unassigned Component".to_string()),
                spare_part_id: r.spare_part_id,
                part_name: r.part_name,
                total_qty_consumed: r.total_qty_consumed.unwrap_or(Decimal::ZERO),
                total_spend: r.total_spend.unwrap_or(Decimal::ZERO),
                failure_count: r.failure_count.unwrap_or(0),
                latest_failure_code: r.latest_failure_code,
                latest_performed_at: r.latest_performed_at,
            })
            .collect();

        Ok(items)
    }
}
