use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Smoke message is too long")]
    SmokeMessageTooLong,
    #[msg("Smoke ping counter overflowed")]
    SmokeCounterOverflow,
}
