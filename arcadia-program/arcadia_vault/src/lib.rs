//! Arcadia Vault — Anchor 1.0 Program
//! On-chain trading reputation and fund management vault on Solana.
//!
//! Program ID (devnet): ArcVaultXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
//!
//! ## Account PDAs
//!   PlatformConfig:   ["config"]
//!   TraderProfile:    ["profile", trader_pubkey]
//!   InvestorAccount:  ["investor", investor_pubkey]
//!   InvestorPosition: ["position", investor_pubkey, profile_pubkey]
//!
//! ## Constant pool
//!   SHARE_SCALE           = 1_000_000   (1e6 — all NAV values in 1e6 units)
//!   BPS_DENOMINATOR       = 10_000
//!   INSTANT_WITHDRAW_BPS  = 500         (< 5% of AUM → instant on next tick)
//!   MAX_NOTIONAL_BPS      = 2_000       (≤ 20% of AUM per single trade)
//!   SECONDS_PER_YEAR      = 31_557_600  (365.25 * 24 * 3600)

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

declare_id!("ArcVaultXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

// ─── Constants ───────────────────────────────────────────────────────────────

pub const SHARE_SCALE: u64 = 1_000_000;
pub const BPS_DENOMINATOR: u64 = 10_000;
pub const INSTANT_WITHDRAW_BPS: u64 = 500;
pub const MAX_NOTIONAL_BPS: u64 = 2_000;
pub const SECONDS_PER_YEAR: u64 = 31_557_600;

/// Return the tier performance-fee BPS for the trader.
/// Tiers map directly to score_tier values (0=Verified,1=Established,2=Advanced,3=Elite).
fn tier_bps(score_tier: u8) -> u64 {
    match score_tier {
        0 => 2_000, // Verified  20%
        1 => 2_500, // Established 25%
        2 => 3_000, // Advanced  30%
        _ => 3_500, // Elite     35%
    }
}

/// Next daily settlement window (next UTC midnight after 24 h).
fn next_daily_settlement_window(now: i64) -> i64 {
    // Round up to next 86_400 boundary
    let day = 86_400_i64;
    ((now + day) / day) * day
}

// ─── Program ─────────────────────────────────────────────────────────────────

#[program]
pub mod arcadia_vault {
    use super::*;

    // ── 4.1  initialize_platform ───────────────────────────────────────────

    /// Admin-only. Creates the singleton PlatformConfig account.
    /// Sets the oracle authority, treasury, base mint, and fee parameters.
    pub fn initialize_platform(
        ctx: Context<InitializePlatformAccountConstraints>,
        oracle_authority: Pubkey,
        perf_fee_bps: u16,  // e.g. 500 = 5%
        mgmt_fee_bps: u16,  // e.g. 100 = 1%
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.admin = ctx.accounts.admin.key();
        cfg.oracle_authority = oracle_authority;
        cfg.treasury_token = ctx.accounts.treasury_token.key();
        cfg.base_mint = ctx.accounts.base_mint.key();
        cfg.perf_fee_bps = perf_fee_bps;
        cfg.mgmt_fee_bps = mgmt_fee_bps;
        cfg.bump = ctx.bumps.config;
        emit!(PlatformInitialized {
            admin: cfg.admin,
            oracle_authority,
            base_mint: cfg.base_mint,
        });
        Ok(())
    }

    // ── 4.2  initialize_profile ────────────────────────────────────────────

    /// Trader-called. Creates the TraderProfile (= the vault) PDA.
    /// max_leverage is immutable after creation.
    pub fn initialize_profile(
        ctx: Context<InitializeProfileAccountConstraints>,
        handle: String,
        max_leverage: u8,
        style_tags: Vec<String>,
    ) -> Result<()> {
        require!(max_leverage > 0 && max_leverage <= 25, ArcadiaError::InvalidLeverage);
        let profile = &mut ctx.accounts.profile;
        profile.trader = ctx.accounts.trader.key();
        profile.handle = handle.clone();
        profile.max_leverage = max_leverage;
        profile.style_tags = style_tags;
        profile.vault_token = ctx.accounts.vault_token.key();
        profile.base_mint = ctx.accounts.base_mint.key();
        profile.total_shares = 0;
        profile.trader_shares = 0;
        profile.hwm_per_share = SHARE_SCALE; // starts at 1.0
        profile.trader_claimable = 0;
        profile.score_tier = 0; // Verified
        profile.status = 0; // active
        profile.capacity_usd = 0;
        profile.last_settle_ts = Clock::get()?.unix_timestamp;
        profile.bump = ctx.bumps.profile;
        emit!(ProfileInitialized {
            trader: profile.trader,
            handle,
            vault_token: profile.vault_token,
        });
        Ok(())
    }

    // ── 4.3  set_capacity ─────────────────────────────────────────────────

    /// Admin-only. Sets the investor capacity for a vault.
    pub fn set_capacity(
        ctx: Context<SetCapacityAccountConstraints>,
        capacity_usd: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.config.admin == ctx.accounts.admin.key(),
            ArcadiaError::Unauthorized
        );
        ctx.accounts.profile.capacity_usd = capacity_usd;
        Ok(())
    }

    // ── 4.4  initialize_investor ───────────────────────────────────────────

    /// Investor-called (first time). Creates the InvestorAccount PDA (once per wallet)
    /// and the InvestorPosition PDA (once per vault).
    pub fn initialize_investor(
        ctx: Context<InitializeInvestorAccountConstraints>,
    ) -> Result<()> {
        let acct = &mut ctx.accounts.investor_account;
        acct.owner = ctx.accounts.owner.key();
        acct.bump = ctx.bumps.investor_account;
        acct.created_at = Clock::get()?.unix_timestamp;

        let pos = &mut ctx.accounts.investor_position;
        pos.owner = ctx.accounts.owner.key();
        pos.profile = ctx.accounts.profile.key();
        pos.shares = 0;
        pos.pending_withdraw_shares = 0;
        pos.withdraw_ready_ts = 0;
        pos.bump = ctx.bumps.investor_position;
        Ok(())
    }

    // ── 4.5  deposit ──────────────────────────────────────────────────────

    /// Investor (or trader-own) deposit.
    /// Mints shares proportional to current NAV; first deposit starts at 1:1.
    pub fn deposit(
        ctx: Context<DepositAccountConstraints>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ArcadiaError::ZeroAmount);
        require!(
            ctx.accounts.profile.status == 0,
            ArcadiaError::VaultNotActive
        );
        let profile = &mut ctx.accounts.profile;
        require!(profile.capacity_usd > 0, ArcadiaError::CapacityNotSet);

        let total_assets = ctx.accounts.vault_token.amount;
        let aum_excl = total_assets.saturating_sub(profile.trader_claimable);

        // shares_minted = amount * total_shares / nav_excl   (first deposit: 1:1)
        let shares_minted: u64 = if profile.total_shares == 0 {
            // First deposit: shares_minted == amount (1:1 at SHARE_SCALE==1e6)
            amount
        } else {
            require!(aum_excl > 0, ArcadiaError::MathOverflow);
            (amount as u128)
                .checked_mul(profile.total_shares as u128)
                .ok_or(ArcadiaError::MathOverflow)?
                .checked_div(aum_excl as u128)
                .ok_or(ArcadiaError::MathOverflow)?
                .try_into()
                .map_err(|_| ArcadiaError::MathOverflow)?
        };
        require!(shares_minted > 0, ArcadiaError::DustDeposit);

        // AUM check: total_assets + amount <= capacity_usd
        require!(
            total_assets.saturating_add(amount) <= profile.capacity_usd,
            ArcadiaError::CapacityExceeded
        );

        let is_trader = ctx.accounts.depositor.key() == profile.trader;

        // EFFECTS
        profile.total_shares = profile
            .total_shares
            .checked_add(shares_minted)
            .ok_or(ArcadiaError::MathOverflow)?;
        if is_trader {
            profile.trader_shares = profile
                .trader_shares
                .checked_add(shares_minted)
                .ok_or(ArcadiaError::MathOverflow)?;
        }
        ctx.accounts.position.shares = ctx
            .accounts
            .position
            .shares
            .checked_add(shares_minted)
            .ok_or(ArcadiaError::MathOverflow)?;

        // INTERACTION
        let cpi_accounts = anchor_spl::token_interface::TransferChecked {
            from: ctx.accounts.depositor_token.to_account_info(),
            mint: ctx.accounts.base_mint.to_account_info(),
            to: ctx.accounts.vault_token.to_account_info(),
            authority: ctx.accounts.depositor.to_account_info(),
        };
        transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            amount,
            ctx.accounts.base_mint.decimals,
        )?;

        emit!(Deposited {
            profile: ctx.accounts.profile.key(),
            depositor: ctx.accounts.depositor.key(),
            is_trader,
            amount_usd: amount,
            shares_minted,
            ts: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    // ── 4.6  request_withdraw ─────────────────────────────────────────────

    /// First step of two-step withdraw. Records pending_withdraw_shares and
    /// decides whether this qualifies as instant (<5% AUM) or next daily window.
    pub fn request_withdraw(
        ctx: Context<RequestWithdrawAccountConstraints>,
        shares: u64,
    ) -> Result<()> {
        require!(shares > 0, ArcadiaError::ZeroAmount);
        let position = &mut ctx.accounts.position;
        require!(shares <= position.shares, ArcadiaError::InsufficientShares);

        let now = Clock::get()?.unix_timestamp;
        let total_assets = ctx.accounts.vault_token.amount;
        let nav_excl = total_assets
            .checked_sub(ctx.accounts.profile.trader_claimable)
            .ok_or(ArcadiaError::MathOverflow)?;

        let total_shares = ctx.accounts.profile.total_shares;
        require!(total_shares > 0, ArcadiaError::NoShares);

        let withdraw_value: u128 = (shares as u128)
            .checked_mul(nav_excl as u128)
            .ok_or(ArcadiaError::MathOverflow)?
            .checked_div(total_shares as u128)
            .ok_or(ArcadiaError::MathOverflow)?;

        let aum = nav_excl as u128;
        let lhs = withdraw_value
            .checked_mul(BPS_DENOMINATOR as u128)
            .ok_or(ArcadiaError::MathOverflow)?;
        let rhs = aum
            .checked_mul(INSTANT_WITHDRAW_BPS as u128)
            .ok_or(ArcadiaError::MathOverflow)?;

        position.pending_withdraw_shares = position
            .pending_withdraw_shares
            .checked_add(shares)
            .ok_or(ArcadiaError::MathOverflow)?;
        position.withdraw_ready_ts = if lhs < rhs {
            now
        } else {
            next_daily_settlement_window(now)
        };

        emit!(WithdrawRequested {
            profile: ctx.accounts.profile.key(),
            owner: ctx.accounts.owner.key(),
            shares,
            withdraw_ready_ts: position.withdraw_ready_ts,
        });
        Ok(())
    }

    // ── 4.6  process_withdraw ─────────────────────────────────────────────

    /// Second step. Executes the pending withdrawal once the settlement window
    /// has passed. Sends USDC proportional to shares at current NAV.
    pub fn process_withdraw(ctx: Context<ProcessWithdrawAccountConstraints>) -> Result<()> {
        let position = &mut ctx.accounts.position;
        require!(
            position.pending_withdraw_shares > 0,
            ArcadiaError::NothingPending
        );
        let now = Clock::get()?.unix_timestamp;
        require!(now >= position.withdraw_ready_ts, ArcadiaError::NoticeNotElapsed);

        let burn = position.pending_withdraw_shares;
        let total_assets = ctx.accounts.vault_token.amount;
        let profile = &mut ctx.accounts.profile;
        let nav_excl = total_assets
            .checked_sub(profile.trader_claimable)
            .ok_or(ArcadiaError::MathOverflow)?;

        let assets_out: u64 = (burn as u128)
            .checked_mul(nav_excl as u128)
            .ok_or(ArcadiaError::MathOverflow)?
            .checked_div(profile.total_shares as u128)
            .ok_or(ArcadiaError::MathOverflow)?
            .try_into()
            .map_err(|_| ArcadiaError::MathOverflow)?;
        require!(assets_out <= total_assets, ArcadiaError::InsufficientVaultLiquidity);

        // EFFECTS
        profile.total_shares = profile
            .total_shares
            .checked_sub(burn)
            .ok_or(ArcadiaError::MathOverflow)?;
        if ctx.accounts.owner.key() == profile.trader {
            profile.trader_shares = profile.trader_shares.saturating_sub(burn);
        }
        position.shares = position
            .shares
            .checked_sub(burn)
            .ok_or(ArcadiaError::MathOverflow)?;
        position.pending_withdraw_shares = 0;

        // INTERACTION — signed by profile PDA
        let seeds: &[&[u8]] = &[b"profile", profile.trader.as_ref(), &[profile.bump]];
        let cpi_accounts = anchor_spl::token_interface::TransferChecked {
            from: ctx.accounts.vault_token.to_account_info(),
            mint: ctx.accounts.base_mint.to_account_info(),
            to: ctx.accounts.owner_token.to_account_info(),
            authority: ctx.accounts.profile.to_account_info(),
        };
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                &[seeds],
            ),
            assets_out,
            ctx.accounts.base_mint.decimals,
        )?;

        emit!(Withdrawn {
            profile: ctx.accounts.profile.key(),
            owner: ctx.accounts.owner.key(),
            shares_burned: burn,
            amount_usd: assets_out,
        });
        Ok(())
    }

    // ── 4.7  record_trade ─────────────────────────────────────────────────

    /// Dual-signed by trader + oracle_authority.
    /// Applies realized PnL to the vault via transfer_checked (devnet treasury simulation).
    pub fn record_trade(
        ctx: Context<RecordTradeAccountConstraints>,
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
            ctx.accounts.trader.key() == ctx.accounts.profile.trader,
            ArcadiaError::Unauthorized
        );
        require!(
            ctx.accounts.oracle_authority.key() == ctx.accounts.config.oracle_authority,
            ArcadiaError::Unauthorized
        );
        require!(
            ctx.accounts.profile.status == 0,
            ArcadiaError::VaultNotActive
        );
        require!(ctx.accounts.profile.total_shares > 0, ArcadiaError::NoShares);
        require!(direction <= 1, ArcadiaError::InvalidTradeParams);
        require!(entry_px > 0 && exit_px > 0, ArcadiaError::InvalidTradeParams);
        require!(size_usd > 0, ArcadiaError::InvalidTradeParams);
        require!(closed_at >= opened_at, ArcadiaError::InvalidTradeParams);

        let profile = &mut ctx.accounts.profile;
        require!(
            (leverage_x100 / 100) as u8 <= profile.max_leverage,
            ArcadiaError::LeverageTooHigh
        );

        let total_assets = ctx.accounts.vault_token.amount;
        let cap = (total_assets as u128)
            .checked_mul(MAX_NOTIONAL_BPS as u128)
            .ok_or(ArcadiaError::MathOverflow)?
            .checked_div(BPS_DENOMINATOR as u128)
            .ok_or(ArcadiaError::MathOverflow)?;
        require!((size_usd as u128) <= cap, ArcadiaError::NotionalTooLarge);

        let dir_sign: i128 = if direction == 0 { 1 } else { -1 };
        let px_diff: i128 = exit_px as i128 - entry_px as i128;
        let gross: i128 = dir_sign
            .checked_mul(size_usd as i128)
            .ok_or(ArcadiaError::MathOverflow)?
            .checked_mul(leverage_x100 as i128)
            .ok_or(ArcadiaError::MathOverflow)?
            .checked_mul(px_diff)
            .ok_or(ArcadiaError::MathOverflow)?
            .checked_div(
                (entry_px as i128)
                    .checked_mul(100)
                    .ok_or(ArcadiaError::MathOverflow)?,
            )
            .ok_or(ArcadiaError::MathOverflow)?;
        let realized_pnl: i128 = gross
            .checked_sub(fees_usd as i128)
            .ok_or(ArcadiaError::MathOverflow)?;

        if realized_pnl > 0 {
            // GAIN: treasury → vault (devnet free USDC top-up)
            let amt: u64 = (realized_pnl as u128)
                .try_into()
                .map_err(|_| ArcadiaError::MathOverflow)?;
            let cpi_accounts = anchor_spl::token_interface::TransferChecked {
                from: ctx.accounts.treasury_token.to_account_info(),
                mint: ctx.accounts.base_mint.to_account_info(),
                to: ctx.accounts.vault_token.to_account_info(),
                authority: ctx.accounts.treasury_authority.to_account_info(),
            };
            transfer_checked(
                CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
                amt,
                ctx.accounts.base_mint.decimals,
            )?;
        } else if realized_pnl < 0 {
            // LOSS: vault → treasury, bounded by NAV-bearing assets
            let loss: u64 = ((-realized_pnl) as u128)
                .try_into()
                .map_err(|_| ArcadiaError::MathOverflow)?;
            let nav_excl = total_assets
                .checked_sub(profile.trader_claimable)
                .ok_or(ArcadiaError::MathOverflow)?;
            let applied = loss.min(nav_excl);
            let seeds: &[&[u8]] = &[b"profile", profile.trader.as_ref(), &[profile.bump]];
            let cpi_accounts = anchor_spl::token_interface::TransferChecked {
                from: ctx.accounts.vault_token.to_account_info(),
                mint: ctx.accounts.base_mint.to_account_info(),
                to: ctx.accounts.treasury_token.to_account_info(),
                authority: ctx.accounts.profile.to_account_info(),
            };
            transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    cpi_accounts,
                    &[seeds],
                ),
                applied,
                ctx.accounts.base_mint.decimals,
            )?;
        }

        let realized_pnl_i64: i64 = realized_pnl
            .try_into()
            .map_err(|_| ArcadiaError::MathOverflow)?;
        emit!(TradeClosed {
            profile: ctx.accounts.profile.key(),
            trader: profile.trader,
            market,
            direction,
            size_usd,
            leverage_x100,
            entry_px,
            exit_px,
            realized_pnl: realized_pnl_i64,
            fees_usd,
            was_liquidated,
            opened_at,
            closed_at,
        });
        Ok(())
    }

    // ── 4.8  settle ───────────────────────────────────────────────────────

    /// Periodic (daily/monthly). Crystallizes profit above HWM into trader_claimable
    /// and platform cut. Resets HWM. Optional management-fee accrual.
    pub fn settle(ctx: Context<SettleAccountConstraints>) -> Result<()> {
        let caller = ctx.accounts.caller.key();
        require!(
            caller == ctx.accounts.profile.trader
                || caller == ctx.accounts.config.oracle_authority,
            ArcadiaError::Unauthorized
        );
        let profile = &mut ctx.accounts.profile;
        require!(profile.total_shares > 0, ArcadiaError::NoShares);

        let now = Clock::get()?.unix_timestamp;
        let total_assets = ctx.accounts.vault_token.amount;
        let nav_excl = total_assets
            .checked_sub(profile.trader_claimable)
            .ok_or(ArcadiaError::MathOverflow)?;

        let current_nav: u64 = (nav_excl as u128)
            .checked_mul(SHARE_SCALE as u128)
            .ok_or(ArcadiaError::MathOverflow)?
            .checked_div(profile.total_shares as u128)
            .ok_or(ArcadiaError::MathOverflow)?
            .try_into()
            .map_err(|_| ArcadiaError::MathOverflow)?;

        let elapsed = (now - profile.last_settle_ts).max(0) as u128;
        let mgmt: u64 = (total_assets as u128)
            .checked_mul(ctx.accounts.config.mgmt_fee_bps as u128)
            .ok_or(ArcadiaError::MathOverflow)?
            .checked_mul(elapsed)
            .ok_or(ArcadiaError::MathOverflow)?
            .checked_div((BPS_DENOMINATOR as u128) * (SECONDS_PER_YEAR as u128))
            .ok_or(ArcadiaError::MathOverflow)?
            .try_into()
            .map_err(|_| ArcadiaError::MathOverflow)?;

        if current_nav > profile.hwm_per_share {
            let per_share_gain = (current_nav - profile.hwm_per_share) as u128;
            let profit_assets: u64 = per_share_gain
                .checked_mul(profile.total_shares as u128)
                .ok_or(ArcadiaError::MathOverflow)?
                .checked_div(SHARE_SCALE as u128)
                .ok_or(ArcadiaError::MathOverflow)?
                .try_into()
                .map_err(|_| ArcadiaError::MathOverflow)?;

            let tier_bps_val = tier_bps(profile.score_tier);
            let trader_cut: u64 = (profit_assets as u128)
                .checked_mul(tier_bps_val)
                .ok_or(ArcadiaError::MathOverflow)?
                .checked_div(BPS_DENOMINATOR as u128)
                .ok_or(ArcadiaError::MathOverflow)?
                .try_into()
                .map_err(|_| ArcadiaError::MathOverflow)?;
            let platform_cut: u64 = (profit_assets as u128)
                .checked_mul(ctx.accounts.config.perf_fee_bps as u128)
                .ok_or(ArcadiaError::MathOverflow)?
                .checked_div(BPS_DENOMINATOR as u128)
                .ok_or(ArcadiaError::MathOverflow)?
                .try_into()
                .map_err(|_| ArcadiaError::MathOverflow)?;

            profile.trader_claimable = profile
                .trader_claimable
                .checked_add(trader_cut)
                .ok_or(ArcadiaError::MathOverflow)?;

            let seeds: &[&[u8]] = &[b"profile", profile.trader.as_ref(), &[profile.bump]];
            let total_out = platform_cut.checked_add(mgmt).ok_or(ArcadiaError::MathOverflow)?;
            if total_out > 0 {
                let cpi_accounts = anchor_spl::token_interface::TransferChecked {
                    from: ctx.accounts.vault_token.to_account_info(),
                    mint: ctx.accounts.base_mint.to_account_info(),
                    to: ctx.accounts.treasury_token.to_account_info(),
                    authority: ctx.accounts.profile.to_account_info(),
                };
                transfer_checked(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        cpi_accounts,
                        &[seeds],
                    ),
                    total_out,
                    ctx.accounts.base_mint.decimals,
                )?;
            }

            profile.hwm_per_share = current_nav;
            profile.last_settle_ts = now;
            emit!(Settled {
                profile: ctx.accounts.profile.key(),
                profit_usd: profit_assets,
                trader_cut,
                platform_cut,
                hwm_per_share: profile.hwm_per_share,
            });
        } else {
            profile.last_settle_ts = now;
        }
        Ok(())
    }

    // ── 4.9  trader_withdraw_profit ────────────────────────────────────────

    /// Trader pulls their earmarked performance fee out of the vault to their wallet.
    pub fn trader_withdraw_profit(
        ctx: Context<TraderWithdrawProfitAccountConstraints>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ArcadiaError::ZeroAmount);
        let profile = &mut ctx.accounts.profile;
        require!(amount <= profile.trader_claimable, ArcadiaError::InsufficientClaimable);

        profile.trader_claimable = profile
            .trader_claimable
            .checked_sub(amount)
            .ok_or(ArcadiaError::MathOverflow)?;

        let seeds: &[&[u8]] = &[b"profile", profile.trader.as_ref(), &[profile.bump]];
        let cpi_accounts = anchor_spl::token_interface::TransferChecked {
            from: ctx.accounts.vault_token.to_account_info(),
            mint: ctx.accounts.base_mint.to_account_info(),
            to: ctx.accounts.trader_token.to_account_info(),
            authority: ctx.accounts.profile.to_account_info(),
        };
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                &[seeds],
            ),
            amount,
            ctx.accounts.base_mint.decimals,
        )?;

        emit!(ProfitWithdrawn {
            profile: ctx.accounts.profile.key(),
            trader: ctx.accounts.trader.key(),
            amount,
        });
        Ok(())
    }
}

