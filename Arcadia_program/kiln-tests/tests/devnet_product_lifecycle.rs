use std::{env, fs, path::PathBuf};

use litesvm::{types::TransactionResult, LiteSVM};
use litesvm_token::{CreateAccount, CreateMint, MintTo, TOKEN_ID};
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
        custody::{
            PRICE_FEED_SEED, PRICE_FEED_SOL_USD, PRICE_FEED_USDC_USD, PRICE_MAGIC, PRICE_SCALE,
            TOKEN_ACCOUNT_AMOUNT_OFFSET, TOKEN_ACCOUNT_MINT_OFFSET, TOKEN_ACCOUNT_OWNER_OFFSET,
            USDC_DECIMALS, USDC_MINT, WSOL_DECIMALS, WSOL_MINT,
        },
        CreateVaultArgs, DepositJuniorArgs, DepositSeniorArgs, WithdrawJuniorArgs,
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

fn price_feed_pda(feed: u8) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[PRICE_FEED_SEED, &[feed]], &program_id())
}

fn update_oracle_price_ix(payer: &Keypair, feed: u8, price: u64, confidence: u64) -> Instruction {
    let (price_account, _) = price_feed_pda(feed);
    let mut data = vec![10, feed];
    data.extend_from_slice(&price.to_le_bytes());
    data.extend_from_slice(&confidence.to_le_bytes());

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(payer.pubkey(), true),
            AccountMeta::new(price_account, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    }
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

fn deposit_junior_usdc_ix(
    manager: &Keypair,
    vault_index: u16,
    manager_usdc: Pubkey,
    vault_usdc: Pubkey,
    amount: u64,
) -> Instruction {
    let (manager_profile, _) = manager_profile_pda(&manager.pubkey());
    let (vault_config, _) = vault_config_pda(&manager.pubkey(), vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let (treasury, _) = treasury_pda(&vault_config);

    let mut data = vec![2];
    data.extend_from_slice(&to_bytes(&DepositJuniorArgs {
        amount_lamports: amount,
    }));

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(manager.pubkey(), true),
            AccountMeta::new(manager_profile, false),
            AccountMeta::new_readonly(vault_config, false),
            AccountMeta::new(vault_state, false),
            AccountMeta::new_readonly(treasury, false),
            AccountMeta::new(manager_usdc, false),
            AccountMeta::new(vault_usdc, false),
            AccountMeta::new_readonly(TOKEN_ID, false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    }
}

fn deposit_senior_usdc_ix(
    investor: &Keypair,
    manager: &Keypair,
    vault_index: u16,
    investor_usdc: Pubkey,
    vault_usdc: Pubkey,
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
            AccountMeta::new_readonly(treasury, false),
            AccountMeta::new(investor_position, false),
            AccountMeta::new(investor_usdc, false),
            AccountMeta::new(vault_usdc, false),
            AccountMeta::new_readonly(TOKEN_ID, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
        data,
    }
}

#[allow(clippy::too_many_arguments)]
fn withdraw_senior_usdc_ix(
    investor: &Keypair,
    manager: &Keypair,
    vault_index: u16,
    vault_usdc: Pubkey,
    vault_wsol: Pubkey,
    investor_usdc: Pubkey,
    sol_price: Pubkey,
    usdc_price: Pubkey,
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
            AccountMeta::new_readonly(investor.pubkey(), true),
            AccountMeta::new_readonly(vault_config, false),
            AccountMeta::new(vault_state, false),
            AccountMeta::new_readonly(treasury, false),
            AccountMeta::new(investor_position, false),
            AccountMeta::new(vault_usdc, false),
            AccountMeta::new(vault_wsol, false),
            AccountMeta::new(investor_usdc, false),
            AccountMeta::new_readonly(sol_price, false),
            AccountMeta::new_readonly(usdc_price, false),
            AccountMeta::new_readonly(TOKEN_ID, false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
        ],
        data,
    }
}

fn withdraw_junior_usdc_ix(
    manager: &Keypair,
    vault_index: u16,
    vault_usdc: Pubkey,
    manager_usdc: Pubkey,
    amount: u64,
) -> Instruction {
    let (manager_profile, _) = manager_profile_pda(&manager.pubkey());
    let (vault_config, _) = vault_config_pda(&manager.pubkey(), vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let (treasury, _) = treasury_pda(&vault_config);

    let mut data = vec![7];
    data.extend_from_slice(&to_bytes(&WithdrawJuniorArgs {
        amount_usdc: amount,
    }));

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new_readonly(manager.pubkey(), true),
            AccountMeta::new(manager_profile, false),
            AccountMeta::new_readonly(vault_config, false),
            AccountMeta::new(vault_state, false),
            AccountMeta::new_readonly(treasury, false),
            AccountMeta::new(vault_usdc, false),
            AccountMeta::new(manager_usdc, false),
            AccountMeta::new_readonly(TOKEN_ID, false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
        ],
        data,
    }
}

fn update_nav_usdc_wsol_ix(
    caller: &Keypair,
    manager: &Keypair,
    vault_index: u16,
    vault_usdc: Pubkey,
    vault_wsol: Pubkey,
    sol_price: Pubkey,
    usdc_price: Pubkey,
) -> Instruction {
    let (vault_config, _) = vault_config_pda(&manager.pubkey(), vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let (treasury, _) = treasury_pda(&vault_config);

    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new_readonly(caller.pubkey(), true),
            AccountMeta::new_readonly(vault_config, false),
            AccountMeta::new(vault_state, false),
            AccountMeta::new_readonly(treasury, false),
            AccountMeta::new(vault_usdc, false),
            AccountMeta::new(vault_wsol, false),
            AccountMeta::new_readonly(sol_price, false),
            AccountMeta::new_readonly(usdc_price, false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
        ],
        data: vec![3, 0],
    }
}

fn graduate_vault_ix(caller: &Keypair, manager: &Keypair, vault_index: u16) -> Instruction {
    let (manager_profile, _) = manager_profile_pda(&manager.pubkey());
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

fn create_args(name: &[u8], paper_window_secs: i64, min_qualifying_trades: u16) -> CreateVaultArgs {
    let mut fixed_name = [0_u8; 32];
    fixed_name[..name.len()].copy_from_slice(name);
    CreateVaultArgs {
        paper_window_secs,
        min_qualifying_trades,
        max_slippage_bps: 200,
        manager_fee_bps: 2_000,
        _reserved: [0; 2],
        name: fixed_name,
    }
}

fn usdc(whole: u64) -> u64 {
    whole.checked_mul(USDC_DECIMALS).expect("usdc overflow")
}

fn wsol(whole: u64) -> u64 {
    whole.checked_mul(WSOL_DECIMALS).expect("wsol overflow")
}

fn usdc_mint() -> Pubkey {
    Pubkey::new_from_array(USDC_MINT)
}

fn wsol_mint() -> Pubkey {
    Pubkey::new_from_array(WSOL_MINT)
}

fn token_amount(svm: &LiteSVM, account: &Pubkey) -> u64 {
    let account = svm.get_account(account).expect("token account missing");
    u64::from_le_bytes(
        account.data[TOKEN_ACCOUNT_AMOUNT_OFFSET..TOKEN_ACCOUNT_AMOUNT_OFFSET + 8]
            .try_into()
            .expect("amount bytes"),
    )
}

fn rewrite_token_account(
    svm: &mut LiteSVM,
    account: &Pubkey,
    mint: Pubkey,
    owner: Pubkey,
    amount: u64,
) {
    let mut account_data = svm.get_account(account).expect("token account missing");
    account_data.data[TOKEN_ACCOUNT_MINT_OFFSET..TOKEN_ACCOUNT_MINT_OFFSET + 32]
        .copy_from_slice(&mint.to_bytes());
    account_data.data[TOKEN_ACCOUNT_OWNER_OFFSET..TOKEN_ACCOUNT_OWNER_OFFSET + 32]
        .copy_from_slice(&owner.to_bytes());
    account_data.data[TOKEN_ACCOUNT_AMOUNT_OFFSET..TOKEN_ACCOUNT_AMOUNT_OFFSET + 8]
        .copy_from_slice(&amount.to_le_bytes());
    svm.set_account(*account, account_data)
        .expect("set token account");
}

fn set_token_amount(svm: &mut LiteSVM, account: &Pubkey, amount: u64) {
    let mut account_data = svm.get_account(account).expect("token account missing");
    account_data.data[TOKEN_ACCOUNT_AMOUNT_OFFSET..TOKEN_ACCOUNT_AMOUNT_OFFSET + 8]
        .copy_from_slice(&amount.to_le_bytes());
    svm.set_account(*account, account_data)
        .expect("set token amount");
}

fn create_token_account(
    svm: &mut LiteSVM,
    payer: &Keypair,
    dummy_mint: &Pubkey,
    owner: &Pubkey,
    mint: Pubkey,
    amount: u64,
) -> Pubkey {
    let account = CreateAccount::new(svm, payer, dummy_mint)
        .owner(owner)
        .send()
        .expect("create token account");
    if amount > 0 {
        MintTo::new(svm, payer, dummy_mint, &account, amount)
            .send()
            .expect("mint fixture balance");
    }
    rewrite_token_account(svm, &account, mint, *owner, amount);
    account
}

fn write_price_account(svm: &mut LiteSVM, account: Pubkey, feed: u8, price: u64, now: i64) {
    let mut data = vec![0_u8; 40];
    data[0..8].copy_from_slice(PRICE_MAGIC);
    data[8] = feed;
    data[16..24].copy_from_slice(&(price as i64).to_le_bytes());
    data[24..32].copy_from_slice(&(price / 100).to_le_bytes());
    data[32..40].copy_from_slice(&now.to_le_bytes());

    let mut account_data = svm.get_account(&account).expect("price account missing");
    account_data.owner = program_id();
    account_data.data = data;
    svm.set_account(account, account_data)
        .expect("set price account");
}

fn create_price_account(svm: &mut LiteSVM, feed: u8, price: u64, now: i64) -> Pubkey {
    let account = Keypair::new().pubkey();
    svm.airdrop(&account, LAMPORTS_PER_SOL)
        .expect("airdrop price account");
    write_price_account(svm, account, feed, price, now);
    account
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

fn force_proof_mode_success(
    svm: &mut LiteSVM,
    manager: &Pubkey,
    vault_index: u16,
    vault_usdc: &Pubkey,
    nav: u64,
) {
    let (vault_config, _) = vault_config_pda(manager, vault_index);
    let (vault_state, _) = vault_state_pda(&vault_config);
    let mut account = svm.get_account(&vault_state).expect("vault state missing");
    let state = bytemuck::from_bytes_mut::<VaultState>(&mut account.data);
    state.paper_trade_count = state.min_qualifying_trades;
    state.current_nav = nav;
    state.last_nav = nav;
    svm.set_account(vault_state, account)
        .expect("set proof state");
    set_token_amount(svm, vault_usdc, nav);
}

#[test]
fn devnet_oracle_adapter_upserts_owned_price_accounts() {
    let (mut svm, payer) = setup();
    set_unix_time(&mut svm, 1234);

    send_tx(
        &mut svm,
        &payer,
        &[],
        update_oracle_price_ix(
            &payer,
            PRICE_FEED_SOL_USD,
            150 * PRICE_SCALE,
            PRICE_SCALE / 100,
        ),
    )
    .expect("upsert sol price");
    send_tx(
        &mut svm,
        &payer,
        &[],
        update_oracle_price_ix(&payer, PRICE_FEED_USDC_USD, PRICE_SCALE, PRICE_SCALE / 100),
    )
    .expect("upsert usdc price");

    let (sol_price, _) = price_feed_pda(PRICE_FEED_SOL_USD);
    let (usdc_price, _) = price_feed_pda(PRICE_FEED_USDC_USD);
    let sol_account = svm.get_account(&sol_price).expect("sol price account");
    let usdc_account = svm.get_account(&usdc_price).expect("usdc price account");
    assert_eq!(sol_account.owner, program_id());
    assert_eq!(&sol_account.data[0..8], PRICE_MAGIC);
    assert_eq!(sol_account.data[8], PRICE_FEED_SOL_USD);
    assert_eq!(usdc_account.owner, program_id());
    assert_eq!(&usdc_account.data[0..8], PRICE_MAGIC);
    assert_eq!(usdc_account.data[8], PRICE_FEED_USDC_USD);
}

#[test]
fn devnet_usdc_wsol_lifecycle_proves_product_invariants() {
    let (mut svm, manager) = setup();
    let investor = Keypair::new();
    let keeper = Keypair::new();
    svm.airdrop(&investor.pubkey(), 10 * LAMPORTS_PER_SOL)
        .expect("airdrop investor");
    svm.airdrop(&keeper.pubkey(), 10 * LAMPORTS_PER_SOL)
        .expect("airdrop keeper");

    let vault_index = 0;
    let now = 1_000;
    set_unix_time(&mut svm, now);

    send_tx(&mut svm, &manager, &[], init_manager_ix(&manager)).expect("init manager");
    send_tx(
        &mut svm,
        &manager,
        &[],
        create_vault_ix(&manager, vault_index, create_args(b"DevnetUSDC", 10, 2)),
    )
    .expect("create vault");

    let (vault_config, _) = vault_config_pda(&manager.pubkey(), vault_index);
    let (treasury, _) = treasury_pda(&vault_config);

    let dummy_mint = CreateMint::new(&mut svm, &manager)
        .decimals(6)
        .send()
        .expect("create dummy mint");
    let manager_usdc = create_token_account(
        &mut svm,
        &manager,
        &dummy_mint,
        &manager.pubkey(),
        usdc_mint(),
        usdc(25_000),
    );
    let investor_usdc = create_token_account(
        &mut svm,
        &manager,
        &dummy_mint,
        &investor.pubkey(),
        usdc_mint(),
        usdc(80_000),
    );
    let vault_usdc =
        create_token_account(&mut svm, &manager, &dummy_mint, &treasury, usdc_mint(), 0);
    let vault_wsol =
        create_token_account(&mut svm, &manager, &dummy_mint, &treasury, wsol_mint(), 0);
    let sol_price = create_price_account(&mut svm, PRICE_FEED_SOL_USD, 150 * PRICE_SCALE, now);
    let usdc_price = create_price_account(&mut svm, PRICE_FEED_USDC_USD, PRICE_SCALE, now);

    let junior_deposit = usdc(20_000);
    send_tx(
        &mut svm,
        &manager,
        &[],
        deposit_junior_usdc_ix(
            &manager,
            vault_index,
            manager_usdc,
            vault_usdc,
            junior_deposit,
        ),
    )
    .expect("junior USDC deposit");
    let state = vault_state_for(&svm, &manager.pubkey(), vault_index);
    assert_eq!(state.junior_capital, junior_deposit);
    assert_eq!(state.junior_shares_outstanding, junior_deposit);
    assert_eq!(state.current_nav, junior_deposit);
    assert_eq!(state.high_water_mark, junior_deposit);
    assert_eq!(token_amount(&svm, &vault_usdc), junior_deposit);

    assert!(
        send_tx(
            &mut svm,
            &investor,
            &[],
            deposit_senior_usdc_ix(
                &investor,
                &manager,
                vault_index,
                investor_usdc,
                vault_usdc,
                usdc(80_000),
            ),
        )
        .is_err(),
        "investor deposits must stay closed until the trader proves performance"
    );

    let proof_nav = usdc(22_000);
    force_proof_mode_success(
        &mut svm,
        &manager.pubkey(),
        vault_index,
        &vault_usdc,
        proof_nav,
    );
    set_unix_time(&mut svm, 1_020);
    send_tx(
        &mut svm,
        &keeper,
        &[],
        graduate_vault_ix(&keeper, &manager, vault_index),
    )
    .expect("graduate proven vault");
    let state = vault_state_for(&svm, &manager.pubkey(), vault_index);
    assert_eq!(state.is_paper_mode, 0);
    assert_eq!(state.is_graduated, 1);

    send_tx(
        &mut svm,
        &manager,
        &[],
        claim_fees_ix(&manager, vault_index),
    )
    .expect("claim paper performance fee");
    let state = vault_state_for(&svm, &manager.pubkey(), vault_index);
    assert_eq!(state.high_water_mark, proof_nav);
    assert_eq!(state.junior_capital, usdc(19_600));

    let senior_deposit = usdc(80_000);
    send_tx(
        &mut svm,
        &investor,
        &[],
        deposit_senior_usdc_ix(
            &investor,
            &manager,
            vault_index,
            investor_usdc,
            vault_usdc,
            senior_deposit,
        ),
    )
    .expect("senior USDC deposit after graduation");
    let state = vault_state_for(&svm, &manager.pubkey(), vault_index);
    assert_eq!(state.senior_capital, senior_deposit);
    assert_eq!(state.senior_shares_outstanding, senior_deposit);
    assert_eq!(state.current_nav, usdc(102_000));
    assert_eq!(
        state.high_water_mark,
        usdc(102_000),
        "capital inflows must not become manager performance fees"
    );
    let position = investor_position_for(&svm, &investor.pubkey(), &vault_config);
    assert_eq!(position.senior_shares, senior_deposit);
    assert_eq!(position.total_deposited, senior_deposit);

    assert!(
        send_tx(
            &mut svm,
            &manager,
            &[],
            withdraw_junior_usdc_ix(
                &manager,
                vault_index,
                vault_usdc,
                manager_usdc,
                usdc(15_000),
            ),
        )
        .is_err(),
        "trader cannot pull buffer if investor protection ratio would break"
    );
    send_tx(
        &mut svm,
        &manager,
        &[],
        withdraw_junior_usdc_ix(&manager, vault_index, vault_usdc, manager_usdc, usdc(1_000)),
    )
    .expect("small trader withdrawal keeps the junior ratio valid");
    let state = vault_state_for(&svm, &manager.pubkey(), vault_index);
    assert_eq!(state.junior_capital, usdc(18_600));
    assert_eq!(state.current_nav, usdc(101_000));
    assert_eq!(state.high_water_mark, usdc(101_000));

    // Surfpool/Jupiter preview equivalent: the quote says to move 30k USDC
    // into 200 SOL at 150 USDC/SOL. LiteSVM applies the custody token movement
    // deterministically, then the program recomputes NAV from fresh price feeds.
    set_token_amount(&mut svm, &vault_usdc, usdc(71_000));
    set_token_amount(&mut svm, &vault_wsol, wsol(200));
    send_tx(
        &mut svm,
        &keeper,
        &[],
        update_nav_usdc_wsol_ix(
            &keeper,
            &manager,
            vault_index,
            vault_usdc,
            vault_wsol,
            sol_price,
            usdc_price,
        ),
    )
    .expect("zero-PnL USDC/WSOL NAV update");
    let state = vault_state_for(&svm, &manager.pubkey(), vault_index);
    assert_eq!(state.current_nav, usdc(101_000));
    assert_eq!(state.senior_capital, senior_deposit);
    assert_eq!(state.junior_capital, usdc(18_600));

    write_price_account(&mut svm, sol_price, PRICE_FEED_SOL_USD, 157_500_000, 1_020);
    send_tx(
        &mut svm,
        &keeper,
        &[],
        update_nav_usdc_wsol_ix(
            &keeper,
            &manager,
            vault_index,
            vault_usdc,
            vault_wsol,
            sol_price,
            usdc_price,
        ),
    )
    .expect("profit NAV update");
    let state = vault_state_for(&svm, &manager.pubkey(), vault_index);
    assert_eq!(state.current_nav, usdc(102_500));
    assert_eq!(state.high_water_mark, usdc(101_000));

    send_tx(
        &mut svm,
        &manager,
        &[],
        claim_fees_ix(&manager, vault_index),
    )
    .expect("claim performance fee after market profit");
    let state = vault_state_for(&svm, &manager.pubkey(), vault_index);
    assert_eq!(state.high_water_mark, usdc(102_500));
    assert_eq!(state.junior_capital, usdc(18_300));

    set_unix_time(&mut svm, 90_000);
    write_price_account(&mut svm, sol_price, PRICE_FEED_SOL_USD, 157_500_000, 90_000);
    write_price_account(
        &mut svm,
        usdc_price,
        PRICE_FEED_USDC_USD,
        PRICE_SCALE,
        90_000,
    );
    assert!(
        send_tx(
            &mut svm,
            &investor,
            &[],
            withdraw_senior_usdc_ix(
                &investor,
                &manager,
                vault_index,
                vault_usdc,
                vault_wsol,
                investor_usdc,
                sol_price,
                usdc_price,
                senior_deposit,
            ),
        )
        .is_err(),
        "short USDC liquidity must fail without Jupiter/auto-unwind and keep principal untouched"
    );
    let position = investor_position_for(&svm, &investor.pubkey(), &vault_config);
    assert_eq!(position.senior_shares, senior_deposit);
    assert_eq!(token_amount(&svm, &investor_usdc), 0);
    let state = vault_state_for(&svm, &manager.pubkey(), vault_index);
    assert_eq!(state.senior_capital, senior_deposit);
    assert_eq!(state.senior_shares_outstanding, senior_deposit);
    assert_eq!(token_amount(&svm, &vault_usdc), usdc(71_000));
    assert_eq!(token_amount(&svm, &vault_wsol), wsol(200));

    send_tx(
        &mut svm,
        &investor,
        &[],
        withdraw_senior_usdc_ix(
            &investor,
            &manager,
            vault_index,
            vault_usdc,
            vault_wsol,
            investor_usdc,
            sol_price,
            usdc_price,
            usdc(10_000),
        ),
    )
    .expect("investor direct liquid withdrawal");
    let state = vault_state_for(&svm, &manager.pubkey(), vault_index);
    assert_eq!(state.senior_capital, usdc(70_000));
    assert_eq!(state.senior_shares_outstanding, usdc(70_000));
    assert_eq!(state.current_nav, usdc(92_500));
    assert_eq!(state.high_water_mark, usdc(92_500));
    let position = investor_position_for(&svm, &investor.pubkey(), &vault_config);
    assert_eq!(position.senior_shares, usdc(70_000));
    assert_eq!(token_amount(&svm, &investor_usdc), usdc(10_000));

    write_price_account(&mut svm, sol_price, PRICE_FEED_SOL_USD, 127_500_000, 90_000);
    write_price_account(
        &mut svm,
        usdc_price,
        PRICE_FEED_USDC_USD,
        PRICE_SCALE,
        90_000,
    );
    send_tx(
        &mut svm,
        &keeper,
        &[],
        update_nav_usdc_wsol_ix(
            &keeper,
            &manager,
            vault_index,
            vault_usdc,
            vault_wsol,
            sol_price,
            usdc_price,
        ),
    )
    .expect("caution loss update");
    let state = vault_state_for(&svm, &manager.pubkey(), vault_index);
    assert_eq!(state.current_nav, usdc(86_500));
    assert_eq!(
        state.junior_capital,
        usdc(12_300),
        "first loss must hit trader junior capital"
    );
    assert_eq!(state.senior_capital, usdc(70_000));
    assert_eq!(state.trading_enabled, 1);

    write_price_account(
        &mut svm,
        sol_price,
        PRICE_FEED_SOL_USD,
        20 * PRICE_SCALE,
        90_000,
    );
    write_price_account(
        &mut svm,
        usdc_price,
        PRICE_FEED_USDC_USD,
        PRICE_SCALE,
        90_000,
    );
    send_tx(
        &mut svm,
        &keeper,
        &[],
        update_nav_usdc_wsol_ix(
            &keeper,
            &manager,
            vault_index,
            vault_usdc,
            vault_wsol,
            sol_price,
            usdc_price,
        ),
    )
    .expect("freeze loss update");
    let state = vault_state_for(&svm, &manager.pubkey(), vault_index);
    assert_eq!(state.current_nav, usdc(65_000));
    assert_eq!(state.junior_capital, 0);
    assert_eq!(state.senior_capital, usdc(60_800));
    assert_eq!(state.trading_enabled, 0);

    assert!(
        send_tx(
            &mut svm,
            &manager,
            &[],
            withdraw_junior_usdc_ix(&manager, vault_index, vault_usdc, manager_usdc, usdc(1),),
        )
        .is_err(),
        "frozen vault with depleted junior buffer blocks trader withdrawal"
    );

    send_tx(
        &mut svm,
        &investor,
        &[],
        withdraw_senior_usdc_ix(
            &investor,
            &manager,
            vault_index,
            vault_usdc,
            vault_wsol,
            investor_usdc,
            sol_price,
            usdc_price,
            usdc(60_800),
        ),
    )
    .expect("investor exits remaining scaled claim after freeze");
    let state = vault_state_for(&svm, &manager.pubkey(), vault_index);
    assert_eq!(state.senior_capital, 0);
    assert_eq!(state.senior_shares_outstanding, 0);
    let position = investor_position_for(&svm, &investor.pubkey(), &vault_config);
    assert_eq!(position.senior_shares, 0);
    assert_eq!(token_amount(&svm, &investor_usdc), usdc(70_800));
}
