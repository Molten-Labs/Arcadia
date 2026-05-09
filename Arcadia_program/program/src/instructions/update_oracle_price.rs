use core::convert::TryInto;

use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    pubkey::find_program_address,
    sysvars::{clock::Clock, rent::Rent},
    ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;

use crate::errors::KilnError;

/// Devnet/demo oracle adapter.
///
/// Mainnet production should replace these adapter accounts with verified Pyth
/// receiver decoding. For devnet, this gives the program a real owned account
/// path so NAV and withdrawals can be tested through wallet transactions.
pub fn update_oracle_price(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [payer, price_account, rent_sysvar, clock_sysvar, system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !payer.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !payer.is_writable() || !price_account.is_writable() {
        return Err(ProgramError::InvalidAccountData);
    }
    if system_program.key() != &pinocchio_system::ID {
        return Err(KilnError::InvalidSystemProgram.into());
    }
    if data.len() != 17 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let feed = data[0];
    if feed != super::custody::PRICE_FEED_SOL_USD && feed != super::custody::PRICE_FEED_USDC_USD {
        return Err(KilnError::InvalidPriceFeed.into());
    }
    let price = u64::from_le_bytes(
        data[1..9]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    let confidence = u64::from_le_bytes(
        data[9..17]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    if price == 0 || confidence == 0 {
        return Err(KilnError::InvalidPriceFeed.into());
    }

    let feed_seed = [feed];
    let (expected_price_account, bump) =
        find_program_address(&[super::custody::PRICE_FEED_SEED, &feed_seed], &crate::ID);
    if price_account.key() != &expected_price_account {
        return Err(KilnError::InvalidOracleAccount.into());
    }

    if price_account.data_is_empty() {
        let rent = Rent::from_account_info(rent_sysvar)?;
        let bump_seed = [bump];
        let signer_seeds = [
            Seed::from(super::custody::PRICE_FEED_SEED),
            Seed::from(&feed_seed[..]),
            Seed::from(&bump_seed[..]),
        ];
        let signers = [Signer::from(&signer_seeds[..])];
        CreateAccount {
            from: payer,
            to: price_account,
            lamports: rent.minimum_balance(super::custody::PRICE_ACCOUNT_LEN),
            space: super::custody::PRICE_ACCOUNT_LEN as u64,
            owner: &crate::ID,
        }
        .invoke_signed(&signers)?;
    }

    if !price_account.is_owned_by(&crate::ID)
        || price_account.data_len() != super::custody::PRICE_ACCOUNT_LEN
    {
        return Err(KilnError::InvalidOracleAccount.into());
    }

    let clock = Clock::from_account_info(clock_sysvar)?;
    let mut account_data = price_account.try_borrow_mut_data()?;
    account_data[0..8].copy_from_slice(super::custody::PRICE_MAGIC);
    account_data[8] = feed;
    account_data[9..16].copy_from_slice(&[0_u8; 7]);
    account_data[16..24].copy_from_slice(&(price as i64).to_le_bytes());
    account_data[24..32].copy_from_slice(&confidence.to_le_bytes());
    account_data[32..40].copy_from_slice(&clock.unix_timestamp.to_le_bytes());

    Ok(())
}