// ─── Account structs ─────────────────────────────────────────────────────────

#[account]
#[derive(Default)]
pub struct PlatformConfig {
    pub admin: Pubkey,
    pub oracle_authority: Pubkey,
    pub treasury_token: Pubkey,
    pub base_mint: Pubkey,
    pub perf_fee_bps: u16,
    pub mgmt_fee_bps: u16,
    pub bump: u8,
}

#[account]
pub struct TraderProfile {
    pub trader: Pubkey,
    pub handle: String,       // up to 32 bytes
    pub max_leverage: u8,
    pub style_tags: Vec<String>,
    pub vault_token: Pubkey,
    pub base_mint: Pubkey,
    pub total_shares: u64,
    pub trader_shares: u64,
    pub hwm_per_share: u64,   // 1e6 scale
    pub trader_claimable: u64,
    pub score_tier: u8,       // 0=Verified,1=Established,2=Advanced,3=Elite
    pub status: u8,           // 0=active,1=paused,2=closed
    pub capacity_usd: u64,
    pub last_settle_ts: i64,
    pub bump: u8,
}

#[account]
#[derive(Default)]
pub struct InvestorAccount {
    pub owner: Pubkey,
    pub bump: u8,
    pub created_at: i64,
}

#[account]
#[derive(Default)]
pub struct InvestorPosition {
    pub owner: Pubkey,
    pub profile: Pubkey,
    pub shares: u64,
    pub pending_withdraw_shares: u64,
    pub withdraw_ready_ts: i64,
    pub bump: u8,
}

