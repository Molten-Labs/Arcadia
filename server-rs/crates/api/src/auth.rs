/// SIWS (Sign-In With Solana) authentication helpers.
use crate::{error::ApiError, state::AppState};
use axum::{extract::State, Json};
use chrono::Utc;
use ed25519_dalek::{Signature, VerifyingKey};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use rand::Rng;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};

// ── Request / response types ──────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ChallengeRes {
    pub nonce: String,
}

#[derive(Deserialize)]
pub struct VerifyReq {
    pub pubkey:    String,
    pub signature: String,
    pub nonce:     String,
}

#[derive(Serialize)]
pub struct TokenRes {
    pub token: String,
}

// ── JWT Claims ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// Solana wallet pubkey (base58).
    pub sub: String,
    pub iat: i64,
    pub exp: i64,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// POST /v1/auth/challenge
pub async fn challenge(State(ctx): State<AppState>) -> Result<Json<ChallengeRes>, ApiError> {
    let nonce = random_b58(24);
    let key   = format!("siws:{nonce}");

    let mut conn = ctx.redis
        .get_multiplexed_tokio_connection()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    conn.set_ex::<_, _, ()>(&key, "1", ctx.cfg.nonce_ttl_secs)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(Json(ChallengeRes { nonce }))
}

/// POST /v1/auth/verify
pub async fn verify(
    State(ctx): State<AppState>,
    Json(body): Json<VerifyReq>,
) -> Result<Json<TokenRes>, ApiError> {
    let nonce_key = format!("siws:{}", body.nonce);

    let mut conn = ctx.redis
        .get_multiplexed_tokio_connection()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    // Consume the nonce atomically (take = get + del)
    let exists: Option<String> = conn.get_del(&nonce_key)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    if exists.is_none() {
        return Err(ApiError::Unauthorized);
    }

    // Decode pubkey
    let pk_bytes = bs58::decode(&body.pubkey)
        .into_vec()
        .map_err(|_| ApiError::BadRequest("invalid pubkey".into()))?;
    let pk_arr: [u8; 32] = pk_bytes.try_into()
        .map_err(|_| ApiError::BadRequest("pubkey must be 32 bytes".into()))?;
    let vk = VerifyingKey::from_bytes(&pk_arr)
        .map_err(|_| ApiError::BadRequest("invalid ed25519 key".into()))?;

    // Decode signature
    let sig_bytes = bs58::decode(&body.signature)
        .into_vec()
        .map_err(|_| ApiError::BadRequest("invalid signature".into()))?;
    let sig_arr: [u8; 64] = sig_bytes.try_into()
        .map_err(|_| ApiError::BadRequest("signature must be 64 bytes".into()))?;
    let sig = Signature::from_bytes(&sig_arr);

    // Build canonical SIWS message and verify
    let msg = siws_message(&body.pubkey, &body.nonce);
    vk.verify_strict(msg.as_bytes(), &sig)
        .map_err(|_| ApiError::Unauthorized)?;

    // Issue JWT
    let now = Utc::now().timestamp();
    let exp = now + ctx.cfg.jwt_expiry_secs as i64;
    let claims = Claims { sub: body.pubkey.clone(), iat: now, exp };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(ctx.jwt_secret.as_bytes()),
    )
    .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(Json(TokenRes { token }))
}

// ── JWT extractor ─────────────────────────────────────────────────────────────

/// Extract & validate a bearer JWT from the Authorization header.
/// Returns the wallet pubkey on success.
pub fn verify_jwt(token: &str, secret: &str) -> Result<String, ApiError> {
    let mut val = Validation::new(Algorithm::HS256);
    val.validate_exp = true;

    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &val,
    )
    .map_err(|_| ApiError::Unauthorized)?;

    Ok(data.claims.sub)
}

// ── Privy auth ────────────────────────────────────────────────────────────────
//
// We verify access tokens by calling GET
// https://api.privy.io/v1/users/me with the user's bearer token.  Privy
// docs: https://docs.privy.io/api/rest/authentication

#[derive(Deserialize)]
pub struct PrivyReq {
    pub token: String,
}

#[derive(Serialize)]
pub struct PrivyRes {
    pub jwt: String,
}

#[derive(Deserialize)]
pub struct PrivyUser {
    id:             String,
    #[serde(default)]
    linked_accounts: Vec<PrivyLinkedAccount>,
}

impl PrivyUser {
    /// First email linked account that Privy has verified ownership of.
    pub fn verified_email(&self) -> Option<&str> {
        self.linked_accounts.iter().find_map(|a| match a {
            PrivyLinkedAccount::Email { email, verified_at: Some(_) } => Some(email.as_str()),
            _ => None,
        })
    }
}

#[derive(Deserialize)]
#[serde(tag = "type")]
enum PrivyLinkedAccount {
    #[serde(rename = "solana_wallet")]
    SolanaWallet { address: String },
    #[serde(rename = "email")]
    Email {
        email:               String,
        #[serde(default)]
        verified_at:         Option<String>,
    },
    #[serde(other)]
    Other,
}

/// Verify a Privy access token and return the linked Privy user.
pub async fn verify_privy_token(token: &str) -> Result<PrivyUser, ApiError> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.privy.io/v1/users/me")
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("privy verify request: {e}")))?;

    if !resp.status().is_success() {
        return Err(ApiError::Unauthorized);
    }

    resp.json()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("privy decode: {e}")))
}

/// POST /v1/auth/privy
pub async fn privy_verify(
    State(ctx): State<AppState>,
    Json(body): Json<PrivyReq>,
) -> Result<Json<PrivyRes>, ApiError> {
    let user = verify_privy_token(&body.token).await?;

    // Extract first linked Solana wallet
    let wallet = user
        .linked_accounts
        .iter()
        .find_map(|a| match a {
            PrivyLinkedAccount::SolanaWallet { address } => Some(address.clone()),
            _ => None,
        })
        .ok_or_else(|| ApiError::BadRequest("no solana wallet linked in privy".into()))?;

    let now = Utc::now().timestamp();
    let exp = now + ctx.cfg.jwt_expiry_secs as i64;
    let claims = Claims { sub: wallet, iat: now, exp };
    let jwt = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(ctx.jwt_secret.as_bytes()),
    )
    .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    Ok(Json(PrivyRes { jwt }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn random_b58(len: usize) -> String {
    let bytes: Vec<u8> = (0..len).map(|_| rand::thread_rng().gen::<u8>()).collect();
    bs58::encode(bytes).into_string()
}

fn siws_message(pubkey: &str, nonce: &str) -> String {
    format!(
        "Arcadia wants you to sign in with your Solana account:\n{pubkey}\n\nNonce: {nonce}"
    )
}
