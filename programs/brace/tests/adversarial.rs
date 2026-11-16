//! Adversarial regressions for review findings (pre-funded PDAs, spot handling,
//! stale prices, degenerate ladders, liquidation rounding, relayer config, CU).
#![allow(dead_code)]
use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, program_pack::Pack, system_instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    anchor_spl::token::spl_token,
    brace::{
        instructions::QuoteArg,
        state::{Pool, Position},
        DEFAULT_PARAMS,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const NOW: i64 = 1_794_844_800;
const SOL: [u8; 8] = *b"SOL\0\0\0\0\0";
const SPOT: u64 = 71_965_000;
const EXPIRY: i64 = NOW + 86_134;
const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
const DEPOSIT: u64 = 10 * LAMPORTS_PER_SOL;
const VALUE: u64 = 719_650_000; // 10 SOL * 71.965 USD, 6 decimals

const E_UNAUTHORIZED: u32 = 6000;
const E_RISK_TIGHTENED: u32 = 6005;
const E_NOT_LIQUIDATABLE: u32 = 6006;
const E_INSUFFICIENT_COLLATERAL: u32 = 6007;
const E_INVALID_AMOUNT: u32 = 6008;
const E_CONSTRAINT_SEEDS: u32 = 2006;

struct Env {
    svm: LiteSVM,
    payer: Keypair,
    admin: Keypair,
    relayer: Keypair,
    owner: Keypair,
    owner_ata: Pubkey,
    owners: Vec<Pubkey>,
}

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &brace::id()).0
}
fn config_pda() -> Pubkey {
    pda(&[b"config"])
}
fn feed_pda() -> Pubkey {
    pda(&[b"feed", SOL.as_ref()])
}
fn pool_pda() -> Pubkey {
    pda(&[b"pool"])
}
fn mint_pda() -> Pubkey {
    pda(&[b"usd_mint"])
}
fn position_pda(owner: &Pubkey) -> Pubkey {
    pda(&[b"position", owner.as_ref()])
}

fn ladder_scaled(num: u64, den: u64) -> Vec<QuoteArg> {
    [
        (67_000_000u64, 9100u16, 9600u16),
        (68_000_000, 8800, 9100),
        (69_000_000, 8200, 8500),
        (70_000_000, 7200, 7600),
        (71_000_000, 5900, 6400),
        (72_000_000, 4400, 5000),
        (73_000_000, 3100, 3700),
        (74_000_000, 2000, 2600),
    ]
    .iter()
    .map(|&(k, b, a)| QuoteArg { strike_e6: k * num / den, bid_bps: b, ask_bps: a })
    .collect()
}

fn ticker() -> [u8; 32] {
    let mut t = [0u8; 32];
    let s = b"SOL-17NOV26";
    t[..s.len()].copy_from_slice(s);
    t
}

fn set_now(svm: &mut LiteSVM, now: i64) {
    let mut c: Clock = svm.get_sysvar::<Clock>();
    c.unix_timestamp = now;
    svm.set_sysvar::<Clock>(&c);
}

/// Sends with `payer` as fee payer so lamport deltas of other signers are exact.
fn send(env: &mut Env, ixs: &[Instruction], signers: &[&Keypair]) -> Result<Vec<String>, (String, Vec<String>)> {
    env.svm.expire_blockhash();
    let bh = env.svm.latest_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&env.payer.pubkey()), &bh);
    let mut all: Vec<&Keypair> = vec![&env.payer];
    all.extend_from_slice(signers);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &all).unwrap();
    env.svm
        .send_transaction(tx)
        .map(|m| m.logs)
        .map_err(|e| (format!("{:?}", e.err), e.meta.logs))
}

fn assert_code<T>(res: Result<T, (String, Vec<String>)>, code: u32) -> Vec<String> {
    let (e, logs) = res.err().expect("expected failure");
    assert!(e.contains(&format!("Custom({code})")), "expected Custom({code}), got {e}");
    logs
}