// ─── Account constraint structs ──────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializePlatformAccountConstraints<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + std::mem::size_of::<PlatformConfig>(),
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, PlatformConfig>,
    #[account(constraint = base_mint.decimals == 6)]
    pub base_mint: InterfaceAccount<'info, Mint>,
    pub treasury_token: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(handle: String)]
pub struct InitializeProfileAccountConstraints<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
    #[account(
        init,
        payer = trader,
        space = 8 + 32 + 4 + 36 + 1 + (4 + 5 * 20) + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 8 + 8 + 1,
        seeds = [b"profile", trader.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, TraderProfile>,
    #[account(token::authority = profile, token::mint = base_mint)]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    pub base_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetCapacityAccountConstraints<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub profile: Account<'info, TraderProfile>,
}

#[derive(Accounts)]
pub struct InitializeInvestorAccountConstraints<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + std::mem::size_of::<InvestorAccount>(),
        seeds = [b"investor", owner.key().as_ref()],
        bump
    )]
    pub investor_account: Account<'info, InvestorAccount>,
    #[account(
        init,
        payer = owner,
        space = 8 + std::mem::size_of::<InvestorPosition>(),
        seeds = [b"position", owner.key().as_ref(), profile.key().as_ref()],
        bump
    )]
    pub investor_position: Account<'info, InvestorPosition>,
    pub profile: Account<'info, TraderProfile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositAccountConstraints<'info> {
    pub depositor: Signer<'info>,
    #[account(mut, has_one = vault_token, has_one = base_mint)]
    pub profile: Account<'info, TraderProfile>,
    #[account(mut)]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::authority = depositor)]
    pub depositor_token: InterfaceAccount<'info, TokenAccount>,
    pub base_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, has_one = profile)]
    pub position: Account<'info, InvestorPosition>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct RequestWithdrawAccountConstraints<'info> {
    pub owner: Signer<'info>,
    pub profile: Account<'info, TraderProfile>,
    #[account(has_one = vault_token)]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, has_one = profile)]
    pub position: Account<'info, InvestorPosition>,
}

