use {
    anchor_lang::{
        prelude::{rent, Clock},
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
    send_tx(
        &mut svm,
        &[set_capacity_ix(
            oracle_authority.pubkey(),
            config,
            profile,
            100_000_000_000,
            1,
        )],
        &oracle_authority,
        &[&oracle_authority],
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

fn record_trade_ix(fixture: &Fixture) -> Instruction {
    Instruction::new_with_bytes(
        arcadia_vault::id(),
        &arcadia_vault::instruction::RecordTrade {
            market: "SOL-PERP".to_string(),
            direction: arcadia_vault::DIRECTION_LONG,
            size_usd: 1_000_000_000,
            leverage_x100: 100,
            entry_px: 100,
            exit_px: 160,
            fees_usd: 0,
            was_liquidated: false,
            opened_at: 10,
            closed_at: 20,
        }
        .data(),
        arcadia_vault::accounts::RecordTrade {
            trader: fixture.trader.pubkey(),
            oracle_authority: fixture.oracle_authority.pubkey(),
            config: fixture.config,
            profile: fixture.profile,
            base_mint: fixture.base_mint,
            vault_token: fixture.vault_token,
            treasury_token: fixture.treasury_token,
            treasury_authority: fixture.oracle_authority.pubkey(),
            token_program: TOKEN_PROGRAM_ID,
        }
        .to_account_metas(None),
    )
}

fn settle_ix(fixture: &Fixture, caller: anchor_lang::prelude::Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        arcadia_vault::id(),
        &arcadia_vault::instruction::Settle {}.data(),
        arcadia_vault::accounts::Settle {
            caller,
            config: fixture.config,
            profile: fixture.profile,
            base_mint: fixture.base_mint,
            vault_token: fixture.vault_token,
            treasury_token: fixture.treasury_token,
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

fn record_gain(fixture: &mut Fixture) {
    let trader = fixture.trader.insecure_clone();
    let oracle = fixture.oracle_authority.insecure_clone();
    let ix = record_trade_ix(fixture);
    send_tx(&mut fixture.svm, &[ix], &trader, &[&trader, &oracle]);
}

fn warp_forward(fixture: &mut Fixture, seconds: i64) {
    let mut clock: Clock = fixture.svm.get_sysvar();
    clock.unix_timestamp += seconds;
    fixture.svm.set_sysvar(&clock);
    fixture.svm.expire_blockhash();
}

fn record_cu(label: &'static str, cu: u64) {
    CU_RESULTS.lock().unwrap().push((label, cu));
}

#[test]
fn settle_no_profit_updates_timestamp_and_moves_no_tokens() {
    let mut fixture = setup(true);
    let before_profile = read_profile(&fixture.svm, &fixture.profile);
    let vault_before = read_token_account(&fixture.svm, &fixture.vault_token).amount;
    let treasury_before = read_token_account(&fixture.svm, &fixture.treasury_token).amount;
    warp_forward(&mut fixture, 60);

    let oracle = fixture.oracle_authority.insecure_clone();
    let ix = settle_ix(&fixture, oracle.pubkey());
    let (cu, logs) = send_tx(&mut fixture.svm, &[ix], &oracle, &[&oracle]);
    record_cu("settle:no_profit", cu);
    assert!(!logs.iter().any(|log| log.starts_with("Program data: ")));

    let profile = read_profile(&fixture.svm, &fixture.profile);
    assert!(profile.last_settle_ts > before_profile.last_settle_ts);
    assert_eq!(profile.hwm_per_share, before_profile.hwm_per_share);
    assert_eq!(profile.trader_claimable, 0);
    assert_eq!(
        read_token_account(&fixture.svm, &fixture.vault_token).amount,
        vault_before
    );
    assert_eq!(
        read_token_account(&fixture.svm, &fixture.treasury_token).amount,
        treasury_before
    );
}

#[test]
fn settle_profit_splits_fees_and_resets_post_fee_hwm() {
    let mut fixture = setup(true);
    record_gain(&mut fixture);
    assert_eq!(
        read_token_account(&fixture.svm, &fixture.vault_token).amount,
        5_600_000_000
    );

    let trader = fixture.trader.insecure_clone();
    let ix = settle_ix(&fixture, trader.pubkey());
    let (cu, logs) = send_tx(&mut fixture.svm, &[ix], &trader, &[&trader]);
    record_cu("settle:profit", cu);
    assert!(logs.iter().any(|log| log.starts_with("Program data: ")));

    let profile = read_profile(&fixture.svm, &fixture.profile);
    assert_eq!(profile.total_shares, 5_000_000_000);
    assert_eq!(profile.trader_claimable, 150_000_000);
    assert_eq!(profile.hwm_per_share, 1_084_000);

    assert_eq!(
        read_token_account(&fixture.svm, &fixture.vault_token).amount,
        5_570_000_000
    );
    assert_eq!(
        read_token_account(&fixture.svm, &fixture.treasury_token).amount,
        9_430_000_000
    );
    assert_eq!(
        arcadia_vault::nav_per_share(5_570_000_000, 150_000_000, profile.total_shares).unwrap(),
        1_084_000
    );
}

#[test]
fn settle_repeated_flat_settlement_does_not_double_charge() {
    let mut fixture = setup(true);
    record_gain(&mut fixture);
    let trader = fixture.trader.insecure_clone();

    let ix = settle_ix(&fixture, trader.pubkey());
    send_tx(&mut fixture.svm, &[ix], &trader, &[&trader]);
    let after_first_profile = read_profile(&fixture.svm, &fixture.profile);
    let vault_after_first = read_token_account(&fixture.svm, &fixture.vault_token).amount;
    let treasury_after_first = read_token_account(&fixture.svm, &fixture.treasury_token).amount;

    let ix = settle_ix(&fixture, trader.pubkey());
    let (cu, logs) = send_tx(&mut fixture.svm, &[ix], &trader, &[&trader]);
    record_cu("settle:flat_repeat", cu);
    assert!(!logs.iter().any(|log| log.starts_with("Program data: ")));

    let profile = read_profile(&fixture.svm, &fixture.profile);
    assert_eq!(
        profile.trader_claimable,
        after_first_profile.trader_claimable
    );
    assert_eq!(profile.hwm_per_share, after_first_profile.hwm_per_share);
    assert_eq!(
        read_token_account(&fixture.svm, &fixture.vault_token).amount,
        vault_after_first
    );
    assert_eq!(
        read_token_account(&fixture.svm, &fixture.treasury_token).amount,
        treasury_after_first
    );
}

#[test]
fn settle_rejects_unauthorized_and_no_shares() {
    {
        let mut fixture = setup(true);
        let attacker = fixture.attacker.insecure_clone();
        let ix = settle_ix(&fixture, attacker.pubkey());
        assert!(tx_fails(&mut fixture.svm, &[ix], &attacker, &[&attacker],));
    }

    {
        let mut fixture = setup(false);
        let trader = fixture.trader.insecure_clone();
        let ix = settle_ix(&fixture, trader.pubkey());
        assert!(tx_fails(&mut fixture.svm, &[ix], &trader, &[&trader],));
    }
}

#[test]
fn settle_rejects_account_binding_and_invalid_nav_state() {
    {
        let mut fixture = setup(true);
        set_token_account(
            &mut fixture.svm,
            fixture.treasury_token,
            fixture.wrong_mint,
            fixture.oracle_authority.pubkey(),
            10_000_000_000,
        );
        let trader = fixture.trader.insecure_clone();
        let ix = settle_ix(&fixture, trader.pubkey());
        assert!(tx_fails(&mut fixture.svm, &[ix], &trader, &[&trader],));
    }

    {
        let mut fixture = setup(true);
        set_token_account(
            &mut fixture.svm,
            fixture.vault_token,
            fixture.base_mint,
            fixture.attacker.pubkey(),
            5_000_000_000,
        );
        let trader = fixture.trader.insecure_clone();
        let ix = settle_ix(&fixture, trader.pubkey());
        assert!(tx_fails(&mut fixture.svm, &[ix], &trader, &[&trader],));
    }

    {
        let mut fixture = setup(true);
        let mut profile = read_profile(&fixture.svm, &fixture.profile);
        profile.trader_claimable = 6_000_000_000;
        write_profile(&mut fixture.svm, fixture.profile, &profile);
        let trader = fixture.trader.insecure_clone();
        let ix = settle_ix(&fixture, trader.pubkey());
        assert!(tx_fails(&mut fixture.svm, &[ix], &trader, &[&trader],));
    }
}

#[test]
fn zz_cu_summary() {
    let results = CU_RESULTS.lock().unwrap();
    if results.is_empty() {
        println!("No settle CU results captured");
        return;
    }

    println!("\n=== settle Compute Unit Summary ===");
    for (label, cu) in results.iter() {
        println!("  {:<32} {:>8} CUs", label, cu);
    }
}
