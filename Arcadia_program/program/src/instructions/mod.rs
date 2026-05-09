use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::program_error::ProgramError;
use shank::ShankInstruction;

pub mod claim_fees;
pub mod create_vault;
pub mod custody;
pub mod deposit_junior;
pub mod deposit_senior;
pub mod execute_swap;
pub mod init_manager;
pub mod magicblock_er;
pub mod update_nav;
pub mod update_oracle_price;
pub mod vault_guard;
pub mod withdraw_junior;
pub mod withdraw_senior;

pub use claim_fees::*;
pub use create_vault::*;
pub use deposit_junior::*;
pub use deposit_senior::*;
pub use execute_swap::*;
pub use init_manager::*;
pub use magicblock_er::*;
pub use update_nav::*;
pub use update_oracle_price::*;
pub use withdraw_junior::*;
pub use withdraw_senior::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum ProgramInstruction {
    InitManager = 0,
    CreateVault = 1,
    DepositJunior = 2,
    UpdateNav = 3,
    GraduateVault = 4,
    DepositSenior = 5,
    WithdrawSenior = 6,
    WithdrawJunior = 7,
    ClaimFees = 8,
    ExecuteSwap = 9,
    UpdateOraclePrice = 10,
    InitPrivateIntentSession = 11,
    DelegatePrivateIntentSession = 12,
    RecordPrivateIntentOnEr = 13,
    CommitPrivateIntentSession = 14,
    CommitAndUndelegatePrivateIntentSession = 15,
}

impl TryFrom<&u8> for ProgramInstruction {
    type Error = ProgramError;

