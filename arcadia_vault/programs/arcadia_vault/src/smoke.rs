use anchor_lang::prelude::*;

#[constant]
pub const SMOKE_SEED: &[u8] = b"smoke";

pub const MAX_SMOKE_MESSAGE_LEN: usize = 64;

#[account]
#[derive(InitSpace)]
pub struct SmokeState {
    pub authority: Pubkey,
    pub count: u64,
    pub bump: u8,
    #[max_len(64)]
    pub message: String,
}
