# Brace: spec

Submission closes Fri Nov 20, 7:00 PM Lagos (12:00 PM CST). Devnet only. Test funds only.

## What it does (happy path)

1. Every minute, the relayer posts Gemini's live price-ladder quotes for SOL, BTC, ETH, XRP, ZEC and silver to the Brace program.
2. The program fits the ladder onchain, stores implied volatility, a confidence flag and a max LTV per asset.
3. A judge opens the app with no wallet and sees the risk board: per-asset implied vol, max LTV, last update, explorer link.
4. A user with a devnet wallet deposits SOL, tries to borrow test USDC above SOL's live limit: the transaction fails onchain with `RiskTightened`. Borrows under the limit succeed.
5. QuickNode Streams delivers every Brace transaction (including failed borrows) to a webhook; the app shows the history timeline and the blocked-borrow feed.
6. Alchin's accuracy tracker reads the history and reports how often price stayed inside Brace's predicted band.

Edge cases that matter for money or safety:
- Stale or low-confidence data: limits never loosen (see Risk rule).
- Liquidation uses only the fixed threshold, never odds.
- Withdrawals are checked against the same live limit as borrows.

## What it must never do

- Raise any limit above the governance max.
- Liquidate anyone because the odds moved.
- Loosen a limit when data is stale, thin or missing.
- Let anyone but the configured relayer post quotes, or anyone but the admin change parameters.
- Hold keys, seeds or tokens in the repo, logs or chat.

## Architecture

| Component | Choice | Why (one line) |
|---|---|---|
| Program | Anchor 1.2.2, Rust, one program `brace` | Toolchain proven in the workspace; tests run in LiteSVM without RPC |
| Math | Integer fixed point, probit lookup table | Deterministic, no floats onchain, every step testable |
| Relayer | Cloudflare Worker, cron every minute | Free minute-level cron; you've deployed Workers before (Sentinel402) |
| Streams sink | Same Worker: `/streams` webhook, D1 (SQLite) | One deploy, no extra accounts |
| History API | Same Worker: `/history?asset=SOL` | Feeds the app and Alchin's tracker |
| App | Next.js on Vercel, wallet adapter (Phantom, Solflare) | Your usual GitHub-to-Vercel path; works in Phantom's in-app browser |
| Accuracy tracker | Python script (Alchin) | His stack; reads `/history` |

Data flow: Gemini public API → Worker cron → `post_quotes` tx (relayer key) → Brace program → QuickNode Stream (devnet, filtered to the program id) → Worker `/streams` → D1 → `/history` → app and tracker.

## Program

### Accounts

- `Config` PDA `["config"]`: admin, relayer, test USDC mint, parameters:
  - `gov_max_ltv_bps` = 7500
  - `liq_threshold_bps` = 8000
  - `horizon_secs` = 86400 (24 h liquidation-risk window)
  - `k_x100` = 300 (3-sigma buffer)
  - `abs_floor_ltv_bps` = 3000 (limit never computed below this)
  - `stale_secs` = 300 (5 min without a valid post = stale)
  - `stale_step_bps` = 250 (each stale window lowers the limit by 2.5 points)
  - `stale_floor_ltv_bps` = 5000
  - `max_spread_bps` = 1500, `min_points` = 3, `max_expiry_secs` = 259200 (72 h), `min_expiry_secs` = 900 (15 min)
  - `max_spot_gap_bps` = 300 (spot vs implied median sanity check)
- `Feed` PDA `["feed", symbol]` (symbol is 8 bytes, e.g. `SOL`): spot (e6), implied median (e6), sigma annual (bps), horizon move (bps), points used, expiry, Gemini event ticker (32 bytes), confident flag, `max_ltv_bps` (from the last confident post), `last_valid_at`, `posted_at`.
- `Pool` PDA `["pool"]`: holds SOL collateral as lamports; mint authority of test USDC.
- `Position` PDA `["position", owner]`: collateral lamports, debt (test USDC base units, 6 decimals).

### Instructions

| Instruction | Who | Does |
|---|---|---|
| `initialize(params, relayer)` | admin, once | Creates Config, Pool, test USDC mint |
| `set_params(params)` | admin | Updates parameters within hard bounds |
| `post_quotes(symbol, expiry_ts, ticker, spot_e6, quotes[≤16])` | relayer | Runs the fit, updates Feed |
| `deposit(lamports)` | user | Adds SOL collateral |
| `borrow(amount)` | user | Mints test USDC if new LTV ≤ effective limit, else `RiskTightened` |
| `repay(amount)` | user | Burns test USDC, reduces debt |
| `withdraw(lamports)` | user | Returns SOL if resulting LTV ≤ effective limit |
| `liquidate(owner)` | anyone | If LTV > liquidation threshold: burns the liquidator's test USDC for the debt, pays collateral plus 5% bonus |
| `check_borrow(ltv_bps)` | any program, by CPI | Fails with `RiskTightened` if `ltv_bps` > SOL's effective limit (composability proof; nice-to-have) |

