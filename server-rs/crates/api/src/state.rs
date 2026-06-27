use sqlx::PgPool;

/// Shared application state injected into every Axum handler.
#[derive(Clone)]
pub struct AppState {
    pub db:         PgPool,
    pub redis:      redis::Client,
    pub jwt_secret: String,
    pub cfg:        ApiConfig,
}

#[derive(Clone, Debug)]
pub struct ApiConfig {
    pub jwt_expiry_secs:  u64,
    /// Maximum staleness for prices before an oracle refuses to sign (secs).
    pub price_max_age:   i64,
    /// SIWS nonce TTL in Redis.
    pub nonce_ttl_secs:  u64,
}

impl ApiConfig {
    pub fn from_env() -> Self {
        Self {
            jwt_expiry_secs: std::env::var("JWT_EXPIRY_SECS")
                .ok().and_then(|s| s.parse().ok()).unwrap_or(86_400),
            price_max_age: std::env::var("PRICE_MAX_AGE_SECS")
                .ok().and_then(|s| s.parse().ok()).unwrap_or(10),
            nonce_ttl_secs: 300,
        }
    }
}
