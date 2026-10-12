pub mod handlers;
pub mod middleware;
pub mod routes;

use axum::Router;
pub use handlers::auth::AppState;

pub fn build_router(state: AppState) -> Router {
    routes::create_api_router(state)
}
