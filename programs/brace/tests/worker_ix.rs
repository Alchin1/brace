//! Verifies the relayer Worker's post_quotes byte layout against Anchor's
//! InstructionData (the IDL) and that LiteSVM accepts those exact bytes.
use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    brace::{instructions::QuoteArg, DEFAULT_PARAMS},
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const WORKER_HEX: &str = "4a1b2d26bcddc2ef534f4c000000000070571a6900000000534f4c3236313131363232303000000000000000000000000000000000000000e00043040000000002000000c05f3b04000000003011881300a24a0400000000b80b740e";
const NOW: i64 = 1_794_844_800;
const SOL: [u8; 8] = *b"SOL\0\0\0\0\0";

fn hex_decode(s: &str) -> Vec<u8> {
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap()).collect()
}

fn ticker() -> [u8; 32] {
    let mut t = [0u8; 32];
    let s = b"SOL2611162200";
    t[..s.len()].copy_from_slice(s);
    t
}

fn worker_quotes() -> Vec<QuoteArg> {
    vec![
        QuoteArg { strike_e6: 71_000_000, bid_bps: 4400, ask_bps: 5000 },
        QuoteArg { strike_e6: 72_000_000, bid_bps: 3000, ask_bps: 3700 },
    ]
}

fn worker_data() -> Vec<u8> {
    hex_decode(WORKER_HEX)
}

fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"config"], &brace::id()).0
}

fn feed_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"feed", SOL.as_ref()], &brace::id()).0
}

#[test]
fn worker_two_quote_bytes_match_anchor_instruction_data() {
    let data = brace::instruction::PostQuotes {
        symbol: SOL,
        expiry_ts: 1_763_334_000,
        ticker: ticker(),
        spot_e6: 71_500_000,
        quotes: worker_quotes(),
    }
    .data();
    assert_eq!(data, worker_data(), "Worker encode.ts must stay byte-identical to the IDL");
}

#[test]
fn litesvm_accepts_the_worker_encoded_post_quotes() {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/brace.so"));
    svm.add_program(brace::id(), bytes).unwrap();
    let mut clock: Clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp = NOW;
    svm.set_sysvar::<Clock>(&clock);

    let admin = Keypair::new();
    let relayer = Keypair::new();
    svm.airdrop(&admin.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&relayer.pubkey(), 10_000_000_000).unwrap();

    let send = |svm: &mut LiteSVM, ix: Instruction, payer: &Keypair| {
        svm.expire_blockhash();
        let bh = svm.latest_blockhash();
        let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &bh);
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
        svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?}", e.err))
    };

    let init = Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::Initialize { params: DEFAULT_PARAMS, relayer: relayer.pubkey() }.data(),
        brace::accounts::Initialize { admin: admin.pubkey(), config: config_pda(), system_program: system_program::ID }
            .to_account_metas(None),
    );
    send(&mut svm, init, &admin).unwrap();

    // Raw instruction built exactly as the Worker does (accounts + worker-encoded data).
    let post = Instruction {
        program_id: brace::id(),
        accounts: brace::accounts::PostQuotes {
            relayer: relayer.pubkey(),
            config: config_pda(),
            feed: feed_pda(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: worker_data(),
    };
    send(&mut svm, post, &relayer).expect("LiteSVM must accept the Worker-encoded post_quotes");

    let acc = svm.get_account(&feed_pda()).expect("feed created");
    let feed = brace::state::Feed::try_deserialize(&mut &acc.data[..]).unwrap();
    assert_eq!(feed.symbol, SOL);
    assert_eq!(feed.ticker, ticker());
    assert_eq!(feed.expiry_ts, 1_763_334_000);
    // Only two quotes: not confident, and spot must not move.
    assert!(!feed.confident);
    assert!(!feed.has_valid);
    assert_eq!(feed.spot_e6, 0);
}

#[test]
fn worker_program_id_matches_declared_id() {
    assert_eq!(brace::id().to_string(), "Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC");
}
