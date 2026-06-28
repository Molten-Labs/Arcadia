use {
    anchor_lang::{
        prelude::rent,
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
    trader: Keypair,
    config: anchor_lang::prelude::Pubkey,
    base_mint: anchor_lang::prelude::Pubkey,
    wrong_mint: anchor_lang::prelude::Pubkey,
}

fn setup() -> Fixture {
    let program_id = arcadia_vault::id();
    let admin = Keypair::new();
    let trader = Keypair::new();
    let oracle_authority = Keypair::new().pubkey();
    let treasury_owner = Keypair::new().pubkey();
    let base_mint = anchor_lang::prelude::Pubkey::new_unique();
    let wrong_mint = anchor_lang::prelude::Pubkey::new_unique();
    let treasury_token = anchor_lang::prelude::Pubkey::new_unique();
    let (config, _) = platform_pda();

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/arcadia_vault.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&admin.pubkey(), LAMPORTS_PER_SOL).unwrap();
    svm.airdrop(&trader.pubkey(), LAMPORTS_PER_SOL).unwrap();

    set_mint_account(&mut svm, base_mint, arcadia_vault::USDC_DECIMALS);
    set_mint_account(&mut svm, wrong_mint, arcadia_vault::USDC_DECIMALS);
    set_token_account(&mut svm, treasury_token, base_mint, treasury_owner, 0);

    let init_platform = initialize_platform_ix(
        admin.pubkey(),
        config,
        base_mint,
        treasury_token,
        oracle_authority,
        arcadia_vault::PLATFORM_PERF_FEE_BPS,
        arcadia_vault::PLATFORM_MGMT_FEE_BPS,
    );
    send_tx(&mut svm, &[init_platform], &admin, &[&admin]);

    Fixture {
        svm,
        trader,
        config,
        base_mint,
        wrong_mint,
    }
}

fn platform_pda() -> (anchor_lang::prelude::Pubkey, u8) {
    anchor_lang::prelude::Pubkey::find_program_address(
        &[arcadia_vault::PLATFORM_SEED],
        &arcadia_vault::id(),
    )
}

