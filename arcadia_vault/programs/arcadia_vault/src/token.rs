use anchor_lang::prelude::*;
use anchor_spl::token_interface::transfer_checked;
pub use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::PROFILE_SEED;

pub fn profile_signer_seeds<'a>(trader: &'a Pubkey, bump: &'a [u8; 1]) -> [&'a [u8]; 3] {
    [PROFILE_SEED, trader.as_ref(), bump]
}

pub fn transfer_checked_accounts<'info>(
    token_program_id: Pubkey,
    from: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    amount: u64,
    decimals: u8,
) -> Result<()> {
    transfer_checked(
        CpiContext::new(
            token_program_id,
            TransferChecked {
                from,
                mint,
                to,
                authority,
            },
        ),
        amount,
        decimals,
    )
}

pub fn transfer_checked_accounts_with_signer<'info>(
    token_program_id: Pubkey,
    from: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    amount: u64,
    decimals: u8,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    transfer_checked(
        CpiContext::new_with_signer(
            token_program_id,
            TransferChecked {
                from,
                mint,
                to,
                authority,
            },
            signer_seeds,
        ),
        amount,
        decimals,
    )
}
