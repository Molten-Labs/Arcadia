use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct SmokeState {
    pub authority: Pubkey,
    pub count: u64,
    pub bump: u8,
    #[max_len(64)]
    pub message: String,
}
