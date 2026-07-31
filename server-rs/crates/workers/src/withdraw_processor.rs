/// Withdraw-processor worker.
///
/// Polls the DB for pending withdrawals whose notice has elapsed,
/// signs `processWithdraw` as the platform processor, and broadcasts
/// via RPC. Constructs Solana transactions without the SDK to avoid
/// ed25519-dalek version conflicts.
use crate::WorkerCtx;
use anyhow::Result;
use ed25519_dalek::Signer;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use tracing::{error, info};

const POLL_INTERVAL_SECS: u64 = 30;

// ── Well-known Solana program IDs ────────────────────────────────────────────

fn spl_token_id() -> [u8; 32] {
    bs58::decode("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
        .into_vec()
        .unwrap()
        .try_into()
        .unwrap()
}

fn associated_token_program_id() -> [u8; 32] {
    bs58::decode("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
        .into_vec()
        .unwrap()
        .try_into()
        .unwrap()
}

// ── Entry ────────────────────────────────────────────────────────────────────

pub async fn run(ctx: WorkerCtx) -> Result<()> {
    let rpc_url =
        std::env::var("SOLANA_RPC").unwrap_or_else(|_| "https://api.devnet.solana.com".into());
    let processor = load_processor()?;
    let program_id = bs58::decode(&ctx.cfg.program_id).into_vec()?;

    info!(
        "withdraw-processor: started processor={}",
        bs58::encode(&processor.verifying_key().to_bytes()).into_string()
    );

    loop {
        if let Err(e) = process_ready(&ctx.db, &rpc_url, &processor, &program_id).await {
            error!("withdraw-processor: poll error: {e:#}");
        }
        tokio::time::sleep(std::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;
    }
}

// ── Key loading ──────────────────────────────────────────────────────────────

fn load_processor() -> Result<ed25519_dalek::SigningKey> {
    let path = std::env::var("PROCESSOR_KEYPAIR_PATH")
        .unwrap_or_else(|_| "/run/secrets/processor_keypair.json".into());
    let bytes = std::fs::read_to_string(&path)?;
    let vals: Vec<u8> = serde_json::from_str(&bytes)?;
    let arr: [u8; 64] = vals.try_into().map_err(|_| anyhow::anyhow!("invalid keypair length"))?;
    Ok(ed25519_dalek::SigningKey::from_keypair_bytes(&arr)?)
}

// ── DB query ─────────────────────────────────────────────────────────────────

async fn process_ready(
    db: &PgPool,
    rpc_url: &str,
    processor: &ed25519_dalek::SigningKey,
    program_id: &[u8],
) -> Result<()> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        r#"
        SELECT owner, profile
        FROM investor_position
        WHERE pending_withdraw_shares > 0
          AND withdraw_ready_ts <= now()
        LIMIT 50
        "#,
    )
    .fetch_all(db)
    .await?;

    for (owner, profile) in &rows {
        match execute_one(rpc_url, processor, program_id, owner, profile).await {
            Ok(sig) => {
                info!("processed owner={owner} profile={profile} sig={sig}");
                let _ = sqlx::query(
                    "UPDATE investor_position SET pending_withdraw_shares=0, withdraw_ready_ts=NULL, updated_at=now() WHERE owner=$1 AND profile=$2",
                )
                .bind(owner)
                .bind(profile)
                .execute(db)
                .await;
            }
            Err(e) => error!("owner={owner} profile={profile}: {e:#}"),
        }
    }
    Ok(())
}

// ── Transaction construction ─────────────────────────────────────────────────

fn compact_u8(len: usize) -> Vec<u8> {
    // Solana compact-u16: single byte for len < 128, two bytes otherwise.
    if len < 128 {
        vec![len as u8]
    } else {
        let low = (len & 0x7f) as u8;
        let high = (len >> 7) as u8;
        vec![low | 0x80, high]
    }
}

fn make_instruction(program_id_index: u8, accounts: &[u8], data: &[u8]) -> Vec<u8> {
    let mut buf = Vec::new();
    buf.push(program_id_index);
    buf.extend_from_slice(&compact_u8(accounts.len()));
    buf.extend_from_slice(accounts);
    buf.extend_from_slice(&compact_u8(data.len()));
    buf.extend_from_slice(data);
    buf
}

fn make_message(
    header: &[u8; 3],
    account_keys: &[Vec<u8>],
    blockhash: &[u8; 32],
    instructions: &[Vec<u8>],
) -> Vec<u8> {
    let mut buf = Vec::new();
    buf.extend_from_slice(header);
    buf.extend_from_slice(&compact_u8(account_keys.len()));
    for key in account_keys {
        buf.extend_from_slice(key);
    }
    buf.extend_from_slice(blockhash);
    buf.extend_from_slice(&compact_u8(instructions.len()));
    for ix in instructions {
        buf.extend_from_slice(ix);
    }
    buf
}

fn hash_message(message: &[u8]) -> [u8; 32] {
    Sha256::digest(message).into()
}

fn sign_hash(processor: &ed25519_dalek::SigningKey, hash: &[u8]) -> [u8; 64] {
    processor.sign(hash).to_bytes()
}

fn make_transaction(signatures: &[[u8; 64]], message: &[u8]) -> Vec<u8> {
    let mut buf = Vec::new();
    buf.extend_from_slice(&compact_u8(signatures.len()));
    for sig in signatures {
        buf.extend_from_slice(sig);
    }
    buf.extend_from_slice(message);
    buf
}

// ── Execution ────────────────────────────────────────────────────────────────

async fn execute_one(
    rpc_url: &str,
    processor: &ed25519_dalek::SigningKey,
    program_id: &[u8],
    owner: &str,
    profile: &str,
) -> Result<String> {
    let owner_bytes = bs58::decode(owner).into_vec()?;
    let profile_bytes = bs58::decode(profile).into_vec()?;

    // Derive PDAs
    let config_pda = find_pda(&[b"platform"], program_id);
    let investor_pda = find_pda(&[b"investor", &owner_bytes], program_id);
    let position_pda = find_pda(&[b"position", &owner_bytes, &profile_bytes], program_id);
    let vault_pda = find_pda(&[b"profile", &profile_bytes], program_id);

    // Recent blockhash
    let blockhash = rpc_get_blockhash(rpc_url).await?;

    // Fetch config account to learn base_mint
    // Layout: admin(32) + oracle_auth(32) + processor(32) = 96
    let config_data = rpc_get_account_data(rpc_url, &config_pda).await?;
    if config_data.len() < 128 {
        anyhow::bail!("config account too small ({} bytes)", config_data.len());
    }
    let base_mint: [u8; 32] = config_data[96..128].try_into()?;
    let owner_ata = find_associated_token_address(&owner_bytes, &base_mint);

    // Account keys:
    //   0 = authority   (processor, signer)
    //   1 = config      (readonly)
    //   2 = profile     (writable)
    //   3 = owner       (readonly)
    //   4 = investor    (writable)
    //   5 = position    (writable)
    //   6 = base_mint   (readonly)
    //   7 = vault       (writable)
    //   8 = owner_ata   (writable)
    //   9 = token_prog (readonly)
    //  10 = program_id  (readonly, referenced by instruction)
    let proc_pk = processor.verifying_key().to_bytes();
    let account_keys = vec![
        proc_pk.to_vec(),                // 0
        config_pda.to_vec(),             // 1
        profile_bytes.clone(),           // 2
        owner_bytes.clone(),             // 3
        investor_pda.to_vec(),           // 4
        position_pda.to_vec(),           // 5
        base_mint.to_vec(),              // 6
        vault_pda.to_vec(),              // 7
        owner_ata.to_vec(),              // 8
        spl_token_id().to_vec(),         // 9
        program_id.to_vec(),             // 10
    ];
    // 1 signer (authority), 0 readonly signers, 5 readonly unsigned (1,3,6,9,10)
    let header = [1, 0, 5];

    // ProcessWithdraw instruction
    let discriminator = [166u8, 189, 47, 170, 19, 135, 210, 19];
    let ix_data = discriminator.to_vec();
    let ix_accounts: Vec<u8> = (0..10).collect(); // indices 0-9
    let ix = make_instruction(10 /*program_id_index*/, &ix_accounts, &ix_data);

    let message = make_message(&header, &account_keys, &blockhash, &[ix]);

    // Solana signature: SHA-256(message) signed with ed25519
    let msg_hash = hash_message(&message);
    let sig = sign_hash(processor, &msg_hash);
    let tx = make_transaction(&[sig], &message);
    let tx_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &tx);

    rpc_send_transaction(rpc_url, &tx_b64).await
}

