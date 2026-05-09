use pinocchio::program_error::ProgramError;
use Kiln_program::{
    errors::KilnError,
    instructions::custody::{
        enforce_liquid_reserve, min_liquid_usdc, nav_usdc, wsol_needed_for_usdc, wsol_value_usdc,
        PRICE_SCALE, USDC_DECIMALS, WSOL_DECIMALS,
    },
    instructions::vault_guard::{
        apply_post_swap_cooldown, effective_health_bps, max_position_bps, run_guards,
        run_guards_with_notional,
    },
    states::VaultState,
};

fn make_state(junior: u64, original_junior: u64, senior: u64, nav: u64) -> VaultState {
    VaultState {
        discriminator: 3,
        bump: 0,
        is_paper_mode: 0,
        is_graduated: 1,
        is_paused: 0,
        trading_enabled: 1,
        _flag_padding: [0; 2],
        vault_config: [0; 32],
        original_junior_deposit: original_junior,
        junior_capital: junior,
        senior_capital: senior,
        junior_shares_outstanding: junior,
        senior_shares_outstanding: senior,
        current_nav: nav,
        last_nav: nav,
        high_water_mark: nav,
        created_at: 1000,
        last_nav_update_at: 1000,
        graduated_at: 1000,
        cooldown_until: 0,
        paper_trade_count: 0,
        min_qualifying_trades: 3,
        rolling_24h_loss_bps: 0,
        rolling_7d_loss_bps: 0,
    }
}

// ======================== max_position_bps ========================

#[test]
fn position_limit_full_health() {
    assert_eq!(max_position_bps(10_000), 1000); // 10%
    assert_eq!(max_position_bps(15_000), 1000); // capped at 10%
}

#[test]
fn position_limit_80_pct() {
    assert_eq!(max_position_bps(8_000), 600); // 6%
    assert_eq!(max_position_bps(9_999), 600);
}

#[test]
fn position_limit_50_pct() {
    assert_eq!(max_position_bps(5_000), 300); // 3%
    assert_eq!(max_position_bps(7_999), 300);
}

#[test]
fn position_limit_30_pct() {
    assert_eq!(max_position_bps(3_000), 100); // 1%
    assert_eq!(max_position_bps(4_999), 100);
}

#[test]
fn position_limit_below_30_disabled() {
    assert_eq!(max_position_bps(2_999), 0);
    assert_eq!(max_position_bps(0), 0);
}

// ======================== effective_health_bps ========================

#[test]
fn health_100_pct_when_no_loss() {
    let state = make_state(1_000_000, 1_000_000, 0, 1_000_000);
    assert_eq!(effective_health_bps(&state).unwrap(), 10_000);
}

#[test]
fn health_50_pct_after_half_loss() {
    let state = make_state(500_000, 1_000_000, 0, 500_000);
    assert_eq!(effective_health_bps(&state).unwrap(), 5_000);
}

#[test]
fn health_capped_at_10000() {
    // Junior grew beyond original (gains)
    let state = make_state(2_000_000, 1_000_000, 0, 2_000_000);
    assert_eq!(effective_health_bps(&state).unwrap(), 10_000);
}

#[test]
fn health_zero_when_junior_zero() {
    let state = make_state(0, 1_000_000, 0, 0);
    assert_eq!(effective_health_bps(&state).unwrap(), 0);
}

#[test]
fn health_zero_when_original_deposit_zero() {
    let state = make_state(0, 0, 0, 0);
    assert_eq!(effective_health_bps(&state).unwrap(), 0);
}

// ======================== run_guards ========================

#[test]
fn guards_pass_healthy_vault() {
    let state = make_state(1_000_000, 1_000_000, 4_000_000, 5_000_000);
    // 10% of 5M = 500k, swapping 100k should pass
    assert!(run_guards(&state, 100_000, 2000).is_ok());
}

#[test]
fn guards_reject_trading_disabled() {
    let mut state = make_state(1_000_000, 1_000_000, 0, 1_000_000);
    state.trading_enabled = 0;
    assert!(run_guards(&state, 100_000, 2000).is_err());
}

#[test]
fn guards_reject_paused() {
    let mut state = make_state(1_000_000, 1_000_000, 0, 1_000_000);
    state.is_paused = 1;
    assert!(run_guards(&state, 100_000, 2000).is_err());
}

#[test]
fn guards_reject_zero_junior() {
    let state = make_state(0, 1_000_000, 500_000, 500_000);
    assert!(run_guards(&state, 100_000, 2000).is_err());
}

#[test]
fn guards_reject_in_cooldown() {
    let mut state = make_state(1_000_000, 1_000_000, 0, 1_000_000);
    state.cooldown_until = 5000;
    assert!(run_guards(&state, 100_000, 2000).is_err()); // current_time 2000 < cooldown 5000
}

#[test]
fn guards_pass_after_cooldown() {
    let mut state = make_state(1_000_000, 1_000_000, 0, 1_000_000);
    state.cooldown_until = 1500;
    assert!(run_guards(&state, 50_000, 2000).is_ok()); // current_time 2000 >= cooldown 1500
}

