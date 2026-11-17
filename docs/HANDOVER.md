# Brace: handover

Written Tue Nov 17, 2026, 02:20 Lagos, by Claude (session 1). Read this whole file before touching anything. Then read, in order: `CLAUDE.md`, `docs/spec.md`, `docs/plan.md`, `docs/progress.md`, `docs/reviews.md`, `docs/event.md`.

The repo is the single source of truth. Two assistants may work on it (Grok and Claude). Rules for working together are in section 10.

---

## 1. The 60-second picture

- **Event:** UBC 2026 Hackathon (University Blockchain Conference, UT Austin).
- **Submission deadline:** **Fri Nov 20, 12:00 PM CST = 7:00 PM Lagos**, on Devpost (ubc-hackathon-2026.devpost.com). Aim to submit by **3:00 PM Lagos** on Friday.
- **Finals:** Sat Nov 21, live in Austin, pitched by the in-person teammates.
- **Prizes we target (they stack):**
  - DeFi & Onchain Apps track ($2,000)
  - Best use of Solana ($1,500, devnet OK)
  - Gemini Prediction Markets bounty (1st $2,500)
  - QuickNode Streams bounty ($500)
  - Overall winner (1st $2,500)
- **Team:**
  - Oh-Jay: builder, remote in Nigeria, works only from an Android phone.
  - Alchin Daryabari: UT Austin student, software engineer (Python, Java, FastAPI, React, AWS). Owns the pitch, judge Q&A and the Python accuracy tracker.
  - Third student: in Austin from Nov 18; pitches at the closing ceremony.
  - Prize split: equal, agreed in writing.
- **Rules that matter:**
  - Most of the team must be at the closing ceremony.
  - All teammates must be students.
  - The project must be built during Nov 12 to 20.
  - Submission needs:
    - Devpost name, description and team
    - a public GitHub repo
    - a working demo or deployed app
    - a **2 to 3 minute demo video**
    - a README with technical docs
  - Judging: technical execution, product and UX, innovation, impact and potential, demo.

**What Brace is (one line):** Brace turns Gemini's prediction markets into an onchain volatility oracle, so Solana lending markets tighten their borrowing limits before volatility arrives.

**How it works:**
1. A relayer reads Gemini's live "price X or above" ladders (SOL, BTC, ETH, XRP, ZEC) every minute and posts the **raw quotes** to Solana devnet.
2. The Brace program fits the ladder **onchain** (a probit lookup table plus a least-squares fit) and gets implied volatility from it.
3. That volatility sets a max loan-to-value (LTV) for each asset.
4. A demo lending pool enforces it: borrow above the limit and the transaction fails with `RiskTightened`; borrow under it and it succeeds.
5. Odds can only tighten limits. They never loosen a limit past the governance max, and never liquidate anyone.
6. QuickNode Streams records every program transaction, including failed borrows, for the history timeline.

**Why it wins:**
- The organizers' own prize card suggests "a DeFi prediction market built on Solana with Gemini's API", so most teams will build prediction market apps. Brace uses prediction markets as infrastructure for the rest of DeFi.
- Deribit, the biggest crypto options venue, lists options on only 7 coins (BTC, ETH, SOL, HYPE, XRP, AVAX, TRX; checked Nov 15). ZEC and commodities like silver, oil and gas have no crypto options market. Gemini prices all of them.

**Live evidence already gathered (real, verified):**
- **Nov 11 (spot price input):** the ladder fit's implied medians landed within 0.1% of Gemini spot. Implied vol was BTC about 36%, SOL about 58 to 62%, ETH about 50%, ZEC about 200%.
- **Nov 16:**
  - BTC had fallen from about $74.3k to $65.3k, and BTC implied vol rose from about 36% to 42%.
  - SOL's 24-hour implied vol was 82.7%, which gives a 69.6% limit.
  - This is the thesis playing out on real data; use it in the pitch.

---

## 2. Where everything stands

### Done (all pushed to `main`)

