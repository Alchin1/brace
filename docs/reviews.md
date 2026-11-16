# Reviews and security passes

Fix commit for passes 1 to 4: see 'fix: review findings' in git log. Retest: 47 tests pass (15 math, 11 adversarial, 1 fuzz with 3,000 actions, 11 oracle, 9 pool).

## Pass 1 (functional correctness) and Pass 2 (access control), fresh reviewer, Nov 17

Findings (no critical/high):
- F1 medium: one kept strike beyond ±15% of K_ref aborts the whole fit (math.rs:161), so high-vol or long-dated ladders (ZEC) never go confident. Fix: skip that quote instead.
- F2 medium: spot_e6 written on every post with no check; spot 0 would make every indebted position liquidatable (post_quotes.rs:129). Fix: require spot > 0 and only move the pricing spot on confident posts.
- F3 low: liquidation uses borrow-side rounding, liquidatable by dust at exactly 80%. Fix: floor LTV for the liquidation check.
- F4 low: mid snapped to grid before the 3-97% range check. Fix: check range before snapping.
- F5, F6 info: sub-bps rounding direction in spot gap and horizon move.
- F7 info: spec drift (check_borrow not built, init_pool split, set_relayer, 4-term ln). Fix: update spec.
- F8 info: invariant 6 should be supply <= sum of debts (holders can burn).
- A1 medium: anyone can pre-fund the usd_mint PDA and block init_pool forever (init_pool.rs:31-43). Fix: top-up/allocate/assign path.
- A2 medium: initialize can be front-run after deploy (initialize.rs). Fix: require the program upgrade authority, plus deploy and initialize in one script.
- A3 low: set_relayer accepts the default pubkey. Fix: reject it.
- A4, A5, A6 info: bump search cost, self-liquidation allowed, missing pre-fund tests.

## Pass 3 (financial logic) and Pass 4 (adversarial), fresh reviewer, Nov 17

8 extra LiteSVM tests run in /tmp. No critical/high. Financial math sound (probit table matches to 1e-6, no overflow, rounding favors the pool on borrow/withdraw).
- A1 medium: initialize front-run (same as Pass 2 A2).
- A2 medium: usd_mint PDA pre-fund bricks init_pool, proven by test.
- A3 medium: non-confident post still moves spot; spot x10 enabled over-borrowing, spot 0 let a liquidator take 10 SOL for 1 test USD. Proven by tests.
- A4 low: spot has no age limit; 30 days stale still allows 50% borrows.
- A5 low: degenerate 3-quote ladder gives sigma 0, confident, limit jumps to gov max.
- A6 low: far strike aborts the fit (same as Pass 1 F1).
- F1 low: dust rounding makes exactly-80% positions liquidatable.
- F2 info: invariant 6 should be supply <= total_debt.
- F3 info: code stricter than spec pseudo-code (code is right).
- F4 info: full-debt liquidation only.
- CU for post_quotes with 16 quotes: 61,610 first post, 59,317 update.

## Accepted risks (go in README Known limitations)
- Relayer is trusted for quotes and spot. Mitigations: spot moves only on confident posts, must be within 3% of the ladder-implied median, and goes stale after 1 hour.
- initialize can be front-run between deploy and setup. Mitigation: deploy, initialize and init_pool run back to back from one script, then admin is verified onchain.
- Liquidation repays the full debt only (no partial liquidation); test USD has no value.
- check_borrow CPI not built (cut for time).
