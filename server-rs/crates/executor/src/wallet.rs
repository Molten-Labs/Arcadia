use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::{Context, Result};
use pbkdf2::pbkdf2_hmac;
use rand::Rng;
use sha2::Sha256;

/// Number of PBKDF2 iterations (matches TS execution-wallet-crypto.ts).
const PBKDF2_ITERATIONS: u32 = 100_000;

/// Derive an AES-256 key from a master password + salt.
fn derive_key(master_password: &str, salt: &[u8]) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(
        master_password.as_bytes(),
        salt,
        PBKDF2_ITERATIONS,
        &mut key,
    );
    key
}

/// Generate a new 32-byte seed for an Ed25519 execution wallet.
pub fn create_seed() -> [u8; 32] {
    rand::thread_rng().gen::<[u8; 32]>()
}

/// Derive the Ed25519 public key from a 32-byte seed.
pub fn derive_pubkey(seed: &[u8; 32]) -> [u8; 32] {
    use ed25519_dalek::SigningKey;
    let signing = SigningKey::from_bytes(seed);
    signing.verifying_key().to_bytes()
}

/// Get base58-encoded pubkey from a seed.
pub fn pubkey_base58(seed: &[u8; 32]) -> String {
    bs58::encode(derive_pubkey(seed)).into_string()
}

/// Encrypt a seed with AES-256-GCM using a master password.
/// Returns (encrypted_seed, salt).
pub fn encrypt_seed(seed: &[u8; 32], master_password: &str) -> Result<(Vec<u8>, Vec<u8>)> {
    let salt: [u8; 32] = rand::thread_rng().gen();
    let key = derive_key(master_password, &salt);
    let cipher =
        Aes256Gcm::new_from_slice(&key).context("failed to create AES-256-GCM cipher")?;
    let nonce: [u8; 12] = rand::thread_rng().gen();
    let nonce = Nonce::from_slice(&nonce);
    let ciphertext = cipher
        .encrypt(nonce, seed.as_slice())
        .map_err(|e| anyhow::anyhow!("AES-256-GCM encryption failed: {e:?}"))?;
    // Prepend the nonce to the ciphertext (first 12 bytes).
    let mut encrypted = Vec::with_capacity(12 + ciphertext.len());
    encrypted.extend_from_slice(nonce);
    encrypted.extend_from_slice(&ciphertext);
    Ok((encrypted, salt.to_vec()))
}

/// Decrypt a seed that was encrypted with `encrypt_seed`.
pub fn decrypt_seed(
    encrypted: &[u8],
    salt: &[u8],
    master_password: &str,
) -> Result<[u8; 32]> {
    if encrypted.len() < 12 + 32 {
        anyhow::bail!("encrypted seed too short");
    }
    let (nonce_bytes, ciphertext) = encrypted.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    let key = derive_key(master_password, salt);
    let cipher =
        Aes256Gcm::new_from_slice(&key).context("failed to create AES-256-GCM cipher")?;
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| anyhow::anyhow!("AES-256-GCM decryption failed: {e:?}"))?;
    let mut seed = [0u8; 32];
    seed.copy_from_slice(&plaintext);
    Ok(seed)
}

/// Generate an execution wallet: seed -> encrypt -> store in DB.
/// Returns the pubkey (base58).
pub async fn create_and_store_wallet(
    db: &sqlx::PgPool,
    profile: &str,
    master_password: &str,
) -> Result<String> {
    let seed = create_seed();
    let pubkey = pubkey_base58(&seed);
    let (encrypted_seed, salt) = encrypt_seed(&seed, master_password)?;

    arcadia_db::queries::upsert_execution_wallet(db, profile, &pubkey, &encrypted_seed, &salt)
        .await?;

    tracing::info!(profile, pubkey, "execution wallet created and stored");
    Ok(pubkey)
}

/// Load and decrypt an execution wallet seed from the DB.
pub async fn load_decrypted_seed(
    db: &sqlx::PgPool,
    profile: &str,
    master_password: &str,
) -> Result<[u8; 32]> {
    let wallet = arcadia_db::queries::get_execution_wallet(db, profile)
        .await?
        .with_context(|| format!("no execution wallet found for profile {profile}"))?;

    decrypt_seed(&wallet.encrypted_seed, &wallet.encryption_salt, master_password)
}