fn profile_pda(trader: &anchor_lang::prelude::Pubkey) -> (anchor_lang::prelude::Pubkey, u8) {
    anchor_lang::prelude::Pubkey::find_program_address(
        &[arcadia_vault::PROFILE_SEED, trader.as_ref()],
        &arcadia_vault::id(),
    )
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

fn initialize_profile_ix(
    trader: anchor_lang::prelude::Pubkey,
    config: anchor_lang::prelude::Pubkey,
    profile: anchor_lang::prelude::Pubkey,
    base_mint: anchor_lang::prelude::Pubkey,
    vault_token: anchor_lang::prelude::Pubkey,
    max_leverage: u8,
) -> Instruction {
    Instruction::new_with_bytes(
        arcadia_vault::id(),
        &arcadia_vault::instruction::InitializeProfile { max_leverage }.data(),
        arcadia_vault::accounts::InitializeProfile {
            trader,
            config,
            profile,
            base_mint,
            vault_token,
            system_program: system_program::ID,
            token_program: TOKEN_PROGRAM_ID,
            rent: rent::ID,
        }
        .to_account_metas(None),
    )
}

fn send_tx(
    svm: &mut LiteSVM,
    instructions: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
) -> (u64, Vec<String>) {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(instructions, Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    let result = svm
        .send_transaction(tx)
        .expect("transaction should succeed");
    svm.expire_blockhash();
    (result.compute_units_consumed, result.logs)
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

fn read_profile(
    svm: &LiteSVM,
    profile: &anchor_lang::prelude::Pubkey,
) -> arcadia_vault::TraderProfile {
    let account = svm.get_account(profile).expect("profile account exists");
    assert_eq!(account.owner.to_bytes(), arcadia_vault::id().to_bytes());

    let mut data: &[u8] = account.data.as_ref();
    arcadia_vault::TraderProfile::try_deserialize(&mut data).unwrap()
}

fn read_token_account(svm: &LiteSVM, address: &anchor_lang::prelude::Pubkey) -> TokenAccount {
    let account = svm.get_account(address).expect("token account exists");
    assert_eq!(account.owner.to_bytes(), TOKEN_PROGRAM_ID.to_bytes());
    TokenAccount::unpack(&account.data).unwrap()
}

fn record_cu(label: &'static str, cu: u64) {
    CU_RESULTS.lock().unwrap().push((label, cu));
}

#[test]
fn initialize_profile_happy_path_sets_profile_and_vault_authority() {
    let mut fixture = setup();
    let vault_token = Keypair::new();
    let (profile, profile_bump) = profile_pda(&fixture.trader.pubkey());
    let ix = initialize_profile_ix(
        fixture.trader.pubkey(),
        fixture.config,
        profile,
        fixture.base_mint,
        vault_token.pubkey(),
        5,
    );

    let (cu, logs) = send_tx(
        &mut fixture.svm,
        &[ix],
        &fixture.trader,
        &[&fixture.trader, &vault_token],
    );
    record_cu("initialize_profile", cu);

    assert!(logs.iter().any(|log| log.starts_with("Program data: ")));

    let profile_state = read_profile(&fixture.svm, &profile);
    assert_eq!(profile_state.trader, fixture.trader.pubkey());
    assert_eq!(profile_state.base_mint, fixture.base_mint);
    assert_eq!(profile_state.vault_token, vault_token.pubkey());
    assert_eq!(profile_state.total_shares, 0);
    assert_eq!(profile_state.trader_shares, 0);
    assert_eq!(profile_state.hwm_per_share, arcadia_vault::SHARE_SCALE);
    assert_eq!(profile_state.capacity_cap_usd, 0);
    assert_eq!(profile_state.trader_claimable, 0);
    assert_eq!(profile_state.last_settle_ts, profile_state.created_at);
    assert_eq!(profile_state.status, arcadia_vault::PROFILE_STATUS_ACTIVE);
    assert_eq!(profile_state.score_tier, arcadia_vault::NOT_FUNDABLE_TIER);
    assert_eq!(profile_state.max_leverage, 5);
    assert_eq!(profile_state.bump, profile_bump);

    let vault_state = read_token_account(&fixture.svm, &vault_token.pubkey());
    assert_eq!(vault_state.mint, fixture.base_mint);
    assert_eq!(vault_state.owner, profile);
    assert_eq!(vault_state.amount, 0);
    assert_eq!(vault_state.state, AccountState::Initialized);
}

#[test]
fn initialize_profile_reinit_for_same_trader_fails() {
    let mut fixture = setup();
    let first_vault = Keypair::new();
    let second_vault = Keypair::new();
    let (profile, _) = profile_pda(&fixture.trader.pubkey());

    let first_ix = initialize_profile_ix(
        fixture.trader.pubkey(),
        fixture.config,
        profile,
        fixture.base_mint,
        first_vault.pubkey(),
        5,
    );
    send_tx(
        &mut fixture.svm,
        &[first_ix],
        &fixture.trader,
        &[&fixture.trader, &first_vault],
    );

    let second_ix = initialize_profile_ix(
        fixture.trader.pubkey(),
        fixture.config,
        profile,
        fixture.base_mint,
        second_vault.pubkey(),
        5,
    );
    assert!(tx_fails(
        &mut fixture.svm,
        &[second_ix],
        &fixture.trader,
        &[&fixture.trader, &second_vault],
    ));
    assert!(fixture.svm.get_account(&second_vault.pubkey()).is_none());
}

#[test]
fn initialize_profile_rejects_invalid_leverage() {
    for max_leverage in [0, arcadia_vault::MAX_LEVERAGE_CEILING + 1] {
        let mut fixture = setup();
        let vault_token = Keypair::new();
        let (profile, _) = profile_pda(&fixture.trader.pubkey());
        let ix = initialize_profile_ix(
            fixture.trader.pubkey(),
            fixture.config,
            profile,
            fixture.base_mint,
            vault_token.pubkey(),
            max_leverage,
        );

        assert!(tx_fails(
            &mut fixture.svm,
            &[ix],
            &fixture.trader,
            &[&fixture.trader, &vault_token],
        ));
        assert!(fixture.svm.get_account(&profile).is_none());
        assert!(fixture.svm.get_account(&vault_token.pubkey()).is_none());
    }
}

#[test]
fn initialize_profile_rejects_wrong_profile_pda() {
    let mut fixture = setup();
    let vault_token = Keypair::new();
    let wrong_profile = anchor_lang::prelude::Pubkey::new_unique();
    let ix = initialize_profile_ix(
        fixture.trader.pubkey(),
        fixture.config,
        wrong_profile,
        fixture.base_mint,
        vault_token.pubkey(),
        5,
    );

    assert!(tx_fails(
        &mut fixture.svm,
        &[ix],
        &fixture.trader,
        &[&fixture.trader, &vault_token],
    ));
    assert!(fixture.svm.get_account(&wrong_profile).is_none());
    assert!(fixture.svm.get_account(&vault_token.pubkey()).is_none());
}

#[test]
fn initialize_profile_rejects_base_mint_not_bound_to_config() {
    let mut fixture = setup();
    let vault_token = Keypair::new();
    let (profile, _) = profile_pda(&fixture.trader.pubkey());
    let ix = initialize_profile_ix(
        fixture.trader.pubkey(),
        fixture.config,
        profile,
        fixture.wrong_mint,
        vault_token.pubkey(),
        5,
    );

    assert!(tx_fails(
        &mut fixture.svm,
        &[ix],
        &fixture.trader,
        &[&fixture.trader, &vault_token],
    ));
    assert!(fixture.svm.get_account(&profile).is_none());
    assert!(fixture.svm.get_account(&vault_token.pubkey()).is_none());
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
