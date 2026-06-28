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

#[derive(Clone)]
struct TradeArgs {
    market: String,
    direction: u8,
    size_usd: u64,
    leverage_x100: u16,
    entry_px: u64,
    exit_px: u64,
    fees_usd: u64,
    was_liquidated: bool,
    opened_at: i64,
    closed_at: i64,
}

impl Default for TradeArgs {
    fn default() -> Self {
        Self {
            market: "SOL-PERP".to_string(),
            direction: arcadia_vault::DIRECTION_LONG,
            size_usd: 1_000_000_000,
            leverage_x100: 100,
            entry_px: 100,
            exit_px: 150,
            fees_usd: 20_000_000,
            was_liquidated: false,
            opened_at: 10,
            closed_at: 20,
        }
    }
}

struct Fixture {
    svm: LiteSVM,
    trader: Keypair,
    oracle_authority: Keypair,
    attacker: Keypair,
    config: anchor_lang::prelude::Pubkey,
    profile: anchor_lang::prelude::Pubkey,
    base_mint: anchor_lang::prelude::Pubkey,
    wrong_mint: anchor_lang::prelude::Pubkey,
    vault_token: anchor_lang::prelude::Pubkey,
    treasury_token: anchor_lang::prelude::Pubkey,
}

fn setup(with_deposit: bool) -> Fixture {
    let program_id = arcadia_vault::id();
    let admin = Keypair::new();
    let trader = Keypair::new();
    let oracle_authority = Keypair::new();
    let attacker = Keypair::new();
    let base_mint = anchor_lang::prelude::Pubkey::new_unique();
    let wrong_mint = anchor_lang::prelude::Pubkey::new_unique();
    let treasury_token = anchor_lang::prelude::Pubkey::new_unique();
    let trader_token = anchor_lang::prelude::Pubkey::new_unique();
    let vault_token = Keypair::new();
    let (config, _) = platform_pda();
    let (profile, _) = profile_pda(&trader.pubkey());
    let (investor_account, _) = investor_pda(&trader.pubkey());
    let (position, _) = position_pda(&trader.pubkey(), &profile);

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/arcadia_vault.so");
    svm.add_program(program_id, bytes).unwrap();
    for signer in [&admin, &trader, &oracle_authority, &attacker] {
        svm.airdrop(&signer.pubkey(), LAMPORTS_PER_SOL).unwrap();
    }

    set_mint_account(&mut svm, base_mint, arcadia_vault::USDC_DECIMALS);
    set_mint_account(&mut svm, wrong_mint, arcadia_vault::USDC_DECIMALS);
    set_token_account(
        &mut svm,
        treasury_token,
        base_mint,
        oracle_authority.pubkey(),
        10_000_000_000,
    );
    set_token_account(
        &mut svm,
        trader_token,
        base_mint,
        trader.pubkey(),
        10_000_000_000,
    );

    send_tx(
        &mut svm,
        &[initialize_platform_ix(
            admin.pubkey(),
            config,
            base_mint,
            treasury_token,
            oracle_authority.pubkey(),
        )],
        &admin,
        &[&admin],
    );
    send_tx(
        &mut svm,
        &[initialize_profile_ix(
            trader.pubkey(),
            config,
            profile,
            base_mint,
            vault_token.pubkey(),
            5,
        )],
        &trader,
        &[&trader, &vault_token],
    );

    if with_deposit {
        send_tx(
            &mut svm,
            &[initialize_investor_ix(trader.pubkey(), investor_account)],
            &trader,
            &[&trader],
        );
        send_tx(
            &mut svm,
            &[deposit_ix(
                trader.pubkey(),
                investor_account,
                profile,
                position,
                base_mint,
                vault_token.pubkey(),
                trader_token,
                5_000_000_000,
            )],
            &trader,
            &[&trader],
        );
    }

    Fixture {
        svm,
        trader,
        oracle_authority,
        attacker,
        config,
        profile,
        base_mint,
        wrong_mint,
        vault_token: vault_token.pubkey(),
        treasury_token,
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

fn investor_pda(wallet: &anchor_lang::prelude::Pubkey) -> (anchor_lang::prelude::Pubkey, u8) {
    anchor_lang::prelude::Pubkey::find_program_address(
        &[arcadia_vault::INVESTOR_SEED, wallet.as_ref()],
        &arcadia_vault::id(),
    )
}

fn position_pda(
    wallet: &anchor_lang::prelude::Pubkey,
    profile: &anchor_lang::prelude::Pubkey,
) -> (anchor_lang::prelude::Pubkey, u8) {
    anchor_lang::prelude::Pubkey::find_program_address(
        &[
            arcadia_vault::POSITION_SEED,
            wallet.as_ref(),
            profile.as_ref(),
        ],
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

fn write_token_amount(svm: &mut LiteSVM, address: &anchor_lang::prelude::Pubkey, amount: u64) {
    let mut account = svm.get_account(address).expect("token account exists");
    let mut token_account = TokenAccount::unpack(&account.data).unwrap();
    token_account.amount = amount;
    TokenAccount::pack(token_account, &mut account.data).unwrap();
    svm.set_account(*address, account).unwrap();
}

fn initialize_platform_ix(
    admin: anchor_lang::prelude::Pubkey,
    config: anchor_lang::prelude::Pubkey,
    base_mint: anchor_lang::prelude::Pubkey,
    treasury_token: anchor_lang::prelude::Pubkey,
    oracle_authority: anchor_lang::prelude::Pubkey,
) -> Instruction {
    Instruction::new_with_bytes(
        arcadia_vault::id(),
        &arcadia_vault::instruction::InitializePlatform {
            perf_fee_bps: arcadia_vault::PLATFORM_PERF_FEE_BPS,
            mgmt_fee_bps: arcadia_vault::PLATFORM_MGMT_FEE_BPS,
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

fn initialize_investor_ix(
    wallet: anchor_lang::prelude::Pubkey,
    investor_account: anchor_lang::prelude::Pubkey,
) -> Instruction {
    Instruction::new_with_bytes(
        arcadia_vault::id(),
        &arcadia_vault::instruction::InitializeInvestor {}.data(),
        arcadia_vault::accounts::InitializeInvestor {
            wallet,
            investor_account,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn deposit_ix(
    depositor: anchor_lang::prelude::Pubkey,
    investor_account: anchor_lang::prelude::Pubkey,
    profile: anchor_lang::prelude::Pubkey,
    position: anchor_lang::prelude::Pubkey,
    base_mint: anchor_lang::prelude::Pubkey,
    vault_token: anchor_lang::prelude::Pubkey,
    depositor_token: anchor_lang::prelude::Pubkey,
    amount: u64,
) -> Instruction {
    Instruction::new_with_bytes(
        arcadia_vault::id(),
        &arcadia_vault::instruction::Deposit { amount }.data(),
        arcadia_vault::accounts::Deposit {
            depositor,
            investor_account,
            profile,
            position,
            base_mint,
            vault_token,
            depositor_token,
            token_program: TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn record_trade_ix(
    fixture: &Fixture,
    trader: anchor_lang::prelude::Pubkey,
    oracle_authority: anchor_lang::prelude::Pubkey,
    treasury_authority: anchor_lang::prelude::Pubkey,
    args: TradeArgs,
) -> Instruction {
    Instruction::new_with_bytes(
        arcadia_vault::id(),
        &arcadia_vault::instruction::RecordTrade {
            market: args.market,
            direction: args.direction,
            size_usd: args.size_usd,
            leverage_x100: args.leverage_x100,
            entry_px: args.entry_px,
            exit_px: args.exit_px,
            fees_usd: args.fees_usd,
            was_liquidated: args.was_liquidated,
            opened_at: args.opened_at,
            closed_at: args.closed_at,
        }
        .data(),
        arcadia_vault::accounts::RecordTrade {
            trader,
            oracle_authority,
            config: fixture.config,
            profile: fixture.profile,
            base_mint: fixture.base_mint,
            vault_token: fixture.vault_token,
            treasury_token: fixture.treasury_token,
            treasury_authority,
            token_program: TOKEN_PROGRAM_ID,
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

fn tx_missing_signature_fails(
    svm: &mut LiteSVM,
    instructions: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
) -> bool {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(instructions, Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers);
    svm.expire_blockhash();
    tx.is_err()
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

fn read_token_account(svm: &LiteSVM, address: &anchor_lang::prelude::Pubkey) -> TokenAccount {
    let account = svm.get_account(address).expect("token account exists");
    assert_eq!(account.owner.to_bytes(), TOKEN_PROGRAM_ID.to_bytes());
    TokenAccount::unpack(&account.data).unwrap()
}

fn assert_trade_fails(fixture: &mut Fixture, args: TradeArgs) {
    let ix = record_trade_ix(
        fixture,
        fixture.trader.pubkey(),
        fixture.oracle_authority.pubkey(),
        fixture.oracle_authority.pubkey(),
        args,
    );
    let trader = fixture.trader.insecure_clone();
    let oracle = fixture.oracle_authority.insecure_clone();
    assert!(tx_fails(
        &mut fixture.svm,
        &[ix],
        &trader,
        &[&trader, &oracle],
    ));
}

fn record_cu(label: &'static str, cu: u64) {
    CU_RESULTS.lock().unwrap().push((label, cu));
}

#[test]
fn record_trade_long_gain_transfers_treasury_to_vault() {
    let mut fixture = setup(true);
    let args = TradeArgs::default();
    let expected_pnl = arcadia_vault::realized_pnl(
        args.direction,
        args.size_usd,
        args.leverage_x100,
        args.entry_px,
        args.exit_px,
        args.fees_usd,
    )
    .unwrap();
    assert_eq!(expected_pnl, 480_000_000);

    let ix = record_trade_ix(
        &fixture,
        fixture.trader.pubkey(),
        fixture.oracle_authority.pubkey(),
        fixture.oracle_authority.pubkey(),
        args,
    );
    let trader = fixture.trader.insecure_clone();
    let oracle = fixture.oracle_authority.insecure_clone();
    let (cu, logs) = send_tx(&mut fixture.svm, &[ix], &trader, &[&trader, &oracle]);
    record_cu("record_trade:long_gain", cu);
    assert!(logs.iter().any(|log| log.starts_with("Program data: ")));

    assert_eq!(
        read_token_account(&fixture.svm, &fixture.vault_token).amount,
        5_480_000_000
    );
    assert_eq!(
        read_token_account(&fixture.svm, &fixture.treasury_token).amount,
        9_520_000_000
    );

    let profile = read_profile(&fixture.svm, &fixture.profile);
    assert_eq!(profile.total_shares, 5_000_000_000);
    assert_eq!(profile.trader_shares, 5_000_000_000);
    assert_eq!(profile.trader_claimable, 0);
    assert_eq!(
        arcadia_vault::nav_per_share(5_480_000_000, 0, profile.total_shares).unwrap(),
        1_096_000
    );
}

#[test]
fn record_trade_short_gain_matches_directional_pnl() {
    let mut fixture = setup(true);
    let args = TradeArgs {
        direction: arcadia_vault::DIRECTION_SHORT,
        size_usd: 1_000_000_000,
        leverage_x100: 200,
        entry_px: 100,
        exit_px: 90,
        fees_usd: 10_000_000,
        ..TradeArgs::default()
    };
    assert_eq!(
        arcadia_vault::realized_pnl(
            args.direction,
            args.size_usd,
            args.leverage_x100,
            args.entry_px,
            args.exit_px,
            args.fees_usd,
        )
        .unwrap(),
        190_000_000
    );

    let ix = record_trade_ix(
        &fixture,
        fixture.trader.pubkey(),
        fixture.oracle_authority.pubkey(),
        fixture.oracle_authority.pubkey(),
        args,
    );
    let trader = fixture.trader.insecure_clone();
    let oracle = fixture.oracle_authority.insecure_clone();
    let (cu, _) = send_tx(&mut fixture.svm, &[ix], &trader, &[&trader, &oracle]);
    record_cu("record_trade:short_gain", cu);

    assert_eq!(
        read_token_account(&fixture.svm, &fixture.vault_token).amount,
        5_190_000_000
    );
    assert_eq!(
        read_token_account(&fixture.svm, &fixture.treasury_token).amount,
        9_810_000_000
    );
}

#[test]
fn record_trade_loss_floors_at_nav_bearing_assets() {
    let mut fixture = setup(true);
    let mut profile = read_profile(&fixture.svm, &fixture.profile);
    profile.trader_claimable = 1_000_000_000;
    write_profile(&mut fixture.svm, fixture.profile, &profile);
    assert_eq!(
        read_token_account(&fixture.svm, &fixture.vault_token).amount,
        5_000_000_000
    );

    let args = TradeArgs {
        direction: arcadia_vault::DIRECTION_LONG,
        size_usd: 999_000_000,
        leverage_x100: 500,
        entry_px: 100,
        exit_px: 1,
        fees_usd: 0,
        was_liquidated: true,
        ..TradeArgs::default()
    };
    assert_eq!(
        arcadia_vault::realized_pnl(
            args.direction,
            args.size_usd,
            args.leverage_x100,
            args.entry_px,
            args.exit_px,
            args.fees_usd,
        )
        .unwrap(),
        -4_945_050_000
    );

    let ix = record_trade_ix(
        &fixture,
        fixture.trader.pubkey(),
        fixture.oracle_authority.pubkey(),
        fixture.oracle_authority.pubkey(),
        args,
    );
    let trader = fixture.trader.insecure_clone();
    let oracle = fixture.oracle_authority.insecure_clone();
    let (cu, _) = send_tx(&mut fixture.svm, &[ix], &trader, &[&trader, &oracle]);
    record_cu("record_trade:loss_floor", cu);

    assert_eq!(
        read_token_account(&fixture.svm, &fixture.vault_token).amount,
        1_000_000_000
    );
    assert_eq!(
        read_token_account(&fixture.svm, &fixture.treasury_token).amount,
        14_000_000_000
    );

    let profile = read_profile(&fixture.svm, &fixture.profile);
    assert_eq!(profile.total_shares, 5_000_000_000);
    assert_eq!(profile.trader_shares, 5_000_000_000);
    assert_eq!(profile.trader_claimable, 1_000_000_000);
    assert_eq!(
        arcadia_vault::nav_per_share(1_000_000_000, 1_000_000_000, profile.total_shares).unwrap(),
        0
    );
}

#[test]
fn record_trade_rejects_missing_or_wrong_signers() {
    let mut fixture = setup(true);
    let args = TradeArgs::default();
    let ix = record_trade_ix(
        &fixture,
        fixture.trader.pubkey(),
        fixture.oracle_authority.pubkey(),
        fixture.oracle_authority.pubkey(),
        args.clone(),
    );
    let trader = fixture.trader.insecure_clone();
    let oracle = fixture.oracle_authority.insecure_clone();
    assert!(tx_missing_signature_fails(
        &mut fixture.svm,
        &[ix.clone()],
        &trader,
        &[&trader],
    ));
    assert!(tx_missing_signature_fails(
        &mut fixture.svm,
        &[ix],
        &trader,
        &[&oracle],
    ));

    let ix = record_trade_ix(
        &fixture,
        fixture.trader.pubkey(),
        fixture.attacker.pubkey(),
        fixture.oracle_authority.pubkey(),
        args.clone(),
    );
    let attacker = fixture.attacker.insecure_clone();
    assert!(tx_fails(
        &mut fixture.svm,
        &[ix],
        &attacker,
        &[&trader, &attacker, &oracle],
    ));

    let ix = record_trade_ix(
        &fixture,
        fixture.attacker.pubkey(),
        fixture.oracle_authority.pubkey(),
        fixture.oracle_authority.pubkey(),
        args,
    );
    assert!(tx_fails(
        &mut fixture.svm,
        &[ix],
        &attacker,
        &[&attacker, &oracle],
    ));
}

#[test]
fn record_trade_rejects_invalid_params_and_bounds() {
    let mut fixture = setup(true);

    assert_trade_fails(
        &mut fixture,
        TradeArgs {
            direction: 2,
            ..TradeArgs::default()
        },
    );
    assert_trade_fails(
        &mut fixture,
        TradeArgs {
            entry_px: 0,
            ..TradeArgs::default()
        },
    );
    assert_trade_fails(
        &mut fixture,
        TradeArgs {
            exit_px: 0,
            ..TradeArgs::default()
        },
    );
    assert_trade_fails(
        &mut fixture,
        TradeArgs {
            size_usd: 0,
            ..TradeArgs::default()
        },
    );
    assert_trade_fails(
        &mut fixture,
        TradeArgs {
            opened_at: 20,
            closed_at: 10,
            ..TradeArgs::default()
        },
    );
    assert_trade_fails(
        &mut fixture,
        TradeArgs {
            leverage_x100: 501,
            ..TradeArgs::default()
        },
    );
    assert_trade_fails(
        &mut fixture,
        TradeArgs {
            size_usd: 1_000_000_001,
            ..TradeArgs::default()
        },
    );
}

#[test]
fn record_trade_rejects_token_binding_and_funding_failures() {
    {
        let mut fixture = setup(true);
        let args = TradeArgs::default();
        let ix = record_trade_ix(
            &fixture,
            fixture.trader.pubkey(),
            fixture.oracle_authority.pubkey(),
            fixture.attacker.pubkey(),
            args,
        );
        let trader = fixture.trader.insecure_clone();
        let oracle = fixture.oracle_authority.insecure_clone();
        let attacker = fixture.attacker.insecure_clone();
        assert!(tx_fails(
            &mut fixture.svm,
            &[ix],
            &attacker,
            &[&trader, &oracle, &attacker],
        ));
    }

    {
        let mut fixture = setup(true);
        set_token_account(
            &mut fixture.svm,
            fixture.treasury_token,
            fixture.wrong_mint,
            fixture.oracle_authority.pubkey(),
            10_000_000_000,
        );
        assert_trade_fails(&mut fixture, TradeArgs::default());
    }

    {
        let mut fixture = setup(true);
        write_token_amount(&mut fixture.svm, &fixture.treasury_token, 1);
        assert_trade_fails(&mut fixture, TradeArgs::default());
    }
}

#[test]
fn record_trade_rejects_empty_or_inactive_profiles() {
    {
        let mut fixture = setup(false);
        assert_trade_fails(&mut fixture, TradeArgs::default());
    }

    {
        let mut fixture = setup(true);
        let mut profile = read_profile(&fixture.svm, &fixture.profile);
        profile.status = arcadia_vault::PROFILE_STATUS_CLOSED;
        write_profile(&mut fixture.svm, fixture.profile, &profile);
        assert_trade_fails(&mut fixture, TradeArgs::default());
    }
}

#[test]
fn zz_cu_summary() {
    let results = CU_RESULTS.lock().unwrap();
    if results.is_empty() {
        println!("No record_trade CU results captured");
        return;
    }

    println!("\n=== record_trade Compute Unit Summary ===");
    for (label, cu) in results.iter() {
        println!("  {:<32} {:>8} CUs", label, cu);
    }
}
