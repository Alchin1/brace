use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    brace::{
        instructions::QuoteArg,
        state::{Config, Feed, Params},
        DEFAULT_PARAMS,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const NOW: i64 = 1_794_844_800; // fixed test clock
const SOL: [u8; 8] = *b"SOL\0\0\0\0\0";
const SPOT: u64 = 71_965_000;

// Error codes: BraceError starts at 6000.
const E_UNAUTHORIZED: u32 = 6000;
const E_INVALID_PARAMS: u32 = 6001;
const E_TOO_MANY_QUOTES: u32 = 6002;
const E_INVALID_SYMBOL: u32 = 6003;

struct Env {
    svm: LiteSVM,
    admin: Keypair,
    relayer: Keypair,
}

fn ladder() -> Vec<QuoteArg> {
    [
        (67_000_000, 9100, 9600),
        (68_000_000, 8800, 9100),
        (69_000_000, 8200, 8500),
        (70_000_000, 7200, 7600),
        (71_000_000, 5900, 6400),
        (72_000_000, 4400, 5000),
        (73_000_000, 3100, 3700),
        (74_000_000, 2000, 2600),
    ]
    .iter()
    .map(|&(k, b, a)| QuoteArg { strike_e6: k, bid_bps: b, ask_bps: a })
    .collect()
}

fn ticker() -> [u8; 32] {
    let mut t = [0u8; 32];
    let s = b"SOL-17NOV26";
    t[..s.len()].copy_from_slice(s);
    t
}

fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"config"], &brace::id()).0
}

fn feed_pda(symbol: &[u8; 8]) -> Pubkey {
    Pubkey::find_program_address(&[b"feed", symbol.as_ref()], &brace::id()).0
}

fn set_now(svm: &mut LiteSVM, now: i64) {
    let mut c: Clock = svm.get_sysvar::<Clock>();
    c.unix_timestamp = now;
    svm.set_sysvar::<Clock>(&c);
}

fn send(svm: &mut LiteSVM, ix: Instruction, payer: &Keypair) -> Result<(), String> {
    svm.expire_blockhash();
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
    svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?}", e.err))
}

fn assert_code(res: Result<(), String>, code: u32) {
    let e = res.expect_err("expected failure");
    assert!(e.contains(&format!("Custom({code})")), "expected Custom({code}), got {e}");
}

fn new_svm() -> (LiteSVM, Keypair, Keypair) {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/brace.so"));
    svm.add_program(brace::id(), bytes).unwrap();
    let admin = Keypair::new();
    let relayer = Keypair::new();
    svm.airdrop(&admin.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&relayer.pubkey(), 10_000_000_000).unwrap();
    set_now(&mut svm, NOW);
    (svm, admin, relayer)
}

fn init_ix(admin: &Pubkey, params: Params, relayer: Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::Initialize { params, relayer }.data(),
        brace::accounts::Initialize { admin: *admin, config: config_pda(), system_program: system_program::ID }
            .to_account_metas(None),
    )
}

fn setup() -> Env {
    let (mut svm, admin, relayer) = new_svm();
    let ix = init_ix(&admin.pubkey(), DEFAULT_PARAMS, relayer.pubkey());
    send(&mut svm, ix, &admin).unwrap();
    Env { svm, admin, relayer }
}

fn post_ix(signer: &Pubkey, symbol: [u8; 8], expiry_ts: i64, spot_e6: u64, quotes: Vec<QuoteArg>) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::PostQuotes { symbol, expiry_ts, ticker: ticker(), spot_e6, quotes }.data(),
        brace::accounts::PostQuotes {
            relayer: *signer,
            config: config_pda(),
            feed: feed_pda(&symbol),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn post(env: &mut Env, expiry_ts: i64, spot_e6: u64, quotes: Vec<QuoteArg>) -> Result<(), String> {
    let ix = post_ix(&env.relayer.pubkey(), SOL, expiry_ts, spot_e6, quotes);
    send(&mut env.svm, ix, &env.relayer)
}

fn set_params_ix(admin: &Pubkey, params: Params) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::SetParams { params }.data(),
        brace::accounts::AdminConfig { admin: *admin, config: config_pda() }.to_account_metas(None),
    )
}

fn read_feed(svm: &LiteSVM) -> Feed {
    let acc = svm.get_account(&feed_pda(&SOL)).expect("feed exists");
    Feed::try_deserialize(&mut &acc.data[..]).unwrap()
}

fn read_config(svm: &LiteSVM) -> Config {
    let acc = svm.get_account(&config_pda()).unwrap();
    Config::try_deserialize(&mut &acc.data[..]).unwrap()
}

fn assert_confident_sol(feed: &Feed, now: i64) {
    assert!(feed.confident);
    assert_eq!(feed.points, 8);
    assert!((feed.sigma_bps as i64 - 8272).abs() <= 50, "sigma {}", feed.sigma_bps);
    assert!((feed.max_ltv_bps as i64 - 6960).abs() <= 15, "max_ltv {}", feed.max_ltv_bps);
    assert!(feed.has_valid);
    assert_eq!(feed.last_valid_at, now);
    assert_eq!(feed.posted_at, now);
}

#[test]
fn t01_initialize_default_params() {
    let env = setup();
    let c = read_config(&env.svm);
    assert_eq!(c.admin, env.admin.pubkey());
    assert_eq!(c.relayer, env.relayer.pubkey());
    assert_eq!(c.params, DEFAULT_PARAMS);
}

#[test]
fn t02_initialize_invalid_params_fails() {
    let (mut svm, admin, relayer) = new_svm();
    let mut p = DEFAULT_PARAMS;
    p.gov_max_ltv_bps = 8500;
    assert_code(send(&mut svm, init_ix(&admin.pubkey(), p, relayer.pubkey()), &admin), E_INVALID_PARAMS);
    assert!(svm.get_account(&config_pda()).map(|a| a.data.is_empty()).unwrap_or(true));
}

