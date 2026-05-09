use bytemuck::{from_bytes, from_bytes_mut, Pod, Zeroable};
use pinocchio::{
    account_info::{AccountInfo, Ref, RefMut},
    program_error::ProgramError,
    pubkey::Pubkey,
    ProgramResult,
};
use shank::ShankAccount;

use crate::{errors::KilnError, instructions::magicblock_er::DELEGATION_PROGRAM_ID};

pub const PRIVATE_INTENT_STATUS_INITIALIZED: u8 = 1;
pub const PRIVATE_INTENT_STATUS_DELEGATED: u8 = 2;
pub const PRIVATE_INTENT_STATUS_EXECUTING: u8 = 3;
pub const PRIVATE_INTENT_STATUS_COMMITTED: u8 = 4;
pub const PRIVATE_INTENT_STATUS_UNDELEGATING: u8 = 5;
pub const PRIVATE_INTENT_STATUS_RECLAIMED: u8 = 6;
pub const PRIVATE_INTENT_STATUS_FAILED: u8 = 7;

pub const PRIVATE_INTENT_GUARD_PENDING: u8 = 0;
pub const PRIVATE_INTENT_GUARD_APPROVED: u8 = 1;
pub const PRIVATE_INTENT_GUARD_REJECTED: u8 = 2;

pub const PRIVATE_INTENT_SETTLEMENT_PENDING: u8 = 0;
pub const PRIVATE_INTENT_SETTLEMENT_SUCCESS: u8 = 1;
pub const PRIVATE_INTENT_SETTLEMENT_LOSS: u8 = 2;
pub const PRIVATE_INTENT_SETTLEMENT_FAILED: u8 = 3;

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, ShankAccount)]
pub struct PrivateIntentSessionAccount {
    pub discriminator: u8,
    pub bump: u8,
    pub status: u8,
    pub guard_decision: u8,
    pub settlement_result: u8,
    pub version: u8,
    pub _padding: [u8; 2],
    pub manager: Pubkey,
    pub vault_config: Pubkey,
    pub session_id: [u8; 32],
    pub intent_commitment: [u8; 32],
    pub proof_hash: [u8; 32],
    pub er_state_root: [u8; 32],
    pub max_in_amount: u64,
    pub expires_at: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

impl PrivateIntentSessionAccount {
    pub const DISCRIMINATOR: u8 = 5;
    pub const VERSION: u8 = 1;
    pub const LEN: usize = core::mem::size_of::<Self>();

    #[allow(clippy::too_many_arguments)]
    pub fn initialize(
        account: &AccountInfo,
        manager: &Pubkey,
        vault_config: &Pubkey,
        session_id: &[u8; 32],
        intent_commitment: &[u8; 32],
        max_in_amount: u64,
        expires_at: i64,
        bump: u8,
        created_at: i64,
    ) -> ProgramResult {
        let mut session = Self::load_mut(account)?;
        *session = Self {
            discriminator: Self::DISCRIMINATOR,
            bump,
            status: PRIVATE_INTENT_STATUS_INITIALIZED,
            guard_decision: PRIVATE_INTENT_GUARD_PENDING,
            settlement_result: PRIVATE_INTENT_SETTLEMENT_PENDING,
            version: Self::VERSION,
            _padding: [0; 2],
            manager: *manager,
            vault_config: *vault_config,
            session_id: *session_id,
            intent_commitment: *intent_commitment,
            proof_hash: [0; 32],
            er_state_root: [0; 32],
            max_in_amount,
            expires_at,
            created_at,
            updated_at: created_at,
        };
        Ok(())
    }

    pub fn load(account: &AccountInfo) -> Result<Ref<'_, Self>, ProgramError> {
        if !account.is_owned_by(&crate::ID) || account.data_len() != Self::LEN {
            return Err(ProgramError::InvalidAccountData);
        }
        let data = account.try_borrow_data()?;
        let state = Ref::map(data, |bytes| from_bytes::<Self>(bytes));
        if state.discriminator != Self::DISCRIMINATOR || state.version != Self::VERSION {
            return Err(KilnError::InvalidAccountDiscriminator.into());
        }
        Ok(state)
    }

    pub fn load_mut(account: &AccountInfo) -> Result<RefMut<'_, Self>, ProgramError> {
        if !account.is_owned_by(&crate::ID) || account.data_len() != Self::LEN {
            return Err(ProgramError::InvalidAccountData);
        }
        let data = account.try_borrow_mut_data()?;
        let state = RefMut::map(data, |bytes| from_bytes_mut::<Self>(bytes));
        if state.discriminator != Self::DISCRIMINATOR && state.discriminator != 0 {
            return Err(KilnError::InvalidAccountDiscriminator.into());
        }
        Ok(state)
    }

    pub fn load_mut_for_er(account: &AccountInfo) -> Result<RefMut<'_, Self>, ProgramError> {
        let owned_by_arcadia = account.is_owned_by(&crate::ID);
        let owned_by_delegation = account.is_owned_by(&DELEGATION_PROGRAM_ID);
        if (!owned_by_arcadia && !owned_by_delegation) || account.data_len() != Self::LEN {
            return Err(ProgramError::InvalidAccountData);
        }
        let data = account.try_borrow_mut_data()?;
        let state = RefMut::map(data, |bytes| from_bytes_mut::<Self>(bytes));
        if state.discriminator != Self::DISCRIMINATOR || state.version != Self::VERSION {
            return Err(KilnError::InvalidAccountDiscriminator.into());
        }
        Ok(state)
    }
}
