use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::program_error::ProgramError;
use shank::ShankInstruction;

pub mod create_vault;
pub mod deposit_junior;
pub mod init_manager;
pub mod update_nav;

pub use create_vault::*;
pub use deposit_junior::*;
pub use init_manager::*;
pub use update_nav::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum ProgramInstruction {
    InitManager = 0,
    CreateVault = 1,
    DepositJunior = 2,
    UpdateNav = 3,
    GraduateVault = 4,
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
    /// Accounts:
    /// 0: caller (signer)
    /// 1: vault_state (writable)
    /// 2: vault_config
    /// 3: treasury
    /// 4: manager_profile (writable)
    /// 5: clock
    #[account(0, name = "caller")]
    #[account(1, writable, name = "vault_state")]
    #[account(2, name = "vault_config")]
    #[account(3, name = "treasury")]
    #[account(4, writable, name = "manager_profile")]
    #[account(5, name = "clock")]
    GraduateVault,
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