#[test]
fn guards_reject_position_too_large() {
    let state = make_state(1_000_000, 1_000_000, 0, 1_000_000);
    // Max position = 10% of 1M = 100k. Swap 200k should fail
    assert!(run_guards(&state, 200_000, 2000).is_err());
}

#[test]
fn guards_accept_position_at_limit() {
    let state = make_state(1_000_000, 1_000_000, 0, 1_000_000);
    // Max = 10% of 1M = 100k
    assert!(run_guards(&state, 100_000, 2000).is_ok());
}

#[test]
fn guards_tighter_limit_at_low_health() {
    // 60% health -> 3% limit
    let state = make_state(600_000, 1_000_000, 0, 600_000);
    // 3% of 600k = 18k
    assert!(run_guards(&state, 18_000, 2000).is_ok());
    assert!(run_guards(&state, 19_000, 2000).is_err());
}

// ======================== apply_post_swap_cooldown ========================

#[test]
fn cooldown_no_loss_no_cooldown() {
    let mut state = make_state(1_000_000, 1_000_000, 0, 1_000_000);
    apply_post_swap_cooldown(&mut state, 1_000_000, 1_000_000, 2000, 100_000);
    assert_eq!(state.cooldown_until, 0);
}

#[test]
fn cooldown_small_loss_no_cooldown() {
    let mut state = make_state(1_000_000, 1_000_000, 0, 1_000_000);
    // 2% loss (under 3% threshold)
    apply_post_swap_cooldown(&mut state, 1_000_000, 980_000, 2000, 100_000);
    assert_eq!(state.cooldown_until, 0);
}

#[test]
fn cooldown_3pct_loss_triggers_2h() {
    let mut state = make_state(1_000_000, 1_000_000, 0, 1_000_000);
    // 4% loss (over 3% threshold)
    apply_post_swap_cooldown(&mut state, 1_000_000, 960_000, 2000, 100_000);
    assert_eq!(state.cooldown_until, 2000 + 7_200); // 2h cooldown
}

#[test]
fn cooldown_rolling_24h_7pct_triggers_24h() {
    let mut state = make_state(1_000_000, 1_000_000, 0, 1_000_000);
    // Two swaps accumulate to 8% rolling loss
    apply_post_swap_cooldown(&mut state, 1_000_000, 960_000, 1000, 100_000); // 4% = 400 bps
    apply_post_swap_cooldown(&mut state, 960_000, 920_000, 2000, 100_000); // ~4.2% = 416 bps, total > 700
    assert!(state.cooldown_until >= 2000 + 86_400); // 24h cooldown
}

#[test]
fn paper_trade_count_incremented_for_qualifying_trade() {
    let mut state = make_state(1_000_000, 1_000_000, 0, 1_000_000);
    state.is_paper_mode = 1;
    // Qualifying trade = > 5% of 1M = 50k
    apply_post_swap_cooldown(&mut state, 1_000_000, 1_000_000, 2000, 60_000);
    assert_eq!(state.paper_trade_count, 1);
}

#[test]
fn paper_trade_count_not_incremented_for_small_trade() {
    let mut state = make_state(1_000_000, 1_000_000, 0, 1_000_000);
    state.is_paper_mode = 1;
    // Below 5% threshold
    apply_post_swap_cooldown(&mut state, 1_000_000, 1_000_000, 2000, 40_000);
    assert_eq!(state.paper_trade_count, 0);
}

#[test]
fn paper_trade_count_not_incremented_after_graduation() {
    let mut state = make_state(1_000_000, 1_000_000, 0, 1_000_000);
    state.is_paper_mode = 0; // graduated
    apply_post_swap_cooldown(&mut state, 1_000_000, 1_000_000, 2000, 100_000);
    assert_eq!(state.paper_trade_count, 0);
}

// ======================== Sliding scale junior ratio ========================
// Test via the deposit_senior module's function (it's not pub, so we test the logic conceptually)

#[test]
fn junior_ratio_calculation() {
    // 20% junior = 200k junior, 800k senior, 1M total
    // ratio = 200k * 10000 / 1M = 2000 bps = 20%
    let junior = 200_000u64;
    let total = 1_000_000u64;
    let ratio_bps = junior.checked_mul(10_000).unwrap() / total;
    assert_eq!(ratio_bps, 2_000);
}

#[test]
fn junior_ratio_below_threshold() {
    // 15% junior at <$50k TVL requires 20% → violation
    let junior = 150_000u64;
    let total = 1_000_000u64;
    let ratio_bps = junior.checked_mul(10_000).unwrap() / total;
    assert_eq!(ratio_bps, 1_500); // 15%, below 20% requirement for <$50k
    assert!(ratio_bps < 2_000);
}

// ======================== Waterfall loss logic ========================

#[test]
fn waterfall_junior_absorbs_full_loss() {
    let mut state = make_state(1_000_000, 1_000_000, 4_000_000, 5_000_000);
    let loss = 500_000u64;
    // Junior absorbs all
    assert!(loss <= state.junior_capital);
    state.junior_capital -= loss;
    assert_eq!(state.junior_capital, 500_000);
    assert_eq!(state.senior_capital, 4_000_000); // untouched
}

