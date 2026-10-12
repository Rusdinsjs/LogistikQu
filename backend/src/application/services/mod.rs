pub mod adjustment_service;
pub mod audit_service;
pub mod auth_service;
pub mod bin_service;
pub mod dashboard_service;
pub mod drop_service;
pub mod inventory_service;
pub mod issue_service;
pub mod maintenance_service;
pub mod master_service;
pub mod notification_service;
pub mod replenishment_service;
pub mod report_service;
pub mod return_service;
pub mod sync_service;
pub mod user_service;

pub use adjustment_service::AdjustmentService;
pub use audit_service::AuditService;
pub use auth_service::AuthService;
pub use bin_service::BinService;
pub use dashboard_service::DashboardService;
pub use drop_service::DropService;
pub use inventory_service::InventoryService;
pub use issue_service::IssueService;
pub use maintenance_service::MaintenanceService;
pub use master_service::MasterService;
pub use notification_service::NotificationService;
pub use replenishment_service::ReplenishmentService;
pub use report_service::ReportService;
pub use return_service::ReturnService;
pub use sync_service::SyncService;
pub use user_service::UserService;

use crate::config::AppConfig;
use sqlx::PgPool;

#[derive(Clone)]
pub struct ServiceContainer {
    pub auth: AuthService,
    pub user: UserService,
    pub master: MasterService,
    pub inventory: InventoryService,
    pub issue: IssueService,
    pub replenishment: ReplenishmentService,
    pub drop: DropService,
    pub adjustment: AdjustmentService,
    pub bin: BinService,
    pub returns: ReturnService,
    pub report: ReportService,
    pub audit: AuditService,
    pub sync: SyncService,
    pub maintenance: MaintenanceService,
    pub notification: NotificationService,
    pub dashboard: DashboardService,
}

impl ServiceContainer {
    pub fn new(pool: PgPool, config: AppConfig) -> Self {
        Self {
            auth: AuthService::new(pool.clone(), config),
            user: UserService::new(pool.clone()),
            master: MasterService::new(pool.clone()),
            inventory: InventoryService::new(pool.clone()),
            issue: IssueService::new(pool.clone()),
            replenishment: ReplenishmentService::new(pool.clone()),
            drop: DropService::new(pool.clone()),
            adjustment: AdjustmentService::new(pool.clone()),
            bin: BinService::new(pool.clone()),
            returns: ReturnService::new(pool.clone()),
            report: ReportService::new(pool.clone()),
            audit: AuditService::new(pool.clone()),
            sync: SyncService::new(pool.clone()),
            maintenance: MaintenanceService::new(pool.clone()),
            notification: NotificationService::new(pool.clone()),
            dashboard: DashboardService::new(pool),
        }
    }
}
