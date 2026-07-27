use sha2::{Digest, Sha256};

/// Compute the 8-byte Anchor discriminator: sha256("global:<name>")[..8]
pub fn discriminator(name: &str) -> [u8; 8] {
    let mut h = Sha256::new();
    h.update(b"global:");
    h.update(name.as_bytes());
    let result = h.finalize();
    let mut disc = [0u8; 8];
    disc.copy_from_slice(&result[..8]);
    disc
}

/// PDA seed for the platform config.
pub const CONFIG_SEED: &[u8] = b"platform";

/// PDA seeds for trader profile.
pub fn profile_seeds(trader: &[u8; 32]) -> Vec<Vec<u8>> {
    vec![b"profile".to_vec(), trader.to_vec()]
}

/// Account meta for an instruction.
#[derive(Debug, Clone, serde::Serialize)]
pub struct AccountMeta {
    pub pubkey: String,
    pub is_signer: bool,
    pub is_writable: bool,
}

/// A built instruction ready for the TS sidecar to sign.
#[derive(Debug, Clone, serde::Serialize)]
pub struct VaultInstruction {
    pub program_id: String,
    pub accounts: Vec<AccountMeta>,
    pub data: Vec<u8>,
    /// Hex-encoded data for the sidecar
    pub data_hex: String,
}

impl VaultInstruction {
    fn new(program_id: &str, accounts: Vec<AccountMeta>, data: Vec<u8>) -> Self {
        let data_hex = hex::encode(&data);
        Self {
            program_id: program_id.to_string(),
            accounts,
            data,
            data_hex,
        }
    }
}

/// Build a `fund_execution` instruction for the vault program.
///
/// Transfers `amount` (USDC minor units, 6 decimals) from the vault token
/// account to the execution wallet's ATA.
pub fn fund_execution(
    amount: u64,
    admin: &str,
    config_pda: &str,
    profile_pda: &str,
    vault_token: &str,
    execution_wallet_ata: &str,
) -> VaultInstruction {
    let program_id = "FPoAMRkM3kXfuvFn1iC2cM8B554KfnaPjibjLH31CHtd";
    let base_mint = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
    let token_program = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

    let mut data = Vec::with_capacity(16);
    data.extend_from_slice(&discriminator("fund_execution"));
    data.extend_from_slice(&amount.to_le_bytes());

    VaultInstruction::new(
        program_id,
        vec![
            AccountMeta { pubkey: admin.to_string(), is_signer: true, is_writable: true },
            AccountMeta { pubkey: admin.to_string(), is_signer: true, is_writable: false },
            AccountMeta { pubkey: config_pda.to_string(), is_signer: false, is_writable: false },
            AccountMeta { pubkey: profile_pda.to_string(), is_signer: false, is_writable: true },
            AccountMeta { pubkey: base_mint.to_string(), is_signer: false, is_writable: false },
            AccountMeta { pubkey: vault_token.to_string(), is_signer: false, is_writable: true },
            AccountMeta { pubkey: execution_wallet_ata.to_string(), is_signer: false, is_writable: true },
            AccountMeta { pubkey: token_program.to_string(), is_signer: false, is_writable: false },
        ],
        data,
    )
}

/// Build a sweep instruction (vanilla SPL Token transfer).
pub fn sweep(
    amount: u64,
    source_ata: &str,
    dest_ata: &str,
    owner: &str,
) -> VaultInstruction {
    let token_program = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

    // SPL Token Transfer instruction
    let mut data = vec![3u8, 0, 0, 0]; // Transfer variant
    data.extend_from_slice(&amount.to_le_bytes());

    VaultInstruction::new(
        token_program,
        vec![
            AccountMeta { pubkey: source_ata.to_string(), is_signer: false, is_writable: true },
            AccountMeta { pubkey: dest_ata.to_string(), is_signer: false, is_writable: true },
            AccountMeta { pubkey: owner.to_string(), is_signer: true, is_writable: false },
        ],
        data,
    )
}
