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
pub struct VaultState {
    pub discriminator: u8,
    pub bump: u8,
    pub is_paper_mode: u8,
    pub is_graduated: u8,
    pub is_paused: u8,
    pub trading_enabled: u8,
    pub _flag_padding: [u8; 2],
    pub vault_config: Pubkey,
    pub original_junior_deposit: u64,
    pub junior_capital: u64,
    pub senior_capital: u64,
    pub junior_shares_outstanding: u64,
    pub senior_shares_outstanding: u64,
    pub current_nav: u64,
    pub last_nav: u64,
    pub high_water_mark: u64,
    pub created_at: i64,
    pub last_nav_update_at: i64,
    pub graduated_at: i64,
    pub cooldown_until: i64,
    pub paper_trade_count: u16,
    pub min_qualifying_trades: u16,
    pub rolling_24h_loss_bps: u16,
    pub rolling_7d_loss_bps: u16,
}

impl VaultState {
    pub const DISCRIMINATOR: u8 = 3;
    pub const LEN: usize = core::mem::size_of::<Self>();

    pub fn initialize(
        account: &AccountInfo,
        vault_config: &Pubkey,
        bump: u8,
        min_qualifying_trades: u16,
        created_at: i64,
    ) -> ProgramResult {
        let mut state = Self::load_mut(account)?;
        *state = Self {
            discriminator: Self::DISCRIMINATOR,
            bump,
            is_paper_mode: 1,
            is_graduated: 0,
            is_paused: 0,
            trading_enabled: 1,
            _flag_padding: [0; 2],
            vault_config: *vault_config,
            original_junior_deposit: 0,
            junior_capital: 0,
            senior_capital: 0,
            junior_shares_outstanding: 0,
            senior_shares_outstanding: 0,
            current_nav: 0,
            last_nav: 0,
            high_water_mark: 0,
            created_at,
            last_nav_update_at: created_at,
            graduated_at: 0,
            cooldown_until: 0,
            paper_trade_count: 0,
            min_qualifying_trades,
            rolling_24h_loss_bps: 0,
            rolling_7d_loss_bps: 0,
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
