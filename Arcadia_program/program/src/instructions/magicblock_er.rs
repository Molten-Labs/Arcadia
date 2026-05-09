use core::convert::TryInto;

use pinocchio::{
    account_info::AccountInfo,
    cpi::slice_invoke_signed,
    instruction::{AccountMeta, Instruction, Seed, Signer},
    program_error::ProgramError,
    pubkey::{find_program_address, Pubkey},
    sysvars::{clock::Clock, rent::Rent},
    ProgramResult,
};
use pinocchio_system::instructions::{Assign, CreateAccount};
use wincode::{deserialize_exact, SchemaRead};

use crate::{
    errors::KilnError,
    states::{
        ManagerProfile, PrivateIntentSessionAccount, VaultConfig, PRIVATE_INTENT_GUARD_APPROVED,
        PRIVATE_INTENT_GUARD_PENDING, PRIVATE_INTENT_GUARD_REJECTED,
        PRIVATE_INTENT_SESSION_SEED, PRIVATE_INTENT_SETTLEMENT_FAILED,
        PRIVATE_INTENT_SETTLEMENT_LOSS, PRIVATE_INTENT_SETTLEMENT_PENDING,
        PRIVATE_INTENT_SETTLEMENT_SUCCESS, PRIVATE_INTENT_STATUS_COMMITTED,
        PRIVATE_INTENT_STATUS_DELEGATED, PRIVATE_INTENT_STATUS_EXECUTING,
        PRIVATE_INTENT_STATUS_FAILED, PRIVATE_INTENT_STATUS_INITIALIZED, PRIVATE_INTENT_STATUS_RECLAIMED,
        PRIVATE_INTENT_STATUS_UNDELEGATING,
    },
};

pub const DELEGATION_PROGRAM_ID: Pubkey =
    pinocchio_pubkey::pubkey!("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
pub const MAGIC_PROGRAM_ID: Pubkey =
    pinocchio_pubkey::pubkey!("Magic11111111111111111111111111111111111111");
pub const MAGIC_CONTEXT_ID: Pubkey =
    pinocchio_pubkey::pubkey!("MagicContext1111111111111111111111111111111");
pub const PERMISSION_PROGRAM_ID: Pubkey =
    pinocchio_pubkey::pubkey!("ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1");
pub const MAGICBLOCK_DEVNET_TEE_VALIDATOR: Pubkey =
    pinocchio_pubkey::pubkey!("MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo");
pub const MAGICBLOCK_EXTERNAL_UNDELEGATE_DISCRIMINATOR: [u8; 8] =
    [196, 28, 41, 206, 48, 37, 51, 167];

const PERMISSION_SEED: &[u8] = b"permission:";
const DELEGATION_BUFFER_SEED: &[u8] = b"buffer";
const DELEGATION_RECORD_SEED: &[u8] = b"delegation";
const DELEGATION_METADATA_SEED: &[u8] = b"delegation-metadata";
const MAGICBLOCK_DELEGATE_DISCRIMINATOR: u64 = 0;
const MAGICBLOCK_COMMIT_DISCRIMINATOR: [u8; 4] = [1, 0, 0, 0];
const MAGICBLOCK_COMMIT_AND_UNDELEGATE_DISCRIMINATOR: [u8; 4] = [2, 0, 0, 0];
const PERMISSION_CREATE_DISCRIMINATOR: u64 = 0;
const PERMISSION_DELEGATE_DISCRIMINATOR: u64 = 3;
const PERMISSION_COMMIT_DISCRIMINATOR: u64 = 4;
const PERMISSION_COMMIT_AND_UNDELEGATE_DISCRIMINATOR: u64 = 5;
const PERMISSION_MEMBER_ALL_FLAGS: u8 = 0b0001_1111;

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, SchemaRead)]
pub struct InitPrivateIntentSessionArgs {
    pub session_id: [u8; 32],
    pub intent_commitment: [u8; 32],
    pub max_in_amount: u64,
    pub expires_at: i64,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, SchemaRead)]
pub struct DelegatePrivateIntentSessionArgs {
    pub commit_frequency_ms: u32,
    pub _reserved: [u8; 4],
    pub validator: Pubkey,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, SchemaRead)]
pub struct RecordPrivateIntentOnErArgs {
    pub proof_hash: [u8; 32],
    pub er_state_root: [u8; 32],
    pub observed_in_amount: u64,
    pub guard_decision: u8,
    pub settlement_result: u8,
    pub status: u8,
    pub _reserved: [u8; 5],
}

