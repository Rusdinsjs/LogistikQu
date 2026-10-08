use crate::error::AppError;
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;

pub async fn create_db_pool(database_url: &str) -> Result<PgPool, AppError> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(10))
        .idle_timeout(Duration::from_secs(300))
        .connect(database_url)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Gagal koneksi ke database: {:?}", e)))?;

    // Menjalankan migrasi embedded
    tracing::info!("Menjalankan database migrations...");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Gagal menjalankan migrasi database: {:?}", e)))?;
    tracing::info!("Database migrations berhasil diterapkan!");

    Ok(pool)
}
