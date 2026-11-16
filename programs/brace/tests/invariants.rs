//! Deterministic fuzz / invariant tests: random action sequences against the real
//! program in LiteSVM, with protocol invariants asserted after every action.
use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, program_pack::Pack, system_instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    anchor_spl::token::spl_token,
    brace::{
        instructions::QuoteArg,
        state::{collateral_value_e6, ltv_bps, Config, Feed, Pool, Position},
        DEFAULT_PARAMS,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    std::collections::BTreeMap,
};

const NOW: i64 = 1_794_844_800;
const SOL: [u8; 8] = *b"SOL\0\0\0\0\0";
const SPOT: u64 = 71_965_000;
const EXPIRY_OFFSET: i64 = 86_134;
const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

/// Matches brace::MAX_PRICE_AGE_SECS.
const MAX_PRICE_AGE: i64 = 3_600;

const SEEDS: u64 = 20;
const ACTIONS_PER_SEED: usize = 150;

// ---------- PRNG ----------

struct Rng(u64);
impl Rng {
    fn new(seed: u64) -> Self {
        // splitmix64 to spread small seeds; never zero.
        let mut z = seed.wrapping_add(0x9E37_79B9_7F4A_7C15);
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^= z >> 31;
        Rng(if z == 0 { 1 } else { z })
    }
    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x
    }
    /// Uniform in [lo, hi] inclusive.
    fn range(&mut self, lo: u64, hi: u64) -> u64 {
        if hi <= lo {
            return lo;
        }
        lo + self.next() % (hi - lo + 1)
    }
    fn below(&mut self, n: u64) -> u64 {
        if n == 0 {
            0
        } else {
            self.next() % n
        }
    }
    fn chance(&mut self, pct: u64) -> bool {
        self.below(100) < pct
    }
}

