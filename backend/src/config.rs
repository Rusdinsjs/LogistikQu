use std::env;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_access_expiry_mins: i64,
    pub jwt_refresh_expiry_days: i64,
    pub server_host: String,
    pub server_port: u16,
}

impl AppConfig {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgres://logisticqu:logisticqu_secret@127.0.0.1:5440/logisticqu_dev".to_string()
        });
        let jwt_secret = env::var("JWT_SECRET")
            .unwrap_or_else(|_| "logisticqu_super_secret_jwt_key_2026_valesite_mining".to_string());
        let jwt_access_expiry_mins = env::var("JWT_ACCESS_EXPIRY_MINS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);
        let jwt_refresh_expiry_days = env::var("JWT_REFRESH_EXPIRY_DAYS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(7);
        let server_host = env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let server_port = env::var("SERVER_PORT")
            .or_else(|_| env::var("PORT"))
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(8090);

        Self {
            database_url,
            jwt_secret,
            jwt_access_expiry_mins,
            jwt_refresh_expiry_days,
            server_host,
            server_port,
        }
    }
}