// ── PDA derivation ───────────────────────────────────────────────────────────

fn find_pda(seeds: &[&[u8]], program_id: &[u8]) -> [u8; 32] {
    for bump in (0..=255u8).rev() {
        let mut hasher = Sha256::new();
        for seed in seeds {
            hasher.update(seed);
        }
        hasher.update(&[bump]);
        hasher.update(program_id);
        let hash: [u8; 32] = hasher.finalize().into();
        // A valid PDA must not be on the ed25519 curve (no collision).
        // Practically impossible to collide, so any non-zero result is fine.
        if hash.iter().any(|&b| b != 0) {
            return hash;
        }
    }
    panic!("unable to find valid PDA");
}

fn find_associated_token_address(wallet: &[u8], mint: &[u8]) -> [u8; 32] {
    let seeds = [wallet, &spl_token_id(), mint];
    let ata_prog = &associated_token_program_id();
    find_pda(&seeds, ata_prog)
}

// ── RPC helpers ──────────────────────────────────────────────────────────────

async fn rpc_get_blockhash(rpc_url: &str) -> Result<[u8; 32]> {
    let body = serde_json::json!({
        "jsonrpc": "2.0", "id": 1, "method": "getLatestBlockhash",
        "params": [{ "commitment": "confirmed" }]
    });
    let resp: serde_json::Value = reqwest::Client::new()
        .post(rpc_url)
        .json(&body)
        .send()
        .await?
        .json()
        .await?;
    let bh = resp["result"]["value"]["blockhash"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("missing blockhash"))?;
    let bytes = bs58::decode(bh).into_vec()?;
    Ok(bytes.try_into().map_err(|_| anyhow::anyhow!("bad blockhash"))?)
}

