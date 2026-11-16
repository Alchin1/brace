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
const E_STALE_PRICE: u32 = 6009;
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

/// Config + SOL feed only (no pool yet).
fn base() -> Env {
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

#[test]
fn p01_borrow_under_limit_succeeds() {
    let mut env = setup();
    let amt = pct(69);
    let logs = borrow(&mut env, amt).unwrap();
    assert!(logs.iter().any(|l| l.contains("brace borrow")), "{logs:?}");
    assert_eq!(token_balance(&env, &env.owner_ata), amt);
    let pos = read_position(&env, &env.owner.pubkey());
    assert_eq!(pos.debt, amt);
    assert_eq!(read_pool(&env).total_debt, amt);
    check_invariants(&env);
}

#[test]
fn p02_borrow_over_limit_blocked() {
    let mut env = setup();
    let logs = assert_code(borrow(&mut env, pct(72)), E_RISK_TIGHTENED);
    assert!(logs.iter().any(|l| l.contains("brace blocked ltv=7200 limit=")), "{logs:?}");
    assert_eq!(read_position(&env, &env.owner.pubkey()).debt, 0);
    assert_code(borrow(&mut env, 0), E_INVALID_AMOUNT);
    check_invariants(&env);
}

#[test]
fn p03_stale_feed_steps_limit_down() {
    let mut env = setup();
    set_now(&mut env.svm, NOW + 650);
    let logs = assert_code(borrow(&mut env, pct(66)), E_RISK_TIGHTENED);
    assert!(logs.iter().any(|l| l.contains("brace blocked ltv=6600")), "{logs:?}");
    check_invariants(&env);
    // A fresh post restores the limit.
    post(&mut env, SPOT, ladder_scaled(1, 1));
    borrow(&mut env, pct(66)).unwrap();
    assert_eq!(read_position(&env, &env.owner.pubkey()).debt, pct(66));
    check_invariants(&env);
}

#[test]
fn p04_withdraw_limit_and_safe_withdraw() {
    let mut env = setup();
    borrow(&mut env, pct(60)).unwrap();
    let logs = assert_code(withdraw(&mut env, 2 * LAMPORTS_PER_SOL), E_RISK_TIGHTENED);
    assert!(logs.iter().any(|l| l.contains("brace blocked")), "{logs:?}");
    assert_code(withdraw(&mut env, DEPOSIT + 1), E_INSUFFICIENT_COLLATERAL);

    let owner = env.owner.pubkey();
    let (ob, pb) = (lamports(&env, &owner), lamports(&env, &pool_pda()));
    withdraw(&mut env, LAMPORTS_PER_SOL).unwrap();
    assert_eq!(lamports(&env, &owner), ob + LAMPORTS_PER_SOL);
    assert_eq!(lamports(&env, &pool_pda()), pb - LAMPORTS_PER_SOL);
    assert_eq!(read_position(&env, &owner).collateral_lamports, DEPOSIT - LAMPORTS_PER_SOL);
    check_invariants(&env);
}

#[test]
fn p05_repay_then_withdraw_all() {
    let mut env = setup();
    let owner = env.owner.insecure_clone();
    let ata = env.owner_ata;
    borrow(&mut env, 300_000_000).unwrap();
    send(&mut env, &[repay_ix(&owner.pubkey(), ata, 300_000_001)], &[&owner])
        .map(|_| ())
        .expect_err("over-repay must fail");
    assert_code(send(&mut env, &[repay_ix(&owner.pubkey(), ata, 300_000_001)], &[&owner]), E_INVALID_AMOUNT);
    send(&mut env, &[repay_ix(&owner.pubkey(), ata, 100_000_000)], &[&owner]).unwrap();
    assert_eq!(read_position(&env, &owner.pubkey()).debt, 200_000_000);
    assert_eq!(token_balance(&env, &env.owner_ata), 200_000_000);
    check_invariants(&env);
    send(&mut env, &[repay_ix(&owner.pubkey(), ata, 200_000_000)], &[&owner]).unwrap();
    assert_eq!(read_position(&env, &owner.pubkey()).debt, 0);
    assert_eq!(token_balance(&env, &env.owner_ata), 0);
    check_invariants(&env);

    let ob = lamports(&env, &owner.pubkey());
    withdraw(&mut env, DEPOSIT).unwrap();
    assert_eq!(lamports(&env, &owner.pubkey()), ob + DEPOSIT);
    let p = read_position(&env, &owner.pubkey());
    assert_eq!(p.collateral_lamports, 0);
    assert_eq!(read_pool(&env).total_collateral, 0);
    check_invariants(&env);
}

#[test]
fn p06_healthy_position_not_liquidatable() {
    let mut env = setup();
    borrow(&mut env, pct(69)).unwrap();
    let liq = Keypair::new();
    env.svm.airdrop(&liq.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let liq_ata = create_token_account(&mut env, &liq.pubkey());
    let pos = position_pda(&env.owner.pubkey());
    assert_code(send(&mut env, &[liquidate_ix(&liq.pubkey(), liq_ata, pos)], &[&liq]), E_NOT_LIQUIDATABLE);
    // At the max price age (3600 s) the odds limit has fallen to the stale floor (5000),
    // far below LTV 6900: borrowing is blocked but the position is still not liquidatable.
    set_now(&mut env.svm, NOW + 3_600);
    assert_code(borrow(&mut env, 1), E_RISK_TIGHTENED);
    assert_code(send(&mut env, &[liquidate_ix(&liq.pubkey(), liq_ata, pos)], &[&liq]), E_NOT_LIQUIDATABLE);
    // Beyond the max price age nothing prices off the stale spot.
    set_now(&mut env.svm, NOW + 86_400);
    assert_code(borrow(&mut env, 1), E_STALE_PRICE);
    assert_code(send(&mut env, &[liquidate_ix(&liq.pubkey(), liq_ata, pos)], &[&liq]), E_STALE_PRICE);
    assert_eq!(read_position(&env, &env.owner.pubkey()).debt, pct(69));
    check_invariants(&env);
}

#[test]
fn p07_price_drop_liquidation() {
    let mut env = setup();
    let debt = pct(69);
    borrow(&mut env, debt).unwrap();
    let liq = Keypair::new();
    env.svm.airdrop(&liq.pubkey(), LAMPORTS_PER_SOL).unwrap();
    let liq_ata = create_token_account(&mut env, &liq.pubkey());
    // Owner hands the borrowed test USD to the liquidator.
    let owner = env.owner.insecure_clone();
    let t = spl_token::instruction::transfer(&spl_token::ID, &env.owner_ata, &liq_ata, &owner.pubkey(), &[], debt)
        .unwrap();
    send(&mut env, &[t], &[&owner]).unwrap();

    set_now(&mut env.svm, NOW + 60);
    let spot = SPOT * 85 / 100;
    post(&mut env, spot, ladder_scaled(85, 100));
    let feed_acc = env.svm.get_account(&feed_pda()).unwrap();
    let feed = brace::state::Feed::try_deserialize(&mut &feed_acc.data[..]).unwrap();
    assert!(feed.confident);
    let value = (DEPOSIT as u128 * spot as u128 / 1_000_000_000) as u64;
    assert!(debt as u128 * 10_000 > value as u128 * 8000, "LTV should exceed 8000");

    let pos = position_pda(&owner.pubkey());
    let lb = lamports(&env, &liq.pubkey());
    let logs = send(&mut env, &[liquidate_ix(&liq.pubkey(), liq_ata, pos)], &[&liq]).unwrap();
    assert!(logs.iter().any(|l| l.contains("brace liquidate")), "{logs:?}");

    let debt_lamports = (debt as u128 * 1_000_000_000).div_ceil(spot as u128) as u64;
    let seize = (debt_lamports as u128 * 10_500 / 10_000) as u64;
    assert!(seize < DEPOSIT);
    assert_eq!(lamports(&env, &liq.pubkey()), lb + seize);
    assert_eq!(token_balance(&env, &liq_ata), 0);
    let p = read_position(&env, &owner.pubkey());
    assert_eq!(p.debt, 0);
    assert_eq!(p.collateral_lamports, DEPOSIT - seize);
    assert_eq!(mint_supply(&env), 0);
    check_invariants(&env);
}

#[test]
fn p08_non_owner_cannot_use_position() {
    let mut env = setup();
    borrow(&mut env, pct(30)).unwrap();
    let attacker = Keypair::new();
    env.svm.airdrop(&attacker.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
    let att_ata = open_and_deposit(&mut env, &attacker, LAMPORTS_PER_SOL);
    let victim_pos = position_pda(&env.owner.pubkey());
    let before = read_position(&env, &env.owner.pubkey());

    let ix = borrow_ix(&attacker.pubkey(), victim_pos, att_ata, pct(10));
    assert_code(send(&mut env, &[ix], &[&attacker]), E_CONSTRAINT_SEEDS);
    let ix = withdraw_ix(&attacker.pubkey(), victim_pos, LAMPORTS_PER_SOL);
    assert_code(send(&mut env, &[ix], &[&attacker]), E_CONSTRAINT_SEEDS);
    // Borrowing into someone else's token account is rejected too.
    let ix = borrow_ix(&attacker.pubkey(), position_pda(&attacker.pubkey()), env.owner_ata, 1);
    send(&mut env, &[ix], &[&attacker]).map(|_| ()).expect_err("foreign token account must fail");

    let after = read_position(&env, &env.owner.pubkey());
    assert_eq!(after.debt, before.debt);
    assert_eq!(after.collateral_lamports, before.collateral_lamports);
    assert_eq!(token_balance(&env, &att_ata), 0);
    check_invariants(&env);
}

#[test]
fn p10_init_pool_admin_only() {
    let mut env = base();
    let rogue = Keypair::new();
    env.svm.airdrop(&rogue.pubkey(), LAMPORTS_PER_SOL).unwrap();
    assert_code(send(&mut env, &[init_pool_ix(&rogue.pubkey())], &[&rogue]), E_UNAUTHORIZED);
    assert!(env.svm.get_account(&pool_pda()).map(|a| a.data.is_empty()).unwrap_or(true));
    let a = env.admin.insecure_clone();
    send(&mut env, &[init_pool_ix(&a.pubkey())], &[&a]).unwrap();
    let pool = read_pool(&env);
    assert_eq!(pool.usd_mint, mint_pda());
    let m = spl_token::state::Mint::unpack(&env.svm.get_account(&mint_pda()).unwrap().data).unwrap();
    assert_eq!(m.decimals, 6);
    assert_eq!(m.mint_authority, Some(pool_pda()).into());
    assert!(m.freeze_authority.is_none());
    check_invariants(&env);
}
