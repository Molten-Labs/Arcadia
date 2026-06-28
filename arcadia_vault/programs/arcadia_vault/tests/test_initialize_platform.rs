use {
    anchor_lang::{
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_account::Account,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_native_token::LAMPORTS_PER_SOL,
    solana_program_option::COption,
    solana_program_pack::Pack,
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    spl_token_interface::{
        state::{Account as TokenAccount, AccountState, Mint},
        ID as TOKEN_PROGRAM_ID,
    },
    std::sync::Mutex,
};

static CU_RESULTS: Mutex<Vec<(&'static str, u64)>> = Mutex::new(Vec::new());

struct Fixture {
    svm: LiteSVM,
    admin: Keypair,
    oracle_authority: anchor_lang::prelude::Pubkey,
    config: anchor_lang::prelude::Pubkey,
    config_bump: u8,
    base_mint: anchor_lang::prelude::Pubkey,
    wrong_mint: anchor_lang::prelude::Pubkey,
    treasury_token: anchor_lang::prelude::Pubkey,
    wrong_treasury_token: anchor_lang::prelude::Pubkey,
}

fn setup() -> Fixture {
    let program_id = arcadia_vault::id();
    let admin = Keypair::new();
    let oracle_authority = Keypair::new().pubkey();
    let treasury_owner = Keypair::new().pubkey();
    let base_mint = anchor_lang::prelude::Pubkey::new_unique();
    let wrong_mint = anchor_lang::prelude::Pubkey::new_unique();
    let treasury_token = anchor_lang::prelude::Pubkey::new_unique();
    let wrong_treasury_token = anchor_lang::prelude::Pubkey::new_unique();
    let (config, config_bump) = anchor_lang::prelude::Pubkey::find_program_address(
        &[arcadia_vault::PLATFORM_SEED],
        &program_id,
    );

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/arcadia_vault.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&admin.pubkey(), LAMPORTS_PER_SOL).unwrap();

    set_mint_account(&mut svm, base_mint, arcadia_vault::USDC_DECIMALS);
    set_mint_account(&mut svm, wrong_mint, arcadia_vault::USDC_DECIMALS);
    set_token_account(&mut svm, treasury_token, base_mint, treasury_owner, 0);
    set_token_account(
        &mut svm,
        wrong_treasury_token,
        wrong_mint,
        treasury_owner,
        0,
    );

    Fixture {
        svm,
        admin,
        oracle_authority,
        config,
        config_bump,
        base_mint,
        wrong_mint,
        treasury_token,
        wrong_treasury_token,
    }
}

fn set_mint_account(svm: &mut LiteSVM, address: anchor_lang::prelude::Pubkey, decimals: u8) {
    let mint = Mint {
        mint_authority: COption::None,
        supply: 0,
        decimals,
        is_initialized: true,
        freeze_authority: COption::None,
    };
    let mut data = [0u8; Mint::LEN];
    Mint::pack(mint, &mut data).unwrap();

    svm.set_account(
        address,
        Account {
            lamports: LAMPORTS_PER_SOL,
            data: data.to_vec(),
            owner: TOKEN_PROGRAM_ID,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

fn set_token_account(
    svm: &mut LiteSVM,
    address: anchor_lang::prelude::Pubkey,
    mint: anchor_lang::prelude::Pubkey,
    owner: anchor_lang::prelude::Pubkey,
    amount: u64,
) {
    let token_account = TokenAccount {
        mint,
        owner,
        amount,
        delegate: COption::None,
        state: AccountState::Initialized,
        is_native: COption::None,
        delegated_amount: 0,
        close_authority: COption::None,
    };
    let mut data = [0u8; TokenAccount::LEN];
    TokenAccount::pack(token_account, &mut data).unwrap();

    svm.set_account(
        address,
        Account {
            lamports: LAMPORTS_PER_SOL,
            data: data.to_vec(),
            owner: TOKEN_PROGRAM_ID,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

fn initialize_platform_ix(
    admin: anchor_lang::prelude::Pubkey,
    config: anchor_lang::prelude::Pubkey,
    base_mint: anchor_lang::prelude::Pubkey,
    treasury_token: anchor_lang::prelude::Pubkey,
    oracle_authority: anchor_lang::prelude::Pubkey,
    perf_fee_bps: u16,
    mgmt_fee_bps: u16,
) -> Instruction {
    Instruction::new_with_bytes(
        arcadia_vault::id(),
        &arcadia_vault::instruction::InitializePlatform {
            perf_fee_bps,
            mgmt_fee_bps,
            oracle_authority,
        }
        .data(),
        arcadia_vault::accounts::InitializePlatform {
            admin,
            config,
            base_mint,
            treasury_token,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn send_tx(
    svm: &mut LiteSVM,
    instructions: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
) -> u64 {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(instructions, Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    let result = svm
        .send_transaction(tx)
        .expect("transaction should succeed");
    svm.expire_blockhash();
    result.compute_units_consumed
}

fn tx_fails(
    svm: &mut LiteSVM,
    instructions: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
) -> bool {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(instructions, Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    let result = svm.send_transaction(tx);
    svm.expire_blockhash();
    result.is_err()
}

fn read_config(
    svm: &LiteSVM,
    config: &anchor_lang::prelude::Pubkey,
) -> arcadia_vault::PlatformConfig {
    let account = svm.get_account(config).expect("config account exists");
    assert_eq!(account.owner.to_bytes(), arcadia_vault::id().to_bytes());

    let mut data: &[u8] = account.data.as_ref();
    arcadia_vault::PlatformConfig::try_deserialize(&mut data).unwrap()
}

fn record_cu(label: &'static str, cu: u64) {
    CU_RESULTS.lock().unwrap().push((label, cu));
}

#[test]
fn initialize_platform_happy_path() {
    let mut fixture = setup();
    let ix = initialize_platform_ix(
        fixture.admin.pubkey(),
        fixture.config,
        fixture.base_mint,
        fixture.treasury_token,
        fixture.oracle_authority,
        arcadia_vault::PLATFORM_PERF_FEE_BPS,
        arcadia_vault::PLATFORM_MGMT_FEE_BPS,
    );

    let cu = send_tx(&mut fixture.svm, &[ix], &fixture.admin, &[&fixture.admin]);
    record_cu("initialize_platform", cu);

    let config = read_config(&fixture.svm, &fixture.config);
    assert_eq!(config.admin, fixture.admin.pubkey());
    assert_eq!(config.oracle_authority, fixture.oracle_authority);
    assert_eq!(config.treasury_token, fixture.treasury_token);
    assert_eq!(config.base_mint, fixture.base_mint);
    assert_eq!(config.perf_fee_bps, arcadia_vault::PLATFORM_PERF_FEE_BPS);
    assert_eq!(config.mgmt_fee_bps, arcadia_vault::PLATFORM_MGMT_FEE_BPS);
    assert_eq!(config.bump, fixture.config_bump);
}

#[test]
fn initialize_platform_reinit_fails() {
    let mut fixture = setup();
    let ix = initialize_platform_ix(
        fixture.admin.pubkey(),
        fixture.config,
        fixture.base_mint,
        fixture.treasury_token,
        fixture.oracle_authority,
        arcadia_vault::PLATFORM_PERF_FEE_BPS,
        arcadia_vault::PLATFORM_MGMT_FEE_BPS,
    );

    send_tx(
        &mut fixture.svm,
        &[ix.clone()],
        &fixture.admin,
        &[&fixture.admin],
    );

    assert!(tx_fails(
        &mut fixture.svm,
        &[ix],
        &fixture.admin,
        &[&fixture.admin],
    ));
}

#[test]
fn initialize_platform_rejects_unsafe_fee_configs() {
    for (perf_fee_bps, mgmt_fee_bps) in [
        (
            arcadia_vault::BPS_DENOMINATOR + 1,
            arcadia_vault::PLATFORM_MGMT_FEE_BPS,
        ),
        (
            arcadia_vault::PLATFORM_PERF_FEE_BPS,
            arcadia_vault::BPS_DENOMINATOR + 1,
        ),
        (
            arcadia_vault::BPS_DENOMINATOR - arcadia_vault::MAX_TIER_BPS + 1,
            0,
        ),
    ] {
        let mut fixture = setup();
        let ix = initialize_platform_ix(
            fixture.admin.pubkey(),
            fixture.config,
            fixture.base_mint,
            fixture.treasury_token,
            fixture.oracle_authority,
            perf_fee_bps,
            mgmt_fee_bps,
        );

        assert!(tx_fails(
            &mut fixture.svm,
            &[ix],
            &fixture.admin,
            &[&fixture.admin],
        ));
        assert!(fixture.svm.get_account(&fixture.config).is_none());
    }
}

#[test]
fn initialize_platform_rejects_wrong_config_pda() {
    let mut fixture = setup();
    let wrong_config = anchor_lang::prelude::Pubkey::new_unique();
    let ix = initialize_platform_ix(
        fixture.admin.pubkey(),
        wrong_config,
        fixture.base_mint,
        fixture.treasury_token,
        fixture.oracle_authority,
        arcadia_vault::PLATFORM_PERF_FEE_BPS,
        arcadia_vault::PLATFORM_MGMT_FEE_BPS,
    );

    assert!(tx_fails(
        &mut fixture.svm,
        &[ix],
        &fixture.admin,
        &[&fixture.admin],
    ));
    assert!(fixture.svm.get_account(&wrong_config).is_none());
}

#[test]
fn initialize_platform_rejects_treasury_mint_mismatch() {
    let mut fixture = setup();
    let ix = initialize_platform_ix(
        fixture.admin.pubkey(),
        fixture.config,
        fixture.base_mint,
        fixture.wrong_treasury_token,
        fixture.oracle_authority,
        arcadia_vault::PLATFORM_PERF_FEE_BPS,
        arcadia_vault::PLATFORM_MGMT_FEE_BPS,
    );

    assert_ne!(fixture.base_mint, fixture.wrong_mint);
    assert!(tx_fails(
        &mut fixture.svm,
        &[ix],
        &fixture.admin,
        &[&fixture.admin],
    ));
    assert!(fixture.svm.get_account(&fixture.config).is_none());
}

#[test]
fn zz_cu_summary() {
    let results = CU_RESULTS.lock().unwrap();
    if results.is_empty() {
        println!("No CU results recorded; run tests with --test-threads=1 for a stable summary.");
        return;
    }

    println!("\n=== Compute Unit Summary ===");
    for (label, cu) in results.iter() {
        println!("  {label:<24} {cu:>8} CUs");
    }
}
