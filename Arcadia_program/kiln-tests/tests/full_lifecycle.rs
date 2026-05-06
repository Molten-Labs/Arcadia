use std::{env, fs, path::PathBuf};

use litesvm::{types::TransactionResult, LiteSVM};
use solana_clock::Clock;
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_native_token::LAMPORTS_PER_SOL;
use solana_pubkey::Pubkey;
use solana_sdk_ids::{system_program, sysvar};
use solana_signer::Signer;
use solana_transaction::Transaction;

use Kiln_program::{
    instructions::{
        CreateVaultArgs, DepositJuniorArgs, DepositSeniorArgs, ExecuteSwapArgs, WithdrawJuniorArgs,
        WithdrawSeniorArgs,
    },
    states::{
        InvestorPosition, VaultState, INVESTOR_POSITION_SEED, MANAGER_PROFILE_SEED, TREASURY_SEED,
        VAULT_CONFIG_SEED, VAULT_STATE_SEED,
    },
};

mod common;

fn to_bytes<T: Copy>(val: &T) -> Vec<u8> {
    let ptr = val as *const T as *const u8;
    let len = core::mem::size_of::<T>();
    unsafe { core::slice::from_raw_parts(ptr, len) }.to_vec()
}

fn program_id() -> Pubkey {
    Pubkey::new_from_array(Kiln_program::ID)
}

fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    let payer = Keypair::new();

    svm.airdrop(&payer.pubkey(), 50 * LAMPORTS_PER_SOL)
        .expect("airdrop failed");

    let so_path = sbf_path();
    common::assert_sbf_is_fresh(&so_path);
    let program_data = fs::read(&so_path).unwrap_or_else(|_| {
        panic!(
            "missing {:?}; run cargo build-sbf in Arcadia_program/program",
            so_path
        )
    });
    svm.add_program(program_id(), &program_data)
        .expect("add_program failed");

    (svm, payer)
}

fn sbf_path() -> PathBuf {
    env::var_os("KILN_SBF_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            // CARGO_MANIFEST_DIR = Arcadia_program/kiln-tests/
            // workspace target  = Arcadia_program/target/
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../target/deploy/Kiln_program.so")
        })
}

fn set_unix_time(svm: &mut LiteSVM, unix_timestamp: i64) {
    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp = unix_timestamp;
    svm.set_sysvar(&clock);
}

fn send_tx(
    svm: &mut LiteSVM,
    payer: &Keypair,
    signers: &[&Keypair],
    ix: Instruction,
) -> TransactionResult {
    let mut all_signers = vec![payer];
    all_signers.extend(signers.iter().copied());

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer.pubkey()),
        &all_signers,
        svm.latest_blockhash(),
    );

    let result = svm.send_transaction(tx);
    svm.expire_blockhash();
    result
}

fn manager_profile_pda(manager: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[MANAGER_PROFILE_SEED, &manager.to_bytes()], &program_id())
}

fn vault_config_pda(manager: &Pubkey, vault_index: u16) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            VAULT_CONFIG_SEED,
            &manager.to_bytes(),
            &vault_index.to_le_bytes(),
        ],
        &program_id(),
    )
}

fn vault_state_pda(vault_config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[VAULT_STATE_SEED, &vault_config.to_bytes()], &program_id())
}

fn treasury_pda(vault_config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[TREASURY_SEED, &vault_config.to_bytes()], &program_id())
}

fn investor_position_pda(investor: &Pubkey, vault_config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            INVESTOR_POSITION_SEED,
            &investor.to_bytes(),
            &vault_config.to_bytes(),
        ],
        &program_id(),
    )
}

fn init_manager_ix(manager: &Keypair) -> Instruction {
    let (manager_profile, _) = manager_profile_pda(&manager.pubkey());
    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(manager_profile, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data: vec![0],
    }
}

