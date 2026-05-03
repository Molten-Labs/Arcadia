use bytemuck::{from_bytes, from_bytes_mut, Pod, Zeroable};
use pinocchio::{
    account_info::{AccountInfo, Ref, RefMut},
    program_error::ProgramError,
    pubkey::Pubkey,
    ProgramResult,
};
use shank::ShankAccount;

use crate::errors::KilnError;

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, ShankAccount)]
pub struct ManagerProfile {
    pub discriminator: u8,
    pub bump: u8,
    pub _padding: [u8; 6],
    pub owner: Pubkey,
    pub created_at: i64,
    pub total_junior_deposited: u64,
    pub total_vaults: u16,
    pub active_vaults: u16,
    pub _reserved: [u8; 4],
}

impl ManagerProfile {
    pub const DISCRIMINATOR: u8 = 1;
    pub const LEN: usize = core::mem::size_of::<Self>();

    pub fn initialize(
        account: &AccountInfo,
        owner: &Pubkey,
        bump: u8,
        created_at: i64,
    ) -> ProgramResult {
        let mut profile = Self::load_mut(account)?;
        *profile = Self {
            discriminator: Self::DISCRIMINATOR,
            bump,
            _padding: [0; 6],
            owner: *owner,
            created_at,
            total_junior_deposited: 0,
            total_vaults: 0,
            active_vaults: 0,
            _reserved: [0; 4],
        };
        Ok(())
    }

    pub fn load(account: &AccountInfo) -> Result<Ref<'_, Self>, ProgramError> {
        if !account.is_owned_by(&crate::ID) || account.data_len() != Self::LEN {
            return Err(ProgramError::InvalidAccountData);
        }
        let data = account.try_borrow_data()?;
        let state = Ref::map(data, |bytes| from_bytes::<Self>(bytes));
        if state.discriminator != Self::DISCRIMINATOR {
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
}