#[derive(Accounts)]
pub struct ProcessWithdrawAccountConstraints<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = vault_token, has_one = base_mint)]
    pub profile: Account<'info, TraderProfile>,
    #[account(mut, has_one = profile)]
    pub position: Account<'info, InvestorPosition>,
    pub base_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::authority = owner)]
    pub owner_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct RecordTradeAccountConstraints<'info> {
    pub trader: Signer<'info>,
    pub oracle_authority: Signer<'info>,
    #[account(has_one = oracle_authority, has_one = treasury_token, has_one = base_mint)]
    pub config: Account<'info, PlatformConfig>,
    #[account(mut, has_one = trader, has_one = vault_token, has_one = base_mint)]
    pub profile: Account<'info, TraderProfile>,
    pub base_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub treasury_token: InterfaceAccount<'info, TokenAccount>,
    pub treasury_authority: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct SettleAccountConstraints<'info> {
    pub caller: Signer<'info>,
    #[account(has_one = treasury_token, has_one = base_mint)]
    pub config: Account<'info, PlatformConfig>,
    #[account(mut, has_one = vault_token, has_one = base_mint)]
    pub profile: Account<'info, TraderProfile>,
    pub base_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub treasury_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct TraderWithdrawProfitAccountConstraints<'info> {
    pub trader: Signer<'info>,
    #[account(mut, has_one = trader, has_one = vault_token, has_one = base_mint)]
    pub profile: Account<'info, TraderProfile>,
    pub base_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::authority = trader)]
    pub trader_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct PlatformInitialized {
    pub admin: Pubkey,
    pub oracle_authority: Pubkey,
    pub base_mint: Pubkey,
}

