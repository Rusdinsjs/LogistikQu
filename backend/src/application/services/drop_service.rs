use crate::{
    domain::entities::MainDrop, error::AppError, infrastructure::repositories::DropRepository,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Clone)]
pub struct DropService {
    drop_repo: DropRepository,
}

impl DropService {
    pub fn new(pool: PgPool) -> Self {
        Self {
            drop_repo: DropRepository::new(pool),
        }
    }

    pub async fn list_main_drops(
        &self,
        wh_filter: &str,
        user_whs: &[String],
    ) -> Result<Vec<MainDrop>, AppError> {
        self.drop_repo.list_drops(wh_filter, user_whs).await
    }

    pub async fn get_drop_detail(&self, id: Uuid) -> Result<Value, AppError> {
        let drop = self
            .drop_repo
            .get_drop_by_id(id)
            .await?
            .ok_or_else(|| AppError::NotFound("Dokumen drop tidak ditemukan".to_string()))?;

        let items = self.drop_repo.get_drop_items(id).await?;

        Ok(json!({
            "drop": drop,
            "items": items
        }))
    }
}