| Commit | What |
|---|---|
| 593423f, 51d39d8, c7d4e47 | Planning docs: event rules, gates, research, brief, spec, plan, demo script, submission draft, CLAUDE.md |
| bf23d46 | Task 1: Anchor 1.2.2 workspace scaffold |
| e50f788 | Task 2: fixed-point implied-vol math (`programs/brace/src/math.rs`) |
| 42871db | Task 3: Config, Feed PDA, `initialize`, `set_params`, `set_relayer`, `post_quotes` |
| 8928733 | Task 4: demo pool (`init_pool`, `open_position`, `deposit`, `borrow`, `repay`, `withdraw`, `liquidate`), test USD mint |
| 680ad99 | Task 5: fuzz and invariant suite (3,000 random actions, 20 seeds) |
| 9b432ef | Fixes from review passes 1 to 4 (see section 6), plus `docs/reviews.md` |

**Test status at 9b432ef: 47 tests pass. Claude ran this itself.**

| Suite | Passing |
|---|---|
| math unit | 15 |
| adversarial | 11 |
| invariants (fuzz, 3,000 actions) | 1 |
| oracle | 11 |
| pool | 9 |

`anchor build` is clean, with no warnings.

### Not done (in order)

| # | Task | Status | Blocker |
|---|---|---|---|
| 6 | Review pass 5 (independent final review) | Started, killed by a usage limit, **no output saved**. Re-run it. | none |
| 7 | Devnet deploy + initialize + first live post | Not started | **devnet SOL for whoever deploys** (see 4.2) |
| 8 | Relayer Worker (Cloudflare) | Started, killed by a usage limit, **nothing written to the repo** | Cloudflare API token + Account ID to deploy |
| 9 | Streams sink + `/history` API | Not started | QuickNode API key |
| 10 | README, first pass | Not started | none |
| 11 | App: risk board (no wallet) | Not started | Vercel token |
| 12 | App: borrow flow + history timeline | Not started | Oh-Jay signs in Phantom |
| 13 | Full re-check | Not started | none |
| ship | Video, Devpost, submission | Not started | Fri Nov 20 |

**Time left at handover:** about 3 days 17 hours (deadline Fri 7:00 PM Lagos).

### Suggested schedule (Lagos time)

| When | What |
|---|---|
| Tue Nov 17 | Pass 5 review; new deploy keys; Oh-Jay funds them; devnet deploy (Task 7); start the Worker (Task 8) |
| Wed Nov 18 | Worker live; Streams + D1 + `/history` (Task 9); Alchin points his tracker at `/history`; README first pass |
| Thu Nov 19, 1:00 AM | **Gemini office hours** (questions in `docs/event.md`) |
| Thu Nov 19 | App: risk board, then borrow flow (Tasks 11, 12); phone checks |
| Fri Nov 20, 1:00 AM | QuickNode office hours |
| Fri Nov 20 morning | Re-check (13), record the video, fill Devpost; **submit by 3:00 PM** |

If time runs short, cut from the bottom of `docs/plan.md` (nice-to-haves) first. Always protect four things: the happy path, a live URL, the README, and the video.

---

## 3. Repo map

```
CLAUDE.md                     build rules (follow them)
Anchor.toml                   cluster = devnet; wallet path points to Claude's workspace, change it to yours
Cargo.toml, Cargo.lock        workspace
programs/brace/
  Cargo.toml                  anchor-lang 1.2.2; anchor-spl 1.2.2 with features ["token","token_2022","solana-v3"] (see pitfalls)
  src/lib.rs                  instruction entry points; declare_id!
  src/math.rs                 integer-only math: probit table, ln series, OLS fit, isqrt, limits
  src/state.rs                Params, Config, Feed, Pool, Position, events, valuation helpers
  src/constants.rs            seeds, DEFAULT_PARAMS, MIN_SIGMA_BPS=500, MAX_PRICE_AGE_SECS=3600
  src/error.rs                BraceError (codes 6000..6009, StalePrice = 6009)
  src/instructions/*.rs       initialize, set_params (+set_relayer), post_quotes, init_pool,
                              deposit (+open_position), borrow (+check_limit), repay, withdraw (+pay_from_pool), liquidate
  tests/{oracle,pool,invariants,adversarial}.rs   LiteSVM integration tests
docs/
  event.md      rules, dates in Lagos time, prizes, questions for organizers and Gemini
  gates.md      day-one checks and Oh-Jay's steps
  research.md   benchmark of ~35 past projects, judges, sponsors, live data test, idea scoring
  brief.md      the product on one page
  spec.md       full spec, incl. the accuracy-tracker data contract for Alchin
  plan.md       the 13 tasks with gates
  progress.md   status table and session log (update after every task)
  reviews.md    review passes 1-4 findings and accepted risks
  demo-script.md, submission-draft.md, sample-history.json
  HANDOVER.md   this file
```