#[test]
fn t12_initialize_default_relayer_rejected() {
    // Pass 5 F2: initialize must reject the default pubkey, matching set_relayer.
    let (mut svm, admin, _) = new_svm();
    assert_code(send(&mut svm, init_ix(&admin.pubkey(), DEFAULT_PARAMS, Pubkey::default()), &admin), E_INVALID_PARAMS);
    assert!(svm.get_account(&config_pda()).map(|a| a.data.is_empty()).unwrap_or(true));
}

#[test]
fn t03_relayer_posts_sol_ladder() {
    let mut env = setup();
    post(&mut env, NOW + 86_134, SPOT, ladder()).unwrap();
    let f = read_feed(&env.svm);
    assert_confident_sol(&f, NOW);
    assert_eq!(f.symbol, SOL);
    assert_eq!(f.spot_e6, SPOT);
    assert_eq!(f.expiry_ts, NOW + 86_134);
    assert_eq!(f.ticker, ticker());
}

#[test]
fn t04_non_relayer_post_fails() {
    let mut env = setup();
    post(&mut env, NOW + 86_134, SPOT, ladder()).unwrap();
    let before = read_feed(&env.svm);
    let rogue = Keypair::new();
    env.svm.airdrop(&rogue.pubkey(), 1_000_000_000).unwrap();
    set_now(&mut env.svm, NOW + 10);
    let ix = post_ix(&rogue.pubkey(), SOL, NOW + 86_134, SPOT, ladder());
    assert_code(send(&mut env.svm, ix, &rogue), E_UNAUTHORIZED);
    let after = read_feed(&env.svm);
    assert_eq!(after.posted_at, before.posted_at);
    assert_eq!(after.max_ltv_bps, before.max_ltv_bps);
}

#[test]
fn t05_thin_ladder_not_confident_keeps_last_valid() {
    let mut env = setup();
    post(&mut env, NOW + 86_134, SPOT, ladder()).unwrap();
    let before = read_feed(&env.svm);
    set_now(&mut env.svm, NOW + 60);
    let thin: Vec<QuoteArg> = ladder().into_iter().skip(3).take(2).collect();
    post(&mut env, NOW + 86_134, SPOT, thin).unwrap();
    let f = read_feed(&env.svm);
    assert!(!f.confident);
    assert!(f.has_valid);
    assert_eq!(f.max_ltv_bps, before.max_ltv_bps);
    assert_eq!(f.last_valid_at, NOW);
    assert_eq!(f.posted_at, NOW + 60);
}

#[test]
fn t06_spot_far_from_median_not_confident() {
    let mut env = setup();
    post(&mut env, NOW + 86_134, SPOT * 11 / 10, ladder()).unwrap();
    let f = read_feed(&env.svm);
    assert!(!f.confident);
    assert!(!f.has_valid);
    assert_eq!(f.points, 8);
}

#[test]
fn t07_expiry_beyond_max_not_confident() {
    let mut env = setup();
    post(&mut env, NOW + 259_201, SPOT, ladder()).unwrap();
    let f = read_feed(&env.svm);
    assert!(!f.confident);
    assert!(!f.has_valid);
}

#[test]
fn t08_seventeen_quotes_fails() {
    let mut env = setup();
    let mut q = ladder();
    q.extend(ladder());
    q.push(ladder()[0]);
    assert_eq!(q.len(), 17);
    assert_code(post(&mut env, NOW + 86_134, SPOT, q), E_TOO_MANY_QUOTES);
}

#[test]
fn t09_set_params_access_and_validation() {
    let mut env = setup();
    let mut p = DEFAULT_PARAMS;
    p.k_x100 = 400;
    let rogue = Keypair::new();
    env.svm.airdrop(&rogue.pubkey(), 1_000_000_000).unwrap();
    assert_code(send(&mut env.svm, set_params_ix(&rogue.pubkey(), p), &rogue), E_UNAUTHORIZED);
    assert_eq!(read_config(&env.svm).params, DEFAULT_PARAMS);

    let admin = env.admin.insecure_clone();
    send(&mut env.svm, set_params_ix(&admin.pubkey(), p), &admin).unwrap();
    assert_eq!(read_config(&env.svm).params, p);

    let mut bad = p;
    bad.min_points = 2;
    assert_code(send(&mut env.svm, set_params_ix(&admin.pubkey(), bad), &admin), E_INVALID_PARAMS);
    assert_eq!(read_config(&env.svm).params, p);
}

#[test]
fn t10_effective_ltv_decays_with_staleness() {
    let mut env = setup();
    post(&mut env, NOW + 86_134, SPOT, ladder()).unwrap();
    let f = read_feed(&env.svm);
    let p = DEFAULT_PARAMS;
    assert_eq!(f.effective_ltv_bps(&p, NOW), f.max_ltv_bps);
    assert_eq!(f.effective_ltv_bps(&p, NOW + 650), f.max_ltv_bps - 500);
    assert_eq!(f.effective_ltv_bps(&p, NOW + 86_400), p.stale_floor_ltv_bps.min(f.max_ltv_bps));
}

#[test]
fn t11_invalid_symbol_fails() {
    let mut env = setup();
    let sym = *b"sol\0\0\0\0\0";
    let ix = post_ix(&env.relayer.pubkey(), sym, NOW + 86_134, SPOT, ladder());
    let relayer = env.relayer.insecure_clone();
    assert_code(send(&mut env.svm, ix, &relayer), E_INVALID_SYMBOL);
}
