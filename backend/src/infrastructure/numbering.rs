use crate::error::AppError;
use chrono::Utc;
use sqlx::PgConnection;

pub async fn next_document_number(
    conn: &mut PgConnection,
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
    .fetch_one(&mut *conn)
    .await?;

    Ok(format!("{}-{}-{:05}", prefix, date_str, seq))
}
