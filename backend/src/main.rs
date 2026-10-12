mod api;
mod application;
mod config;
mod domain;
mod error;
mod infrastructure;

use api::{build_router, handlers::auth::AppState};
use application::ServiceContainer;
use config::AppConfig;
use infrastructure::db::create_db_pool;
use std::{net::SocketAddr, sync::Arc};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "logisticqu_backend=debug,tower_http=debug,axum=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = AppConfig::from_env();
    tracing::info!("Konfigurasi loaded. Database: {}", config.database_url);

    let pool = create_db_pool(&config.database_url).await?;
    let services = Arc::new(ServiceContainer::new(pool.clone(), config.clone()));

    let state = AppState {
        pool,
        config: config.clone(),
        services,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = build_router(state)
        .layer(axum::middleware::from_fn(
            api::middleware::security_headers_middleware,
        ))
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::new(config.server_host.parse()?, config.server_port);
    tracing::info!("🚀 Server LogisticQu berjalan pada http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
