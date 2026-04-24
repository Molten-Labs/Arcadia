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

#[test]
fn manager_can_create_and_fund_vault() {
    let (mut svm, manager) = setup();
    send_tx(&mut svm, &manager, &[], init_manager_ix(&manager), "init_manager")
        .expect("init manager");

    let create_args = CreateVaultArgs {
        paper_window_secs: 86_400,
        min_qualifying_trades: 10,
        max_slippage_bps: 50,
        manager_fee_bps: 2_000,
        _reserved: [0; 2],
        name: {
            let mut name = [0_u8; 32];
            name[..10].copy_from_slice(b"Kiln Core");
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

    let deposit_amount = 5 * LAMPORTS_PER_SOL;
    send_tx(
        &mut svm,
        &manager,
        &[],
        deposit_junior_ix(&manager, 0, deposit_amount),
        "deposit_junior",
    )
    .expect("deposit junior");

    let (manager_profile_key, _) = manager_profile_pda(&manager.pubkey());
    let (vault_config_key, _) = vault_config_pda(&manager.pubkey(), 0);
    let (vault_state_key, _) = vault_state_pda(&vault_config_key);
    let (treasury_key, _) = treasury_pda(&vault_config_key);

    let manager_profile_acc = svm
        .get_account(&manager_profile_key)
        .expect("manager profile missing");
    let manager_profile = bytemuck::from_bytes::<ManagerProfile>(&manager_profile_acc.data);
    assert_eq!(manager_profile.owner, manager.pubkey().to_bytes());
    assert_eq!(manager_profile.total_vaults, 1);
    assert_eq!(manager_profile.total_junior_deposited, deposit_amount);

    let vault_config_acc = svm
        .get_account(&vault_config_key)
        .expect("vault config missing");
    let vault_config = bytemuck::from_bytes::<VaultConfig>(&vault_config_acc.data);
    assert_eq!(vault_config.manager, manager.pubkey().to_bytes());
    assert_eq!(vault_config.treasury, treasury_key.to_bytes());

    let vault_state_acc = svm
        .get_account(&vault_state_key)
        .expect("vault state missing");
    let vault_state = bytemuck::from_bytes::<VaultState>(&vault_state_acc.data);
    assert_eq!(vault_state.junior_capital, deposit_amount);
    assert_eq!(vault_state.junior_shares_outstanding, deposit_amount);
    assert_eq!(vault_state.current_nav, deposit_amount);
    assert_eq!(vault_state.original_junior_deposit, deposit_amount);
    assert_eq!(vault_state.is_paper_mode, 1);

    let treasury_acc = svm.get_account(&treasury_key).expect("treasury missing");
    assert_eq!(
        treasury_acc.lamports - vault_config.treasury_rent_lamports,
        deposit_amount
    );
}

#[test]
fn non_manager_cannot_fund_someone_elses_vault() {
    let (mut svm, manager) = setup();
    let intruder = Keypair::new();
    svm.airdrop(&intruder.pubkey(), 10 * LAMPORTS_PER_SOL)
        .expect("intruder airdrop");

    send_tx(&mut svm, &manager, &[], init_manager_ix(&manager), "init_manager")
        .expect("init manager");
    send_tx(
        &mut svm,
        &manager,
        &[],
        create_vault_ix(
            &manager,
            0,
            CreateVaultArgs {
                paper_window_secs: 86_400,
                min_qualifying_trades: 10,
                max_slippage_bps: 50,
                manager_fee_bps: 2_000,
                _reserved: [0; 2],
                name: [0; 32],
            },
        ),
        "create_vault",
    )
    .expect("create vault");

    let result = send_tx(
        &mut svm,
        &intruder,
        &[],
        deposit_junior_ix(&intruder, 0, LAMPORTS_PER_SOL),
        "deposit_junior_wrong_manager",
    );
    assert!(result.is_err(), "deposit should fail for wrong manager");
}

#[test]
fn zz_cu_summary() {
    for (label, units) in CU_RESULTS.lock().expect("lock").iter() {
        println!("{label}: {units} CUs");
    }
}