    fn try_from(value: &u8) -> Result<Self, Self::Error> {
        match *value {
            0 => Ok(ProgramInstruction::InitManager),
            1 => Ok(ProgramInstruction::CreateVault),
            2 => Ok(ProgramInstruction::DepositJunior),
            3 => Ok(ProgramInstruction::UpdateNav),
            4 => Ok(ProgramInstruction::GraduateVault),
            5 => Ok(ProgramInstruction::DepositSenior),
            6 => Ok(ProgramInstruction::WithdrawSenior),
            7 => Ok(ProgramInstruction::WithdrawJunior),
            8 => Ok(ProgramInstruction::ClaimFees),
            9 => Ok(ProgramInstruction::ExecuteSwap),
            10 => Ok(ProgramInstruction::UpdateOraclePrice),
            11 => Ok(ProgramInstruction::InitPrivateIntentSession),
            12 => Ok(ProgramInstruction::DelegatePrivateIntentSession),
            13 => Ok(ProgramInstruction::RecordPrivateIntentOnEr),
            14 => Ok(ProgramInstruction::CommitPrivateIntentSession),
            15 => Ok(ProgramInstruction::CommitAndUndelegatePrivateIntentSession),
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}

#[derive(Clone, Debug, ShankInstruction, BorshSerialize, BorshDeserialize)]
pub enum KilnInstructionIdl {
    /// Initialize a manager profile
    #[account(0, writable, signer, name = "manager")]
    #[account(1, writable, name = "manager_profile")]
    #[account(2, name = "rent")]
    #[account(3, name = "clock")]
    #[account(4, name = "system_program")]
    InitManager,

    /// Create a new vault (paper mode)
    #[account(0, writable, signer, name = "manager")]
    #[account(1, writable, name = "manager_profile")]
    #[account(2, writable, name = "vault_config")]
    #[account(3, writable, name = "vault_state")]
    #[account(4, writable, name = "treasury")]
    #[account(5, name = "rent")]
    #[account(6, name = "clock")]
    #[account(7, name = "system_program")]
    CreateVault(CreateVaultArgsIdl),

    /// Deposit junior capital into a vault
    #[account(0, writable, signer, name = "manager")]
    #[account(1, writable, name = "manager_profile")]
    #[account(2, name = "vault_config")]
    #[account(3, writable, name = "vault_state")]
    #[account(4, writable, name = "treasury")]
    #[account(5, name = "clock")]
    #[account(6, name = "system_program")]
    DepositJunior(DepositJuniorArgsIdl),

    /// Recompute NAV and apply waterfall loss logic.
    /// Accounts:
    /// 0: updater (optional signer)
    /// 1: vault_config
    /// 2: vault_state (writable)
    /// 3: treasury (writable)
    /// 4: pyth_price (optional / placeholder)
    /// 5: clock
    #[account(0, name = "updater")]
    #[account(1, name = "vault_config")]
    #[account(2, writable, name = "vault_state")]
    #[account(3, writable, name = "treasury")]
    #[account(4, name = "pyth_price")]
    #[account(5, name = "clock")]
    UpdateNav,

    /// Attempt to graduate a paper-mode vault.
    #[account(0, signer, name = "caller")]
    #[account(1, writable, name = "vault_state")]
    #[account(2, name = "vault_config")]
    #[account(3, name = "treasury")]
    #[account(4, writable, name = "manager_profile")]
    #[account(5, name = "clock")]
    GraduateVault,

    /// Deposit senior capital into a graduated vault.
    #[account(0, writable, signer, name = "investor")]
    #[account(1, name = "vault_config")]
    #[account(2, writable, name = "vault_state")]
    #[account(3, writable, name = "treasury")]
    #[account(4, writable, name = "investor_position")]
    #[account(5, name = "rent")]
    #[account(6, name = "clock")]
    #[account(7, name = "system_program")]
    DepositSenior(DepositSeniorArgsIdl),

    /// Withdraw senior capital from a vault.
    #[account(0, writable, signer, name = "investor")]
    #[account(1, name = "vault_config")]
    #[account(2, writable, name = "vault_state")]
    #[account(3, writable, name = "treasury")]
    #[account(4, writable, name = "investor_position")]
    #[account(5, name = "clock")]
    WithdrawSenior(WithdrawSeniorArgsIdl),

    /// Withdraw junior capital from a vault.
    #[account(0, writable, signer, name = "manager")]
    #[account(1, writable, name = "manager_profile")]
    #[account(2, name = "vault_config")]
    #[account(3, writable, name = "vault_state")]
    #[account(4, writable, name = "treasury")]
    #[account(5, name = "clock")]
    WithdrawJunior(WithdrawJuniorArgsIdl),

    /// Claim performance fees above high water mark.
    #[account(0, writable, signer, name = "manager")]
    #[account(1, name = "manager_profile")]
    #[account(2, name = "vault_config")]
    #[account(3, writable, name = "vault_state")]
    #[account(4, writable, name = "treasury")]
    #[account(5, name = "clock")]
    ClaimFees,

    /// Execute a swap from the vault treasury (with vault guard checks).
    #[account(0, signer, name = "manager")]
    #[account(1, name = "manager_profile")]
    #[account(2, name = "vault_config")]
    #[account(3, writable, name = "vault_state")]
    #[account(4, writable, name = "treasury")]
    #[account(5, name = "clock")]
    ExecuteSwap(ExecuteSwapArgsIdl),

    /// Upsert a devnet/demo oracle adapter price account.
    #[account(0, writable, signer, name = "payer")]
    #[account(1, writable, name = "price_account")]
    #[account(2, name = "rent")]
    #[account(3, name = "clock")]
    #[account(4, name = "system_program")]
    UpdateOraclePrice(UpdateOraclePriceArgsIdl),

    /// Create a MagicBlock ER private intent session PDA. This account stores only public proof commitments.
    #[account(0, writable, signer, name = "manager")]
    #[account(1, name = "manager_profile")]
    #[account(2, name = "vault_config")]
    #[account(3, writable, name = "private_intent_session")]
    #[account(4, name = "rent")]
    #[account(5, name = "clock")]
    #[account(6, name = "system_program")]
    InitPrivateIntentSession(InitPrivateIntentSessionArgsIdl),

    /// Delegate only the private intent session PDA to MagicBlock ER.
    #[account(0, writable, signer, name = "manager")]
    #[account(1, name = "vault_config")]
    #[account(2, writable, name = "private_intent_session")]
    #[account(3, name = "owner_program")]
    #[account(4, writable, name = "delegation_buffer")]
    #[account(5, writable, name = "delegation_record")]
    #[account(6, writable, name = "delegation_metadata")]
    #[account(7, name = "system_program")]
    #[account(8, name = "clock")]
    #[account(9, name = "delegation_program")]
    DelegatePrivateIntentSession(DelegatePrivateIntentSessionArgsIdl),

    /// Record a redacted ER guard/settlement proof on the delegated session account.
    #[account(0, signer, name = "manager")]
    #[account(1, name = "vault_config")]
    #[account(2, writable, name = "private_intent_session")]
    #[account(3, name = "clock")]
    RecordPrivateIntentOnEr(RecordPrivateIntentOnErArgsIdl),

    /// Commit the delegated session state from MagicBlock ER back to base Solana.
    #[account(0, signer, name = "manager")]
    #[account(1, writable, name = "private_intent_session")]
    #[account(2, name = "magic_program")]
    #[account(3, writable, name = "magic_context")]
    #[account(4, name = "clock")]
    CommitPrivateIntentSession,

    /// Commit and undelegate the session PDA after the ER demo proof is complete.
    #[account(0, signer, name = "manager")]
    #[account(1, writable, name = "private_intent_session")]
    #[account(2, name = "magic_program")]
    #[account(3, writable, name = "magic_context")]
    #[account(4, name = "clock")]
    CommitAndUndelegatePrivateIntentSession,
}

#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct CreateVaultArgsIdl {
    pub paper_window_secs: i64,
    pub min_qualifying_trades: u16,
    pub max_slippage_bps: u16,
    pub manager_fee_bps: u16,
    pub _reserved: [u8; 2],
    pub name: [u8; 32],
}

#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct DepositJuniorArgsIdl {
    pub amount_lamports: u64,
}

#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct DepositSeniorArgsIdl {
    pub amount_lamports: u64,
}

#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct WithdrawSeniorArgsIdl {
    pub amount_usdc: u64,
}

#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct WithdrawJuniorArgsIdl {
    pub amount_usdc: u64,
}

#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct ExecuteSwapArgsIdl {
    pub in_amount: u64,
    pub minimum_amount_out: u64,
}

#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct UpdateOraclePriceArgsIdl {
    pub feed: u8,
    pub price: u64,
    pub confidence: u64,
}

#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct InitPrivateIntentSessionArgsIdl {
    pub session_id: [u8; 32],
    pub intent_commitment: [u8; 32],
    pub max_in_amount: u64,
    pub expires_at: i64,
}

#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct DelegatePrivateIntentSessionArgsIdl {
    pub commit_frequency_ms: u32,
    pub _reserved: [u8; 4],
    pub validator: [u8; 32],
}

#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct RecordPrivateIntentOnErArgsIdl {
    pub proof_hash: [u8; 32],
    pub er_state_root: [u8; 32],
    pub observed_in_amount: u64,
    pub guard_decision: u8,
    pub settlement_result: u8,
    pub status: u8,
    pub _reserved: [u8; 5],
}
