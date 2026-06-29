pub mod models;
pub mod queries;

use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

pub use models::*;
pub use queries::*;

/// Create a Postgres connection pool and run pending migrations.
pub async fn connect(database_url: &str) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .connect(database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}
