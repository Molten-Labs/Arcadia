use pinocchio::program_error::ProgramError;

#[derive(Clone, Copy, Debug, PartialEq, Eq, shank::ShankType)]
#[repr(u32)]
pub enum KilnError {
    InvalidInstructionData = 6_000,
    InvalidAccountDiscriminator,
    InvalidManagerProfilePda,
    InvalidVaultConfigPda,
    InvalidVaultStatePda,
    InvalidTreasuryPda,
    InvalidSystemProgram,
    InvalidVaultConfiguration,
    InvalidAmount,
    ManagerMismatch,
    VaultStateMismatch,
    TreasuryMismatch,
    TreasuryAccountingMismatch,
    VaultPaused,
    MathOverflow,
    InsufficientJuniorCapital,
    GraduationRequirementsNotMet,
    VaultNotGraduated,
    VaultInCooldown,
    VaultFrozen,
    JuniorRatioViolation,
    SlippageExceeded,
    PositionTooLarge,
    MinDepositNotMet,
    TradingDisabled,
    InsufficientSeniorCapital,
    WithdrawalCooldownActive,
    InvestorMismatch,
    InvalidInvestorPositionPda,
    InvalidSwapRoute,
    InvalidJupiterProgram,
    InvalidTokenProgram,
    InvalidTokenAccount,
    InvalidOracleAccount,
    JupiterCpiFailed,
    InsufficientLiquidity,
    StaleOraclePrice,
    InvalidPriceFeed,
    LiquidReserveViolation,
    InvalidCustodyAccount,
    InvalidPrivateIntentSession,
    PrivateIntentExpired,
    PrivateIntentAmountExceeded,
    InvalidMagicBlockAccount,
    InvalidPrivateIntentTransition,
    InvalidPrivateIntentProof,
}

impl From<KilnError> for ProgramError {
    fn from(value: KilnError) -> Self {
        Self::Custom(value as u32)
    }
}
