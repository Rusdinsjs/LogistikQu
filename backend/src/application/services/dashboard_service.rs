use crate::{
    domain::entities::{EnterpriseKpiSummary, FastSlowMovingPartItem, StockAgingSummary},
    error::AppError,
    infrastructure::repositories::DashboardRepository,
};
use sqlx::PgPool;

#[derive(Clone)]
pub struct DashboardService {
    dashboard_repo: DashboardRepository,
}

impl DashboardService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            dashboard_repo: DashboardRepository::new(pool),
        }
    }

    pub async fn get_enterprise_kpis(
        &self,
        user_whs: &[String],
    ) -> Result<EnterpriseKpiSummary, AppError> {
        self.dashboard_repo
            .get_enterprise_kpi_summary(user_whs)
            .await
    }

    pub async fn get_stock_velocity(
        &self,
        user_whs: &[String],
    ) -> Result<Vec<FastSlowMovingPartItem>, AppError> {
        self.dashboard_repo.get_stock_velocity(user_whs).await
    }

    pub async fn get_stock_aging(
        &self,
        user_whs: &[String],
    ) -> Result<StockAgingSummary, AppError> {
        self.dashboard_repo.get_stock_aging_summary(user_whs).await
    }
}
