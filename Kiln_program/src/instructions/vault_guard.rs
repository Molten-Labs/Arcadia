use pinocchio::program_error::ProgramError;

use crate::{errors::KilnError, states::VaultState};

/// Dynamic position limit based on junior health.
/// Returns max position size in basis points of NAV.
pub fn max_position_bps(effective_health_bps: u64) -> u16 {
    if effective_health_bps >= 10_000 {
        1000 // 10% of NAV
    } else if effective_health_bps >= 8_000 {
        600 // 6%
    } else if effective_health_bps >= 5_000 {
        300 // 3%
    } else if effective_health_bps >= 3_000 {
        100 // 1%
    } else {
        0 // trading disabled
    }
}

/// Compute effective health in basis points.
/// effective_health = min(junior_strength, 10000)
/// junior_strength = junior_capital * 10000 / original_junior_deposit
pub fn effective_health_bps(state: &VaultState) -> Result<u64, ProgramError> {
    if state.original_junior_deposit == 0 {
        return Ok(0);
    }
    let strength = state.junior_capital
        .checked_mul(10_000)
        .ok_or(KilnError::MathOverflow)?
        .checked_div(state.original_junior_deposit)
        .ok_or(KilnError::MathOverflow)?;
    Ok(core::cmp::min(strength, 10_000))
}

/// Run all pre-swap guard checks.
/// Returns Ok(()) if the swap is allowed, or the appropriate error.
pub fn run_guards(
    state: &VaultState,
    swap_amount: u64,
    current_time: i64,
) -> Result<(), ProgramError> {
    // 1. Trading must be enabled
    if state.trading_enabled == 0 {
        return Err(KilnError::TradingDisabled.into());
    }

    // 2. Vault must not be paused
    if state.is_paused != 0 {
        return Err(KilnError::VaultPaused.into());
    }

    // 3. Junior capital must be positive
    if state.junior_capital == 0 {
        return Err(KilnError::InsufficientJuniorCapital.into());
    }

    // 4. Cooldown must have expired
    if current_time < state.cooldown_until {
        return Err(KilnError::VaultInCooldown.into());
    }

    // 5. Position size within dynamic limit
    let health = effective_health_bps(state)?;
    let max_bps = max_position_bps(health) as u64;
    if max_bps == 0 {
        return Err(KilnError::TradingDisabled.into());
    }

    if state.current_nav > 0 {
        let max_amount = state.current_nav
            .checked_mul(max_bps)
            .ok_or(KilnError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(KilnError::MathOverflow)?;
        if swap_amount > max_amount {
            return Err(KilnError::PositionTooLarge.into());
        }
    }

    Ok(())
}

/// Apply post-swap cooldown logic based on NAV loss.
/// Updates cooldown_until, rolling loss fields, and paper_trade_count.
pub fn apply_post_swap_cooldown(
    state: &mut VaultState,
    old_nav: u64,
    new_nav: u64,
    current_time: i64,
    swap_amount: u64,
) {
    // Track paper trades (qualifying = > 5% of original junior deposit)
    if state.is_paper_mode != 0 && state.original_junior_deposit > 0 {
        let threshold = state.original_junior_deposit / 20; // 5%
        if swap_amount >= threshold {
            state.paper_trade_count = state.paper_trade_count.saturating_add(1);
        }
    }

    if new_nav >= old_nav {
        return;
    }

    let loss = old_nav.saturating_sub(new_nav);

    // Single trade loss as bps of old NAV
    let loss_bps = if old_nav > 0 {
        (loss.saturating_mul(10_000) / old_nav) as u16
    } else {
        0
    };

    // Single trade -3% → 2h cooldown
    if loss_bps >= 300 {
        let cooldown = current_time.saturating_add(7_200);
        if cooldown > state.cooldown_until {
            state.cooldown_until = cooldown;
        }
    }

    // Accumulate rolling losses (simplified: add to rolling counters)
    state.rolling_24h_loss_bps = state.rolling_24h_loss_bps.saturating_add(loss_bps);
    state.rolling_7d_loss_bps = state.rolling_7d_loss_bps.saturating_add(loss_bps);

    // Rolling 24h -7% → 24h cooldown
    if state.rolling_24h_loss_bps >= 700 {
        let cooldown = current_time.saturating_add(86_400);
        if cooldown > state.cooldown_until {
            state.cooldown_until = cooldown;
        }
    }

    // Rolling 7d -15% → 72h cooldown
    if state.rolling_7d_loss_bps >= 1_500 {
        let cooldown = current_time.saturating_add(259_200);
        if cooldown > state.cooldown_until {
            state.cooldown_until = cooldown;
        }
    }
}
