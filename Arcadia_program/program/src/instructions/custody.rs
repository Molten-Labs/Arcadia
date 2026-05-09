use core::convert::TryInto;

use pinocchio::{
    account_info::AccountInfo,
    cpi::{slice_invoke, slice_invoke_signed},
    instruction::{AccountMeta, Instruction, Seed, Signer},
    program_error::ProgramError,
    pubkey::Pubkey,
    ProgramResult,
};

use crate::{errors::KilnError, states::TREASURY_SEED};

pub const TOKEN_ACCOUNT_MINT_OFFSET: usize = 0;
pub const TOKEN_ACCOUNT_OWNER_OFFSET: usize = 32;
pub const TOKEN_ACCOUNT_AMOUNT_OFFSET: usize = 64;
pub const TOKEN_ACCOUNT_MIN_LEN: usize = 72;

pub const USDC_DECIMALS: u64 = 1_000_000;
pub const WSOL_DECIMALS: u64 = 1_000_000_000;
pub const PRICE_SCALE: u64 = 1_000_000;
pub const MIN_LIQUID_USDC_BPS: u64 = 1_000;
pub const MAX_PRICE_STALENESS_SECS: i64 = 90;
pub const MAX_CONFIDENCE_BPS: u64 = 150;

pub const TOKEN_PROGRAM_ID: Pubkey =
    pinocchio_pubkey::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
pub const WSOL_MINT: Pubkey =
    pinocchio_pubkey::pubkey!("So11111111111111111111111111111111111111112");
pub const USDC_MINT: Pubkey =
    pinocchio_pubkey::pubkey!("DLkVtDD4zfFJzWgGRLqjzqkBhaBs5sVNzDeBCQ2hPgMz");

pub const PRICE_MAGIC: &[u8; 8] = b"SYNQPYTH";
pub const PRICE_FEED_SOL_USD: u8 = 1;
pub const PRICE_FEED_USDC_USD: u8 = 2;
pub const PRICE_ACCOUNT_LEN: usize = 40;
pub const PRICE_FEED_SEED: &[u8] = b"price-feed";

const TOKEN_TRANSFER_DISCRIMINATOR: u8 = 3;

