use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("not found")]
    NotFound,
    #[error("unauthorized")]
    Unauthorized,
    #[error("forbidden")]
    Forbidden,
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("internal error")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            Self::NotFound       => (StatusCode::NOT_FOUND,            "NOT_FOUND",    self.to_string()),
            Self::Unauthorized   => (StatusCode::UNAUTHORIZED,         "UNAUTHORIZED", self.to_string()),
            Self::Forbidden      => (StatusCode::FORBIDDEN,            "FORBIDDEN",    self.to_string()),
            Self::BadRequest(m)  => (StatusCode::BAD_REQUEST,          "BAD_REQUEST",  m.clone()),
            Self::Internal(e)    => {
                tracing::error!("internal error: {e:?}");
                (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL", "internal server error".into())
            }
        };
        let body = json!({ "error": { "code": code, "message": message } });
        (status, Json(body)).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        Self::Internal(anyhow::anyhow!(e))
    }
}
