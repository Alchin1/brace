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

## Pass 5 (independent final review), Grok, Nov 17

Scope: `programs/brace` (math.rs fixed-point correctness and overflow, PDA/account validation, signer/owner checks, `post_quotes` Feed creation, borrow/`check_limit`/liquidate, stale handling, `set_params` bounds, "odds only tighten"), cross-checked against `docs/spec.md` and passes 1-4. No code changes in this pass.

Baseline on `main` at c740ede (program last changed in 9b432ef): `anchor build --ignore-keys` exit 0 (one `cargo-build-sbf` warning: crate types `cdylib` + `lib` preclude LTO; no rustc warnings); `cargo test -p brace` 47 passed, 0 failed (15 math, 11 adversarial, 1 fuzz in 49.76s, 11 oracle, 9 pool). `post_quotes` with 16 quotes: 68,416 CU on first post (create), 66,122 CU on update, both confident (from `a11_post_quotes_16_compute_units`).

No critical or high findings. Prior accepted risks still stand. Fixes from passes 1-4 (spot only on confident posts, 1-hour price age, prefund-safe mint and feed PDAs, far strikes skipped, degenerate span rejected, dust liquidation rounding, `set_relayer` rejects default) still hold in the current code.

Findings:
- F1 medium: `Withdraw` always requires a deserialized SOL Feed (`withdraw.rs:31-32`). A user who opens a position and deposits after `init_pool` but before the first `post_quotes` cannot withdraw, even with zero debt. The handler correctly skips `check_limit` when debt is 0 (`withdraw.rs:40-43`), but Anchor still demands the account and fails if the PDA does not exist. Funds are not stolen; they are locked until any SOL post creates the Feed (a non-confident post is enough). Fix: create a placeholder SOL Feed in `init_pool`, or make `sol_feed` optional and require it only when `position.debt > 0`. Until then, Task 7 should keep `init_pool` and the first SOL post back to back, and the app should not offer deposit before the SOL feed exists. **Fixed:** `sol_feed` is now an `UncheckedAccount` checked only when `debt > 0`; a zero-debt withdraw succeeds if the Feed does not exist. Test: `a12_zero_debt_withdraw_without_feed`.
- F2 low: `initialize` accepts `Pubkey::default()` as the relayer (`initialize.rs:20-27`), unlike `set_relayer` (`set_params.rs:24`). Quotes cannot be posted until admin calls `set_relayer`. Not a permanent brick. Fix: reject the default key in `handle_initialize` the same way. **Fixed:** `handle_initialize` rejects the default key with `InvalidParams`. Test: `t12_initialize_default_relayer_rejected`.
- F3 low: `Params::is_valid` allows `stale_step_bps == 0` (`state.rs:33`). `effective_limit_bps` then never steps down, so stale data keeps the last confident limit until the 1-hour `StalePrice` guard. Admin-only. Fix: require `stale_step_bps >= 1`.
- F4 low: `set_params` can lower `liq_threshold_bps` (and `gov_max_ltv_bps`) so a previously healthy position becomes immediately liquidatable with no price change (`set_params.rs:17-20`, `liquidate.rs:35`). Admin-only governance power, not an odds-driven liquidation. Fix: document it under Known limitations, or reject a new threshold that would liquidate any current position.
- F5 low: `post_quotes` only requires `spot_e6 > 0` (`post_quotes.rs:97`); strikes have no upper bound. A confident post with extreme values can make `collateral_value_e6` or `liq_ltv_bps` return `MathOverflow` and pause borrow, withdraw-with-debt, and liquidate until a later sensible confident post. The relayer is already a trusted party (accepted risk). Fix: cap `spot_e6` and strikes at a generous finite bound.
- F6 info: dead `if spot == 0` branch in `liquidate.rs:37-38`; `fresh_spot_e6` already fails on a zero spot.
- F7 info: remaining spec drift (same family as Pass 1 F7). `check_borrow` is not built; `initialize` does not create the Pool or mint; the ln series is 4-term in code vs 3-term in the spec; a never-valid or >1-hour-old feed fails `StalePrice` rather than lending at `stale_floor` (the code is stricter and fail-safe). A new *confident* post may raise `max_ltv_bps` up to `gov_max`; stale and non-confident posts cannot raise the effective limit. That is the "odds only tighten" rule as implemented, and it holds.

Checked and not issues: PDA seeds and stored bumps; admin `has_one` / relayer constraint; position `has_one = owner`; pool `has_one = usd_mint`; mint authority is the pool PDA; Feed create/update (system-owned prefund uses allocate+assign; program-owned accounts are deserialized); non-confident posts do not move spot, `max_ltv_bps`, `has_valid`, or `last_valid_at`; `vol_limit_bps` clamps to `[abs_floor, gov_max]`; stale decay is non-increasing and never above `min(max_ltv, gov_max)` or below `min(stale_floor, base)`; borrow/withdraw LTV rounds up, liquidation LTV floors and uses only `liq_threshold`; `pay_from_pool` keeps the pool rent-exempt. Math uses `checked_*` / `Option` and did not panic on the existing 5k-case property tests.

F1 and F2 were fixed after this pass (tests first). F3–F7 are still open. The program id was switched to `Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC`.