#[event]
pub struct ProfileInitialized {
    pub trader: Pubkey,
    pub handle: String,
    pub vault_token: Pubkey,
}

#[event]
pub struct Deposited {
    pub profile: Pubkey,
    pub depositor: Pubkey,
    pub is_trader: bool,
    pub amount_usd: u64,
    pub shares_minted: u64,
    pub ts: i64,
}

#[event]
pub struct WithdrawRequested {
    pub profile: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub withdraw_ready_ts: i64,
}

#[event]
pub struct Withdrawn {
    pub profile: Pubkey,
    pub owner: Pubkey,
    pub shares_burned: u64,
    pub amount_usd: u64,
}

#[event]
pub struct TradeClosed {
    pub profile: Pubkey,
    pub trader: Pubkey,
    pub market: String,
    pub direction: u8,
    pub size_usd: u64,
    pub leverage_x100: u16,
    pub entry_px: u64,
    pub exit_px: u64,
    pub realized_pnl: i64,
    pub fees_usd: u64,
    pub was_liquidated: bool,
    pub opened_at: i64,
    pub closed_at: i64,
}

#[event]
pub struct Settled {
    pub profile: Pubkey,
    pub profit_usd: u64,
    pub trader_cut: u64,
    pub platform_cut: u64,
    pub hwm_per_share: u64,
}

