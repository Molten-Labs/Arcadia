use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    pubkey::find_program_address,
    sysvars::{clock::Clock, rent::Rent},
    ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;

use crate::{
    errors::KilnError,
    states::{ManagerProfile, MANAGER_PROFILE_SEED},
};

pub fn init_manager(accounts: &[AccountInfo]) -> ProgramResult {
    let [manager, manager_profile, rent_sysvar, clock_sysvar, system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !manager.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !manager.is_writable() || !manager_profile.is_writable() {
        return Err(ProgramError::InvalidAccountData);
    }
    if system_program.key() != &pinocchio_system::ID {
        return Err(KilnError::InvalidSystemProgram.into());
    }
    if !manager_profile.data_is_empty() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let rent = Rent::from_account_info(rent_sysvar)?;
    let clock = Clock::from_account_info(clock_sysvar)?;

    let (expected_profile, bump) =
        find_program_address(&[MANAGER_PROFILE_SEED, manager.key().as_ref()], &crate::ID);
    if manager_profile.key() != &expected_profile {
        return Err(KilnError::InvalidManagerProfilePda.into());
    }

    let bump_seed = [bump];
    let signer_seeds = [
        Seed::from(MANAGER_PROFILE_SEED),
        Seed::from(manager.key().as_ref()),
        Seed::from(&bump_seed[..]),
    ];
    let signers = [Signer::from(&signer_seeds[..])];
    CreateAccount {
        from: manager,
        to: manager_profile,
        lamports: rent.minimum_balance(ManagerProfile::LEN),
        space: ManagerProfile::LEN as u64,
        owner: &crate::ID,
    }
    .invoke_signed(&signers)?;

    ManagerProfile::initialize(manager_profile, manager.key(), bump, clock.unix_timestamp)?;
    Ok(())
}