---

## 4. Setting up a fresh workspace

### 4.1 Toolchain (verified working on Nov 11 and 16)

```bash
# Solana CLI (Agave). Installs to ~/.local/share/solana
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version          # 4.3.x worked

# Anchor CLI 1.2.2 from crates.io (takes ~5-10 min to compile)
cargo install anchor-cli --version 1.2.2 --locked
export PATH="$HOME/.cargo/bin:$PATH"
anchor --version          # anchor-cli 1.2.2

# Build + test
git clone https://github.com/ohjay-official/brace && cd brace
anchor build              # MUST run before cargo test: the LiteSVM tests load target/deploy/brace.so
cargo test -p brace       # expect 47 passing (the fuzz test takes ~50 s)
```

`cargo build-sbf` downloads platform-tools from GitHub the first time.

### 4.2 Keys: important

Claude's deployer, relayer and program keypairs exist **only in Claude's workspace**. Nothing has been deployed yet, and no SOL was sent to them. **Whoever deploys must generate their own keys:**

```bash
mkdir -p ~/keys
solana-keygen new --no-bip39-passphrase -s -o ~/keys/deployer.json
solana-keygen new --no-bip39-passphrase -s -o ~/keys/relayer.json
solana-keygen new --no-bip39-passphrase -s -o ~/keys/brace-program.json
solana-keygen pubkey ~/keys/deployer.json   # give this to Oh-Jay to fund
solana-keygen pubkey ~/keys/relayer.json    # give this to Oh-Jay to fund
```

Then switch the program id to your new program keypair:

```bash
cp ~/keys/brace-program.json target/deploy/brace-keypair.json
anchor keys sync          # updates declare_id! in lib.rs and Anchor.toml
# edit Anchor.toml: wallet = "<path to your deployer.json>"
anchor build && cargo test -p brace
```

Commit the new program id (lib.rs + Anchor.toml) and update `docs/submission-draft.md`. **Never commit any keypair file.** `target/` is gitignored.

**Tell Oh-Jay the new addresses.** The old ones in chat (`WgkL5t5p...` deployer, `HvCLY9Pe...` relayer) are Claude's. If he already funded those, tell Claude, who can deploy with them; otherwise use yours. The program is about 340 KB, so deploying needs **about 3 to 4 devnet SOL**. Ask for **6 SOL** for the deployer and **1 SOL** for the relayer, via faucet.solana.com (sign in with GitHub, choose Devnet). Shell airdrops from cloud IPs are rate-limited and failed on Nov 11.

### 4.3 Reachability checked from a cloud shell

These were reachable:
- devnet RPC `https://api.devnet.solana.com`
- `api.gemini.com`, including the public prediction-markets and pubticker endpoints, with no key
- `api.cloudflare.com`
- `api.quicknode.com` (needs a key)
- `api.vercel.com` (needs a token)
- `hermes.pyth.network`
- crates.io
- npm

Creating a new GitHub repo from Claude's session is not possible (session scope). That doesn't matter now that the repo exists.

---

## 5. The program in detail (what exists now)

