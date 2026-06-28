use {
    anchor_lang::{
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_native_token::LAMPORTS_PER_SOL,
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    std::sync::Mutex,
};

static CU_RESULTS: Mutex<Vec<(&'static str, u64)>> = Mutex::new(Vec::new());

fn setup() -> (LiteSVM, Keypair) {
    let program_id = arcadia_vault::id();
    let wallet = Keypair::new();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/arcadia_vault.so");

    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&wallet.pubkey(), LAMPORTS_PER_SOL).unwrap();

    (svm, wallet)
}

fn investor_pda(wallet: &anchor_lang::prelude::Pubkey) -> (anchor_lang::prelude::Pubkey, u8) {
    anchor_lang::prelude::Pubkey::find_program_address(
        &[arcadia_vault::INVESTOR_SEED, wallet.as_ref()],
        &arcadia_vault::id(),
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

fn record_cu(label: &'static str, cu: u64) {
    CU_RESULTS.lock().unwrap().push((label, cu));
}

#[test]
fn initialize_investor_happy_path() {
    let (mut svm, wallet) = setup();
    let (investor_account, bump) = investor_pda(&wallet.pubkey());
    let ix = initialize_investor_ix(wallet.pubkey(), investor_account);

    let (cu, logs) = send_tx(&mut svm, &[ix], &wallet, &[&wallet]);
    record_cu("initialize_investor", cu);
    assert!(logs.iter().any(|log| log.starts_with("Program data: ")));

    let account = read_investor(&svm, &investor_account);
    assert_eq!(account.owner, wallet.pubkey());
    assert_eq!(account.position_count, 0);
    assert_eq!(account.total_deposited_usd, 0);
    assert_eq!(account.bump, bump);
}

#[test]
fn initialize_investor_reinit_fails() {
    let (mut svm, wallet) = setup();
    let (investor_account, _) = investor_pda(&wallet.pubkey());
    let ix = initialize_investor_ix(wallet.pubkey(), investor_account);

    send_tx(&mut svm, &[ix.clone()], &wallet, &[&wallet]);

    assert!(tx_fails(&mut svm, &[ix], &wallet, &[&wallet]));
}

#[test]
fn initialize_investor_rejects_wrong_pda() {
    let (mut svm, wallet) = setup();
    let wrong_investor_account = anchor_lang::prelude::Pubkey::new_unique();
    let ix = initialize_investor_ix(wallet.pubkey(), wrong_investor_account);

    assert!(tx_fails(&mut svm, &[ix], &wallet, &[&wallet]));
    assert!(svm.get_account(&wrong_investor_account).is_none());
}

#[test]
fn initialize_investor_allows_distinct_wallets() {
    let (mut svm, first_wallet) = setup();
    let second_wallet = Keypair::new();
    svm.airdrop(&second_wallet.pubkey(), LAMPORTS_PER_SOL)
        .unwrap();

    let (first_account, _) = investor_pda(&first_wallet.pubkey());
    let (second_account, _) = investor_pda(&second_wallet.pubkey());

    send_tx(
        &mut svm,
        &[initialize_investor_ix(first_wallet.pubkey(), first_account)],
        &first_wallet,
        &[&first_wallet],
    );
    send_tx(
        &mut svm,
        &[initialize_investor_ix(
            second_wallet.pubkey(),
            second_account,
        )],
        &second_wallet,
        &[&second_wallet],
    );

    let first = read_investor(&svm, &first_account);
    let second = read_investor(&svm, &second_account);
    assert_eq!(first.owner, first_wallet.pubkey());
    assert_eq!(second.owner, second_wallet.pubkey());
    assert_ne!(first_account, second_account);
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
