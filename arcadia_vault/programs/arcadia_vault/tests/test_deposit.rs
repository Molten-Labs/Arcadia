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
    trader: Keypair,
    investor: Keypair,
    oracle_authority: Keypair,
    config: anchor_lang::prelude::Pubkey,
    profile: anchor_lang::prelude::Pubkey,
    base_mint: anchor_lang::prelude::Pubkey,
    wrong_mint: anchor_lang::prelude::Pubkey,
    vault_token: anchor_lang::prelude::Pubkey,
    trader_token: anchor_lang::prelude::Pubkey,
    investor_token: anchor_lang::prelude::Pubkey,
    attacker_token: anchor_lang::prelude::Pubkey,
}

fn setup() -> Fixture {
    let program_id = arcadia_vault::id();
    let admin = Keypair::new();
    let trader = Keypair::new();
    let investor = Keypair::new();
    let oracle_authority = Keypair::new();
    let attacker = Keypair::new();
    let treasury_owner = Keypair::new().pubkey();
    let base_mint = anchor_lang::prelude::Pubkey::new_unique();
    let wrong_mint = anchor_lang::prelude::Pubkey::new_unique();
    let treasury_token = anchor_lang::prelude::Pubkey::new_unique();
    let trader_token = anchor_lang::prelude::Pubkey::new_unique();
    let investor_token = anchor_lang::prelude::Pubkey::new_unique();
    let attacker_token = anchor_lang::prelude::Pubkey::new_unique();
    let vault_token = Keypair::new();
    let (config, _) = platform_pda();
    let (profile, _) = profile_pda(&trader.pubkey());

    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/arcadia_vault.so");
    svm.add_program(program_id, bytes).unwrap();
    for signer in [&admin, &trader, &investor, &oracle_authority, &attacker] {
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
        10_000_000_000,
    );
    set_token_account(
        &mut svm,
        investor_token,
        base_mint,
        investor.pubkey(),
        10_000_000_000,
    );
    set_token_account(
        &mut svm,
        attacker_token,
        base_mint,
        attacker.pubkey(),
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

    Fixture {
        svm,
        trader,
        investor,
        oracle_authority,
        config,
        profile,
        base_mint,
        wrong_mint,
        vault_token: vault_token.pubkey(),
        trader_token,
        investor_token,
        attacker_token,
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

fn read_investor(
    svm: &LiteSVM,
    investor_account: &anchor_lang::prelude::Pubkey,
) -> arcadia_vault::InvestorAccount {
    let account = svm
        .get_account(investor_account)
        .expect("investor account exists");
    assert_eq!(account.owner.to_bytes(), arcadia_vault::id().to_bytes());

    let mut data: &[u8] = account.data.as_ref();
    arcadia_vault::InvestorAccount::try_deserialize(&mut data).unwrap()
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

fn read_token_account(svm: &LiteSVM, address: &anchor_lang::prelude::Pubkey) -> TokenAccount {
    let account = svm.get_account(address).expect("token account exists");
    assert_eq!(account.owner.to_bytes(), TOKEN_PROGRAM_ID.to_bytes());
    TokenAccount::unpack(&account.data).unwrap()
}

fn initialize_investor_for(
    fixture: &mut Fixture,
    wallet: &Keypair,
) -> anchor_lang::prelude::Pubkey {
    let (investor_account, _) = investor_pda(&wallet.pubkey());
    send_tx(
        &mut fixture.svm,
        &[initialize_investor_ix(wallet.pubkey(), investor_account)],
        wallet,
        &[wallet],
    );
    investor_account
}

fn trader_self_fund(fixture: &mut Fixture, amount: u64) -> anchor_lang::prelude::Pubkey {
    let trader = fixture.trader.insecure_clone();
    let (trader_investor_account, _) = investor_pda(&trader.pubkey());
    if fixture.svm.get_account(&trader_investor_account).is_none() {
        send_tx(
            &mut fixture.svm,
            &[initialize_investor_ix(
                trader.pubkey(),
                trader_investor_account,
            )],
            &trader,
            &[&trader],
        );
    }
    let (position, _) = position_pda(&trader.pubkey(), &fixture.profile);
    let ix = deposit_ix(
        trader.pubkey(),
        trader_investor_account,
        fixture.profile,
        position,
        fixture.base_mint,
        fixture.vault_token,
        fixture.trader_token,
        amount,
    );
    send_tx(&mut fixture.svm, &[ix], &trader, &[&trader]);
    position
}

fn record_cu(label: &'static str, cu: u64) {
    CU_RESULTS.lock().unwrap().push((label, cu));
}

#[test]
fn deposit_trader_self_fund_first_branch_transfers_and_mints_shares() {
    let mut fixture = setup();
    let trader = fixture.trader.insecure_clone();
    let trader_investor_account = initialize_investor_for(&mut fixture, &trader);
    let (position, position_bump) = position_pda(&trader.pubkey(), &fixture.profile);
    let ix = deposit_ix(
        trader.pubkey(),
        trader_investor_account,
        fixture.profile,
        position,
        fixture.base_mint,
        fixture.vault_token,
        fixture.trader_token,
        5_000_000_000,
    );

    let (cu, logs) = send_tx(&mut fixture.svm, &[ix], &trader, &[&trader]);
    record_cu("deposit:trader_first", cu);
    assert!(logs.iter().any(|log| log.starts_with("Program data: ")));

    let profile = read_profile(&fixture.svm, &fixture.profile);
    assert_eq!(profile.total_shares, 5_000_000_000);
    assert_eq!(profile.trader_shares, 5_000_000_000);

    let position_state = read_position(&fixture.svm, &position);
    assert_eq!(position_state.owner, trader.pubkey());
    assert_eq!(position_state.profile, fixture.profile);
    assert_eq!(position_state.shares, 5_000_000_000);
    assert_eq!(position_state.cost_basis_usd, 5_000_000_000);
    assert_eq!(position_state.pending_withdraw_shares, 0);
    assert_eq!(position_state.withdraw_ready_ts, 0);
    assert_eq!(position_state.bump, position_bump);

    let investor_account = read_investor(&fixture.svm, &trader_investor_account);
    assert_eq!(investor_account.position_count, 1);
    assert_eq!(investor_account.total_deposited_usd, 5_000_000_000);

    assert_eq!(
        read_token_account(&fixture.svm, &fixture.trader_token).amount,
        5_000_000_000
    );
    assert_eq!(
        read_token_account(&fixture.svm, &fixture.vault_token).amount,
        5_000_000_000
    );
}

#[test]
fn deposit_investor_after_nav_gain_uses_floor_and_capacity() {
    let mut fixture = setup();
    let investor = fixture.investor.insecure_clone();
    trader_self_fund(&mut fixture, 5_000_000_000);

    // record_trade is not implemented yet; inject the post-trade token-backed NAV.
    write_token_amount(&mut fixture.svm, &fixture.vault_token, 5_500_000_000);

    let investor_account = initialize_investor_for(&mut fixture, &investor);
    send_tx(
        &mut fixture.svm,
        &[set_capacity_ix(
            fixture.oracle_authority.pubkey(),
            fixture.config,
            fixture.profile,
            7_000_000_000,
            2,
        )],
        &fixture.oracle_authority,
        &[&fixture.oracle_authority],
    );

    let (position, _) = position_pda(&investor.pubkey(), &fixture.profile);
    let ix = deposit_ix(
        investor.pubkey(),
        investor_account,
        fixture.profile,
        position,
        fixture.base_mint,
        fixture.vault_token,
        fixture.investor_token,
        1_100_000_000,
    );

    let (cu, logs) = send_tx(&mut fixture.svm, &[ix], &investor, &[&investor]);
    record_cu("deposit:investor_nav", cu);
    assert!(logs.iter().any(|log| log.starts_with("Program data: ")));

    let profile = read_profile(&fixture.svm, &fixture.profile);
    assert_eq!(profile.total_shares, 6_000_000_000);
    assert_eq!(profile.trader_shares, 5_000_000_000);

    let position_state = read_position(&fixture.svm, &position);
    assert_eq!(position_state.owner, investor.pubkey());
    assert_eq!(position_state.shares, 1_000_000_000);
    assert_eq!(position_state.cost_basis_usd, 1_100_000_000);

    let investor_account_state = read_investor(&fixture.svm, &investor_account);
    assert_eq!(investor_account_state.position_count, 1);
    assert_eq!(investor_account_state.total_deposited_usd, 1_100_000_000);

    assert_eq!(
        read_token_account(&fixture.svm, &fixture.investor_token).amount,
        8_900_000_000
    );
    assert_eq!(
        read_token_account(&fixture.svm, &fixture.vault_token).amount,
        6_600_000_000
    );
}

#[test]
fn deposit_existing_position_accumulates_without_incrementing_position_count() {
    let mut fixture = setup();
    let trader = fixture.trader.insecure_clone();
    let trader_investor_account = initialize_investor_for(&mut fixture, &trader);
    let (position, _) = position_pda(&trader.pubkey(), &fixture.profile);

    for amount in [1_000_000_000, 250_000_000] {
        let ix = deposit_ix(
            trader.pubkey(),
            trader_investor_account,
            fixture.profile,
            position,
            fixture.base_mint,
            fixture.vault_token,
            fixture.trader_token,
            amount,
        );
        send_tx(&mut fixture.svm, &[ix], &trader, &[&trader]);
    }

    let position_state = read_position(&fixture.svm, &position);
    assert_eq!(position_state.shares, 1_250_000_000);
    assert_eq!(position_state.cost_basis_usd, 1_250_000_000);

    let investor_account = read_investor(&fixture.svm, &trader_investor_account);
    assert_eq!(investor_account.position_count, 1);
    assert_eq!(investor_account.total_deposited_usd, 1_250_000_000);
}

#[test]
fn deposit_rejects_zero_amount_over_balance_and_inactive_profile() {
    let mut fixture = setup();
    let trader = fixture.trader.insecure_clone();
    let trader_investor_account = initialize_investor_for(&mut fixture, &trader);
    let (position, _) = position_pda(&trader.pubkey(), &fixture.profile);

    assert!(tx_fails(
        &mut fixture.svm,
        &[deposit_ix(
            trader.pubkey(),
            trader_investor_account,
            fixture.profile,
            position,
            fixture.base_mint,
            fixture.vault_token,
            fixture.trader_token,
            0,
        )],
        &trader,
        &[&trader],
    ));

    assert!(tx_fails(
        &mut fixture.svm,
        &[deposit_ix(
            trader.pubkey(),
            trader_investor_account,
            fixture.profile,
            position,
            fixture.base_mint,
            fixture.vault_token,
            fixture.trader_token,
            10_000_000_001,
        )],
        &trader,
        &[&trader],
    ));

    let mut profile = read_profile(&fixture.svm, &fixture.profile);
    profile.status = arcadia_vault::PROFILE_STATUS_CLOSED;
    write_profile(&mut fixture.svm, fixture.profile, &profile);

    assert!(tx_fails(
        &mut fixture.svm,
        &[deposit_ix(
            trader.pubkey(),
            trader_investor_account,
            fixture.profile,
            position,
            fixture.base_mint,
            fixture.vault_token,
            fixture.trader_token,
            1,
        )],
        &trader,
        &[&trader],
    ));
}

#[test]
fn deposit_rejects_capacity_failures_and_empty_vault_investor() {
    let mut fixture = setup();
    let investor = fixture.investor.insecure_clone();
    let investor_account = initialize_investor_for(&mut fixture, &investor);
    let (position, _) = position_pda(&investor.pubkey(), &fixture.profile);

    assert!(tx_fails(
        &mut fixture.svm,
        &[deposit_ix(
            investor.pubkey(),
            investor_account,
            fixture.profile,
            position,
            fixture.base_mint,
            fixture.vault_token,
            fixture.investor_token,
            1_000_000,
        )],
        &investor,
        &[&investor],
    ));

    send_tx(
        &mut fixture.svm,
        &[set_capacity_ix(
            fixture.oracle_authority.pubkey(),
            fixture.config,
            fixture.profile,
            10_000_000_000,
            2,
        )],
        &fixture.oracle_authority,
        &[&fixture.oracle_authority],
    );

    assert!(tx_fails(
        &mut fixture.svm,
        &[deposit_ix(
            investor.pubkey(),
            investor_account,
            fixture.profile,
            position,
            fixture.base_mint,
            fixture.vault_token,
            fixture.investor_token,
            1_000_000,
        )],
        &investor,
        &[&investor],
    ));

    trader_self_fund(&mut fixture, 5_000_000_000);

    send_tx(
        &mut fixture.svm,
        &[set_capacity_ix(
            fixture.oracle_authority.pubkey(),
            fixture.config,
            fixture.profile,
            5_500_000_000,
            2,
        )],
        &fixture.oracle_authority,
        &[&fixture.oracle_authority],
    );

    assert!(tx_fails(
        &mut fixture.svm,
        &[deposit_ix(
            investor.pubkey(),
            investor_account,
            fixture.profile,
            position,
            fixture.base_mint,
            fixture.vault_token,
            fixture.investor_token,
            600_000_001,
        )],
        &investor,
        &[&investor],
    ));
}

#[test]
fn deposit_rejects_account_binding_failures() {
    let mut fixture = setup();
    let trader = fixture.trader.insecure_clone();
    let investor = fixture.investor.insecure_clone();
    let trader_account = initialize_investor_for(&mut fixture, &trader);
    let investor_account = initialize_investor_for(&mut fixture, &investor);
    let (investor_position, _) = position_pda(&investor.pubkey(), &fixture.profile);

    send_tx(
        &mut fixture.svm,
        &[set_capacity_ix(
            fixture.oracle_authority.pubkey(),
            fixture.config,
            fixture.profile,
            10_000_000_000,
            2,
        )],
        &fixture.oracle_authority,
        &[&fixture.oracle_authority],
    );
    trader_self_fund(&mut fixture, 1_000_000_000);

    assert!(tx_fails(
        &mut fixture.svm,
        &[deposit_ix(
            investor.pubkey(),
            trader_account,
            fixture.profile,
            investor_position,
            fixture.base_mint,
            fixture.vault_token,
            fixture.investor_token,
            1_000_000,
        )],
        &investor,
        &[&investor],
    ));

    assert!(tx_fails(
        &mut fixture.svm,
        &[deposit_ix(
            investor.pubkey(),
            investor_account,
            fixture.profile,
            anchor_lang::prelude::Pubkey::new_unique(),
            fixture.base_mint,
            fixture.vault_token,
            fixture.investor_token,
            1_000_000,
        )],
        &investor,
        &[&investor],
    ));

    assert!(tx_fails(
        &mut fixture.svm,
        &[deposit_ix(
            investor.pubkey(),
            investor_account,
            fixture.profile,
            investor_position,
            fixture.base_mint,
            fixture.vault_token,
            fixture.attacker_token,
            1_000_000,
        )],
        &investor,
        &[&investor],
    ));

    let wrong_mint_token = anchor_lang::prelude::Pubkey::new_unique();
    set_token_account(
        &mut fixture.svm,
        wrong_mint_token,
        fixture.wrong_mint,
        investor.pubkey(),
        1_000_000,
    );
    assert!(tx_fails(
        &mut fixture.svm,
        &[deposit_ix(
            investor.pubkey(),
            investor_account,
            fixture.profile,
            investor_position,
            fixture.base_mint,
            fixture.vault_token,
            wrong_mint_token,
            1_000_000,
        )],
        &investor,
        &[&investor],
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
        println!("  {label:<24} {cu:>8} CUs");
    }
}