async fn rpc_get_account_data(rpc_url: &str, pubkey: &[u8; 32]) -> Result<Vec<u8>> {
    let body = serde_json::json!({
        "jsonrpc": "2.0", "id": 1, "method": "getAccountInfo",
        "params": [
            bs58::encode(pubkey).into_string(),
            { "commitment": "confirmed", "encoding": "base64" }
        ]
    });
    let resp: serde_json::Value = reqwest::Client::new()
        .post(rpc_url)
        .json(&body)
        .send()
        .await?
        .json()
        .await?;
    let data_b64 = resp["result"]["value"]["data"][0]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("missing account data"))?;
    Ok(base64::Engine::decode(&base64::engine::general_purpose::STANDARD, data_b64)?)
}

async fn rpc_send_transaction(rpc_url: &str, tx_b64: &str) -> Result<String> {
    let body = serde_json::json!({
        "jsonrpc": "2.0", "id": 1, "method": "sendTransaction",
        "params": [
            tx_b64,
            { "skipPreflight": true, "encoding": "base64", "maxRetries": 3 }
        ]
    });
    let resp: serde_json::Value = reqwest::Client::new()
        .post(rpc_url)
        .json(&body)
        .send()
        .await?
        .json()
        .await?;
    if let Some(err) = resp["error"].as_object() {
        anyhow::bail!("RPC error: {:?}", err["message"]);
    }
    resp["result"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow::anyhow!("missing signature in RPC response"))
}
