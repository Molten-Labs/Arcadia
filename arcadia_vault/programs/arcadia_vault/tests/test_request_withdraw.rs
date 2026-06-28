use {
    anchor_lang::{
        prelude::{rent, Clock},
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
    attacker: Keypair,
    profile: anchor_lang::prelude::Pubkey,
    wrong_mint: anchor_lang::prelude::Pubkey,
    vault_token: anchor_lang::prelude::Pubkey,
    position: anchor_lang::prelude::Pubkey,
}

fn setup() -> Fixture {
    let program_id = arcadia_vault::id();
    let admin = Keypair::new();
    let trader = Keypair::new();
    let oracle_authority = Keypair::new().pubkey();
    let attacker = Keypair::new();
    let treasury_owner = Keypair::new().pubkey();
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
    for signer in [&admin, &trader, &attacker] {
        svm.airdrop(&signer.pubkey(), LAMPORTS_PER_SOL).unwrap();
    }

    set_mint_account(&mut svm, base_mint, arcadia_vault::USDC_DECIMALS);
    set_mint_account(&mut svm, wrong_mint, arcadia_vault::USDC_DECIMALS);
    set_token_account(&mut svm, treasury_token, base_mint, treasury_owner, 0);
    set_token_account(
        &mut svm,
        trader_token,
        base_mint,
        trader.pubkey(),
        2_000_000_000,
    );

    send_tx(
        &mut svm,
        &[initialize_platform_ix(
            admin.pubkey(),
            config,
            base_mint,
            treasury_token,
            oracle_authority,
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
            1_000_000_000,
        )],
        &trader,
        &[&trader],
    );

    Fixture {
        svm,
        trader,
        attacker,
        profile,
        wrong_mint,
        vault_token: vault_token.pubkey(),
        position,
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

fn write_token_mint(
    svm: &mut LiteSVM,
    address: &anchor_lang::prelude::Pubkey,
    mint: anchor_lang::prelude::Pubkey,
) {
    let mut account = svm.get_account(address).expect("token account exists");
    let mut token_account = TokenAccount::unpack(&account.data).unwrap();
    token_account.mint = mint;
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

fn request_withdraw_ix(
    owner: anchor_lang::prelude::Pubkey,
    profile: anchor_lang::prelude::Pubkey,
    vault_token: anchor_lang::prelude::Pubkey,
    position: anchor_lang::prelude::Pubkey,
    shares: u64,
) -> Instruction {
    Instruction::new_with_bytes(
        arcadia_vault::id(),
        &arcadia_vault::instruction::RequestWithdraw { shares }.data(),
        arcadia_vault::accounts::RequestWithdraw {
            owner,
            profile,
            vault_token,
            position,
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

fn read_position(
    svm: &LiteSVM,
    position: &anchor_lang::prelude::Pubkey,
) -> arcadia_vault::InvestorPosition {
    let account = svm.get_account(position).expect("position account exists");
    assert_eq!(account.owner.to_bytes(), arcadia_vault::id().to_bytes());

    let mut data: &[u8] = account.data.as_ref();
    arcadia_vault::InvestorPosition::try_deserialize(&mut data).unwrap()
}

fn record_cu(label: &'static str, cu: u64) {
    CU_RESULTS.lock().unwrap().push((label, cu));
}

#[test]
fn request_withdraw_under_five_percent_is_instant() {
    let mut fixture = setup();
    let trader = fixture.trader.insecure_clone();
    let clock: Clock = fixture.svm.get_sysvar();
    let ix = request_withdraw_ix(
        trader.pubkey(),
        fixture.profile,
        fixture.vault_token,
        fixture.position,
        49_000_000,
    );

    let (cu, logs) = send_tx(&mut fixture.svm, &[ix], &trader, &[&trader]);
    record_cu("request_withdraw:instant", cu);
    assert!(logs.iter().any(|log| log.starts_with("Program data: ")));

    let position = read_position(&fixture.svm, &fixture.position);
    assert_eq!(position.shares, 1_000_000_000);
    assert_eq!(position.pending_withdraw_shares, 49_000_000);
    assert_eq!(position.withdraw_ready_ts, clock.unix_timestamp);
}

#[test]
fn request_withdraw_at_threshold_uses_next_daily_window() {
    let mut fixture = setup();
    let trader = fixture.trader.insecure_clone();
    let clock: Clock = fixture.svm.get_sysvar();
    let ix = request_withdraw_ix(
        trader.pubkey(),
        fixture.profile,
        fixture.vault_token,
        fixture.position,
        50_000_000,
    );

    let (cu, _) = send_tx(&mut fixture.svm, &[ix], &trader, &[&trader]);
    record_cu("request_withdraw:delayed", cu);

    let position = read_position(&fixture.svm, &fixture.position);
    assert_eq!(position.pending_withdraw_shares, 50_000_000);
    assert_eq!(
        position.withdraw_ready_ts,
        arcadia_vault::next_daily_settlement_window(clock.unix_timestamp).unwrap()
    );
}

#[test]
fn request_withdraw_accumulates_pending_without_exceeding_owned_shares() {
    let mut fixture = setup();
    let trader = fixture.trader.insecure_clone();

    send_tx(
        &mut fixture.svm,
        &[request_withdraw_ix(
            trader.pubkey(),
            fixture.profile,
            fixture.vault_token,
            fixture.position,
            600_000_000,
        )],
        &trader,
        &[&trader],
    );

    assert!(tx_fails(
        &mut fixture.svm,
        &[request_withdraw_ix(
            trader.pubkey(),
            fixture.profile,
            fixture.vault_token,
            fixture.position,
            401_000_000,
        )],
        &trader,
        &[&trader],
    ));

    let position = read_position(&fixture.svm, &fixture.position);
    assert_eq!(position.pending_withdraw_shares, 600_000_000);
}

#[test]
fn request_withdraw_rejects_zero_and_excess_shares() {
    let mut fixture = setup();
    let trader = fixture.trader.insecure_clone();

    for shares in [0, 1_000_000_001] {
        assert!(tx_fails(
            &mut fixture.svm,
            &[request_withdraw_ix(
                trader.pubkey(),
                fixture.profile,
                fixture.vault_token,
                fixture.position,
                shares,
            )],
            &trader,
            &[&trader],
        ));
    }
}

#[test]
fn request_withdraw_rejects_account_binding_failures() {
    let mut fixture = setup();
    let trader = fixture.trader.insecure_clone();
    let attacker = fixture.attacker.insecure_clone();

    assert!(tx_fails(
        &mut fixture.svm,
        &[request_withdraw_ix(
            attacker.pubkey(),
            fixture.profile,
            fixture.vault_token,
            fixture.position,
            1,
        )],
        &attacker,
        &[&attacker],
    ));

    assert!(tx_fails(
        &mut fixture.svm,
        &[request_withdraw_ix(
            trader.pubkey(),
            fixture.profile,
            fixture.vault_token,
            anchor_lang::prelude::Pubkey::new_unique(),
            1,
        )],
        &trader,
        &[&trader],
    ));

    write_token_mint(&mut fixture.svm, &fixture.vault_token, fixture.wrong_mint);
    assert!(tx_fails(
        &mut fixture.svm,
        &[request_withdraw_ix(
            trader.pubkey(),
            fixture.profile,
            fixture.vault_token,
            fixture.position,
            1,
        )],
        &trader,
        &[&trader],
    ));
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
        println!("  {label:<32} {cu:>8} CUs");
    }
}
