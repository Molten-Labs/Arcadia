#![allow(unexpected_cfgs)]

use crate::instructions::{self, ProgramInstruction};
use pinocchio::{
    account_info::AccountInfo, default_panic_handler, no_allocator, program_entrypoint,
    program_error::ProgramError, pubkey::Pubkey, ProgramResult,
};

// This is the entrypoint for the program.
program_entrypoint!(process_instruction);
//Do not allocate memory.
no_allocator!();
// Use the no_std panic handler.
default_panic_handler!();

#[inline(always)]
fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    if instruction_data.len() >= 8
        && instruction_data[..8] == instructions::MAGICBLOCK_EXTERNAL_UNDELEGATE_DISCRIMINATOR
    {
        return instructions::external_undelegate_private_intent_session(
            accounts,
            &instruction_data[8..],
        );
    }

    let (ix_disc, instruction_data) = instruction_data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;

    match ProgramInstruction::try_from(ix_disc)? {
        ProgramInstruction::InitManager => instructions::init_manager(accounts),
        ProgramInstruction::CreateVault => instructions::create_vault(accounts, instruction_data),
        ProgramInstruction::DepositJunior => {
            instructions::deposit_junior(accounts, instruction_data)
        }
        ProgramInstruction::UpdateNav => instructions::update_nav(accounts, instruction_data),
        ProgramInstruction::GraduateVault => {
            instructions::graduate_vault(accounts, instruction_data)
        }
        ProgramInstruction::DepositSenior => {
            instructions::deposit_senior(accounts, instruction_data)
        }
        ProgramInstruction::WithdrawSenior => {
            instructions::withdraw_senior(accounts, instruction_data)
        }
        ProgramInstruction::WithdrawJunior => {
            instructions::withdraw_junior(accounts, instruction_data)
        }
        ProgramInstruction::ClaimFees => instructions::claim_fees(accounts, instruction_data),
        ProgramInstruction::ExecuteSwap => instructions::execute_swap(accounts, instruction_data),
        ProgramInstruction::UpdateOraclePrice => {
            instructions::update_oracle_price(accounts, instruction_data)
        }
        ProgramInstruction::InitPrivateIntentSession => {
            instructions::init_private_intent_session(accounts, instruction_data)
        }
        ProgramInstruction::DelegatePrivateIntentSession => {
            instructions::delegate_private_intent_session(accounts, instruction_data)
        }
        ProgramInstruction::RecordPrivateIntentOnEr => {
            instructions::record_private_intent_on_er(accounts, instruction_data)
        }
        ProgramInstruction::CommitPrivateIntentSession => {
            instructions::commit_private_intent_session(accounts, instruction_data)
        }
        ProgramInstruction::CommitAndUndelegatePrivateIntentSession => {
            instructions::commit_and_undelegate_private_intent_session(accounts, instruction_data)
        }
    }
}
