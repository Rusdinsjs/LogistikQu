use crate::error::AppError;
use chrono::Utc;
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
        .map_err(|e| {
            AppError::Internal(anyhow::anyhow!(
                "Gagal menjalankan migrasi database: {:?}",
                e
            ))
        })?;
    tracing::info!("Database migrations berhasil diterapkan!");

    Ok(pool)
}

/// Menghasilkan nomor dokumen atomik dengan locking baris menggunakan document_sequences
pub async fn next_document_number(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    prefix: &str,
) -> Result<String, AppError> {
    let now = Utc::now();
    let date_str = now.format("%Y%m%d").to_string();

    let seq = sqlx::query_scalar::<_, i32>(
        r#"
        INSERT INTO document_sequences (doc_type, date_str, last_number)
        VALUES ($1, $2, 1)
        ON CONFLICT (doc_type, date_str)
        DO UPDATE SET last_number = document_sequences.last_number + 1
        RETURNING last_number
        "#,
    )
    .bind(prefix)
    .bind(&date_str)
    .fetch_one(&mut **tx)
    .await?;

    Ok(format!("{}-{}-{:05}", prefix, date_str, seq))
}

pub async fn generate_document_number(pool: &PgPool, prefix: &str) -> Result<String, AppError> {
    let mut tx = pool.begin().await?;
    let doc_no = next_document_number(&mut tx, prefix).await?;
    tx.commit().await?;
    Ok(doc_no)
}