#[derive(Clone, Copy)]
struct PrivateIntentPermissionAccounts<'a> {
    permission: &'a AccountInfo,
    permission_program: &'a AccountInfo,
    permission_delegation_buffer: &'a AccountInfo,
    permission_delegation_record: &'a AccountInfo,
    permission_delegation_metadata: &'a AccountInfo,
    validator: Option<&'a AccountInfo>,
}

pub fn init_private_intent_session(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [manager, manager_profile, vault_config, private_session, rent_sysvar, clock_sysvar, system_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !manager.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !manager.is_writable() || !private_session.is_writable() {
        return Err(ProgramError::InvalidAccountData);
    }
    if system_program.key() != &pinocchio_system::ID {
        return Err(KilnError::InvalidSystemProgram.into());
    }
    if !private_session.data_is_empty() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let args: InitPrivateIntentSessionArgs =
        deserialize_exact(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    if is_zero_32(&args.session_id)
        || is_zero_32(&args.intent_commitment)
        || args.max_in_amount == 0
    {
        return Err(KilnError::InvalidPrivateIntentSession.into());
    }

    let clock = Clock::from_account_info(clock_sysvar)?;
    if args.expires_at <= clock.unix_timestamp {
        return Err(KilnError::PrivateIntentExpired.into());
    }
    let rent = Rent::from_account_info(rent_sysvar)?;

    let profile = ManagerProfile::load(manager_profile)?;
    if profile.owner != *manager.key() {
        return Err(KilnError::ManagerMismatch.into());
    }
    drop(profile);

    let config = VaultConfig::load(vault_config)?;
    if config.manager != *manager.key() || config.manager_profile != *manager_profile.key() {
        return Err(KilnError::ManagerMismatch.into());
    }
    drop(config);

    let (expected_session, session_bump) = find_program_address(
        &[
            PRIVATE_INTENT_SESSION_SEED,
            vault_config.key().as_ref(),
            &args.session_id,
        ],
        &crate::ID,
    );
    if private_session.key() != &expected_session {
        return Err(KilnError::InvalidPrivateIntentSession.into());
    }

    let session_bump_seed = [session_bump];
    let session_signer_seeds = [
        Seed::from(PRIVATE_INTENT_SESSION_SEED),
        Seed::from(vault_config.key().as_ref()),
        Seed::from(&args.session_id[..]),
        Seed::from(&session_bump_seed[..]),
    ];
    let session_signer = [Signer::from(&session_signer_seeds[..])];

    CreateAccount {
        from: manager,
        to: private_session,
        lamports: rent.minimum_balance(PrivateIntentSessionAccount::LEN),
        space: PrivateIntentSessionAccount::LEN as u64,
        owner: &crate::ID,
    }
    .invoke_signed(&session_signer)?;

    PrivateIntentSessionAccount::initialize(
        private_session,
        manager.key(),
        vault_config.key(),
        &args.session_id,
        &args.intent_commitment,
        args.max_in_amount,
        args.expires_at,
        session_bump,
        clock.unix_timestamp,
    )
}

pub fn delegate_private_intent_session(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if accounts.len() < 10 || (accounts.len() > 10 && accounts.len() < 15) {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    let manager = &accounts[0];
    let vault_config = &accounts[1];
    let private_session = &accounts[2];
    let owner_program = &accounts[3];
    let delegation_buffer = &accounts[4];
    let delegation_record = &accounts[5];
    let delegation_metadata = &accounts[6];
    let system_program = &accounts[7];
    let clock_sysvar = &accounts[8];
    let delegation_program = &accounts[9];
    let permission_accounts = if accounts.len() >= 15 {
        Some(PrivateIntentPermissionAccounts {
            permission: &accounts[10],
            permission_program: &accounts[11],
            permission_delegation_buffer: &accounts[12],
            permission_delegation_record: &accounts[13],
            permission_delegation_metadata: &accounts[14],
            validator: accounts.get(15),
        })
    } else {
        None
    };

    if !manager.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !manager.is_writable()
        || !private_session.is_writable()
        || !delegation_buffer.is_writable()
        || !delegation_record.is_writable()
        || !delegation_metadata.is_writable()
    {
        return Err(ProgramError::InvalidAccountData);
    }
    if owner_program.key() != &crate::ID || system_program.key() != &pinocchio_system::ID {
        return Err(KilnError::InvalidSystemProgram.into());
    }
    if delegation_program.key() != &DELEGATION_PROGRAM_ID {
        return Err(KilnError::InvalidMagicBlockAccount.into());
    }

    let args: DelegatePrivateIntentSessionArgs =
        deserialize_exact(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    if is_zero_32(&args.validator) {
        return Err(KilnError::InvalidMagicBlockAccount.into());
    }
    let clock = Clock::from_account_info(clock_sysvar)?;

    let mut session = PrivateIntentSessionAccount::load_mut(private_session)?;
    if session.manager != *manager.key()
        || session.vault_config != *vault_config.key()
        || session.status != PRIVATE_INTENT_STATUS_INITIALIZED
    {
        return Err(KilnError::InvalidPrivateIntentTransition.into());
    }
    if session.expires_at <= clock.unix_timestamp {
        return Err(KilnError::PrivateIntentExpired.into());
    }

    let session_id = session.session_id;
    let session_bump = session.bump;
    session.status = PRIVATE_INTENT_STATUS_DELEGATED;
    session.updated_at = clock.unix_timestamp;
    drop(session);

    validate_magicblock_delegation_pdas(
        private_session,
        owner_program,
        delegation_buffer,
        delegation_record,
        delegation_metadata,
    )?;

    if let Some(permission_accounts) = permission_accounts {
        validate_private_intent_permission_accounts(
            private_session,
            permission_accounts.permission,
            permission_accounts.permission_program,
            permission_accounts.permission_delegation_buffer,
            permission_accounts.permission_delegation_record,
            permission_accounts.permission_delegation_metadata,
        )?;
        create_and_delegate_private_intent_permission(
            manager,
            private_session,
            permission_accounts,
            system_program,
            delegation_program,
            vault_config.key(),
            &session_id,
            session_bump,
            &args.validator,
        )?;
    }

    create_buffer_copy_and_assign_session(
        manager,
        private_session,
        owner_program,
        delegation_buffer,
        vault_config.key(),
        &session_id,
        session_bump,
    )?;

    invoke_magicblock_delegate(
        manager,
        private_session,
        owner_program,
        delegation_buffer,
        delegation_record,
        delegation_metadata,
        system_program,
        vault_config.key(),
        &session_id,
        session_bump,
        args.commit_frequency_ms,
        &args.validator,
    )?;

    close_buffer_to_payer(manager, delegation_buffer)
}

pub fn record_private_intent_on_er(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [manager, vault_config, private_session, clock_sysvar] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !manager.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !private_session.is_writable() {
        return Err(ProgramError::InvalidAccountData);
    }

    let args: RecordPrivateIntentOnErArgs =
        deserialize_exact(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    if is_zero_32(&args.proof_hash)
        || is_zero_32(&args.er_state_root)
        || !is_valid_guard_decision(args.guard_decision)
        || !is_valid_settlement_result(args.settlement_result)
        || !matches!(
            args.status,
            PRIVATE_INTENT_STATUS_EXECUTING
                | PRIVATE_INTENT_STATUS_COMMITTED
                | PRIVATE_INTENT_STATUS_FAILED
        )
    {
        return Err(KilnError::InvalidPrivateIntentProof.into());
    }

    let clock = Clock::from_account_info(clock_sysvar)?;
    let mut session = PrivateIntentSessionAccount::load_mut_for_er(private_session)?;
    if session.manager != *manager.key() || session.vault_config != *vault_config.key() {
        return Err(KilnError::InvalidPrivateIntentSession.into());
    }
    if session.status != PRIVATE_INTENT_STATUS_DELEGATED
        && session.status != PRIVATE_INTENT_STATUS_EXECUTING
        && session.status != PRIVATE_INTENT_STATUS_COMMITTED
    {
        return Err(KilnError::InvalidPrivateIntentTransition.into());
    }
    if session.expires_at <= clock.unix_timestamp {
        return Err(KilnError::PrivateIntentExpired.into());
    }
    if args.observed_in_amount > session.max_in_amount {
        return Err(KilnError::PrivateIntentAmountExceeded.into());
    }

    session.proof_hash = args.proof_hash;
    session.er_state_root = args.er_state_root;
    session.guard_decision = args.guard_decision;
    session.settlement_result = args.settlement_result;
    session.status = args.status;
    session.updated_at = clock.unix_timestamp;
    Ok(())
}

pub fn commit_private_intent_session(accounts: &[AccountInfo], _data: &[u8]) -> ProgramResult {
    commit_or_undelegate_private_intent_session(accounts, false)
}

pub fn commit_and_undelegate_private_intent_session(
    accounts: &[AccountInfo],
    _data: &[u8],
) -> ProgramResult {
    commit_or_undelegate_private_intent_session(accounts, true)
}

pub fn external_undelegate_private_intent_session(
    accounts: &[AccountInfo],
    callback_args: &[u8],
) -> ProgramResult {
    let [private_session, undelegate_buffer, payer, system_program, rest @ ..] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !undelegate_buffer.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !private_session.is_writable() {
        return Err(ProgramError::InvalidAccountData);
    }
    if system_program.key() != &pinocchio_system::ID {
        return Err(KilnError::InvalidSystemProgram.into());
    }

    let parsed = parse_private_session_callback_seeds(callback_args)?;
    let (expected_session, bump) = find_program_address(
        &[
            PRIVATE_INTENT_SESSION_SEED,
            parsed.vault_config,
            parsed.session_id,
        ],
        &crate::ID,
    );
    if private_session.key() != &expected_session {
        return Err(KilnError::InvalidPrivateIntentSession.into());
    }

    let lamports = if undelegate_buffer.lamports() > 0 {
        undelegate_buffer.lamports()
    } else if let Some(rent_sysvar) = rest.first() {
        Rent::from_account_info(rent_sysvar)?.minimum_balance(undelegate_buffer.data_len())
    } else {
        return Err(ProgramError::InsufficientFunds);
    };
    let bump_seed = [bump];
    let session_signer_seeds = [
        Seed::from(PRIVATE_INTENT_SESSION_SEED),
        Seed::from(parsed.vault_config),
        Seed::from(parsed.session_id),
        Seed::from(&bump_seed[..]),
    ];
    let session_signer = [Signer::from(&session_signer_seeds[..])];

    CreateAccount {
        from: payer,
        to: private_session,
        lamports,
        space: undelegate_buffer.data_len() as u64,
        owner: &crate::ID,
    }
    .invoke_signed(&session_signer)?;

    {
        let buffer_data = undelegate_buffer.try_borrow_data()?;
        let mut session_data = private_session.try_borrow_mut_data()?;
        if session_data.len() != buffer_data.len()
            || session_data.len() != PrivateIntentSessionAccount::LEN
        {
            return Err(ProgramError::InvalidAccountData);
        }
        session_data.copy_from_slice(&buffer_data);
    }

    let mut session = PrivateIntentSessionAccount::load_mut(private_session)?;
    session.status = PRIVATE_INTENT_STATUS_RECLAIMED;
    Ok(())
}

fn commit_or_undelegate_private_intent_session(
    accounts: &[AccountInfo],
    undelegate: bool,
) -> ProgramResult {
    if accounts.len() < 5 || (accounts.len() > 5 && accounts.len() < 7) {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    let manager = &accounts[0];
    let private_session = &accounts[1];
    let magic_program = &accounts[2];
    let magic_context = &accounts[3];
    let clock_sysvar = &accounts[4];
    let permission_accounts = if accounts.len() >= 7 {
        Some((&accounts[5], &accounts[6]))
    } else {
        None
    };
    if !manager.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !private_session.is_writable() || !magic_context.is_writable() {
        return Err(ProgramError::InvalidAccountData);
    }
    if magic_program.key() != &MAGIC_PROGRAM_ID || magic_context.key() != &MAGIC_CONTEXT_ID {
        return Err(KilnError::InvalidMagicBlockAccount.into());
    }

    let clock = Clock::from_account_info(clock_sysvar)?;
    let mut session = PrivateIntentSessionAccount::load_mut_for_er(private_session)?;
    if session.manager != *manager.key() {
        return Err(KilnError::ManagerMismatch.into());
    }
    if session.status != PRIVATE_INTENT_STATUS_DELEGATED
        && session.status != PRIVATE_INTENT_STATUS_EXECUTING
        && session.status != PRIVATE_INTENT_STATUS_COMMITTED
    {
        return Err(KilnError::InvalidPrivateIntentTransition.into());
    }
    session.status = if undelegate {
        PRIVATE_INTENT_STATUS_UNDELEGATING
    } else {
        PRIVATE_INTENT_STATUS_COMMITTED
    };
    session.updated_at = clock.unix_timestamp;
    drop(session);

    if let Some((permission, permission_program)) = permission_accounts {
        validate_private_intent_permission_account(private_session, permission, permission_program)?;
        invoke_commit_private_intent_permission(
            manager,
            private_session,
            permission,
            permission_program,
            magic_program,
            magic_context,
            undelegate,
        )?;
    }

    let data = if undelegate {
        &MAGICBLOCK_COMMIT_AND_UNDELEGATE_DISCRIMINATOR[..]
    } else {
        &MAGICBLOCK_COMMIT_DISCRIMINATOR[..]
    };
    let metas = [
        AccountMeta::new(manager.key(), manager.is_writable(), true),
        AccountMeta::writable(magic_context.key()),
        AccountMeta::new(
            private_session.key(),
            private_session.is_writable(),
            private_session.is_signer(),
        ),
    ];
    let ix = Instruction {
        program_id: magic_program.key(),
        accounts: &metas,
        data,
    };
    slice_invoke_signed(&ix, &[manager, magic_context, private_session], &[])
}

fn create_buffer_copy_and_assign_session(
    payer: &AccountInfo,
    private_session: &AccountInfo,
    owner_program: &AccountInfo,
    delegation_buffer: &AccountInfo,
    vault_config: &Pubkey,
    session_id: &[u8; 32],
    session_bump: u8,
) -> ProgramResult {
    let (_, buffer_bump) = find_program_address(
        &[DELEGATION_BUFFER_SEED, private_session.key().as_ref()],
        owner_program.key(),
    );
    let buffer_bump_seed = [buffer_bump];
    let buffer_signer_seeds = [
        Seed::from(DELEGATION_BUFFER_SEED),
        Seed::from(private_session.key().as_ref()),
        Seed::from(&buffer_bump_seed[..]),
    ];
    let buffer_signer = [Signer::from(&buffer_signer_seeds[..])];

    CreateAccount {
        from: payer,
        to: delegation_buffer,
        lamports: 0,
        space: private_session.data_len() as u64,
        owner: owner_program.key(),
    }
    .invoke_signed(&buffer_signer)?;

    {
        let session_data = private_session.try_borrow_data()?;
        let mut buffer_data = delegation_buffer.try_borrow_mut_data()?;
        if session_data.len() != buffer_data.len() {
            return Err(ProgramError::InvalidAccountData);
        }
        buffer_data.copy_from_slice(&session_data);
    }
    {
        let mut session_data = private_session.try_borrow_mut_data()?;
        session_data.fill(0);
    }

    let session_bump_seed = [session_bump];
    let session_signer_seeds = [
        Seed::from(PRIVATE_INTENT_SESSION_SEED),
        Seed::from(vault_config.as_ref()),
        Seed::from(&session_id[..]),
        Seed::from(&session_bump_seed[..]),
    ];
    let session_signer = [Signer::from(&session_signer_seeds[..])];

    if !private_session.is_owned_by(&pinocchio_system::ID) {
        unsafe { private_session.assign(&pinocchio_system::ID) };
    }
    Assign {
        account: private_session,
        owner: &DELEGATION_PROGRAM_ID,
    }
    .invoke_signed(&session_signer)
}

#[allow(clippy::too_many_arguments)]
fn invoke_magicblock_delegate(
    payer: &AccountInfo,
    private_session: &AccountInfo,
    owner_program: &AccountInfo,
    delegation_buffer: &AccountInfo,
    delegation_record: &AccountInfo,
    delegation_metadata: &AccountInfo,
    system_program: &AccountInfo,
    vault_config: &Pubkey,
    session_id: &[u8; 32],
    session_bump: u8,
    commit_frequency_ms: u32,
    validator: &Pubkey,
) -> ProgramResult {
    let mut data = [0_u8; 8 + 4 + 4 + (3 * (4 + 32)) + 1 + 32];
    let mut offset = 0;
    data[offset..offset + 8].copy_from_slice(&MAGICBLOCK_DELEGATE_DISCRIMINATOR.to_le_bytes());
    offset += 8;
    data[offset..offset + 4].copy_from_slice(&commit_frequency_ms.to_le_bytes());
    offset += 4;
    data[offset..offset + 4].copy_from_slice(&3_u32.to_le_bytes());
    offset += 4;
    offset = write_seed(&mut data, offset, PRIVATE_INTENT_SESSION_SEED)?;
    offset = write_seed(&mut data, offset, vault_config.as_ref())?;
    offset = write_seed(&mut data, offset, session_id)?;
    data[offset] = 1;
    offset += 1;
    data[offset..offset + 32].copy_from_slice(validator.as_ref());
    offset += 32;

    let session_bump_seed = [session_bump];
    let session_signer_seeds = [
        Seed::from(PRIVATE_INTENT_SESSION_SEED),
        Seed::from(vault_config.as_ref()),
        Seed::from(&session_id[..]),
        Seed::from(&session_bump_seed[..]),
    ];
    let session_signer = [Signer::from(&session_signer_seeds[..])];

    let metas = [
        AccountMeta::writable_signer(payer.key()),
        AccountMeta::writable_signer(private_session.key()),
        AccountMeta::readonly(owner_program.key()),
        AccountMeta::writable(delegation_buffer.key()),
        AccountMeta::writable(delegation_record.key()),
        AccountMeta::writable(delegation_metadata.key()),
        AccountMeta::readonly(system_program.key()),
    ];
    let ix = Instruction {
        program_id: &DELEGATION_PROGRAM_ID,
        accounts: &metas,
        data: &data[..offset],
    };
    slice_invoke_signed(
        &ix,
        &[
            payer,
            private_session,
            owner_program,
            delegation_buffer,
            delegation_record,
            delegation_metadata,
            system_program,
        ],
        &session_signer,
    )
}

fn close_buffer_to_payer(payer: &AccountInfo, buffer: &AccountInfo) -> ProgramResult {
    let buffer_lamports = buffer.lamports();
    if buffer_lamports > 0 {
        {
            let mut payer_lamports = payer.try_borrow_mut_lamports()?;
            *payer_lamports = payer_lamports
                .checked_add(buffer_lamports)
                .ok_or(KilnError::MathOverflow)?;
        }
        {
            let mut buffer_lamports_mut = buffer.try_borrow_mut_lamports()?;
            *buffer_lamports_mut = 0;
        }
    }
    buffer.resize(0)?;
    unsafe { buffer.assign(&pinocchio_system::ID) };
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn create_and_delegate_private_intent_permission(
    payer: &AccountInfo,
    private_session: &AccountInfo,
    permission_accounts: PrivateIntentPermissionAccounts<'_>,
    system_program: &AccountInfo,
    delegation_program: &AccountInfo,
    vault_config: &Pubkey,
    session_id: &[u8; 32],
    session_bump: u8,
    validator: &Pubkey,
) -> ProgramResult {
    if let Some(validator_account) = permission_accounts.validator {
        if validator_account.key() != validator {
            return Err(KilnError::InvalidMagicBlockAccount.into());
        }
    }

    let session_bump_seed = [session_bump];
    let session_signer_seeds = [
        Seed::from(PRIVATE_INTENT_SESSION_SEED),
        Seed::from(vault_config.as_ref()),
        Seed::from(&session_id[..]),
        Seed::from(&session_bump_seed[..]),
    ];
    let session_signer = [Signer::from(&session_signer_seeds[..])];

    if permission_accounts.permission.data_is_empty() {
        invoke_create_private_intent_permission(
            payer,
            private_session,
            permission_accounts.permission,
            permission_accounts.permission_program,
            system_program,
            &session_signer,
        )?;
    }

    if !permission_accounts.permission.is_owned_by(&DELEGATION_PROGRAM_ID) {
        invoke_delegate_private_intent_permission(
            payer,
            private_session,
            permission_accounts.permission,
            permission_accounts.permission_program,
            permission_accounts.permission_delegation_buffer,
            permission_accounts.permission_delegation_record,
            permission_accounts.permission_delegation_metadata,
            system_program,
            delegation_program,
            permission_accounts.validator,
        )?;
    }

    Ok(())
}

fn invoke_create_private_intent_permission(
    payer: &AccountInfo,
    private_session: &AccountInfo,
    permission: &AccountInfo,
    permission_program: &AccountInfo,
    system_program: &AccountInfo,
    session_signer: &[Signer],
) -> ProgramResult {
    let mut data = [0_u8; 8 + 1 + 4 + 1 + 32];
    let mut offset = 0;
    data[offset..offset + 8].copy_from_slice(&PERMISSION_CREATE_DISCRIMINATOR.to_le_bytes());
    offset += 8;
    data[offset] = 1;
    offset += 1;
    data[offset..offset + 4].copy_from_slice(&1_u32.to_le_bytes());
    offset += 4;
    data[offset] = PERMISSION_MEMBER_ALL_FLAGS;
    offset += 1;
    data[offset..offset + 32].copy_from_slice(payer.key().as_ref());
    offset += 32;

    let metas = [
        AccountMeta::readonly_signer(private_session.key()),
        AccountMeta::writable(permission.key()),
        AccountMeta::writable_signer(payer.key()),
        AccountMeta::readonly(system_program.key()),
    ];
    let ix = Instruction {
        program_id: permission_program.key(),
        accounts: &metas,
        data: &data[..offset],
    };
    slice_invoke_signed(
        &ix,
        &[private_session, permission, payer, system_program],
        session_signer,
    )
}

#[allow(clippy::too_many_arguments)]
fn invoke_delegate_private_intent_permission(
    payer: &AccountInfo,
    private_session: &AccountInfo,
    permission: &AccountInfo,
    permission_program: &AccountInfo,
    permission_delegation_buffer: &AccountInfo,
    permission_delegation_record: &AccountInfo,
    permission_delegation_metadata: &AccountInfo,
    system_program: &AccountInfo,
    delegation_program: &AccountInfo,
    validator: Option<&AccountInfo>,
) -> ProgramResult {
    let data = PERMISSION_DELEGATE_DISCRIMINATOR.to_le_bytes();
    let metas_without_validator = [
        AccountMeta::writable_signer(payer.key()),
        AccountMeta::writable_signer(payer.key()),
        AccountMeta::readonly(private_session.key()),
        AccountMeta::writable(permission.key()),
        AccountMeta::readonly(system_program.key()),
        AccountMeta::readonly(permission_program.key()),
        AccountMeta::writable(permission_delegation_buffer.key()),
        AccountMeta::writable(permission_delegation_record.key()),
        AccountMeta::writable(permission_delegation_metadata.key()),
        AccountMeta::readonly(delegation_program.key()),
    ];
    let validator_meta;
    let metas = if let Some(validator_account) = validator {
        validator_meta = AccountMeta::readonly(validator_account.key());
        [
            metas_without_validator[0].clone(),
            metas_without_validator[1].clone(),
            metas_without_validator[2].clone(),
            metas_without_validator[3].clone(),
            metas_without_validator[4].clone(),
            metas_without_validator[5].clone(),
            metas_without_validator[6].clone(),
            metas_without_validator[7].clone(),
            metas_without_validator[8].clone(),
            metas_without_validator[9].clone(),
            validator_meta,
        ]
    } else {
        [
            metas_without_validator[0].clone(),
            metas_without_validator[1].clone(),
            metas_without_validator[2].clone(),
            metas_without_validator[3].clone(),
            metas_without_validator[4].clone(),
            metas_without_validator[5].clone(),
            metas_without_validator[6].clone(),
            metas_without_validator[7].clone(),
            metas_without_validator[8].clone(),
            metas_without_validator[9].clone(),
            AccountMeta::readonly(delegation_program.key()),
        ]
    };
    let account_count = if validator.is_some() { 11 } else { 10 };
    let ix = Instruction {
        program_id: permission_program.key(),
        accounts: &metas[..account_count],
        data: &data,
    };
    if let Some(validator_account) = validator {
        slice_invoke_signed(
            &ix,
            &[
                payer,
                payer,
                private_session,
                permission,
                system_program,
                permission_program,
                permission_delegation_buffer,
                permission_delegation_record,
                permission_delegation_metadata,
                delegation_program,
                validator_account,
            ],
            &[],
        )
    } else {
        slice_invoke_signed(
            &ix,
            &[
                payer,
                payer,
                private_session,
                permission,
                system_program,
                permission_program,
                permission_delegation_buffer,
                permission_delegation_record,
                permission_delegation_metadata,
                delegation_program,
            ],
            &[],
        )
    }
}

fn invoke_commit_private_intent_permission(
    payer: &AccountInfo,
    private_session: &AccountInfo,
    permission: &AccountInfo,
    permission_program: &AccountInfo,
    magic_program: &AccountInfo,
    magic_context: &AccountInfo,
    undelegate: bool,
) -> ProgramResult {
    let data = if undelegate {
        PERMISSION_COMMIT_AND_UNDELEGATE_DISCRIMINATOR.to_le_bytes()
    } else {
        PERMISSION_COMMIT_DISCRIMINATOR.to_le_bytes()
    };
    let metas = [
        AccountMeta::writable_signer(payer.key()),
        AccountMeta::writable(private_session.key()),
        AccountMeta::writable(permission.key()),
        AccountMeta::readonly(magic_program.key()),
        AccountMeta::writable(magic_context.key()),
    ];
    let ix = Instruction {
        program_id: permission_program.key(),
        accounts: &metas,
        data: &data,
    };
    slice_invoke_signed(
        &ix,
        &[payer, private_session, permission, magic_program, magic_context],
        &[],
    )
}

fn validate_private_intent_permission_accounts(
    private_session: &AccountInfo,
    permission: &AccountInfo,
    permission_program: &AccountInfo,
    permission_delegation_buffer: &AccountInfo,
    permission_delegation_record: &AccountInfo,
    permission_delegation_metadata: &AccountInfo,
) -> ProgramResult {
    validate_private_intent_permission_account(private_session, permission, permission_program)?;
    validate_magicblock_delegation_pdas_for(
        permission,
        permission_program.key(),
        permission_delegation_buffer,
        permission_delegation_record,
        permission_delegation_metadata,
    )
}

fn validate_private_intent_permission_account(
    private_session: &AccountInfo,
    permission: &AccountInfo,
    permission_program: &AccountInfo,
) -> ProgramResult {
    if permission_program.key() != &PERMISSION_PROGRAM_ID || !permission.is_writable() {
        return Err(KilnError::InvalidMagicBlockAccount.into());
    }
    let (expected_permission, _) = find_program_address(
        &[PERMISSION_SEED, private_session.key().as_ref()],
        &PERMISSION_PROGRAM_ID,
    );
    if permission.key() != &expected_permission {
        return Err(KilnError::InvalidMagicBlockAccount.into());
    }
    Ok(())
}

fn validate_magicblock_delegation_pdas(
    private_session: &AccountInfo,
    owner_program: &AccountInfo,
    delegation_buffer: &AccountInfo,
    delegation_record: &AccountInfo,
    delegation_metadata: &AccountInfo,
) -> ProgramResult {
    validate_magicblock_delegation_pdas_for(
        private_session,
        owner_program.key(),
        delegation_buffer,
        delegation_record,
        delegation_metadata,
    )
}

fn validate_magicblock_delegation_pdas_for(
    delegated_account: &AccountInfo,
    owner_program: &Pubkey,
    delegation_buffer: &AccountInfo,
    delegation_record: &AccountInfo,
    delegation_metadata: &AccountInfo,
) -> ProgramResult {
    let (expected_buffer, _) = find_program_address(
        &[DELEGATION_BUFFER_SEED, delegated_account.key().as_ref()],
        owner_program,
    );
    let (expected_record, _) = find_program_address(
        &[DELEGATION_RECORD_SEED, delegated_account.key().as_ref()],
        &DELEGATION_PROGRAM_ID,
    );
    let (expected_metadata, _) = find_program_address(
        &[DELEGATION_METADATA_SEED, delegated_account.key().as_ref()],
        &DELEGATION_PROGRAM_ID,
    );
    if delegation_buffer.key() != &expected_buffer
        || delegation_record.key() != &expected_record
        || delegation_metadata.key() != &expected_metadata
    {
        return Err(KilnError::InvalidMagicBlockAccount.into());
    }
    Ok(())
}

fn write_seed(buffer: &mut [u8], offset: usize, seed: &[u8]) -> Result<usize, ProgramError> {
    if seed.len() > 32 || buffer.len() < offset + 4 + seed.len() {
        return Err(ProgramError::InvalidInstructionData);
    }
    buffer[offset..offset + 4].copy_from_slice(&(seed.len() as u32).to_le_bytes());
    let next = offset + 4;
    buffer[next..next + seed.len()].copy_from_slice(seed);
    Ok(next + seed.len())
}

struct ParsedPrivateSessionCallbackSeeds<'a> {
    vault_config: &'a [u8],
    session_id: &'a [u8],
}

fn parse_private_session_callback_seeds(
    mut data: &[u8],
) -> Result<ParsedPrivateSessionCallbackSeeds<'_>, ProgramError> {
    let seed_count = read_u32(&mut data)? as usize;
    if seed_count != 3 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let seed_prefix = read_seed(&mut data)?;
    let vault_config = read_seed(&mut data)?;
    let session_id = read_seed(&mut data)?;
    if !data.is_empty()
        || seed_prefix != PRIVATE_INTENT_SESSION_SEED
        || vault_config.len() != 32
        || session_id.len() != 32
    {
        return Err(ProgramError::InvalidInstructionData);
    }
    Ok(ParsedPrivateSessionCallbackSeeds {
        vault_config,
        session_id,
    })
}

fn read_u32(data: &mut &[u8]) -> Result<u32, ProgramError> {
    if data.len() < 4 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let value = u32::from_le_bytes(
        data[..4]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    *data = &data[4..];
    Ok(value)
}

fn read_seed<'a>(data: &mut &'a [u8]) -> Result<&'a [u8], ProgramError> {
    let len = read_u32(data)? as usize;
    if data.len() < len || len > 32 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let seed = &data[..len];
    *data = &data[len..];
    Ok(seed)
}

fn is_valid_guard_decision(value: u8) -> bool {
    matches!(
        value,
        PRIVATE_INTENT_GUARD_PENDING | PRIVATE_INTENT_GUARD_APPROVED | PRIVATE_INTENT_GUARD_REJECTED
    )
}

fn is_valid_settlement_result(value: u8) -> bool {
    matches!(
        value,
        PRIVATE_INTENT_SETTLEMENT_PENDING
            | PRIVATE_INTENT_SETTLEMENT_SUCCESS
            | PRIVATE_INTENT_SETTLEMENT_LOSS
            | PRIVATE_INTENT_SETTLEMENT_FAILED
    )
}

fn is_zero_32(value: &[u8; 32]) -> bool {
    value.iter().all(|byte| *byte == 0)
}
