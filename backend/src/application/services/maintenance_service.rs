use crate::{
    domain::entities::{
        Claims, CostPerEquipmentReport, CreateMaintenanceLogRequest, EquipmentComponentItem,
        EquipmentMaintenanceRecord, HierarchicalConsumptionItem, MaintenanceQuery,
    },
    error::AppError,
    infrastructure::repositories::{AuditRepository, MaintenanceRepository},
};
use serde_json::json;
use sqlx::PgPool;

#[derive(Clone)]
pub struct MaintenanceService {
    maintenance_repo: MaintenanceRepository,
    audit_repo: AuditRepository,
}

impl MaintenanceService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            maintenance_repo: MaintenanceRepository::new(pool.clone()),
            audit_repo: AuditRepository::new(pool),
        }
    }

    pub async fn list_components(&self) -> Result<Vec<EquipmentComponentItem>, AppError> {
        self.maintenance_repo.list_components().await
    }

    pub async fn list_maintenance_history(
        &self,
        query: MaintenanceQuery,
    ) -> Result<Vec<EquipmentMaintenanceRecord>, AppError> {
        self.maintenance_repo.list_maintenance_history(&query).await
    }

    pub async fn create_maintenance_log(
        &self,
        claims: &Claims,
        req: CreateMaintenanceLogRequest,
    ) -> Result<EquipmentMaintenanceRecord, AppError> {
        if req.work_order_number.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Nomor Work Order (WO) wajib diisi".to_string(),
            ));
        }
        if req.equipment_id.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Equipment / Unit wajib dipilih".to_string(),
            ));
        }
        if req.failure_code.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Kode kegagalan (failure code) wajib diisi".to_string(),
            ));
        }

        let record = self.maintenance_repo.create_maintenance_log(&req).await?;

        let _ = self
            .audit_repo
            .record_log(
                Some(claims.sub),
                Some(&claims.username),
                "CREATE_MAINTENANCE_LOG",
                "EQUIPMENT_MAINTENANCE",
                Some(&record.id.to_string()),
                Some(json!({
                    "work_order_number": record.work_order_number,
                    "equipment_id": record.equipment_id,
                    "unit_number": record.unit_number,
                    "failure_code": record.failure_code,
                    "total_cost": record.total_cost,
                    "downtime_hours": record.downtime_hours,
                })),
            )
            .await;

        Ok(record)
    }

    pub async fn get_cost_per_equipment(&self) -> Result<Vec<CostPerEquipmentReport>, AppError> {
        self.maintenance_repo.get_cost_per_equipment().await
    }

    pub async fn get_hierarchical_consumption(
        &self,
        equipment_id: Option<String>,
    ) -> Result<Vec<HierarchicalConsumptionItem>, AppError> {
        self.maintenance_repo
            .get_hierarchical_consumption(equipment_id.as_deref())
            .await
    }
}
