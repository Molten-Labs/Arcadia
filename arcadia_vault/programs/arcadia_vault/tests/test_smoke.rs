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
    let payer = Keypair::new();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!("../../../target/deploy/arcadia_vault.so");

    svm.add_program(program_id, bytes).unwrap();
    svm.airdrop(&payer.pubkey(), LAMPORTS_PER_SOL).unwrap();

    (svm, payer)
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

fn smoke_pda(authority: &anchor_lang::prelude::Pubkey) -> anchor_lang::prelude::Pubkey {
    anchor_lang::prelude::Pubkey::find_program_address(
        &[arcadia_vault::SMOKE_SEED, authority.as_ref()],
        &arcadia_vault::id(),
    )
    .0
}

fn initialize_smoke_ix(
    authority: anchor_lang::prelude::Pubkey,
    smoke_state: anchor_lang::prelude::Pubkey,
    message: &str,
) -> Instruction {
    Instruction::new_with_bytes(
        arcadia_vault::id(),
        &arcadia_vault::instruction::InitializeSmoke {
            message: message.to_string(),
        }
        .data(),
        arcadia_vault::accounts::InitializeSmoke {
            authority,
            smoke_state,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn ping_ix(
    authority: anchor_lang::prelude::Pubkey,
    smoke_state: anchor_lang::prelude::Pubkey,
    message: &str,
) -> Instruction {
    Instruction::new_with_bytes(
        arcadia_vault::id(),
        &arcadia_vault::instruction::Ping {
            message: message.to_string(),
        }
        .data(),
        arcadia_vault::accounts::Ping {
            authority,
            smoke_state,
        }
        .to_account_metas(None),
    )
}

fn read_smoke_state(
    svm: &LiteSVM,
    smoke_state: &anchor_lang::prelude::Pubkey,
) -> arcadia_vault::SmokeState {
    let account = svm.get_account(smoke_state).expect("smoke account exists");
    assert_eq!(account.owner.to_bytes(), arcadia_vault::id().to_bytes());

    let mut data: &[u8] = account.data.as_ref();
    arcadia_vault::SmokeState::try_deserialize(&mut data).unwrap()
}

fn record_cu(label: &'static str, cu: u64) {
    CU_RESULTS.lock().unwrap().push((label, cu));
}

#[test]
fn smoke_state_round_trip() {
    let (mut svm, payer) = setup();
    let smoke_state = smoke_pda(&payer.pubkey());

    let init_cu = send_tx(
        &mut svm,
        &[initialize_smoke_ix(payer.pubkey(), smoke_state, "hello")],
        &payer,
        &[&payer],
    );
    record_cu("initialize_smoke", init_cu);

    let state = read_smoke_state(&svm, &smoke_state);
    assert_eq!(state.authority, payer.pubkey());
    assert_eq!(state.count, 0);
    assert_eq!(state.message, "hello");

    let ping_cu = send_tx(
        &mut svm,
        &[ping_ix(payer.pubkey(), smoke_state, "pong")],
        &payer,
        &[&payer],
    );
    record_cu("ping", ping_cu);

    let state = read_smoke_state(&svm, &smoke_state);
    assert_eq!(state.authority, payer.pubkey());
    assert_eq!(state.count, 1);
    assert_eq!(state.message, "pong");
}

#[test]
fn smoke_reinit_fails() {
    let (mut svm, payer) = setup();
    let smoke_state = smoke_pda(&payer.pubkey());

    send_tx(
        &mut svm,
        &[initialize_smoke_ix(payer.pubkey(), smoke_state, "first")],
        &payer,
        &[&payer],
    );

    assert!(tx_fails(
        &mut svm,
        &[initialize_smoke_ix(payer.pubkey(), smoke_state, "again")],
        &payer,
        &[&payer],
    ));
}

#[test]
fn smoke_wrong_signer_fails() {
    let (mut svm, payer) = setup();
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), LAMPORTS_PER_SOL).unwrap();

    let smoke_state = smoke_pda(&payer.pubkey());
    send_tx(
        &mut svm,
        &[initialize_smoke_ix(payer.pubkey(), smoke_state, "hello")],
        &payer,
        &[&payer],
    );

    assert!(tx_fails(
        &mut svm,
        &[ping_ix(attacker.pubkey(), smoke_state, "nope")],
        &attacker,
        &[&attacker],
    ));
}

#[test]
fn smoke_rejects_long_message() {
    let (mut svm, payer) = setup();
    let smoke_state = smoke_pda(&payer.pubkey());
    let message = "x".repeat(arcadia_vault::MAX_SMOKE_MESSAGE_LEN + 1);

    assert!(tx_fails(
        &mut svm,
        &[initialize_smoke_ix(payer.pubkey(), smoke_state, &message)],
        &payer,
        &[&payer],
    ));
    assert!(svm.get_account(&smoke_state).is_none());
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
