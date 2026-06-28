use anchor_lang::prelude::*;

#[error_code]
pub enum ArcadiaError {
    #[msg("Caller is not authorized for this action")]
    Unauthorized,
    #[msg("Profile/vault is not active")]
    VaultNotActive,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Insufficient funds in source token account")]
    InsufficientFunds,
    #[msg("Leverage must be valid and within limits")]
    InvalidLeverage,
    #[msg("Leverage exceeds profile max_leverage")]
    LeverageTooHigh,
    #[msg("Trade notional exceeds 20% of AUM")]
    NotionalTooLarge,
    #[msg("Invalid trade parameters")]
    InvalidTradeParams,
    #[msg("Vault has no shares; NAV undefined")]
    NoShares,
    #[msg("Capacity has not been set by oracle")]
    CapacityNotSet,
    #[msg("Deposit would exceed capacity cap")]
    CapacityExceeded,
    #[msg("Deposit too small; mints zero shares")]
    DustDeposit,
    #[msg("Invalid score tier")]
    InvalidTier,
    #[msg("Invalid or unsafe fee configuration")]
    InvalidFeeConfig,
    #[msg("Insufficient shares for withdrawal")]
    InsufficientShares,
    #[msg("No pending withdrawal")]
    NothingPending,
    #[msg("Withdrawal window not yet reached")]
    NoticeNotElapsed,
    #[msg("Vault token balance insufficient for payout")]
    InsufficientVaultLiquidity,
    #[msg("Amount exceeds trader claimable")]
    InsufficientClaimable,
    #[msg("Arithmetic overflow")]
    MathOverflow,

    #[msg("Smoke message is too long")]
    SmokeMessageTooLong,
    #[msg("Smoke ping counter overflowed")]
    SmokeCounterOverflow,
}