#[derive(Clone, Copy)]
pub struct TokenAccountSnapshot {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PriceSnapshot {
    pub price: u64,
    pub confidence: u64,
    pub published_at: i64,
}

pub fn read_token_account(account: &AccountInfo) -> Result<TokenAccountSnapshot, ProgramError> {
    if !account.is_owned_by(&TOKEN_PROGRAM_ID) || account.data_len() < TOKEN_ACCOUNT_MIN_LEN {
        return Err(KilnError::InvalidTokenAccount.into());
    }
    let data = account.try_borrow_data()?;
    let mint: Pubkey = data[TOKEN_ACCOUNT_MINT_OFFSET..TOKEN_ACCOUNT_MINT_OFFSET + 32]
        .try_into()
        .map_err(|_| KilnError::InvalidTokenAccount)?;
    let owner: Pubkey = data[TOKEN_ACCOUNT_OWNER_OFFSET..TOKEN_ACCOUNT_OWNER_OFFSET + 32]
        .try_into()
        .map_err(|_| KilnError::InvalidTokenAccount)?;
    let amount = u64::from_le_bytes(
        data[TOKEN_ACCOUNT_AMOUNT_OFFSET..TOKEN_ACCOUNT_AMOUNT_OFFSET + 8]
            .try_into()
            .map_err(|_| KilnError::InvalidTokenAccount)?,
    );
    Ok(TokenAccountSnapshot {
        mint,
        owner,
        amount,
    })
}

pub fn read_token_amount(account: &AccountInfo) -> Result<u64, ProgramError> {
    Ok(read_token_account(account)?.amount)
}

pub fn validate_custody_account(
    account: &AccountInfo,
    treasury: &AccountInfo,
    expected_mint: &Pubkey,
) -> Result<TokenAccountSnapshot, ProgramError> {
    let snapshot = read_token_account(account)?;
    if snapshot.owner != *treasury.key() || snapshot.mint != *expected_mint {
        return Err(KilnError::InvalidCustodyAccount.into());
    }
    Ok(snapshot)
}

/// Temporary Pyth-compatible adapter used by tests and devnet plumbing.
///
/// Production wiring should decode the Pyth receiver account into these same
/// normalized fields before calling the shared valuation helpers. Keeping this
/// parser tiny makes the critical accounting deterministic under LiteSVM.
pub fn read_price(
    account: &AccountInfo,
    expected_feed: u8,
    now: i64,
) -> Result<PriceSnapshot, ProgramError> {
    if !account.is_owned_by(&crate::ID) {
        return Err(KilnError::InvalidOracleAccount.into());
    }
    if account.data_len() < 40 {
        return Err(KilnError::InvalidPriceFeed.into());
    }
    let data = account.try_borrow_data()?;
    if &data[0..8] != PRICE_MAGIC || data[8] != expected_feed {
        return Err(KilnError::InvalidPriceFeed.into());
    }
    let raw_price = i64::from_le_bytes(
        data[16..24]
            .try_into()
            .map_err(|_| KilnError::InvalidPriceFeed)?,
    );
    let confidence = u64::from_le_bytes(
        data[24..32]
            .try_into()
            .map_err(|_| KilnError::InvalidPriceFeed)?,
    );
    let published_at = i64::from_le_bytes(
        data[32..40]
            .try_into()
            .map_err(|_| KilnError::InvalidPriceFeed)?,
    );
    if raw_price <= 0 {
        return Err(KilnError::InvalidPriceFeed.into());
    }
    if published_at > now {
        return Err(KilnError::StaleOraclePrice.into());
    }
    let price = raw_price as u64;
    if now
        .checked_sub(published_at)
        .ok_or(KilnError::MathOverflow)?
        > MAX_PRICE_STALENESS_SECS
    {
        return Err(KilnError::StaleOraclePrice.into());
    }
    let confidence_bps = confidence
        .checked_mul(10_000)
        .ok_or(KilnError::MathOverflow)?
        .checked_div(price)
        .ok_or(KilnError::MathOverflow)?;
    if confidence_bps > MAX_CONFIDENCE_BPS {
        return Err(KilnError::InvalidPriceFeed.into());
    }
    Ok(PriceSnapshot {
        price,
        confidence,
        published_at,
    })
}

pub fn wsol_value_usdc(
    wsol_amount: u64,
    sol_usd_price: u64,
    usdc_usd_price: u64,
) -> Result<u64, ProgramError> {
    if wsol_amount == 0 {
        return Ok(0);
    }
    if sol_usd_price == 0 || usdc_usd_price == 0 {
        return Err(KilnError::InvalidPriceFeed.into());
    }
    let value = (wsol_amount as u128)
        .checked_mul(sol_usd_price as u128)
        .ok_or(KilnError::MathOverflow)?
        .checked_mul(USDC_DECIMALS as u128)
        .ok_or(KilnError::MathOverflow)?
        .checked_div(
            (WSOL_DECIMALS as u128)
                .checked_mul(usdc_usd_price as u128)
                .ok_or(KilnError::MathOverflow)?,
        )
        .ok_or(KilnError::MathOverflow)?;
    if value > u64::MAX as u128 {
        return Err(KilnError::MathOverflow.into());
    }
    Ok(value as u64)
}

pub fn nav_usdc(
    usdc_amount: u64,
    wsol_amount: u64,
    sol_usd_price: u64,
    usdc_usd_price: u64,
) -> Result<u64, ProgramError> {
    let wsol_value = wsol_value_usdc(wsol_amount, sol_usd_price, usdc_usd_price)?;
    usdc_amount
        .checked_add(wsol_value)
        .ok_or(KilnError::MathOverflow.into())
}

pub fn min_liquid_usdc(nav: u64) -> Result<u64, ProgramError> {
    nav.checked_mul(MIN_LIQUID_USDC_BPS)
        .ok_or(KilnError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(KilnError::MathOverflow.into())
}

pub fn enforce_liquid_reserve(usdc_amount: u64, nav: u64) -> ProgramResult {
    if usdc_amount < min_liquid_usdc(nav)? {
        return Err(KilnError::LiquidReserveViolation.into());
    }
    Ok(())
}

pub fn wsol_needed_for_usdc(
    shortfall_usdc: u64,
    sol_usd_price: u64,
    usdc_usd_price: u64,
) -> Result<u64, ProgramError> {
    if shortfall_usdc == 0 {
        return Ok(0);
    }
    if sol_usd_price == 0 || usdc_usd_price == 0 {
        return Err(KilnError::InvalidPriceFeed.into());
    }
    let numerator = (shortfall_usdc as u128)
        .checked_mul(WSOL_DECIMALS as u128)
        .ok_or(KilnError::MathOverflow)?
        .checked_mul(usdc_usd_price as u128)
        .ok_or(KilnError::MathOverflow)?;
    let denominator = (USDC_DECIMALS as u128)
        .checked_mul(sol_usd_price as u128)
        .ok_or(KilnError::MathOverflow)?;
    let needed = numerator
        .checked_add(denominator.checked_sub(1).ok_or(KilnError::MathOverflow)?)
        .ok_or(KilnError::MathOverflow)?
        .checked_div(denominator)
        .ok_or(KilnError::MathOverflow)?;
    if needed > u64::MAX as u128 {
        return Err(KilnError::MathOverflow.into());
    }
    Ok(needed as u64)
}

pub fn transfer_token(
    token_program: &AccountInfo,
    source: &AccountInfo,
    destination: &AccountInfo,
    authority: &AccountInfo,
    amount: u64,
) -> ProgramResult {
    if token_program.key() != &TOKEN_PROGRAM_ID {
        return Err(KilnError::InvalidTokenProgram.into());
    }
    let mut data = [0_u8; 9];
    data[0] = TOKEN_TRANSFER_DISCRIMINATOR;
    data[1..9].copy_from_slice(&amount.to_le_bytes());
    let metas = [
        AccountMeta::new(source.key(), true, false),
        AccountMeta::new(destination.key(), true, false),
        AccountMeta::readonly_signer(authority.key()),
    ];
    let infos = [source, destination, authority];
    let ix = Instruction {
        program_id: &TOKEN_PROGRAM_ID,
        accounts: &metas,
        data: &data,
    };
    slice_invoke(&ix, &infos)
}

pub fn transfer_token_from_treasury(
    token_program: &AccountInfo,
    source: &AccountInfo,
    destination: &AccountInfo,
    treasury: &AccountInfo,
    vault_config_key: &Pubkey,
    treasury_bump: u8,
    amount: u64,
) -> ProgramResult {
    if token_program.key() != &TOKEN_PROGRAM_ID {
        return Err(KilnError::InvalidTokenProgram.into());
    }
    let mut data = [0_u8; 9];
    data[0] = TOKEN_TRANSFER_DISCRIMINATOR;
    data[1..9].copy_from_slice(&amount.to_le_bytes());
    let metas = [
        AccountMeta::new(source.key(), true, false),
        AccountMeta::new(destination.key(), true, false),
        AccountMeta::readonly_signer(treasury.key()),
    ];
    let infos = [source, destination, treasury];
    let ix = Instruction {
        program_id: &TOKEN_PROGRAM_ID,
        accounts: &metas,
        data: &data,
    };
    let treasury_bump_seed = [treasury_bump];
    let treasury_signer_seeds = [
        Seed::from(TREASURY_SEED),
        Seed::from(vault_config_key.as_ref()),
        Seed::from(&treasury_bump_seed[..]),
    ];
    let signers = [Signer::from(&treasury_signer_seeds[..])];
    slice_invoke_signed(&ix, &infos, &signers)
}