// ---------- PDAs / helpers (copied from pool.rs / oracle.rs) ----------

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &brace::id()).0
}
fn config_pda() -> Pubkey {
    pda(&[b"config"])
}
fn feed_pda_sym(sym: &[u8; 8]) -> Pubkey {
    pda(&[b"feed", sym.as_ref()])
}
fn feed_pda() -> Pubkey {
    feed_pda_sym(&SOL)
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

const BASE_LADDER: [(u64, u16, u16); 8] = [
    (67_000_000, 9100, 9600),
    (68_000_000, 8800, 9100),
    (69_000_000, 8200, 8500),
    (70_000_000, 7200, 7600),
    (71_000_000, 5900, 6400),
    (72_000_000, 4400, 5000),
    (73_000_000, 3100, 3700),
    (74_000_000, 2000, 2600),
];

/// The real SOL ladder with strikes scaled by num/den.
fn ladder_scaled(num: u64, den: u64) -> Vec<QuoteArg> {
    BASE_LADDER
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

fn post_ix(signer: &Pubkey, symbol: [u8; 8], expiry_ts: i64, spot_e6: u64, quotes: Vec<QuoteArg>) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::PostQuotes { symbol, expiry_ts, ticker: ticker(), spot_e6, quotes }.data(),
        brace::accounts::PostQuotes {
            relayer: *signer,
            config: config_pda(),
            feed: feed_pda_sym(&symbol),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn init_ix(admin: &Pubkey, relayer: Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::Initialize { params: DEFAULT_PARAMS, relayer }.data(),
        brace::accounts::Initialize { admin: *admin, config: config_pda(), system_program: system_program::ID }
            .to_account_metas(None),
    )
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

fn deposit_ix(owner: &Pubkey, lamports: u64) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::Deposit { lamports }.data(),
        brace::accounts::Deposit {
            owner: *owner,
            position: position_pda(owner),
            pool: pool_pda(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn borrow_ix(owner: &Pubkey, owner_token: Pubkey, amount: u64) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::Borrow { amount }.data(),
        brace::accounts::Borrow {
            owner: *owner,
            position: position_pda(owner),
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

fn withdraw_ix(owner: &Pubkey, lamports: u64) -> Instruction {
    Instruction::new_with_bytes(
        brace::id(),
        &brace::instruction::Withdraw { lamports }.data(),
        brace::accounts::Withdraw {
            owner: *owner,
            position: position_pda(owner),
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

// ---------- Simulation ----------

#[derive(Default)]
struct Stat {
    attempted: u64,
    succeeded: u64,
}

type Counts = BTreeMap<&'static str, Stat>;

struct Sim {
    svm: LiteSVM,
    payer: Keypair,
    admin: Keypair,
    relayer: Keypair,
    /// Index 0..3 are users, index 3 is the liquidator (it also owns a position).
    owners: Vec<Keypair>,
    atas: Vec<Pubkey>,
    now: i64,
    config_bytes: Vec<u8>,
    /// Effective limit after the previous action; None right after a confident post.
    prev_eff: u16,
}

const LIQ: usize = 3;

impl Sim {
    fn send(&mut self, ixs: &[Instruction], signers: &[&Keypair]) -> Result<(), String> {
        self.svm.expire_blockhash();
        let bh = self.svm.latest_blockhash();
        let msg = Message::new_with_blockhash(ixs, Some(&self.payer.pubkey()), &bh);
        let mut all: Vec<&Keypair> = vec![&self.payer];
        for s in signers {
            if s.pubkey() != self.payer.pubkey() {
                all.push(s);
            }
        }
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &all).unwrap();
        self.svm.send_transaction(tx).map(|_| ()).map_err(|e| format!("{:?}", e.err))
    }

    fn feed(&self) -> Feed {
        let a = self.svm.get_account(&feed_pda()).expect("feed exists");
        Feed::try_deserialize(&mut &a.data[..]).unwrap()
    }
    fn config(&self) -> Config {
        let a = self.svm.get_account(&config_pda()).unwrap();
        Config::try_deserialize(&mut &a.data[..]).unwrap()
    }
    fn pool(&self) -> Pool {
        let a = self.svm.get_account(&pool_pda()).unwrap();
        Pool::try_deserialize(&mut &a.data[..]).unwrap()
    }
    fn position(&self, i: usize) -> Position {
        let a = self.svm.get_account(&position_pda(&self.owners[i].pubkey())).unwrap();
        Position::try_deserialize(&mut &a.data[..]).unwrap()
    }
    fn mint_supply(&self) -> u64 {
        let a = self.svm.get_account(&mint_pda()).unwrap();
        spl_token::state::Mint::unpack(&a.data).unwrap().supply
    }
    fn token_balance(&self, acc: &Pubkey) -> u64 {
        let a = self.svm.get_account(acc).unwrap();
        spl_token::state::Account::unpack(&a.data).unwrap().amount
    }
    fn lamports(&self, k: &Pubkey) -> u64 {
        self.svm.get_account(k).map(|a| a.lamports).unwrap_or(0)
    }
    /// Invariant 8 precondition: the SOL price cannot be used (missing or older than 3600 s).
    fn price_stale(&self) -> bool {
        let f = self.feed();
        !f.has_valid || f.spot_e6 == 0 || self.now - f.last_valid_at > MAX_PRICE_AGE
    }
    fn eff(&self) -> u16 {
        self.feed().effective_ltv_bps(&DEFAULT_PARAMS, self.now)
    }
    fn pos_ltv(&self, i: usize) -> u64 {
        let p = self.position(i);
        let value = collateral_value_e6(p.collateral_lamports, self.feed().spot_e6).unwrap();
        ltv_bps(p.debt, value).unwrap()
    }

    fn create_token_account(&mut self, owner: &Pubkey) -> Pubkey {
        let acc = Keypair::new();
        let rent = self.svm.minimum_balance_for_rent_exemption(spl_token::state::Account::LEN);
        let create = system_instruction::create_account(
            &self.payer.pubkey(),
            &acc.pubkey(),
            rent,
            spl_token::state::Account::LEN as u64,
            &spl_token::ID,
        );
        let init =
            spl_token::instruction::initialize_account3(&spl_token::ID, &acc.pubkey(), &mint_pda(), owner).unwrap();
        self.send(&[create, init], &[&acc]).unwrap();
        acc.pubkey()
    }

    fn setup() -> Sim {
        let mut svm = LiteSVM::new();
        let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/brace.so"));
        svm.add_program(brace::id(), bytes).unwrap();
        set_now(&mut svm, NOW);
        let (payer, admin, relayer) = (Keypair::new(), Keypair::new(), Keypair::new());
        svm.airdrop(&payer.pubkey(), 1_000 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&admin.pubkey(), 10 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&relayer.pubkey(), 10 * LAMPORTS_PER_SOL).unwrap();
        let owners: Vec<Keypair> = (0..4).map(|_| Keypair::new()).collect();
        for (i, o) in owners.iter().enumerate() {
            let amt = if i == LIQ { 6_000 } else { 500 } * LAMPORTS_PER_SOL;
            svm.airdrop(&o.pubkey(), amt).unwrap();
        }
        let mut sim = Sim {
            svm,
            payer,
            admin,
            relayer,
            owners,
            atas: vec![],
            now: NOW,
            config_bytes: vec![],
            prev_eff: 0,
        };

        let admin = sim.admin.insecure_clone();
        let relayer = sim.relayer.insecure_clone();
        sim.send(&[init_ix(&admin.pubkey(), relayer.pubkey())], &[&admin]).unwrap();
        sim.send(&[post_ix(&relayer.pubkey(), SOL, NOW + EXPIRY_OFFSET, SPOT, ladder_scaled(1, 1))], &[&relayer])
            .unwrap();
        assert!(sim.feed().confident, "real SOL ladder must be confident");
        sim.send(&[init_pool_ix(&admin.pubkey())], &[&admin]).unwrap();

        for i in 0..4 {
            let o = sim.owners[i].insecure_clone();
            let dep = if i == LIQ { 5_000 } else { 10 } * LAMPORTS_PER_SOL;
            sim.send(&[open_position_ix(&o.pubkey()), deposit_ix(&o.pubkey(), dep)], &[&o]).unwrap();
            let ata = sim.create_token_account(&o.pubkey());
            sim.atas.push(ata);
        }
        // Liquidator funds itself with test USD from its own borrowing position (~28% LTV).
        let l = sim.owners[LIQ].insecure_clone();
        let ata = sim.atas[LIQ];
        sim.send(&[borrow_ix(&l.pubkey(), ata, 100_000_000_000)], &[&l]).unwrap();
        assert_eq!(sim.token_balance(&ata), 100_000_000_000);

        let cfg = sim.config();
        assert_eq!(cfg.params, DEFAULT_PARAMS);
        assert_eq!(cfg.relayer, sim.relayer.pubkey());
        sim.config_bytes = sim.svm.get_account(&config_pda()).unwrap().data;
        sim.prev_eff = sim.eff();
        sim.check_global("setup");
        sim
    }

    /// Invariants 1, 2, 5 (config part), 6, 7. Confident posts reset invariant 2.
    fn check_global(&mut self, ctx: &str) {
        let p = DEFAULT_PARAMS;
        let feed = self.feed();
        let eff = feed.effective_ltv_bps(&p, self.now);

        // 1. effective limit <= gov max
        assert!(eff <= p.gov_max_ltv_bps, "[{ctx}] inv1: eff {eff} > gov_max {}", p.gov_max_ltv_bps);

        // 2. non-increasing while no confident post (caller resets prev_eff on confident posts)
        assert!(eff <= self.prev_eff, "[{ctx}] inv2: eff rose {} -> {eff} without a confident post", self.prev_eff);
        self.prev_eff = eff;

        // 5. config never changes
        let cfg_now = self.svm.get_account(&config_pda()).unwrap().data;
        assert_eq!(cfg_now, self.config_bytes, "[{ctx}] inv5: config changed");

        // 6. supply <= total_debt == sum of debts (holders may burn test USD themselves)
        let pool = self.pool();
        let positions: Vec<Position> = (0..4).map(|i| self.position(i)).collect();
        let sum_debt: u64 = positions.iter().map(|x| x.debt).sum();
        let sum_coll: u64 = positions.iter().map(|x| x.collateral_lamports).sum();
        let supply = self.mint_supply();
        assert!(supply <= pool.total_debt, "[{ctx}] inv6: supply {supply} > total_debt {}", pool.total_debt);
        assert_eq!(pool.total_debt, sum_debt, "[{ctx}] inv6: total_debt vs sum of debts");

        // 7. pool lamports cover collateral + rent; total_collateral == sum
        let acc = self.svm.get_account(&pool_pda()).unwrap();
        let rent = self.svm.minimum_balance_for_rent_exemption(acc.data.len());
        assert!(
            acc.lamports >= pool.total_collateral + rent,
            "[{ctx}] inv7: pool lamports {} < collateral {} + rent {rent}",
            acc.lamports,
            pool.total_collateral
        );
        assert_eq!(pool.total_collateral, sum_coll, "[{ctx}] inv7: total_collateral vs sum");
    }

    /// Invariant 3: the touched position's LTV is within the effective limit now.
    fn check_touched(&self, i: usize, ctx: &str) {
        let ltv = self.pos_ltv(i);
        let eff = self.eff();
        assert!(ltv <= eff as u64, "[{ctx}] inv3: touched position {i} ltv {ltv} > effective limit {eff}");
    }

    fn rand_quotes_post(&mut self, rng: &mut Rng) -> (&'static str, i64, u64, Vec<QuoteArg>) {
        let f = rng.range(7_000, 13_000);
        let spot = SPOT * f / 10_000;
        let expiry = self.now + EXPIRY_OFFSET;
        let ladder = ladder_scaled(f, 10_000);
        match rng.below(100) {
            0..=54 => ("ladder", expiry, spot, ladder),
            55..=64 => {
                let start = rng.below(7) as usize;
                ("thin", expiry, spot, ladder[start..start + 2].to_vec())
            }
            65..=76 => {
                let far = match rng.below(4) {
                    0 => 0,
                    1 => spot * rng.range(30, 90) / 100,
                    2 => spot * rng.range(110, 200) / 100,
                    _ => spot * rng.range(95, 105) / 100,
                };
                ("spot_far", expiry, far, ladder)
            }
            77..=82 => {
                let e = if rng.chance(50) { self.now + rng.range(0, 899) as i64 } else { self.now + 259_201 + rng.below(100_000) as i64 };
                ("bad_expiry", e, spot, ladder)
            }
            83..=87 => {
                let mut q = ladder.clone();
                q.extend(ladder.clone());
                q.push(ladder[0]);
                ("too_many", expiry, spot, q)
            }
            88..=93 => {
                let n = rng.below(17) as usize;
                let q = (0..n)
                    .map(|_| QuoteArg {
                        strike_e6: if rng.chance(20) { rng.next() } else { spot * rng.range(80, 120) / 100 },
                        bid_bps: rng.below(11_000) as u16,
                        ask_bps: rng.below(11_000) as u16,
                    })
                    .collect();
                ("garbage", expiry, spot, q)
            }
            _ => {
                // Subset of the ladder with jittered bids/asks.
                let mut q = Vec::new();
                for x in &ladder {
                    if !rng.chance(70) {
                        continue;
                    }
                    let j = rng.range(0, 400) as i32 - 200;
                    q.push(QuoteArg {
                        strike_e6: x.strike_e6,
                        bid_bps: (x.bid_bps as i32 + j).clamp(0, 10_000) as u16,
                        ask_bps: (x.ask_bps as i32 + j).clamp(0, 10_000) as u16,
                    });
                }
                ("jitter", expiry, spot, q)
            }
        }
    }

    fn step(&mut self, rng: &mut Rng, counts: &mut Counts, ctx: &str) {
        let roll = rng.below(100);
        let user = rng.below(3) as usize;
        let (kind, ok): (&'static str, bool) = match roll {
            // deposit
            0..=13 => {
                let o = self.owners[user].insecure_clone();
                let bal = self.lamports(&o.pubkey());
                let amt = match rng.below(6) {
                    0 => 0,
                    1 => rng.range(1, 1_000),
                    2 => u64::MAX,
                    3 => bal,
                    4 => bal + rng.range(1, LAMPORTS_PER_SOL),
                    _ => rng.range(1, 20 * LAMPORTS_PER_SOL),
                };
                ("deposit", self.send(&[deposit_ix(&o.pubkey(), amt)], &[&o]).is_ok())
            }
            // borrow
            14..=33 => {
                let o = self.owners[user].insecure_clone();
                let pos = self.position(user);
                let feed = self.feed();
                let value = collateral_value_e6(pos.collateral_lamports, feed.spot_e6).unwrap();
                let max_debt = (value as u128 * self.eff() as u128 / 10_000) as u64;
                let room = max_debt.saturating_sub(pos.debt);
                let amt = match rng.below(7) {
                    0 => 0,
                    1 => rng.range(1, 1_000),
                    2 => u64::MAX,
                    3 | 4 => room,
                    5 => room + rng.range(1, 1_000),
                    _ => rng.range(1, room.max(1)),
                };
                let stale = self.price_stale();
                let ok = self.send(&[borrow_ix(&o.pubkey(), self.atas[user], amt)], &[&o]).is_ok();
                if stale {
                    // 8. nothing prices off a stale spot
                    assert!(!ok, "[{ctx}] inv8: borrow succeeded on a stale price");
                    counts.entry("stale_blocked").or_default().attempted += 1;
                }
                if ok {
                    self.check_touched(user, ctx);
                }
                ("borrow", ok)
            }
            // repay
            34..=45 => {
                let o = self.owners[user].insecure_clone();
                let debt = self.position(user).debt;
                let amt = match rng.below(6) {
                    0 => 0,
                    1 => rng.range(1, 1_000),
                    2 => u64::MAX,
                    3 => debt,
                    4 => debt + 1,
                    _ => rng.range(1, debt.max(1)),
                };
                ("repay", self.send(&[repay_ix(&o.pubkey(), self.atas[user], amt)], &[&o]).is_ok())
            }
            // withdraw
            46..=60 => {
                let o = self.owners[user].insecure_clone();
                let pos = self.position(user);
                let feed = self.feed();
                let eff = self.eff() as u128;
                // Largest withdrawal that keeps LTV within the limit (approximate, +1 lamport margin).
                let safe = if pos.debt == 0 {
                    pos.collateral_lamports
                } else if feed.spot_e6 == 0 || eff == 0 {
                    0
                } else {
                    let need_value = (pos.debt as u128 * 10_000).div_ceil(eff);
                    let need = (need_value * LAMPORTS_PER_SOL as u128).div_ceil(feed.spot_e6 as u128) + 1;
                    (pos.collateral_lamports as u128).saturating_sub(need) as u64
                };
                let amt = match rng.below(7) {
                    0 => 0,
                    1 => rng.range(1, 1_000),
                    2 => u64::MAX,
                    3 => pos.collateral_lamports,
                    4 | 5 => safe,
                    _ => rng.range(1, pos.collateral_lamports.max(1)),
                };
                let stale_with_debt = self.price_stale() && pos.debt > 0;
                let ok = self.send(&[withdraw_ix(&o.pubkey(), amt)], &[&o]).is_ok();
                if stale_with_debt {
                    // 8. with debt outstanding, a stale price blocks withdrawals
                    assert!(!ok, "[{ctx}] inv8: withdraw with debt succeeded on a stale price");
                    counts.entry("stale_blocked").or_default().attempted += 1;
                }
                if ok {
                    self.check_touched(user, ctx);
                }
                ("withdraw", ok)
            }
            // liquidate
            61..=72 => {
                let target = if rng.chance(50) {
                    (0..4).max_by_key(|&i| self.pos_ltv(i)).unwrap()
                } else {
                    rng.below(4) as usize
                };
                let pre_ltv = self.pos_ltv(target);
                let pre = self.position(target);
                let l = self.owners[LIQ].insecure_clone();
                let ix = liquidate_ix(&l.pubkey(), self.atas[LIQ], position_pda(&self.owners[target].pubkey()));
                let stale = self.price_stale();
                let spot = self.feed().spot_e6;
                let ok = self.send(&[ix], &[&l]).is_ok();
                if stale {
                    // 8. no liquidation on a stale price
                    assert!(!ok, "[{ctx}] inv8: liquidation succeeded on a stale price");
                    counts.entry("stale_blocked").or_default().attempted += 1;
                }
                if ok {
                    // 4. only on positions above the hard threshold by true value
                    let true_ltv = brace::math::liq_ltv_bps(pre.debt, pre.collateral_lamports, spot).unwrap();
                    assert!(
                        true_ltv > DEFAULT_PARAMS.liq_threshold_bps as u64,
                        "[{ctx}] inv4: liquidated position {target} with true LTV {true_ltv}"
                    );
                    assert!(
                        pre_ltv > DEFAULT_PARAMS.liq_threshold_bps as u64,
                        "[{ctx}] inv4: liquidated position {target} with pre-LTV {pre_ltv} (debt {}, coll {})",
                        pre.debt,
                        pre.collateral_lamports
                    );
                    assert_eq!(self.position(target).debt, 0, "[{ctx}] liquidation must clear debt");
                }
                ("liquidate", ok)
            }
            // clock jump 0..2h
            73..=80 => {
                self.now += rng.range(0, 7_200) as i64;
                set_now(&mut self.svm, self.now);
                ("clock", true)
            }
            // relayer post
            81..=93 => {
                let (variant, expiry, spot, quotes) = self.rand_quotes_post(rng);
                let r = self.relayer.insecure_clone();
                let before_raw = self.svm.get_account(&feed_pda()).unwrap().data;
                let before = self.feed();
                let ok = self.send(&[post_ix(&r.pubkey(), SOL, expiry, spot, quotes)], &[&r]).is_ok();
                let after = self.feed();
                if ok && after.confident {
                    // A confident post may raise the limit; restart invariant 2's window.
                    self.prev_eff = DEFAULT_PARAMS.gov_max_ltv_bps;
                    let c = counts.entry("post_confident").or_default();
                    c.attempted += 1;
                    c.succeeded += 1;
                } else if ok {
                    // Non-confident: the risk state and the spot are untouched.
                    assert_eq!(after.spot_e6, before.spot_e6, "[{ctx}] non-confident post moved spot");
                    assert_eq!(after.max_ltv_bps, before.max_ltv_bps, "[{ctx}] non-confident post changed max_ltv");
                    assert_eq!(after.last_valid_at, before.last_valid_at, "[{ctx}] non-confident post changed last_valid_at");
                    assert_eq!(after.has_valid, before.has_valid, "[{ctx}] non-confident post changed has_valid");
                    let c = counts.entry("post_unconfident").or_default();
                    c.attempted += 1;
                    c.succeeded += 1;
                } else {
                    let after_raw = self.svm.get_account(&feed_pda()).unwrap().data;
                    assert_eq!(after_raw, before_raw, "[{ctx}] failed post mutated feed");
                }
                let _ = variant;
                ("relayer_post", ok)
            }
            // non-relayer post attempts
            _ => {
                let before = self.svm.get_account(&feed_pda()).unwrap().data;
                let (_, expiry, spot, quotes) = self.rand_quotes_post(rng);
                let mode = rng.below(4);
                let res = match mode {
                    0 | 1 => {
                        let who = if mode == 0 { self.owners[user].insecure_clone() } else { self.admin.insecure_clone() };
                        self.send(&[post_ix(&who.pubkey(), SOL, expiry, spot, quotes)], &[&who])
                    }
                    2 => {
                        let rogue = Keypair::new();
                        self.svm.airdrop(&rogue.pubkey(), LAMPORTS_PER_SOL).unwrap();
                        self.send(&[post_ix(&rogue.pubkey(), SOL, expiry, spot, quotes)], &[&rogue])
                    }
                    _ => {
                        // Relayer key passed but not signing.
                        let mut ix = post_ix(&self.relayer.pubkey(), SOL, expiry, spot, quotes);
                        ix.accounts[0].is_signer = false;
                        self.send(&[ix], &[])
                    }
                };
                // 5. only relayer posts succeed
                assert!(res.is_err(), "[{ctx}] inv5: non-relayer post (mode {mode}) succeeded");
                let after = self.svm.get_account(&feed_pda()).unwrap().data;
                assert_eq!(after, before, "[{ctx}] inv5: rejected post mutated feed");
                ("non_relayer_post", false)
            }
        };
        let c = counts.entry(kind).or_default();
        c.attempted += 1;
        if ok {
            c.succeeded += 1;
        }
        self.check_global(ctx);
    }
}

#[test]
fn fuzz_invariants() {
    let mut counts: Counts = BTreeMap::new();
    let mut total = 0usize;
    for seed in 1..=SEEDS {
        let mut rng = Rng::new(seed);
        let mut sim = Sim::setup();
        for step in 0..ACTIONS_PER_SEED {
            let ctx = format!("seed {seed} step {step}");
            sim.step(&mut rng, &mut counts, &ctx);
            total += 1;
        }
    }
    eprintln!("invariants: {total} actions over {SEEDS} seeds");
    for (k, s) in &counts {
        eprintln!("  {k:<18} attempted {:>5}  succeeded {:>5}", s.attempted, s.succeeded);
    }
    assert!(total >= 2_000);
    for k in ["deposit", "borrow", "repay", "withdraw", "liquidate", "clock", "relayer_post", "post_confident", "post_unconfident"] {
        let s = counts.get(k).map(|s| s.succeeded).unwrap_or(0);
        assert!(s >= 3, "coverage: {k} succeeded only {s} times");
    }
    let stale = counts.get("stale_blocked").map(|s| s.attempted).unwrap_or(0);
    assert!(stale >= 3, "coverage: stale-price actions attempted only {stale} times");
    assert_eq!(counts.get("non_relayer_post").map(|s| s.succeeded).unwrap_or(0), 0);
}