fn post(env: &mut Env, spot: u64, quotes: Vec<QuoteArg>) {
    let ix = Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::PostQuotes { symbol: SOL, expiry_ts: EXPIRY, ticker: ticker(), spot_e6: spot, quotes }
            .data(),
        brace::accounts::PostQuotes {
            relayer: env.relayer.pubkey(),
            config: config_pda(),
            feed: feed_pda(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    let r = env.relayer.insecure_clone();
    send(env, &[ix], &[&r]).unwrap();
}

fn init_pool_ix(admin: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::InitPool {}.data(),
        brace::accounts::InitPool {
            admin: *admin,
            config: config_pda(),
            pool: pool_pda(),
            usd_mint: mint_pda(),
            token_program: spl_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn open_position_ix(owner: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::OpenPosition {}.data(),
        brace::accounts::OpenPosition {
            owner: *owner,
            position: position_pda(owner),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn deposit_ix(owner: &Pubkey, position: Pubkey, lamports: u64) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::Deposit { lamports }.data(),
        brace::accounts::Deposit { owner: *owner, position, pool: pool_pda(), system_program: system_program::ID }
            .to_account_metas(None),
    )
}

fn borrow_ix(owner: &Pubkey, position: Pubkey, owner_token: Pubkey, amount: u64) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::Borrow { amount }.data(),
        brace::accounts::Borrow {
            owner: *owner,
            position,
            pool: pool_pda(),
            config: config_pda(),
            sol_feed: feed_pda(),
            usd_mint: mint_pda(),
            owner_token,
            token_program: spl_token::ID,
        }
        .to_account_metas(None),
    )
}

fn repay_ix(owner: &Pubkey, owner_token: Pubkey, amount: u64) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::Repay { amount }.data(),
        brace::accounts::Repay {
            owner: *owner,
            position: position_pda(owner),
            pool: pool_pda(),
            usd_mint: mint_pda(),
            owner_token,
            token_program: spl_token::ID,
        }
        .to_account_metas(None),
    )
}

fn withdraw_ix(owner: &Pubkey, position: Pubkey, lamports: u64) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::Withdraw { lamports }.data(),
        brace::accounts::Withdraw {
            owner: *owner,
            position,
            pool: pool_pda(),
            config: config_pda(),
            sol_feed: feed_pda(),
        }
        .to_account_metas(None),
    )
}

fn liquidate_ix(liquidator: &Pubkey, liquidator_token: Pubkey, position: Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::Liquidate {}.data(),
        brace::accounts::Liquidate {
            liquidator: *liquidator,
            liquidator_token,
            position,
            config: config_pda(),
            sol_feed: feed_pda(),
            pool: pool_pda(),
            usd_mint: mint_pda(),
            token_program: spl_token::ID,
        }
        .to_account_metas(None),
    )
}

/// Creates and initializes a test USD token account owned by `owner` via the SPL token program.
fn create_token_account(env: &mut Env, owner: &Pubkey) -> Pubkey {
    let acc = Keypair::new();
    let rent = env.svm.minimum_balance_for_rent_exemption(spl_token::state::Account::LEN);
    let create = system_instruction::create_account(
        &env.payer.pubkey(),
        &acc.pubkey(),
        rent,
        spl_token::state::Account::LEN as u64,
        &spl_token::ID,
    );
    let init = spl_token::instruction::initialize_account3(&spl_token::ID, &acc.pubkey(), &mint_pda(), owner).unwrap();
    send(env, &[create, init], &[&acc]).unwrap();
    acc.pubkey()
}

fn token_balance(env: &Env, acc: &Pubkey) -> u64 {
    let a = env.svm.get_account(acc).unwrap();
    spl_token::state::Account::unpack(&a.data).unwrap().amount
}

fn mint_supply(env: &Env) -> u64 {
    let a = env.svm.get_account(&mint_pda()).unwrap();
    spl_token::state::Mint::unpack(&a.data).unwrap().supply
}

fn read_pool(env: &Env) -> Pool {
    let a = env.svm.get_account(&pool_pda()).unwrap();
    Pool::try_deserialize(&mut &a.data[..]).unwrap()
}