fn create_vault_ix(manager: &Keypair, vault_index: u16, args: CreateVaultArgs) -> Instruction {
    let (manager_profile, _) = manager_profile_pda(&manager.pubkey());
    let (vault_config, _) = vault_config_pda(&manager.pubkey(), vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let (treasury, _) = treasury_pda(&vault_config);

    let mut data = vec![1];
    data.extend_from_slice(&to_bytes(&args));

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(manager_profile, false),
            AccountMeta::new(vault_config, false),
            AccountMeta::new(vault_state, false),
            AccountMeta::new(treasury, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    }
}

fn deposit_junior_ix(manager: &Keypair, vault_index: u16, amount_lamports: u64) -> Instruction {
    let (manager_profile, _) = manager_profile_pda(&manager.pubkey());
    let (vault_config, _) = vault_config_pda(&manager.pubkey(), vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let (treasury, _) = treasury_pda(&vault_config);

    let mut data = vec![2];
    data.extend_from_slice(&to_bytes(&DepositJuniorArgs { amount_lamports }));

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(manager_profile, false),
            AccountMeta::new_readonly(vault_config, false),
            AccountMeta::new(vault_state, false),
            AccountMeta::new(treasury, false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    }
}

fn execute_swap_ix(
    manager: &Keypair,
    vault_index: u16,
    in_amount: u64,
    minimum_amount_out: u64,
) -> Instruction {
    let (manager_profile, _) = manager_profile_pda(&manager.pubkey());
    let (vault_config, _) = vault_config_pda(&manager.pubkey(), vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let (treasury, _) = treasury_pda(&vault_config);

    let mut data = vec![9];
    data.extend_from_slice(&to_bytes(&ExecuteSwapArgs {
        in_amount,
        minimum_amount_out,
    }));

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new_readonly(manager.pubkey(), true),
            AccountMeta::new_readonly(manager_profile, false),
            AccountMeta::new_readonly(vault_config, false),
            AccountMeta::new(vault_state, false),
            AccountMeta::new(treasury, false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
        ],
        data,
    }
}

fn graduate_vault_ix(caller: &Keypair, manager: &Keypair, vault_index: u16) -> Instruction {
    let (manager_profile, _) = manager_profile_pda(&manager.pubkey());
    graduate_vault_with_profile_ix(caller, manager, vault_index, manager_profile)
}

fn graduate_vault_with_profile_ix(
    caller: &Keypair,
    manager: &Keypair,
    vault_index: u16,
    manager_profile: Pubkey,
) -> Instruction {
    let (vault_config, _) = vault_config_pda(&manager.pubkey(), vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let (treasury, _) = treasury_pda(&vault_config);

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new_readonly(caller.pubkey(), true),
            AccountMeta::new(vault_state, false),
            AccountMeta::new_readonly(vault_config, false),
            AccountMeta::new_readonly(treasury, false),
            AccountMeta::new(manager_profile, false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
        ],
        data: vec![4],
    }
}

fn deposit_senior_ix(
    investor: &Keypair,
    manager: &Keypair,
    vault_index: u16,
    amount: u64,
) -> Instruction {
    let (vault_config, _) = vault_config_pda(&manager.pubkey(), vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let (treasury, _) = treasury_pda(&vault_config);
    let (investor_position, _) = investor_position_pda(&investor.pubkey(), &vault_config);

    let mut data = vec![5];
    data.extend_from_slice(&to_bytes(&DepositSeniorArgs {
        amount_lamports: amount,
    }));

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(investor.pubkey(), true),
            AccountMeta::new_readonly(vault_config, false),
            AccountMeta::new(vault_state, false),
            AccountMeta::new(treasury, false),
            AccountMeta::new(investor_position, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    }
}

fn withdraw_senior_ix(
    investor: &Keypair,
    manager: &Keypair,
    vault_index: u16,
    amount: u64,
) -> Instruction {
    let (vault_config, _) = vault_config_pda(&manager.pubkey(), vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let (treasury, _) = treasury_pda(&vault_config);
    let (investor_position, _) = investor_position_pda(&investor.pubkey(), &vault_config);

    let mut data = vec![6];
    data.extend_from_slice(&to_bytes(&WithdrawSeniorArgs {
        amount_usdc: amount,
    }));

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(investor.pubkey(), true),
            AccountMeta::new_readonly(vault_config, false),
            AccountMeta::new(vault_state, false),
            AccountMeta::new(treasury, false),
            AccountMeta::new(investor_position, false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
        ],
        data,
    }
}

fn withdraw_junior_ix(manager: &Keypair, vault_index: u16, amount: u64) -> Instruction {
    let (profile, _) = manager_profile_pda(&manager.pubkey());
    let (config, _) = vault_config_pda(&manager.pubkey(), vault_index);
    let (state, _) = vault_state_pda(&config);
    let (treasury, _) = treasury_pda(&config);
    let mut data = vec![7];
    data.extend_from_slice(&to_bytes(&WithdrawJuniorArgs {
        amount_usdc: amount,
    }));
    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(profile, false),
            AccountMeta::new_readonly(config, false),
            AccountMeta::new(state, false),
            AccountMeta::new(treasury, false),
            AccountMeta::new_readonly(sysvar::clock::ID, false),
        ],
        data,
    }
}

fn claim_fees_ix(manager: &Keypair, vault_index: u16) -> Instruction {
    let (manager_profile, _) = manager_profile_pda(&manager.pubkey());
    let (vault_config, _) = vault_config_pda(&manager.pubkey(), vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let (treasury, _) = treasury_pda(&vault_config);

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new_readonly(manager_profile, false),
            AccountMeta::new_readonly(vault_config, false),
            AccountMeta::new(vault_state, false),
            AccountMeta::new(treasury, false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
        ],
        data: vec![8],
    }
}

fn vault_state_for(svm: &LiteSVM, manager: &Pubkey, vault_index: u16) -> VaultState {
    let (vault_config, _) = vault_config_pda(manager, vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let account = svm.get_account(&vault_state).expect("vault state missing");
    *bytemuck::from_bytes::<VaultState>(&account.data)
}

fn investor_position_for(
    svm: &LiteSVM,
    investor: &Pubkey,
    vault_config: &Pubkey,
) -> InvestorPosition {
    let (position, _) = investor_position_pda(investor, vault_config);
    let account = svm
        .get_account(&position)
        .expect("investor position missing");
    *bytemuck::from_bytes::<InvestorPosition>(&account.data)
}

fn force_paper_success_state(svm: &mut LiteSVM, manager: &Pubkey, vault_index: u16, nav: u64) {
    let (vault_config, _) = vault_config_pda(manager, vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let (treasury, _) = treasury_pda(&vault_config);
    let mut account = svm.get_account(&vault_state).expect("vault state missing");
    let state = bytemuck::from_bytes_mut::<VaultState>(&mut account.data);
    let old_nav = state.current_nav;
    state.paper_trade_count = state.min_qualifying_trades;
    state.current_nav = nav;
    state.last_nav = nav;
    svm.set_account(vault_state, account)
        .expect("set vault state");

    if nav > old_nav {
        let mut treasury_account = svm.get_account(&treasury).expect("treasury missing");
        treasury_account.lamports = treasury_account
            .lamports
            .checked_add(nav - old_nav)
            .expect("treasury lamport top-up");
        svm.set_account(treasury, treasury_account)
            .expect("set treasury");
    }
}

fn create_args(name: &[u8], paper_window_secs: i64, min_qualifying_trades: u16) -> CreateVaultArgs {
    let mut fixed_name = [0_u8; 32];
    fixed_name[..name.len()].copy_from_slice(name);
    CreateVaultArgs {
        paper_window_secs,
        min_qualifying_trades,
        max_slippage_bps: 50,
        manager_fee_bps: 2_000,
        _reserved: [0; 2],
        name: fixed_name,
    }
}

#[test]
fn lifecycle_reaches_full_senior_withdrawal_on_sol_path() {
    let (mut svm, manager) = setup();
    let investor = Keypair::new();
    let caller = Keypair::new();
    svm.airdrop(&investor.pubkey(), 20 * LAMPORTS_PER_SOL)
        .expect("airdrop investor");
    svm.airdrop(&caller.pubkey(), LAMPORTS_PER_SOL)
        .expect("airdrop caller");

    set_unix_time(&mut svm, 1_000);
    send_tx(&mut svm, &manager, &[], init_manager_ix(&manager)).expect("init manager");
    send_tx(
        &mut svm,
        &manager,
        &[],
        create_vault_ix(&manager, 0, create_args(b"Lifecycle", 10, 2)),
    )
    .expect("create vault");

    let junior_deposit = 10 * LAMPORTS_PER_SOL;
    send_tx(
        &mut svm,
        &manager,
        &[],
        deposit_junior_ix(&manager, 0, junior_deposit),
    )
    .expect("deposit junior");

    assert!(
        send_tx(
            &mut svm,
            &investor,
            &[],
            deposit_senior_ix(&investor, &manager, 0, 2 * LAMPORTS_PER_SOL),
        )
        .is_err(),
        "investor deposit must be blocked before graduation",
    );

    send_tx(
        &mut svm,
        &manager,
        &[],
        execute_swap_ix(&manager, 0, LAMPORTS_PER_SOL / 2, 0),
    )
    .expect("guard-only swap succeeds");
    let state = vault_state_for(&svm, &manager.pubkey(), 0);
    assert_eq!(
        state.paper_trade_count, 0,
        "no-op guard swap must not count for graduation"
    );

    assert!(
        send_tx(
            &mut svm,
            &manager,
            &[],
            execute_swap_ix(&manager, 0, LAMPORTS_PER_SOL / 2, 1),
        )
        .is_err(),
        "guard-only swap must reject non-zero minimum-out",
    );

    set_unix_time(&mut svm, 1_020);
    assert!(
        send_tx(
            &mut svm,
            &caller,
            &[],
            graduate_vault_ix(&caller, &manager, 0),
        )
        .is_err(),
        "graduation must fail without qualifying trades and positive paper PnL",
    );

    force_paper_success_state(
        &mut svm,
        &manager.pubkey(),
        0,
        junior_deposit + LAMPORTS_PER_SOL,
    );
    send_tx(
        &mut svm,
        &caller,
        &[],
        graduate_vault_ix(&caller, &manager, 0),
    )
    .expect("non-manager caller graduates eligible vault");
    let state = vault_state_for(&svm, &manager.pubkey(), 0);
    assert_eq!(state.is_paper_mode, 0);
    assert_eq!(state.is_graduated, 1);

    send_tx(&mut svm, &manager, &[], claim_fees_ix(&manager, 0)).expect("claim fees");
    let post_fee_state = vault_state_for(&svm, &manager.pubkey(), 0);
    assert_eq!(post_fee_state.high_water_mark, post_fee_state.current_nav);
    assert!(post_fee_state.junior_capital < junior_deposit);

    let senior_deposit = 2 * LAMPORTS_PER_SOL;
    send_tx(
        &mut svm,
        &investor,
        &[],
        deposit_senior_ix(&investor, &manager, 0, senior_deposit),
    )
    .expect("senior deposit after graduation");
    let (vault_config, _) = vault_config_pda(&manager.pubkey(), 0);
    let position = investor_position_for(&svm, &investor.pubkey(), &vault_config);
    assert_eq!(position.senior_shares, senior_deposit);

    assert!(
        send_tx(
            &mut svm,
            &investor,
            &[],
            withdraw_senior_ix(&investor, &manager, 0, LAMPORTS_PER_SOL),
        )
        .is_err(),
        "senior withdrawal must respect the 24h cooldown while junior buffer is healthy",
    );

    set_unix_time(&mut svm, 87_500);
    send_tx(
        &mut svm,
        &investor,
        &[],
        withdraw_senior_ix(&investor, &manager, 0, LAMPORTS_PER_SOL),
    )
    .expect("senior withdrawal succeeds after cooldown");
    let position = investor_position_for(&svm, &investor.pubkey(), &vault_config);
    assert_eq!(position.senior_shares, senior_deposit - LAMPORTS_PER_SOL);
    let state = vault_state_for(&svm, &manager.pubkey(), 0);
    assert_eq!(state.senior_capital, senior_deposit - LAMPORTS_PER_SOL);
    assert_eq!(
        state.senior_shares_outstanding,
        senior_deposit - LAMPORTS_PER_SOL
    );

    send_tx(
        &mut svm,
        &investor,
        &[],
        withdraw_senior_ix(&investor, &manager, 0, LAMPORTS_PER_SOL),
    )
    .expect("investor can fully exit remaining senior position");
    let position = investor_position_for(&svm, &investor.pubkey(), &vault_config);
    assert_eq!(position.senior_shares, 0);
    let state = vault_state_for(&svm, &manager.pubkey(), 0);
    assert_eq!(state.senior_capital, 0);
    assert_eq!(state.senior_shares_outstanding, 0);

    let junior_exit_amount = state.current_nav;
    assert!(junior_exit_amount > 0);
    send_tx(
        &mut svm,
        &manager,
        &[],
        withdraw_junior_ix(&manager, 0, junior_exit_amount),
    )
    .expect("manager can fully withdraw remaining junior capital after senior exit");
    let state = vault_state_for(&svm, &manager.pubkey(), 0);
    assert_eq!(state.junior_capital, 0);
    assert_eq!(state.junior_shares_outstanding, 0);
    assert_eq!(state.current_nav, 0);
}

#[test]
fn graduation_rejects_wrong_manager_profile_relationship() {
    let (mut svm, manager) = setup();
    let wrong_manager = Keypair::new();
    let caller = Keypair::new();
    svm.airdrop(&wrong_manager.pubkey(), 5 * LAMPORTS_PER_SOL)
        .expect("airdrop wrong manager");
    svm.airdrop(&caller.pubkey(), LAMPORTS_PER_SOL)
        .expect("airdrop caller");

    set_unix_time(&mut svm, 1_000);
    send_tx(&mut svm, &manager, &[], init_manager_ix(&manager)).expect("init manager");
    send_tx(
        &mut svm,
        &wrong_manager,
        &[],
        init_manager_ix(&wrong_manager),
    )
    .expect("init wrong manager");
    send_tx(
        &mut svm,
        &manager,
        &[],
        create_vault_ix(&manager, 0, create_args(b"WrongProfile", 10, 1)),
    )
    .expect("create vault");
    send_tx(
        &mut svm,
        &manager,
        &[],
        deposit_junior_ix(&manager, 0, LAMPORTS_PER_SOL),
    )
    .expect("deposit junior");

    set_unix_time(&mut svm, 1_020);
    force_paper_success_state(&mut svm, &manager.pubkey(), 0, 2 * LAMPORTS_PER_SOL);
    let (wrong_profile, _) = manager_profile_pda(&wrong_manager.pubkey());
    assert!(
        send_tx(
            &mut svm,
            &caller,
            &[],
            graduate_vault_with_profile_ix(&caller, &manager, 0, wrong_profile),
        )
        .is_err(),
        "graduation must bind the supplied profile to the vault config",
    );
}