### Accounts
- **`Config`** PDA `["config"]`: admin, relayer, `Params`, bump.
- **`Feed`** PDA `["feed", symbol]`, where symbol is 8 bytes, uppercase ASCII and zero-padded, e.g. `SOL\0\0\0\0\0`. Fields:
  - spot_e6 (the price used for collateral; **updated only by confident posts**)
  - median_e6, sigma_bps, horizon_move_e6, points
  - expiry_ts, ticker[32]
  - confident, max_ltv_bps, has_valid, last_valid_at, posted_at, bump

  `post_quotes` creates the Feed by hand on first post (the init-if-needed feature isn't enabled), and that path is safe against pre-funding.
- **`Pool`** PDA `["pool"]`: holds the SOL collateral as lamports and is the mint authority for test USD. Fields: usd_mint, total_debt, total_collateral, bumps.
- **Test USD mint** PDA `["usd_mint"]`, 6 decimals.
- **`Position`** PDA `["position", owner]`: owner, collateral_lamports, debt, bump.

### Params (`DEFAULT_PARAMS`)

| Param | Value | Meaning |
|---|---|---|
| gov_max | 7500 | 75%, the hard cap |
| liq_threshold | 8000 | 80% |
| horizon | 86400 | 24 h risk window |
| k_x100 | 300 | 3 sigma |
| abs_floor | 3000 | |
| stale_secs | 300 | |
| stale_step | 250 | |
| stale_floor | 5000 | |
| max_spread | 1500 | 15 cents |
| min_points | 3 | |
| expiry window | 900 s to 259200 s | 15 min to 72 h |
| max_spot_gap | 300 | 3% |

`set_params` validates hard bounds.

### Instructions

| Instruction | Who | What |
|---|---|---|
| `initialize(params, relayer)` | first caller (see accepted risk) | creates Config |
| `set_params(params)`, `set_relayer(pk)` | admin | `set_relayer` rejects the default key |
| `post_quotes(symbol, expiry_ts, ticker, spot_e6, quotes ≤16)` | relayer | spot > 0 required; fit; confidence; limit; emits `QuotesPosted`; logs `brace SOL conf=1 sigma_bps=.. max_ltv=..` |
| `init_pool()` | admin | Pool + mint (pre-fund safe) |
| `open_position()` | owner | Position |
| `deposit(lamports)` | owner | |
| `borrow(amount)` | owner | mints test USD if new LTV ≤ effective limit; else logs `brace blocked ltv=.. limit=..` and fails `RiskTightened` (6005) |
| `repay(amount)` | owner | burns |
| `withdraw(lamports)` | owner | checked against the limit if debt remains; zero-debt withdraw always allowed |
| `liquidate()` | anyone | only if LTV > 80% (rounded in the borrower's favour); seizes collateral = debt value + 5%, capped at collateral |

Borrow, withdraw-with-debt and liquidate all fail with **`StalePrice` (6009)** if the SOL feed has never had a confident post, its spot is 0, or the last confident post is more than **3600 s** old.

### The fit (onchain, integer-only)
1. Keep quotes that have both bid and ask, a spread ≤ max_spread, and an unsnapped mid between 3% and 97%. Snap the mid to the 50-bps grid.
2. Look up z from the probit table (199 entries).
3. Compute x = ln(K/K_ref) with a 4-term series. Skip strikes more than 15% from K_ref.
4. Require the kept strikes to span at least 0.5%, then run least squares. sT = −1/slope; median = K_ref·exp(c·sT).
5. sigma_annual = sT/√(T/yr). If sigma is under 5%, the post is not confident.
6. horizon move sH = sT·√(24h/T); limit = 80%·(1 − 3·sH), clamped to [30%, 75%].

### Effective limit (fail safe)
- Fresh confident data: use max_ltv.
- Stale: step down 2.5 points every 5 minutes, never below min(50%, last limit), never above the last limit or 75%.

### Error codes
| Code | Error |
|---|---|
| 6000 | Unauthorized |
| 6001 | InvalidParams |
| 6002 | TooManyQuotes |
| 6003 | InvalidSymbol |
| 6004 | MathOverflow |
| 6005 | RiskTightened |
| 6006 | NotLiquidatable |
| 6007 | InsufficientCollateral |
| 6008 | InvalidAmount |
| 6009 | StalePrice |

### Compute units
`post_quotes` with 16 quotes costs about 68k CU on first post and 66k on update. Set the CU limit to 120k.

---

## 6. Reviews so far and accepted risks

Passes 1 to 4 were done by fresh reviewers (details in `docs/reviews.md`). No critical or high findings. All medium and low items were fixed in 9b432ef, each with a test that reproduces the issue:
- spot only moves on confident posts, and spot 0 is rejected
- 1-hour price age guard
- mint PDA can no longer be blocked by pre-funding
- far strikes are skipped instead of failing the fit
- degenerate ladders are rejected
- dust-rounding liquidation fixed
- `set_relayer` rejects the default key

**Still to do:** pass 5, an independent final review that gets only the spec and the code. A useful brief:
> Find anything that lets a user, liquidator or anyone other than admin/relayer take value from the pool or another user, raise a limit above governance max, liquidate a healthy position, or permanently break the program, plus anything that would make the devnet demo misbehave (account sizes, rent, compute, clock). Severity, file:line, scenario, fix.

Append the results to `docs/reviews.md`.

**Accepted risks (put them in the README under "Known limitations"):**
1. The relayer is trusted for quotes and spot. Mitigations: spot only moves on confident posts, must be within 3% of the ladder-implied median, and goes stale after 1 hour.
2. `initialize` can be front-run between deploy and setup. **Mitigation:** run deploy, `initialize` and `init_pool` back to back from one script, then read Config and check `admin == deployer` and `relayer == relayer key`.
3. Liquidation repays the full debt only. Test USD has no value.
4. `check_borrow` CPI was cut for time.

---

## 7. Remaining tasks: exact designs

### Task 7: Devnet deploy (gated: needs funded keys)

```bash
solana config set --url https://api.devnet.solana.com --keypair ~/keys/deployer.json
anchor build
anchor deploy --provider.cluster devnet --provider.wallet ~/keys/deployer.json
```

Then immediately run a one-shot script (TypeScript with `@coral-xyz/anchor` in a scratch folder is fine here, since it's not the Worker):
1. `initialize(DEFAULT_PARAMS, relayer_pubkey)` with the deployer as admin.
2. `init_pool()`.
3. Read Config and assert admin and relayer.
4. Post one real SOL ladder with the relayer key, using the selection rules in Task 8.

**Gate:**
- `solana program show <PROGRAM_ID> -u devnet` works.
- The SOL Feed account decodes with `confident = true` and a sensible sigma (SOL has been 60 to 85%).

**Phone check for Oh-Jay:** open `https://explorer.solana.com/address/<PROGRAM_ID>?cluster=devnet` and the `post_quotes` tx; the logs show `brace SOL conf=1 sigma_bps=… max_ltv=…`.

Record the program id, deploy tx and first post tx in `docs/progress.md` and `docs/submission-draft.md`.

### Task 8: Relayer Worker (Cloudflare Workers, TypeScript)
- **Files:** `worker/**` (package.json, tsconfig.json, wrangler.toml, src/{index,gemini,select,encode,tx}.ts, src/idl.json copied from target/idl/brace.json, test/*.test.ts, test/fixtures/*.json, README.md).
- **Packages:** `@solana/web3.js@1`, `bs58`, `typescript`, `vitest`, dev `wrangler`, `@cloudflare/workers-types`. **Don't use `@coral-xyz/anchor` in the Worker** (too heavy). Hand-encode the instruction: the 8-byte discriminator from the IDL, then little-endian args (`[u8;8]`, `i64`, `[u8;32]`, `u64`, `Vec` = u32 length + items of `u64,u16,u16`).
- **Accounts for post_quotes:** relayer (signer, writable), config PDA, feed PDA `["feed", symbol]` (writable), system program.
- **Gemini API (public, no key):**
  - Events: `GET https://api.gemini.com/v1/prediction-markets/events?status=active&limit=200&category=crypto` returns `{data:[event]}`.
    - Each event has `ticker` (e.g. `SOL2611172200`) and `expiryDate` (ISO).
    - Each event has `contracts[]` with `strike {type:"above", value:"72"}` and `prices {bestBid:"0.44", bestAsk:"0.50"}` (strings, sometimes missing).
  - Spot: `GET https://api.gemini.com/v1/pubticker/{solusd|btcusd|ethusd|xrpusd|zecusd}` returns `{last:"72.00"}`.
- **Ladder selection, per asset (SOL mandatory; BTC, ETH, XRP, ZEC desirable):**
  1. Ticker starts with `<ASSET>2`.
  2. Contracts are type `above`.
  3. Expiry is between now+15 min and now+72 h.
  4. At least 4 contracts have both bid and ask, a spread ≤ 0.15, and a mid in [0.03, 0.97].
  5. Prefer the earliest such expiry.
  6. Send up to 16 contracts, closest to a 50% mid first.

  Encoding:
  - Bid/ask become integer bps (0.44 → 4400), parsed from strings with integer math and no float rounding.
  - Strike becomes strike×1e6 (u64).
  - spot_e6 comes from pubticker `last`.
  - Ticker is 32 bytes and symbol 8 bytes, both zero-padded.
- **Cron:** `* * * * *`. One tx per asset, with ComputeBudget `setComputeUnitLimit(120_000)` and a tiny priority fee. Sign with secret `RELAYER_SECRET` (base58 64-byte key, set with `wrangler secret put`). RPC from `env.RPC_URL` (default devnet). An error in one asset must not stop the others. Log only signatures and tickers.
- **HTTP:** `GET /health` returns `{ok, lastRun, lastSigs}`. `GET /preview?asset=SOL` returns the selected ladder and encoded args without signing (debug from a phone).
- **Tests (vitest, offline, fixtures captured with curl from the live API):** ladder selection; encoding ("71.5" → 71500000, "0.44" → 4400); exact byte layout for a 2-quote case; padding; an asset with no valid ladder is skipped without throwing.
- **Gate:** `npm install && npx tsc --noEmit && npx vitest run` pass. After deploy, all 5 Feed accounts update within 2 minutes.
- **Deploy (gated):** needs Oh-Jay's **Cloudflare API token** ("Edit Cloudflare Workers" template) and **Account ID**. `CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npx wrangler deploy`, then `wrangler secret put RELAYER_SECRET`.
- **Note:** Vercel Hobby crons only run daily. That's why the relayer lives on Cloudflare (minute cron, free).

### Task 9: Streams sink + history API (same Worker)
- **D1 database** `brace` (`wrangler d1 create brace`), schema in `worker/schema.sql`:
  - `posts(ts, asset, spot, median, sigma_annual, max_ltv, effective_ltv, confident, points, expiry_ts, ticker, tx)`
  - `actions(ts, kind, owner, amount, ltv, limit, ok, tx)`, where kind is deposit, borrow, repay, withdraw, liquidate or blocked
- **`POST /streams`:** QuickNode Stream destination. Check a shared secret header (`x-brace-secret`, set as a Worker secret and in the Stream's destination headers).
  - Decode program logs and Anchor events (`Program data:` base64 = 8-byte event discriminator + borsh) for `QuotesPosted`, `Borrowed`, etc.
  - Record **failed** txs whose logs contain `brace blocked ltv=X limit=Y` as `blocked`.
- **QuickNode Stream setup:** Solana **devnet**, dataset block or transactions, starting at the tip. Use a server-side filter function that keeps only transactions touching the program id and returns a small JSON (signature, err, logMessages, blockTime). Destination is the Worker `/streams` URL with the secret header. The free trial streams from the chain tip only, which is fine.
- **`GET /history?asset=SOL&since=<unix>`:** returns the JSON array from the spec's "Accuracy tracker contract" (oldest first). Add `GET /actions?since=` for the app's blocked/allowed feed. Allow CORS (`*`) on GETs.
- **Gate:** `/history?asset=SOL` returns rows **written by the Streams webhook** (not by the relayer directly).
- **Phone check:** open `/history?asset=SOL` in Chrome and see recent JSON rows.
- **Gated:** needs Oh-Jay's QuickNode API key, or he creates the Stream in the QuickNode dashboard on his phone using the exact values you give him.
- **Bounty point:** Streams is the core data source for the history, timeline and tracker. Say so in the README.

### Task 10: README (judge-first)
Follow Oh-Jay's README rules:
1. A first-screen "For Judges" line: what it does, how to try it in 30 seconds, proof it works.
2. Then a screenshot or GIF of the live risk board.
3. Then the one sentence that makes it different.
4. Then a "How to test" section with "Do X, see Y" steps and timings: no-wallet path (open the URL) and wallet path (Phantom, Testnet Mode, Devnet, faucet link, deposit 0.5 SOL, borrow over the limit and see it fail, borrow under it and see it pass).
5. Proof: program id, explorer links, sample tx hashes, the live `/history` URL.
6. A table mapping each prize to the feature that earns it (DeFi track, Solana, Gemini, QuickNode).
7. Architecture diagram (Mermaid).
8. The math in short.
9. Known limitations (section 6).
10. Test summary (47 tests + fuzz).
11. AI disclosure: built with AI coding assistance (Claude, Grok), all code tested.
12. Third-party libraries.

Rules: no marketing copy, only testable claims. Collapse long sections. Check the rendered page.

### Task 11: App: risk board (no wallet), Next.js on Vercel
- **Gated:** needs Oh-Jay's Vercel token. Before any UI, remind him of his website workflow: he sends 2 or 3 reference screenshots, each with one line on what to take. Galleries: Godly, Land-book, Lapa Ninja, SaaSpo. For a dev-tool feel, good references are Linear, Vercel, Stripe and Resend.
- **His design rules (strict):** none of the following:
  - purple gradients
  - pill-shaped buttons
  - fake metrics, reviews or counters
  - vague hero text
  - emoji icons
  - em dashes
  - over-the-top animations
  - AI slop images or copy
- **Data:** read the 5 Feed accounts directly from devnet RPC and decode them with the IDL. Show per asset: implied vol, max LTV, effective LTV, confident flag, "updated Xs ago", and an explorer link to the last post. Read history from the Worker `/history` for a small chart.
- **Gate:** `npm run build` passes, and the board values match the onchain Feed accounts.
- **Phone check:** open the Vercel URL and watch the numbers update within a minute.
- **Checkpoint:** show Oh-Jay a mockup or design direction and get his OK before building UI (his rule). Show the first real screen and get his reaction before doing the rest.

### Task 12: Borrow flow + timeline
- Solana wallet adapter (Phantom, Solflare). Phantom's in-app browser on Android works on devnet once Testnet Mode is on.
- Flow: open position, deposit SOL, borrow test USD (with a slider showing the live limit), repay, withdraw.
- Show `RiskTightened` and `StalePrice` errors in plain words.
- Timeline: blocked vs allowed borrows from `/actions`.
- The token account for test USD is the owner's associated token account; create it in the same tx if missing.
- **Gate:** in Phantom on devnet, a borrow over the limit fails with `RiskTightened`, a borrow under it succeeds, and both appear in the timeline within a minute.
- **Gated:** Oh-Jay signs on his phone.

### Task 13: Re-check
- Re-run all tests.
- Fresh-browser (incognito) run of the demo path on phone and desktop.
- Every README link and address works.
- Program id matches everywhere.
- Worker `/health` is green; all feeds updated in the last 2 minutes.

### Ship (Fri Nov 20)
- **Video:** 2:30, script in `docs/demo-script.md`. Show the product in the first 10 seconds. Use real numbers only. Phone screen recording; Oh-Jay or Alchin narrates.
- **Devpost:** fields in `docs/submission-draft.md`. Main track DeFi & Onchain Apps; Best use of Solana; Gemini and QuickNode bounties; all three teammates on the team. Double-check every link.
- **Submit by 3:00 PM Lagos.** Keep the demo live until judging ends (Nov 21).

---

## 8. Alchin's part (accuracy tracker)

The data contract is in `docs/spec.md` under "Accuracy tracker contract", with a real sample in `docs/sample-history.json` (computed offchain, labeled SAMPLE).

- **What he builds:** a Python script that reads `/history?asset=SOL&since=...`. For each record it takes the 1-hour band `spot·exp(±n·sigma·sqrt(3600/31536000))` for n = 1 and 2, then checks whether the spot one hour later landed inside.
- **What it reports:** the hit rate per asset. A well-calibrated feed lands near 68% at 1 sigma and 95% at 2 sigma.
- **Where the result goes:** the README and the pitch ("our hit rate this week: X%").
- **When:** as soon as `/history` is live (Task 9), send him the URL.

**Judge Q&A answers Alchin already has:**
- **"How accurate are odds?"** Brace only tightens limits, so a bad signal makes the pool more careful, never riskier; thin or stale data steps limits down; and the hit rate is measured live.
- **"Why Brace over existing tools?"** Limits today come from governance votes and risk firms like Gauntlet. Options-based vol feeds only cover coins with options (Deribit lists 7). Brace covers ZEC and commodities, updates every minute onchain, and plugs in with one call. It's an input for risk teams, not a replacement.
- **"What if Gemini stops?"** Fail safe: limits hold, then step down. After 1 hour without fresh data, borrowing and liquidation pause (StalePrice).

---

## 9. Pitfalls already hit (save yourself the time)

- **anchor-spl 1.2.2:** must be `default-features = false, features = ["token", "token_2022", "solana-v3"]`, plus `"anchor-spl/idl-build"` in the idl-build feature. Without `solana-v3` it doesn't compile; without `token_2022` the IDL build fails.
- **Tests:** LiteSVM tests load `target/deploy/brace.so`. Always `anchor build` before `cargo test`, or you test an old binary.
- **Feed PDA:** created by hand in `post_quotes` (no init-if-needed feature). Don't "simplify" it without re-running the adversarial tests.
- **Gemini quirks:** prices are strings and can be missing; some contracts have only a bid. Volumes are thin (quotes exist, trades are rare). 5- and 15-minute "up/down" markets are not ladders; ignore them. The SOL hourly and daily ladders are the reliable ones.
- **Vercel Hobby:** cron is daily only, so the relayer stays on Cloudflare.
- **Cloud shell:** devnet airdrops are rate-limited, so Oh-Jay funds via faucet.solana.com.
- **Oh-Jay is phone-only (Android, Chrome).** Any step he does must be phone-friendly. If a dashboard is cramped, tell him to switch on Desktop site. No step may need a desktop.

---

## 10. Working rules (both assistants)

- **Branches:** one assistant works on `main` at a time. If both are active, the second works on a branch (`grok/<task>` or `claude/<task>`) and merges only after rebasing and re-running `anchor build && cargo test -p brace`.
- **Claim tasks:** before starting a task, mark it `in progress (<who>)` in `docs/progress.md` and push. That's how the other side knows. Never take a task someone else has claimed.
- **After every task:** update the progress table (status, one-line gate proof, commit hash) and the "Next up" line, then push.
- **Gates:** never claim a pass you didn't run. Never weaken or skip a test. Test first. Keep changes inside the task's declared files.
- **Secrets:** never in the repo, logs or chat. Keys live outside the repo. Tokens go in platform secrets.
- **Oh-Jay's working style:**
  - Blunt and direct; make the technical calls yourself and explain each in one line.
  - Step-by-step, mobile-friendly instructions.
  - Never present an unverified claim as fact.
  - He reviews before anything is final (10-80-10).
  - Ask him before anything that changes what the product does, what users see, or what gets cut, and bring a recommendation.
  - Never offer free or on-spec work in any outreach he sends.
- **Commits:** attribute to `ohjay-official` (he prefers that account).

---

## 11. What Oh-Jay needs to do next (copy to him)

1. Get the deployer and relayer addresses from whoever deploys. Fund them at faucet.solana.com: 6 SOL to the deployer, 1 SOL to the relayer.
2. **Cloudflare:** dash.cloudflare.com, My Profile, API Tokens, "Edit Cloudflare Workers" template. Send the token and the Account ID.
3. **QuickNode:** sign up at quicknode.com (free trial), create an API key, send it.
4. **Vercel:** Settings, Tokens, create one, send it.
5. **Phantom:** Settings, Developer Settings, Testnet Mode on, Solana Devnet.
6. Send Alchin the spec link for the tracker contract.
7. Attend Gemini office hours (Thu Nov 19, 1:00 AM Lagos) with the questions in `docs/event.md`.