fn read_position(env: &Env, owner: &Pubkey) -> Position {
    let a = env.svm.get_account(&position_pda(owner)).unwrap();
    Position::try_deserialize(&mut &a.data[..]).unwrap()
}

fn lamports(env: &Env, k: &Pubkey) -> u64 {
    env.svm.get_account(k).map(|a| a.lamports).unwrap_or(0)
}

fn check_invariants(env: &Env) {
    let pool = read_pool(env);
    assert_eq!(pool.usd_mint, mint_pda());
    let sum_debt: u64 = env.owners.iter().map(|o| read_position(env, o).debt).sum();
    let sum_coll: u64 = env.owners.iter().map(|o| read_position(env, o).collateral_lamports).sum();
    assert_eq!(pool.total_debt, mint_supply(env), "total_debt vs supply");
    assert_eq!(pool.total_debt, sum_debt, "total_debt vs sum of debts");
    assert_eq!(pool.total_collateral, sum_coll, "total_collateral vs sum of collateral");
    let acc = env.svm.get_account(&pool_pda()).unwrap();
    let rent = env.svm.minimum_balance_for_rent_exemption(acc.data.len());
    assert!(acc.lamports >= pool.total_collateral + rent, "pool lamports below collateral + rent");
}

/// Config only.
fn base_no_post() -> Env {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/brace.so"));
    svm.add_program(brace::id(), bytes).unwrap();
    set_now(&mut svm, NOW);
    let (payer, admin, relayer, owner) = (Keypair::new(), Keypair::new(), Keypair::new(), Keypair::new());
    for k in [&payer, &admin, &relayer] {
        svm.airdrop(&k.pubkey(), 10 * LAMPORTS_PER_SOL).unwrap();
    }
    svm.airdrop(&owner.pubkey(), 20 * LAMPORTS_PER_SOL).unwrap();
    let mut env = Env { svm, payer, admin, relayer, owner, owner_ata: Pubkey::default(), owners: vec![] };
    let ix = Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::Initialize { params: DEFAULT_PARAMS, relayer: env.relayer.pubkey() }.data(),
        brace::accounts::Initialize {
            admin: env.admin.pubkey(),
            config: config_pda(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    let a = env.admin.insecure_clone();
    send(&mut env, &[ix], &[&a]).unwrap();
    env
}

/// Config + SOL feed only (no pool yet).
fn base() -> Env {
    let mut env = base_no_post();
    post(&mut env, SPOT, ladder_scaled(1, 1));
    env
}

fn open_and_deposit(env: &mut Env, user: &Keypair, lamports: u64) -> Pubkey {
    let pk = user.pubkey();
    send(env, &[open_position_ix(&pk), deposit_ix(&pk, position_pda(&pk), lamports)], &[user]).unwrap();
    env.owners.push(pk);
    create_token_account(env, &pk)
}

fn setup() -> Env {
    let mut env = base();
    let a = env.admin.insecure_clone();
    send(&mut env, &[init_pool_ix(&a.pubkey())], &[&a]).unwrap();
    let owner = env.owner.insecure_clone();
    env.owner_ata = open_and_deposit(&mut env, &owner, DEPOSIT);
    let pos = read_position(&env, &owner.pubkey());
    assert_eq!(pos.owner, owner.pubkey());
    assert_eq!(pos.collateral_lamports, DEPOSIT);
    assert_eq!(pos.debt, 0);
    check_invariants(&env);
    env
}

fn borrow(env: &mut Env, amount: u64) -> Result<Vec<String>, (String, Vec<String>)> {
    let o = env.owner.insecure_clone();
    let ix = borrow_ix(&o.pubkey(), position_pda(&o.pubkey()), env.owner_ata, amount);
    send(env, &[ix], &[&o])
}

fn withdraw(env: &mut Env, lamports: u64) -> Result<Vec<String>, (String, Vec<String>)> {
    let o = env.owner.insecure_clone();
    let ix = withdraw_ix(&o.pubkey(), position_pda(&o.pubkey()), lamports);
    send(env, &[ix], &[&o])
}

fn pct(p: u64) -> u64 {
    VALUE * p / 100
}


// ---------- adversarial extras ----------

const E_INVALID_PARAMS: u32 = 6001;
const E_STALE_PRICE: u32 = 6009;
const MAX_PRICE_AGE: i64 = 3_600;

fn read_feed_sym(env: &Env, sym: [u8; 8]) -> brace::state::Feed {
    let a = env.svm.get_account(&pda(&[b"feed", sym.as_ref()])).unwrap();
    brace::state::Feed::try_deserialize(&mut &a.data[..]).unwrap()
}

fn read_feed(env: &Env) -> brace::state::Feed {
    read_feed_sym(env, SOL)
}

fn post_ix_sym(relayer: &Pubkey, sym: [u8; 8], expiry: i64, spot: u64, quotes: Vec<QuoteArg>) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::PostQuotes { symbol: sym, expiry_ts: expiry, ticker: ticker(), spot_e6: spot, quotes }
            .data(),
        brace::accounts::PostQuotes {
            relayer: *relayer,
            config: config_pda(),
            feed: pda(&[b"feed", sym.as_ref()]),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

/// Posts and returns compute units consumed (or the error and logs).
fn try_post(
    env: &mut Env,
    sym: [u8; 8],
    expiry: i64,
    spot: u64,
    quotes: Vec<QuoteArg>,
) -> Result<u64, (String, Vec<String>)> {
    let ix = post_ix_sym(&env.relayer.pubkey(), sym, expiry, spot, quotes);
    env.svm.expire_blockhash();
    let bh = env.svm.latest_blockhash();
    let r = env.relayer.insecure_clone();
    let msg = Message::new_with_blockhash(&[ix], Some(&env.payer.pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[&env.payer, &r]).unwrap();
    env.svm
        .send_transaction(tx)
        .map(|m| m.compute_units_consumed)
        .map_err(|e| (format!("{:?}", e.err), e.meta.logs))
}

fn liquidator_with_usd(env: &mut Env, amount: u64) -> (Keypair, Pubkey) {
    let liq = Keypair::new();
    env.svm.airdrop(&liq.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let lt = create_token_account(env, &liq.pubkey());
    if amount > 0 {
        let o = env.owner.insecure_clone();
        let ix = spl_token::instruction::transfer(&spl_token::ID, &env.owner_ata, &lt, &o.pubkey(), &[], amount).unwrap();
        send(env, &[ix], &[&o]).unwrap();
    }
    (liq, lt)
}

fn ladder16() -> Vec<QuoteArg> {
    // SOL-like ladder 64..79, decreasing probabilities, spreads 300 bps.
    let mids = [9650u16, 9550, 9400, 9150, 8800, 8300, 7600, 6700, 5700, 4600, 3600, 2700, 1900, 1300, 800, 500];
    (0..16)
        .map(|i| QuoteArg { strike_e6: (64 + i as u64) * 1_000_000, bid_bps: mids[i] - 150, ask_bps: mids[i] + 150 })
        .collect()
}

#[test]
fn a01_prefunded_mint_pda_init_pool_succeeds() {
    let mut env = base();
    let ix = system_instruction::transfer(&env.payer.pubkey(), &mint_pda(), 890_880);
    send(&mut env, &[ix], &[]).unwrap();
    let a = env.admin.insecure_clone();
    send(&mut env, &[init_pool_ix(&a.pubkey())], &[&a]).unwrap();
    let acc = env.svm.get_account(&mint_pda()).unwrap();
    assert_eq!(acc.owner, spl_token::ID);
    assert!(acc.lamports >= env.svm.minimum_balance_for_rent_exemption(spl_token::state::Mint::LEN));
    let m = spl_token::state::Mint::unpack(&acc.data).unwrap();
    assert_eq!(m.decimals, 6);
    assert_eq!(m.mint_authority, Some(pool_pda()).into());
    assert_eq!(read_pool(&env).usd_mint, mint_pda());
    // Pool works end to end on the pre-funded mint.
    let owner = env.owner.insecure_clone();
    env.owner_ata = open_and_deposit(&mut env, &owner, DEPOSIT);
    borrow(&mut env, pct(10)).unwrap();
    check_invariants(&env);
}

#[test]
fn a02_nonconfident_post_does_not_move_spot() {
    let mut env = setup();
    let before = read_feed(&env);
    try_post(&mut env, SOL, EXPIRY, SPOT * 10, vec![]).unwrap();
    let f = read_feed(&env);
    assert!(!f.confident);
    assert_eq!(f.spot_e6, SPOT, "non-confident post must not move spot");
    assert_eq!(f.spot_e6, before.spot_e6);
    // Spot x10 with a ladder that fails the spot-gap check: also not confident, spot unchanged.
    try_post(&mut env, SOL, EXPIRY, SPOT * 10, ladder_scaled(1, 1)).unwrap();
    let f = read_feed(&env);
    assert!(!f.confident);
    assert_eq!(f.spot_e6, SPOT);
    assert_code(borrow(&mut env, VALUE * 10 * 65 / 100), E_RISK_TIGHTENED);
    assert_eq!(read_position(&env, &env.owner.pubkey()).debt, 0);
    check_invariants(&env);
}

#[test]
fn a03_spot_zero_rejected() {
    let mut env = setup();
    let before = env.svm.get_account(&feed_pda()).unwrap().data;
    assert_code(try_post(&mut env, SOL, EXPIRY, 0, vec![]), E_INVALID_AMOUNT);
    assert_code(try_post(&mut env, SOL, EXPIRY, 0, ladder_scaled(1, 1)), E_INVALID_AMOUNT);
    assert_eq!(env.svm.get_account(&feed_pda()).unwrap().data, before);
    // A brand-new feed cannot be created with spot 0 either.
    let eth = *b"ETH\0\0\0\0\0";
    assert_code(try_post(&mut env, eth, EXPIRY, 0, ladder16()), E_INVALID_AMOUNT);
}

#[test]
fn a04_stale_price_blocks_borrow_withdraw_liquidate() {
    let mut env = setup();
    borrow(&mut env, pct(30)).unwrap();
    let (liq, lt) = liquidator_with_usd(&mut env, pct(30));
    let pos = position_pda(&env.owner.pubkey());

    // Exactly at the max age: still allowed (limit has decayed to the stale floor).
    set_now(&mut env.svm, NOW + MAX_PRICE_AGE);
    borrow(&mut env, 1).unwrap();
    // One second later: stale.
    set_now(&mut env.svm, NOW + MAX_PRICE_AGE + 1);
    assert_code(borrow(&mut env, 1), E_STALE_PRICE);

    // 30 days later.
    set_now(&mut env.svm, NOW + 30 * 86_400);
    assert_code(borrow(&mut env, pct(50)), E_STALE_PRICE);
    assert_code(withdraw(&mut env, 1), E_STALE_PRICE);
    assert_code(send(&mut env, &[liquidate_ix(&liq.pubkey(), lt, pos)], &[&liq]), E_STALE_PRICE);
    let p = read_position(&env, &env.owner.pubkey());
    assert_eq!(p.debt, pct(30) + 1);
    assert_eq!(p.collateral_lamports, DEPOSIT);
    check_invariants(&env);

    // Zero debt: the owner can always exit, even on a stale price.
    let o = env.owner.insecure_clone();
    let ata = env.owner_ata;
    // Give the liquidator's USD back so the owner can repay in full.
    let back = spl_token::instruction::transfer(&spl_token::ID, &lt, &ata, &liq.pubkey(), &[], pct(30)).unwrap();
    send(&mut env, &[back], &[&liq]).unwrap();
    send(&mut env, &[repay_ix(&o.pubkey(), ata, pct(30) + 1)], &[&o]).unwrap();
    withdraw(&mut env, DEPOSIT).unwrap();
    assert_eq!(read_position(&env, &o.pubkey()).collateral_lamports, 0);
    check_invariants(&env);
}

#[test]
fn a05_never_valid_feed_blocks_borrow() {
    // The only SOL post so far was not confident: has_valid false and spot never set.
    let mut env = base_no_post();
    try_post(&mut env, SOL, EXPIRY, SPOT, vec![]).unwrap();
    let f = read_feed(&env);
    assert!(!f.has_valid);
    assert_eq!(f.spot_e6, 0, "spot is only written by confident posts");
    let a = env.admin.insecure_clone();
    send(&mut env, &[init_pool_ix(&a.pubkey())], &[&a]).unwrap();
    let owner = env.owner.insecure_clone();
    env.owner_ata = open_and_deposit(&mut env, &owner, DEPOSIT);
    assert_code(borrow(&mut env, 1), E_STALE_PRICE);
    // Zero-debt exit still works.
    withdraw(&mut env, DEPOSIT).unwrap();
    check_invariants(&env);
}

#[test]
fn a06_degenerate_three_quote_ladder_not_confident() {
    let mut env = base();
    let eth = *b"ETH\0\0\0\0\0";
    let q = vec![
        QuoteArg { strike_e6: 100_000_000, bid_bps: 9650, ask_bps: 9750 },
        QuoteArg { strike_e6: 100_000_001, bid_bps: 4950, ask_bps: 5050 },
        QuoteArg { strike_e6: 100_000_002, bid_bps: 250, ask_bps: 350 },
    ];
    try_post(&mut env, eth, NOW + 900, 100_000_001, q).unwrap();
    let f = read_feed_sym(&env, eth);
    println!("degenerate: conf={} sigma_bps={} max_ltv={}", f.confident, f.sigma_bps, f.max_ltv_bps);
    assert!(!f.confident);
    assert!(!f.has_valid);
    assert_eq!(f.max_ltv_bps, 0);
    assert_eq!(f.spot_e6, 0);
}

#[test]
fn a07_low_sigma_ladder_not_confident() {
    // Span 1.2% passes, but the implied annual sigma is below the 5% floor.
    let mut env = base();
    let eth = *b"ETH\0\0\0\0\0";
    let q = vec![
        QuoteArg { strike_e6: 100_000_000, bid_bps: 9650, ask_bps: 9750 },
        QuoteArg { strike_e6: 100_600_000, bid_bps: 4950, ask_bps: 5050 },
        QuoteArg { strike_e6: 101_200_000, bid_bps: 250, ask_bps: 350 },
    ];
    let mq: Vec<brace::math::Quote> =
        q.iter().map(|x| brace::math::Quote { strike_e6: x.strike_e6, bid_bps: x.bid_bps, ask_bps: x.ask_bps }).collect();
    let fit = brace::math::fit_ladder(&mq, DEFAULT_PARAMS.max_spread_bps, DEFAULT_PARAMS.min_points).unwrap();
    let sigma = brace::math::sigma_annual_bps(fit.s_t_e6, 259_000).unwrap();
    assert!(sigma < brace::MIN_SIGMA_BPS, "fixture sigma {sigma} must be below the floor");
    let gap = (100_600_000u64.abs_diff(fit.median_e6)) * 10_000 / fit.median_e6;
    assert!(gap <= DEFAULT_PARAMS.max_spot_gap_bps as u64, "fixture spot gap {gap}");
    try_post(&mut env, eth, NOW + 259_000, 100_600_000, q).unwrap();
    let f = read_feed_sym(&env, eth);
    println!("low sigma: conf={} fit sigma_bps={sigma} points={}", f.confident, f.points);
    assert!(!f.confident);
    assert!(!f.has_valid);
    assert_eq!(f.points, 3, "the ladder itself fits; only the sigma floor rejects it");
}

#[test]
fn a08_zec_wide_ladder_with_far_strike_confident() {
    let mut env = base();
    let zec = *b"ZEC\0\0\0\0\0";
    let q = vec![
        QuoteArg { strike_e6: 900_000_000, bid_bps: 7400, ask_bps: 8700 },
        QuoteArg { strike_e6: 910_000_000, bid_bps: 4700, ask_bps: 6000 },
        QuoteArg { strike_e6: 920_000_000, bid_bps: 1900, ask_bps: 3200 },
        QuoteArg { strike_e6: 930_000_000, bid_bps: 200, ask_bps: 1400 },
        // >15% below k_ref, valid quote: must be skipped, not fatal.
        QuoteArg { strike_e6: 750_000_000, bid_bps: 9500, ask_bps: 9700 },
        QuoteArg { strike_e6: 870_000_000, bid_bps: 9300, ask_bps: 0 },
    ];
    try_post(&mut env, zec, NOW + 3_334, 911_000_000, q).unwrap();
    let f = read_feed_sym(&env, zec);
    println!("ZEC: conf={} points={} sigma_bps={} max_ltv={} median={}", f.confident, f.points, f.sigma_bps, f.max_ltv_bps, f.median_e6);
    assert!(f.confident);
    assert_eq!(f.points, 4);
    assert!((f.sigma_bps as i64 - 14_097).abs() <= 50, "sigma {}", f.sigma_bps);
    assert_eq!(f.spot_e6, 911_000_000);
}

#[test]
fn a09_dust_position_at_threshold_not_liquidatable() {
    let mut env = setup();
    let dust = Keypair::new();
    env.svm.airdrop(&dust.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let dust_ata = open_and_deposit(&mut env, &dust, 1_001_900);
    let ix = borrow_ix(&dust.pubkey(), position_pda(&dust.pubkey()), dust_ata, 801);
    send(&mut env, &[ix], &[&dust]).unwrap();
    let liq = Keypair::new();
    env.svm.airdrop(&liq.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let lt = create_token_account(&mut env, &liq.pubkey());
    let t = spl_token::instruction::transfer(&spl_token::ID, &dust_ata, &lt, &dust.pubkey(), &[], 801).unwrap();
    send(&mut env, &[t], &[&dust]).unwrap();

    // Confident post that moves spot to $1.
    try_post(&mut env, SOL, EXPIRY, 1_000_000, ladder_scaled(1_000_000, SPOT)).unwrap();
    let f = read_feed(&env);
    assert!(f.confident);
    assert_eq!(f.spot_e6, 1_000_000);

    // True LTV = 801 / 1001.9 = 79.95% <= 80%. Conservative rounding would say 8002.
    let v = brace::state::collateral_value_e6(1_001_900, 1_000_000).unwrap();
    assert!(brace::state::ltv_bps(801, v).unwrap() > 8000);
    let pos = position_pda(&dust.pubkey());
    assert_code(send(&mut env, &[liquidate_ix(&liq.pubkey(), lt, pos)], &[&liq]), E_NOT_LIQUIDATABLE);
    assert_eq!(read_position(&env, &dust.pubkey()).debt, 801);
    check_invariants(&env);
}

#[test]
fn a10_set_relayer_default_rejected() {
    let mut env = base();
    let a = env.admin.insecure_clone();
    let ix = Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::SetRelayer { relayer: Pubkey::default() }.data(),
        brace::accounts::AdminConfig { admin: a.pubkey(), config: config_pda() }.to_account_metas(None),
    );
    assert_code(send(&mut env, &[ix], &[&a]), E_INVALID_PARAMS);
    let acc = env.svm.get_account(&config_pda()).unwrap();
    let c = brace::state::Config::try_deserialize(&mut &acc.data[..]).unwrap();
    assert_eq!(c.relayer, env.relayer.pubkey());
}

#[test]
fn a11_post_quotes_16_compute_units() {
    let mut env = base();
    let eth = *b"ETH\0\0\0\0\0";
    let cu_create = try_post(&mut env, eth, EXPIRY, 71_500_000, ladder16()).unwrap();
    let cu_update = try_post(&mut env, eth, EXPIRY, 71_500_000, ladder16()).unwrap();
    let f = read_feed_sym(&env, eth);
    println!("post_quotes CU: create+16={cu_create} update+16={cu_update} confident={}", f.confident);
    assert!(cu_create < 200_000, "create CU {cu_create}");
    assert!(cu_update < 200_000, "update CU {cu_update}");
}
