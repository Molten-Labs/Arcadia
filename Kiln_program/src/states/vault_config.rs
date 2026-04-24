use bytemuck::{from_bytes, from_bytes_mut, Pod, Zeroable};
use pinocchio::{
    account_info::{AccountInfo, Ref, RefMut},
    program_error::ProgramError,
    pubkey::Pubkey,
    ProgramResult,
};
use shank::ShankAccount;

use crate::{
    errors::KilnError,
    instructions::create_vault::CreateVaultArgs,
};

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable, ShankAccount)]
pub struct VaultConfig {
    pub discriminator: u8,
    pub config_bump: u8,
    pub state_bump: u8,
    pub treasury_bump: u8,
    pub manager_fee_bps: u16,
    pub max_slippage_bps: u16,
    pub manager: Pubkey,
    pub manager_profile: Pubkey,
    pub vault_state: Pubkey,
    pub treasury: Pubkey,
    pub paper_window_secs: i64,
    pub created_at: i64,
    pub treasury_rent_lamports: u64,
    pub vault_index: u16,
    pub _reserved: [u8; 6],
    pub name: [u8; 32],
}

impl VaultConfig {
    pub const DISCRIMINATOR: u8 = 2;
    pub const LEN: usize = core::mem::size_of::<Self>();

    #[allow(clippy::too_many_arguments)]
    pub fn initialize(
        account: &AccountInfo,
        manager: &Pubkey,
        manager_profile: &Pubkey,
        vault_state: &Pubkey,
        treasury: &Pubkey,
        vault_index: u16,
        args: &CreateVaultArgs,
        config_bump: u8,
        state_bump: u8,
        treasury_bump: u8,
        treasury_rent_lamports: u64,
        created_at: i64,
    ) -> ProgramResult {
        let mut config = Self::load_mut(account)?;
        *config = Self {
            discriminator: Self::DISCRIMINATOR,
            config_bump,
            state_bump,
            treasury_bump,
            manager_fee_bps: args.manager_fee_bps,
            max_slippage_bps: args.max_slippage_bps,
            manager: *manager,
            manager_profile: *manager_profile,
            vault_state: *vault_state,
            treasury: *treasury,
            paper_window_secs: args.paper_window_secs,
            created_at,
            treasury_rent_lamports,
            vault_index,
            _reserved: [0; 6],
            name: args.name,
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