Quote format: `{ strike_e6: u64, bid_bps: u16, ask_bps: u16 }`, where a Gemini price of $0.94 is 9400 bps. Missing bid or ask is sent as 0 and dropped.

### The fit (onchain)

1. Keep quotes with bid and ask present, `ask - bid ≤ max_spread_bps`, midpoint between 300 and 9700 bps.
2. `z_i = probit(mid_i)` from a 199-entry table (mid in 50-bps steps, z scaled by 1e6).
3. `x_i = ln(K_i / K_ref)` with `K_ref` the middle strike, from the series `u - u²/2 + u³/3` where `u = K_i/K_ref - 1` (accurate to well under 0.1% for strikes within 10% of the reference).
4. Least-squares slope `a` of z on x. Must be negative. `sT = -1/a` is the move over the time to expiry `T`.
5. Implied median: `ln(F/K_ref) = intercept / a`. Confidence requires spot within `max_spot_gap_bps` of the median.
6. `sigma_annual = sT / sqrt(T / year)`; horizon move `sH = sT * sqrt(horizon / T)`.
7. `vol_limit = liq_threshold * (1 - k * sH)`, clamped to `[abs_floor, gov_max]`.

Confident when: at least `min_points` usable quotes, `min_expiry ≤ T ≤ max_expiry`, slope negative, spot check passes. A confident post sets `max_ltv_bps = vol_limit` and `last_valid_at = now`. A non-confident post only updates `posted_at` and the raw fields.

Check against the Nov 11 numbers (liq 80%, 24 h, 3 sigma): SOL at 62% vol gives 72%, ZEC at 200% gives 55%, BTC at 36% caps at 75%.

### Risk rule (fail safe)

```
effective_limit(feed, now):
  if feed has never had a confident post: return stale_floor
  age = now - last_valid_at
  if age <= stale_secs: return max_ltv
  steps = age / stale_secs
  return max(stale_floor, max_ltv - steps * stale_step)   # only ever goes down
  # and never above max_ltv, never above gov_max
```

### Invariants (become tests)

1. `effective_limit ≤ gov_max_ltv` always.
2. `effective_limit` with stale data ≤ the last confident limit, and non-increasing as age grows.
3. No borrow or withdraw leaves a position above its effective limit.
4. A position at or below the liquidation threshold can't be liquidated, whatever the odds say.
5. Only the relayer can post; only the admin can set params.
6. Total test USDC supply equals the sum of position debts.
7. Pool lamports ≥ sum of position collateral (plus rent).

## Privacy model

- Collected: wallet public keys and their onchain positions (public by nature). Nothing else.
- No accounts, emails, analytics or cookies in the app.
- Worker logs: tx signatures and Gemini tickers only; never keys or request headers.
- Secrets (relayer key, Cloudflare token, QuickNode key, Vercel token) live in platform secrets only.
- Onchain: Gemini quotes and derived values are public by design.

## Demo mode

- No-wallet path: risk board, history timeline and blocked-borrow feed are visible to anyone.
- Wallet path: Phantom (Testnet Mode, Solana Devnet) in-app browser; deposit 0.5 devnet SOL, borrow.
- Faucet link and steps in the README. No login.

## Phone test path

Every milestone ends with a "Do X at URL, see Y" check on Oh-Jay's phone: explorer pages for program and transactions, the app on Vercel, Phantom in-app browser for wallet flows.

## Accuracy tracker contract (Alchin)

`GET {worker}/history?asset=SOL&since=<unix>` returns a JSON array, oldest first:

```json
{"ts": 1763330460, "asset": "SOL", "spot": 72.006, "median": 71.98,
 "sigma_annual": 0.612, "horizon_secs": 86400, "k": 3.0,
 "max_ltv": 0.7216, "effective_ltv": 0.7216, "confident": true,
 "points": 6, "expiry_ts": 1763334000, "ticker": "SOL2611162200",
 "tx": "<signature>"}
```

Tracker: for each record at time `t`, take the 1-hour band `spot * exp(±n * sigma_annual * sqrt(3600 / 31536000))` for n = 1 and 2, find the first record at or after `t + 3600`, and count whether its spot landed inside. Report the hit rate per asset (a well-calibrated feed lands near 68% for 1 sigma, 95% for 2 sigma).