#[event]
pub struct ProfitWithdrawn {
    pub profile: Pubkey,
    pub trader: Pubkey,
    pub amount: u64,
}

// ─── Error codes ─────────────────────────────────────────────────────────────

#[error_code]
pub enum ArcadiaError {
    #[msg("Caller is not authorized to perform this action")]
    Unauthorized,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Vault is not in active state")]
    VaultNotActive,
    #[msg("Vault capacity has not been set by the platform")]
    CapacityNotSet,
    #[msg("Deposit would exceed vault capacity")]
    CapacityExceeded,
    #[msg("Deposit amount too small (dust)")]
    DustDeposit,
    #[msg("Insufficient share balance")]
    InsufficientShares,
    #[msg("No pending withdraw request")]
    NothingPending,
    #[msg("Settlement window has not elapsed")]
    NoticeNotElapsed,
    #[msg("Vault has insufficient liquidity to process withdrawal")]
    InsufficientVaultLiquidity,
    #[msg("Trade parameters are invalid")]
    InvalidTradeParams,
    #[msg("Leverage exceeds vault maximum")]
    LeverageTooHigh,
    #[msg("Trade notional exceeds 20% of AUM")]
    NotionalTooLarge,
    #[msg("Vault has no shares outstanding (NAV undefined)")]
    NoShares,
    #[msg("Claimable balance is insufficient for this withdrawal")]
    InsufficientClaimable,
    #[msg("Math overflow or underflow")]
    MathOverflow,
    #[msg("Invalid leverage value")]
    InvalidLeverage,
}
