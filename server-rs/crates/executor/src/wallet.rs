use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::{Context, Result};
use pbkdf2::pbkdf2_hmac;
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

/// Decrypt a seed that was encrypted with AES-256-GCM.
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
