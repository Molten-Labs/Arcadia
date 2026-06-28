use {
    anchor_lang::{
        prelude::rent,
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, AccountSerialize, InstructionData, ToAccountMetas,
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
    oracle_authority: Keypair,
    attacker: Keypair,
    config: anchor_lang::prelude::Pubkey,
    profile: anchor_lang::prelude::Pubkey,
}

fn setup() -> Fixture {
    let program_id = arcadia_vault::id();
    let admin = Keypair::new();
    let trader = Keypair::new();
    let oracle_authority = Keypair::new();
    let attacker = Keypair::new();
    let treasury_owner = Keypair::new().pubkey();
    let base_mint = anchor_lang::prelude::Pubkey::new_unique();
    let treasury_token = anchor_lang::prelude::Pubkey::new_unique();
    let vault_token = Keypair::new();
    let (config, _) = platform_pda();
    let (profile, _) = profile_pda(&trader.pubkey());

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/arcadia_vault.so");
    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&admin.pubkey(), LAMPORTS_PER_SOL).unwrap();
    svm.airdrop(&trader.pubkey(), LAMPORTS_PER_SOL).unwrap();
    svm.airdrop(&oracle_authority.pubkey(), LAMPORTS_PER_SOL)
        .unwrap();
    svm.airdrop(&attacker.pubkey(), LAMPORTS_PER_SOL).unwrap();

    set_mint_account(&mut svm, base_mint, arcadia_vault::USDC_DECIMALS);
    set_token_account(&mut svm, treasury_token, base_mint, treasury_owner, 0);

    let init_platform = initialize_platform_ix(
        admin.pubkey(),
        config,
        base_mint,
        treasury_token,
        oracle_authority.pubkey(),
        arcadia_vault::PLATFORM_PERF_FEE_BPS,
        arcadia_vault::PLATFORM_MGMT_FEE_BPS,
    );
    send_tx(&mut svm, &[init_platform], &admin, &[&admin]);

    let init_profile = initialize_profile_ix(
        trader.pubkey(),
        config,
        profile,
        base_mint,
        vault_token.pubkey(),
        5,
    );
    send_tx(&mut svm, &[init_profile], &trader, &[&trader, &vault_token]);

    Fixture {
        svm,
        oracle_authority,
        attacker,
        config,
        profile,
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

fn set_capacity_ix(
    oracle_authority: anchor_lang::prelude::Pubkey,
    config: anchor_lang::prelude::Pubkey,
    profile: anchor_lang::prelude::Pubkey,
    cap_usd: u64,
    score_tier: u8,
) -> Instruction {
    Instruction::new_with_bytes(
        arcadia_vault::id(),
        &arcadia_vault::instruction::SetCapacity {
            cap_usd,
            score_tier,
        }
        .data(),
        arcadia_vault::accounts::SetCapacity {
            oracle_authority,
            config,
            profile,
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

fn write_profile(
    svm: &mut LiteSVM,
    profile: anchor_lang::prelude::Pubkey,
    profile_state: &arcadia_vault::TraderProfile,
) {
    let mut account = svm.get_account(&profile).expect("profile account exists");
    let len = account.data.len();
    let mut data = Vec::with_capacity(len);
    profile_state.try_serialize(&mut data).unwrap();
    data.resize(len, 0);
    account.data = data;
    svm.set_account(profile, account).unwrap();
}

fn record_cu(label: &'static str, cu: u64) {
    CU_RESULTS.lock().unwrap().push((label, cu));
}

#[test]
fn set_capacity_happy_path_updates_only_capacity_fields() {
    let mut fixture = setup();
    let before = read_profile(&fixture.svm, &fixture.profile);
    let ix = set_capacity_ix(
        fixture.oracle_authority.pubkey(),
        fixture.config,
        fixture.profile,
        42_000_000_000,
        2,
    );

    let (cu, _) = send_tx(
        &mut fixture.svm,
        &[ix],
        &fixture.oracle_authority,
        &[&fixture.oracle_authority],
    );
    record_cu("set_capacity", cu);

    let after = read_profile(&fixture.svm, &fixture.profile);
    assert_eq!(after.capacity_cap_usd, 42_000_000_000);
    assert_eq!(after.score_tier, 2);
    assert_eq!(after.trader, before.trader);
    assert_eq!(after.base_mint, before.base_mint);
    assert_eq!(after.vault_token, before.vault_token);
    assert_eq!(after.total_shares, before.total_shares);
    assert_eq!(after.trader_claimable, before.trader_claimable);
    assert_eq!(after.status, arcadia_vault::PROFILE_STATUS_ACTIVE);
}

#[test]
fn set_capacity_accepts_not_fundable_tier() {
    let mut fixture = setup();
    let ix = set_capacity_ix(
        fixture.oracle_authority.pubkey(),
        fixture.config,
        fixture.profile,
        0,
        arcadia_vault::NOT_FUNDABLE_TIER,
    );

    send_tx(
        &mut fixture.svm,
        &[ix],
        &fixture.oracle_authority,
        &[&fixture.oracle_authority],
    );

    let profile = read_profile(&fixture.svm, &fixture.profile);
    assert_eq!(profile.capacity_cap_usd, 0);
    assert_eq!(profile.score_tier, arcadia_vault::NOT_FUNDABLE_TIER);
}

#[test]
fn set_capacity_rejects_non_oracle_signer() {
    let mut fixture = setup();
    let ix = set_capacity_ix(
        fixture.attacker.pubkey(),
        fixture.config,
        fixture.profile,
        42_000_000_000,
        1,
    );

    assert!(tx_fails(
        &mut fixture.svm,
        &[ix],
        &fixture.attacker,
        &[&fixture.attacker],
    ));

    let profile = read_profile(&fixture.svm, &fixture.profile);
    assert_eq!(profile.capacity_cap_usd, 0);
    assert_eq!(profile.score_tier, arcadia_vault::NOT_FUNDABLE_TIER);
}

#[test]
fn set_capacity_rejects_invalid_tier() {
    let mut fixture = setup();
    let ix = set_capacity_ix(
        fixture.oracle_authority.pubkey(),
        fixture.config,
        fixture.profile,
        42_000_000_000,
        4,
    );

    assert!(tx_fails(
        &mut fixture.svm,
        &[ix],
        &fixture.oracle_authority,
        &[&fixture.oracle_authority],
    ));

    let profile = read_profile(&fixture.svm, &fixture.profile);
    assert_eq!(profile.capacity_cap_usd, 0);
    assert_eq!(profile.score_tier, arcadia_vault::NOT_FUNDABLE_TIER);
}

#[test]
fn set_capacity_rejects_inactive_profile() {
    let mut fixture = setup();
    let mut profile_state = read_profile(&fixture.svm, &fixture.profile);
    profile_state.status = arcadia_vault::PROFILE_STATUS_CLOSED;
    write_profile(&mut fixture.svm, fixture.profile, &profile_state);

    let ix = set_capacity_ix(
        fixture.oracle_authority.pubkey(),
        fixture.config,
        fixture.profile,
        42_000_000_000,
        1,
    );

    assert!(tx_fails(
        &mut fixture.svm,
        &[ix],
        &fixture.oracle_authority,
        &[&fixture.oracle_authority],
    ));

    let profile = read_profile(&fixture.svm, &fixture.profile);
    assert_eq!(profile.status, arcadia_vault::PROFILE_STATUS_CLOSED);
    assert_eq!(profile.capacity_cap_usd, 0);
    assert_eq!(profile.score_tier, arcadia_vault::NOT_FUNDABLE_TIER);
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
