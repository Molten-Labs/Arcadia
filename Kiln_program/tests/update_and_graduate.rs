use std::{path::PathBuf, sync::Mutex};

use litesvm::{types::TransactionResult, LiteSVM};
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_native_token::LAMPORTS_PER_SOL;
use solana_pubkey::Pubkey;
use solana_sdk_ids::{sysvar, system_program};
use solana_signer::Signer;
use solana_transaction::Transaction;
use wincode::serialize;

use Kiln_program::{
    instructions::{CreateVaultArgs, DepositJuniorArgs},
    states::{
        ManagerProfile, VaultConfig, VaultState, MANAGER_PROFILE_SEED, TREASURY_SEED,
        VAULT_CONFIG_SEED, VAULT_STATE_SEED,
    },
};

static CU_RESULTS: Mutex<Vec<(&str, u64)>> = Mutex::new(Vec::new());

fn program_id() -> Pubkey {
    Pubkey::new_from_array(Kiln_program::ID)
}

fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    let payer = Keypair::new();

    svm.airdrop(&payer.pubkey(), 50 * LAMPORTS_PER_SOL)
        .expect("airdrop failed");

    let so_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target/deploy/Kiln_program.so");
    let program_data = std::fs::read(&so_path)
        .unwrap_or_else(|_| panic!("missing {:?}; run cargo build-sbf in Kiln_program", so_path));
    svm.add_program(program_id(), &program_data)
        .expect("add_program failed");

    (svm, payer)
}

fn send_tx(
    svm: &mut LiteSVM,
    payer: &Keypair,
    signers: &[&Keypair],
    ix: Instruction,
    label: &'static str,
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
    if let Ok(meta) = &result {
        CU_RESULTS
            .lock()
            .expect("lock")
            .push((label, meta.compute_units_consumed));
    }
    svm.expire_blockhash();
    result
}

fn manager_profile_pda(manager: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[MANAGER_PROFILE_SEED, &manager.to_bytes()], &program_id())
}

fn vault_config_pda(manager: &Pubkey, vault_index: u16) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[VAULT_CONFIG_SEED, &manager.to_bytes(), &vault_index.to_le_bytes()],
        &program_id(),
    )
}

fn vault_state_pda(vault_config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[VAULT_STATE_SEED, &vault_config.to_bytes()], &program_id())
}

fn treasury_pda(vault_config: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[TREASURY_SEED, &vault_config.to_bytes()], &program_id())
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
    data.extend_from_slice(&serialize(&args).expect("serialize create vault"));

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
    data.extend_from_slice(
        &serialize(&DepositJuniorArgs { amount_lamports }).expect("serialize deposit"),
    );

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

fn update_nav_ix(caller: &Keypair, manager: &Keypair, vault_index: u16) -> Instruction {
    // According to update_nav.rs the accounts expected are:
    // 0: updater (caller)
    // 1: vault_config
    // 2: vault_state (writable)
    // 3: treasury (writable)
    // 4: clock
    let (_mgr_profile, _) = manager_profile_pda(&manager.pubkey());
    let (vault_config, _) = vault_config_pda(&manager.pubkey(), vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let (treasury, _) = treasury_pda(&vault_config);

    let mut data = vec![3u8, 0u8]; // discriminator 3 + reserved byte for UpdateNavArgs

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(caller.pubkey(), true),
            AccountMeta::new_readonly(vault_config, false),
            AccountMeta::new(vault_state, false),
            AccountMeta::new(treasury, false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
        ],
        data,
    }
}

fn graduate_vault_ix(caller: &Keypair, manager: &Keypair, vault_index: u16) -> Instruction {
    // graduate_vault expects:
    // 0: caller (signer)
    // 1: vault_state (writable)
    // 2: vault_config
    // 3: treasury
    // 4: manager_profile (writable)
    // 5: clock
    let (manager_profile, _) = manager_profile_pda(&manager.pubkey());
    let (vault_config, _) = vault_config_pda(&manager.pubkey(), vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let (treasury, _) = treasury_pda(&vault_config);

    let mut data = vec![4u8]; // discriminator 4

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(caller.pubkey(), true),
            AccountMeta::new(vault_state, false),
            AccountMeta::new_readonly(vault_config, false),
            AccountMeta::new_readonly(treasury, false),
            AccountMeta::new(manager_profile, false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
        ],
        data,
    }
}