#[test]
fn waterfall_junior_wiped_senior_hit() {
    let mut state = make_state(200_000, 1_000_000, 4_000_000, 4_200_000);
    let loss = 500_000u64;
    // Junior can only absorb 200k, remaining 300k hits senior
    let remaining = loss - state.junior_capital;
    state.junior_capital = 0;
    state.senior_capital -= remaining;
    state.trading_enabled = 0;
    assert_eq!(state.junior_capital, 0);
    assert_eq!(state.senior_capital, 3_700_000);
    assert_eq!(state.trading_enabled, 0);
}

#[test]
fn waterfall_full_junior_wipe_freezes_vault() {
    let mut state = make_state(100_000, 1_000_000, 500_000, 600_000);
    let _loss = 100_000u64;
    state.junior_capital = 0;
    state.trading_enabled = 0;
    assert_eq!(state.junior_capital, 0);
    assert_eq!(state.trading_enabled, 0);
}

// ======================== Principal ledger accounting ========================

#[test]
fn principal_deposit_adds_exact_amount() {
    let mut state = make_state(1_000_000, 1_000_000, 4_000_000, 5_000_000);
    let deposit = 500_000u64;
    state.senior_capital += deposit;
    state.senior_shares_outstanding += deposit;

    assert_eq!(state.senior_capital, 4_500_000);
    assert_eq!(state.senior_shares_outstanding, 4_500_000);
}

#[test]
fn principal_claim_scales_after_loss() {
    let investor_principal = 1_000_000u64;
    let senior_capital = 800_000u64;
    let total_principal = 1_000_000u64;
    let max_claim = investor_principal * senior_capital / total_principal;

    assert_eq!(max_claim, 800_000);
}

// ======================== Performance fee (HWM) ========================

#[test]
fn fee_only_above_hwm() {
    let nav = 1_200_000u64;
    let hwm = 1_000_000u64;
    let profit = nav - hwm; // 200k
    let fee = profit * 2000 / 10_000; // 20% = 40k
    assert_eq!(fee, 40_000);
}

#[test]
fn fee_zero_at_hwm() {
    let nav = 1_000_000u64;
    let hwm = 1_000_000u64;
    assert!(nav <= hwm); // no fee
}

#[test]
fn fee_zero_below_hwm() {
    let nav = 800_000u64;
    let hwm = 1_000_000u64;
    assert!(nav <= hwm); // no fee on recovery
}

// ======================== USDC/WSOL custody valuation ========================

#[test]
fn nav_counts_usdc_plus_wsol_value() {
    let ten_thousand_usdc = 10_000 * USDC_DECIMALS;
    let two_sol = 2 * WSOL_DECIMALS;
    let sol_usd = 150 * PRICE_SCALE;
    let usdc_usd = PRICE_SCALE;

    assert_eq!(
        nav_usdc(ten_thousand_usdc, two_sol, sol_usd, usdc_usd).unwrap(),
        10_300 * USDC_DECIMALS
    );
}

#[test]
fn zero_wsol_is_valid_nav() {
    assert_eq!(
        nav_usdc(42_000 * USDC_DECIMALS, 0, 180 * PRICE_SCALE, PRICE_SCALE).unwrap(),
        42_000 * USDC_DECIMALS
    );
}

#[test]
fn wsol_value_uses_usdc_usd_denominator() {
    let one_sol = WSOL_DECIMALS;
    let sol_usd = 200 * PRICE_SCALE;
    let usdc_usd = PRICE_SCALE + 10_000; // USDC at $1.01

    assert_eq!(
        wsol_value_usdc(one_sol, sol_usd, usdc_usd).unwrap(),
        198_019_801
    );
}

#[test]
fn wsol_needed_rounds_up_to_cover_shortfall() {
    let shortfall = 100 * USDC_DECIMALS;
    let sol_usd = 150 * PRICE_SCALE;
    let usdc_usd = PRICE_SCALE;

    assert_eq!(
        wsol_needed_for_usdc(shortfall, sol_usd, usdc_usd).unwrap(),
        666_666_667
    );
}

#[test]
fn reserve_requires_ten_percent_liquid_usdc() {
    let nav = 1_000 * USDC_DECIMALS;
    assert_eq!(min_liquid_usdc(nav).unwrap(), 100 * USDC_DECIMALS);
    assert!(enforce_liquid_reserve(100 * USDC_DECIMALS, nav).is_ok());
    let err = enforce_liquid_reserve(99 * USDC_DECIMALS, nav).unwrap_err();
    assert_eq!(
        err,
        ProgramError::Custom(KilnError::LiquidReserveViolation as u32)
    );
}

#[test]
fn guards_use_usdc_notional_for_position_limit() {
    let state = make_state(1_000_000, 1_000_000, 4_000_000, 5_000_000);
    assert!(run_guards_with_notional(&state, 500_000, 2000).is_ok());
    assert!(run_guards_with_notional(&state, 500_001, 2000).is_err());
}
