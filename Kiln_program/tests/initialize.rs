// use this to run the tests -
// cargo test --features std  -- --no-capture

use std::path::PathBuf;

use litesvm::{types::TransactionResult, LiteSVM};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    native_token::LAMPORTS_PER_SOL,
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    sysvar,
    transaction::Transaction,
};

use Kiln_program::instructions::Initialize;
use Kiln_program::states::{self, MyState};
use Kiln_program::states::utils::DataLen;

pub fn program_id() -> Pubkey {
    // Convert Pinocchio program ID to solana-sdk Pubkey
    Pubkey::new_from_array(Kiln_program::ID)
}

pub fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();

    let so_path = PathBuf::from("target/deploy").join("Kiln_program.so");

    let program_data = std::fs::read(so_path).expect("Failed to read program .so file");
    svm.add_program(program_id(), &program_data).expect("add_program failed");

    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 10 * LAMPORTS_PER_SOL).expect("airdrop failed");

    (svm, payer)
}

pub struct InitializeData {
    pub payer: Pubkey,
    pub state_pda: (Pubkey, u8),
}

impl InitializeData {
    pub fn new(payer: &Keypair) -> Self {
        let (state_pda, bump) =
            Pubkey::find_program_address(&[MyState::SEED.as_bytes(), &payer.pubkey().to_bytes()], &program_id());
        Self {
            payer: payer.pubkey(),
            state_pda: (state_pda, bump),
        }
    }
}

pub fn initialize(
    svm: &mut LiteSVM,
    payer: &Keypair,
    data: &InitializeData,
) -> TransactionResult {
    // Discriminator 0 for Initialize, followed by Initialize{ owner, bump }
    let ix = Initialize { owner: data.payer.to_bytes(), bump: data.state_pda.1 };

    let mut ix_data = vec![0u8];
    // Serialize instruction payload using the program's utility
    let ix_bytes = unsafe { states::utils::to_bytes(&ix) };
    ix_data.extend_from_slice(ix_bytes);

    let system_program = Pubkey::from(pinocchio_system::id());
    let accounts = vec![
        AccountMeta::new(data.payer, true),
        AccountMeta::new(data.state_pda.0, false),
        AccountMeta::new_readonly(sysvar::rent::id(), false),
        AccountMeta::new_readonly(system_program, false),
    ];

    let ix = Instruction { program_id: program_id(), accounts, data: ix_data };

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer.pubkey()),
        &[payer],
        svm.latest_blockhash(),
    );

    svm.send_transaction(tx)
}

#[test]
pub fn test_initialize() {
    let (mut svm, payer) = setup();
    let init_data = InitializeData::new(&payer);

    let _res = initialize(&mut svm, &payer, &init_data).expect("transaction failed");

    // Fetch PDA account and verify it was created with expected size
    let state_account = svm.get_account(&init_data.state_pda.0).expect("missing state account");
    assert_eq!(state_account.data.len(), MyState::LEN, "state size mismatch");
}
