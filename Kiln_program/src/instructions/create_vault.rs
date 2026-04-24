use wincode::deserialize_exact;

use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    pubkey::find_program_address,
    sysvars::{clock::Clock, rent::Rent},
    ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;
use wincode::SchemaRead;

use crate::{
    errors::KilnError,
    states::{
        ManagerProfile, VaultConfig, VaultState, TREASURY_SEED, VAULT_CONFIG_SEED, VAULT_STATE_SEED,
    },
};

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, SchemaRead)]
pub struct CreateVaultArgs {
    pub paper_window_secs: i64,
    pub min_qualifying_trades: u16,
    pub max_slippage_bps: u16,
    pub manager_fee_bps: u16,
    pub _reserved: [u8; 2],
    pub name: [u8; 32],
}

pub fn create_vault(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [manager, manager_profile, vault_config, vault_state, treasury, rent_sysvar, clock_sysvar, system_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !manager.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !manager.is_writable()
        || !manager_profile.is_writable()
        || !vault_config.is_writable()
        || !vault_state.is_writable()
        || !treasury.is_writable()
    {
        return Err(ProgramError::InvalidAccountData);
    }
    if system_program.key() != &pinocchio_system::ID {
        return Err(KilnError::InvalidSystemProgram.into());
    }
    if !vault_config.data_is_empty() || !vault_state.data_is_empty() || !treasury.data_is_empty() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let args: CreateVaultArgs =
        deserialize_exact(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    if args.max_slippage_bps == 0 || args.manager_fee_bps > 2_000 || args.paper_window_secs <= 0 {
        return Err(KilnError::InvalidVaultConfiguration.into());
    }

    let rent = Rent::from_account_info(rent_sysvar)?;
    let clock = Clock::from_account_info(clock_sysvar)?;

    let manager_snapshot = ManagerProfile::load(manager_profile)?;
    if manager_snapshot.owner != *manager.key() {
        return Err(KilnError::ManagerMismatch.into());
    }

    let vault_index = manager_snapshot.total_vaults;
    let index_bytes = vault_index.to_le_bytes();
    let (expected_config, config_bump) = find_program_address(
        &[VAULT_CONFIG_SEED, manager.key().as_ref(), &index_bytes],
        &crate::ID,
    );
    if vault_config.key() != &expected_config {
        return Err(KilnError::InvalidVaultConfigPda.into());
    }

    let (expected_state, state_bump) =
        find_program_address(&[VAULT_STATE_SEED, vault_config.key().as_ref()], &crate::ID);
    if vault_state.key() != &expected_state {
        return Err(KilnError::InvalidVaultStatePda.into());
    }

    let (expected_treasury, treasury_bump) =
        find_program_address(&[TREASURY_SEED, vault_config.key().as_ref()], &crate::ID);
    if treasury.key() != &expected_treasury {
        return Err(KilnError::InvalidTreasuryPda.into());
    }

    let config_bump_seed = [config_bump];
    let config_signer_seeds = [
        Seed::from(VAULT_CONFIG_SEED),
        Seed::from(manager.key().as_ref()),
        Seed::from(&index_bytes[..]),
        Seed::from(&config_bump_seed[..]),
    ];
    let config_signers = [Signer::from(&config_signer_seeds[..])];
    CreateAccount {
        from: manager,
        to: vault_config,
        lamports: rent.minimum_balance(VaultConfig::LEN),
        space: VaultConfig::LEN as u64,
        owner: &crate::ID,
    }
    .invoke_signed(&config_signers)?;

    let state_bump_seed = [state_bump];
    let state_signer_seeds = [
        Seed::from(VAULT_STATE_SEED),
        Seed::from(vault_config.key().as_ref()),
        Seed::from(&state_bump_seed[..]),
    ];
    let state_signers = [Signer::from(&state_signer_seeds[..])];
    CreateAccount {
        from: manager,
        to: vault_state,
        lamports: rent.minimum_balance(VaultState::LEN),
        space: VaultState::LEN as u64,
        owner: &crate::ID,
    }
    .invoke_signed(&state_signers)?;

    let treasury_rent_lamports = rent.minimum_balance(0);
    let treasury_bump_seed = [treasury_bump];
    let treasury_signer_seeds = [
        Seed::from(TREASURY_SEED),
        Seed::from(vault_config.key().as_ref()),
        Seed::from(&treasury_bump_seed[..]),
    ];
    let treasury_signers = [Signer::from(&treasury_signer_seeds[..])];
    CreateAccount {
        from: manager,
        to: treasury,
        lamports: treasury_rent_lamports,
        space: 0,
        owner: &crate::ID,
    }
    .invoke_signed(&treasury_signers)?;

    VaultConfig::initialize(
        vault_config,
        manager.key(),
        manager_profile.key(),
        vault_state.key(),
        treasury.key(),
        vault_index,
        &args,
        config_bump,
        state_bump,
        treasury_bump,
        treasury_rent_lamports,
        clock.unix_timestamp,
    )?;

    VaultState::initialize(
        vault_state,
        vault_config.key(),
        state_bump,
        args.min_qualifying_trades,
        clock.unix_timestamp,
    )?;

    let mut manager_profile = ManagerProfile::load_mut(manager_profile)?;
    manager_profile.total_vaults = manager_profile
        .total_vaults
        .checked_add(1)
        .ok_or(KilnError::MathOverflow)?;
    manager_profile.active_vaults = manager_profile
        .active_vaults
        .checked_add(1)
        .ok_or(KilnError::MathOverflow)?;

    Ok(())
}
