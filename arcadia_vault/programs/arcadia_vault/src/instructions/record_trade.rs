use anchor_lang::prelude::*;

use crate::{
    nav_bearing_assets, realized_pnl, token::profile_signer_seeds,
    token::transfer_checked_accounts, token::transfer_checked_accounts_with_signer, token::Mint,
    token::TokenAccount, token::TokenInterface, trade_notional_cap, ArcadiaError, PlatformConfig,
    TradeClosed, TraderProfile, MAX_NOTIONAL_BPS, PROFILE_STATUS_ACTIVE,
};

#[derive(Accounts)]
pub struct RecordTrade<'info> {
    pub trader: Signer<'info>,
    pub oracle_authority: Signer<'info>,
    #[account(has_one = oracle_authority, has_one = treasury_token, has_one = base_mint)]
    pub config: Account<'info, PlatformConfig>,
    #[account(
        mut,
        has_one = trader,
        has_one = base_mint,
        has_one = vault_token,
        constraint = profile.status == PROFILE_STATUS_ACTIVE @ ArcadiaError::VaultNotActive
    )]
    pub profile: Account<'info, TraderProfile>,
    pub base_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = base_mint,
        token::authority = profile,
        token::token_program = token_program
    )]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = base_mint,
        token::authority = treasury_authority,
        token::token_program = token_program
    )]
    pub treasury_token: InterfaceAccount<'info, TokenAccount>,
    pub treasury_authority: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<RecordTrade>,
    market: String,
    direction: u8,
    size_usd: u64,
    leverage_x100: u16,
    entry_px: u64,
    exit_px: u64,
    fees_usd: u64,
    was_liquidated: bool,
    opened_at: i64,
    closed_at: i64,
) -> Result<()> {
    require!(
        ctx.accounts.profile.total_shares > 0,
        ArcadiaError::NoShares
    );

    let vault_balance_before = ctx.accounts.vault_token.amount;
    let treasury_balance_before = ctx.accounts.treasury_token.amount;
    let nav_excl = nav_bearing_assets(vault_balance_before, ctx.accounts.profile.trader_claimable)?;
    let notional_cap = trade_notional_cap(vault_balance_before, MAX_NOTIONAL_BPS)?;
    require!(size_usd <= notional_cap, ArcadiaError::NotionalTooLarge);

    // Compare in x100 units so 5.01x cannot floor-divide into a 5x cap.
    let max_leverage_x100 = (ctx.accounts.profile.max_leverage as u16)
        .checked_mul(100)
        .ok_or(ArcadiaError::MathOverflow)?;
    require!(
        leverage_x100 <= max_leverage_x100,
        ArcadiaError::LeverageTooHigh
    );

    let realized_pnl = realized_pnl(
        direction,
        size_usd,
        leverage_x100,
        entry_px,
        exit_px,
        fees_usd,
    )?;
    require!(closed_at >= opened_at, ArcadiaError::InvalidTradeParams);

    let mut applied_pnl: u64 = 0;
    if realized_pnl > 0 {
        applied_pnl = realized_pnl
            .try_into()
            .map_err(|_| ArcadiaError::MathOverflow)?;
        require!(
            applied_pnl <= treasury_balance_before,
            ArcadiaError::InsufficientFunds
        );
        transfer_checked_accounts(
            ctx.accounts.token_program.key(),
            ctx.accounts.treasury_token.to_account_info(),
            ctx.accounts.base_mint.to_account_info(),
            ctx.accounts.vault_token.to_account_info(),
            ctx.accounts.treasury_authority.to_account_info(),
            applied_pnl,
            ctx.accounts.base_mint.decimals,
        )?;
    } else if realized_pnl < 0 {
        let loss: u64 = (-(realized_pnl as i128))
            .try_into()
            .map_err(|_| ArcadiaError::MathOverflow)?;
        applied_pnl = loss.min(nav_excl);

        if applied_pnl > 0 {
            let profile_bump = [ctx.accounts.profile.bump];
            let seeds = profile_signer_seeds(&ctx.accounts.profile.trader, &profile_bump);
            let signer_seeds = &[&seeds[..]];
            transfer_checked_accounts_with_signer(
                ctx.accounts.token_program.key(),
                ctx.accounts.vault_token.to_account_info(),
                ctx.accounts.base_mint.to_account_info(),
                ctx.accounts.treasury_token.to_account_info(),
                ctx.accounts.profile.to_account_info(),
                applied_pnl,
                ctx.accounts.base_mint.decimals,
                signer_seeds,
            )?;
        }
    }

    ctx.accounts.vault_token.reload()?;
    ctx.accounts.treasury_token.reload()?;

    if realized_pnl > 0 {
        let vault_delta = ctx
            .accounts
            .vault_token
            .amount
            .checked_sub(vault_balance_before)
            .ok_or(ArcadiaError::TokenConservationFailed)?;
        let treasury_delta = treasury_balance_before
            .checked_sub(ctx.accounts.treasury_token.amount)
            .ok_or(ArcadiaError::TokenConservationFailed)?;
        require_eq!(
            vault_delta,
            applied_pnl,
            ArcadiaError::TokenConservationFailed
        );
        require_eq!(
            treasury_delta,
            applied_pnl,
            ArcadiaError::TokenConservationFailed
        );
    } else if realized_pnl < 0 {
        let vault_delta = vault_balance_before
            .checked_sub(ctx.accounts.vault_token.amount)
            .ok_or(ArcadiaError::TokenConservationFailed)?;
        let treasury_delta = ctx
            .accounts
            .treasury_token
            .amount
            .checked_sub(treasury_balance_before)
            .ok_or(ArcadiaError::TokenConservationFailed)?;
        require_eq!(
            vault_delta,
            applied_pnl,
            ArcadiaError::TokenConservationFailed
        );
        require_eq!(
            treasury_delta,
            applied_pnl,
            ArcadiaError::TokenConservationFailed
        );
    }

    emit!(TradeClosed {
        profile: ctx.accounts.profile.key(),
        trader: ctx.accounts.profile.trader,
        market,
        direction,
        size_usd,
        leverage_x100,
        entry_px,
        exit_px,
        realized_pnl,
        fees_usd,
        was_liquidated,
        opened_at,
        closed_at,
    });

    Ok(())
}