#[test]
fn update_nav_sets_hwm_and_updates_nav() {
    let (mut svm, manager) = setup();
    // init manager
    send_tx(&mut svm, &manager, &[], init_manager_ix(&manager), "init_manager")
        .expect("init manager");

    // create vault with very short paper window so tests can progress quickly
    let create_args = CreateVaultArgs {
        paper_window_secs: 1,
        min_qualifying_trades: 1,
        max_slippage_bps: 50,
        manager_fee_bps: 200,
        _reserved: [0; 2],
        name: {
            let mut name = [0_u8; 32];
            name[..8].copy_from_slice(b"UpdateNav");
            name
        },
    };
    send_tx(
        &mut svm,
        &manager,
        &[],
        create_vault_ix(&manager, 0, create_args),
        "create_vault",
    )
    .expect("create vault");

    // deposit junior
    let deposit_amount = 2 * LAMPORTS_PER_SOL;
    send_tx(
        &mut svm,
        &manager,
        &[],
        deposit_junior_ix(&manager, 0, deposit_amount),
        "deposit_junior",
    )
    .expect("deposit junior");

    // call update_nav
    let caller = Keypair::new();
    // fund caller so it can sign the tx (caller doesn't need lamports for program ops but LiteSVM signs)
    svm.airdrop(&caller.pubkey(), 1 * LAMPORTS_PER_SOL)
        .expect("airdrop caller");

    send_tx(
        &mut svm,
        &caller,
        &[],
        update_nav_ix(&caller, &manager, 0),
        "update_nav",
    )
    .expect("update_nav");

    // check state: high_water_mark should equal deposit amount and current_nav should equal deposit
    let (vault_config_key, _) = vault_config_pda(&manager.pubkey(), 0);
    let (vault_state_key, _) = vault_state_pda(&vault_config_key);
    let vault_state_acc = svm
        .get_account(&vault_state_key)
        .expect("vault state missing");
    let vault_state = bytemuck::from_bytes::<VaultState>(&vault_state_acc.data);

    assert_eq!(vault_state.current_nav, deposit_amount);
    assert_eq!(vault_state.high_water_mark, deposit_amount);
}

#[test]
fn graduate_vault_fails_before_paper_window_elapsed() {
    let (mut svm, manager) = setup();
    send_tx(&mut svm, &manager, &[], init_manager_ix(&manager), "init_manager")
        .expect("init manager");

    let create_args = CreateVaultArgs {
        paper_window_secs: 86_400, // 1 day -> intentionally large so graduation will fail
        min_qualifying_trades: 1,
        max_slippage_bps: 50,
        manager_fee_bps: 200,
        _reserved: [0; 2],
        name: {
            let mut name = [0_u8; 32];
            name[..9].copy_from_slice(b"Graduate0");
            name
        },
    };
    send_tx(
        &mut svm,
        &manager,
        &[],
        create_vault_ix(&manager, 0, create_args),
        "create_vault",
    )
    .expect("create vault");

    // deposit junior (needed to meet junior > 0 requirement)
    let deposit_amount = 1 * LAMPORTS_PER_SOL;
    send_tx(
        &mut svm,
        &manager,
        &[],
        deposit_junior_ix(&manager, 0, deposit_amount),
        "deposit_junior",
    )
    .expect("deposit junior");

    // attempt to graduate immediately (should fail)
    let caller = Keypair::new();
    svm.airdrop(&caller.pubkey(), 1 * LAMPORTS_PER_SOL)
        .expect("airdrop caller");

    let res = send_tx(
        &mut svm,
        &caller,
        &[],
        graduate_vault_ix(&caller, &manager, 0),
        "graduate_vault",
    );

    assert!(res.is_err(), "graduation should fail if paper window not elapsed");
}

#[test]
fn zz_cu_summary_update_and_graduate() {
    for (label, units) in CU_RESULTS.lock().expect("lock").iter() {
        println!("{label}: {units} CUs");
    }
}
