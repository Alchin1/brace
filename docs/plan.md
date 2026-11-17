# Brace: task plan

Four days. Lagos time. Each task: test first, one gate that can fail, commit, update progress.md.
Gated = needs Oh-Jay (key, token, funds or a signature).

## Day 1: Mon Nov 16 night to Tue Nov 17 (contracts)

### Task 1: Scaffold the Anchor workspace
Phase: foundation | Size: S
Files: Create `programs/brace/**`, `Anchor.toml`, `Cargo.toml`
Steps: `anchor init` layout, program id from a fresh keypair, empty instruction compiles.
Gate: `anchor build` exits 0.
Commit: `chore: scaffold anchor workspace` | Gated: no

### Task 2: Fixed-point math module with tests
Phase: contracts | Size: M
Files: Create `programs/brace/src/math.rs` (probit table, ln series, regression, isqrt, limit, effective_limit)
Steps: unit tests first against Python reference values (Nov 11 and Nov 16 ladders); property tests: limit never above gov max, stale limit non-increasing.
Gate: `cargo test -p brace math` passes; reference cases within 0.5 vol points.
Commit: `feat: onchain implied-vol math` | Gated: no

### Task 3: Config, Feed and post_quotes
Phase: contracts | Size: M
Files: `programs/brace/src/{lib,state,errors}.rs`, `instructions/{initialize,set_params,post_quotes}.rs`, `tests/oracle.rs`
Steps: LiteSVM tests: relayer posts real ladder, feed updates; non-relayer rejected; thin ladder marks not confident; params out of bounds rejected.
Gate: `cargo test -p brace --test oracle` passes.
Commit: `feat: oracle feed and quote posting` | Gated: no

### Task 4: Pool, positions, borrow check, liquidation
Phase: contracts | Size: L
Files: `instructions/{deposit,borrow,repay,withdraw,liquidate}.rs`, `tests/pool.rs`
Steps: tests for `RiskTightened` above limit, success under it, stale step-down, withdraw check, liquidation only above threshold, supply equals debts.
Gate: `cargo test -p brace --test pool` passes.
Commit: `feat: demo lending pool with live limits` | Gated: no

### Task 5: Fuzz and invariant tests
Phase: contracts | Size: M
Files: `tests/invariants.rs`
Steps: random sequences of posts, borrows, repays, withdraws, time jumps; assert the 7 spec invariants after each step.
Gate: `cargo test -p brace --test invariants` passes with 2,000+ random cases.
Commit: `test: invariant and fuzz suite` | Gated: no

### Task 6: Five review passes
Phase: reviews | Size: M
Files: `docs/reviews.md`
Passes: functional correctness; access control and state transitions; financial logic and rounding; adversarial (manipulated quotes, stale relayer, dust, overflow); fresh independent review by a separate agent.
Gate: every finding fixed or written up as an accepted risk; all tests still pass.
Commit: `docs: review and security log` | Gated: no

### Task 7: Deploy to devnet
Phase: core | Size: S
Steps: fund deployer, `anchor deploy`, initialize with relayer pubkey, post one real Gemini ladder from the shell.
Gate: `solana program show <id>` succeeds and the SOL Feed account shows a confident post.
Phone check: open the program and the post tx on explorer.solana.com (devnet), see the instruction and logs.
Commit: `chore: devnet deploy` | **Gated: yes** (5 devnet SOL to deployer `FncbMMNBCFVv76GsPP8FJhkNGHkmAZfw7gnkkBj7SvdM`, 1 to relayer `BSzBknNiGxiYXtjsK7wcHgvYg88BMQx1j26dKbfYfmRo`)

## Day 2: Wed Nov 18 (data pipeline)

### Task 8: Relayer Worker
Phase: core | Size: M
Files: `worker/src/{index,gemini,fit,tx}.ts`, `worker/test/*.test.ts`, `worker/wrangler.toml`
Steps: unit tests for ladder selection and quote encoding (fixture JSON); cron every minute posts all six assets.
Gate: `npm test` passes; after deploy, six Feed accounts update within 2 minutes.
Commit: `feat: gemini relayer worker` | **Gated: yes** (Cloudflare API token)

### Task 9: Streams sink and history API
Phase: core | Size: M
Files: `worker/src/{streams,history}.ts`, `worker/schema.sql`
Steps: QuickNode Stream on Solana devnet filtered to the program id, destination `/streams` with a shared secret; decode events and failed borrows into D1; `/history` serves the contract in spec.md.
Gate: `/history?asset=SOL` returns rows written by Streams (not by the relayer directly).
Phone check: open `/history?asset=SOL` in Chrome, see JSON rows from the last minutes.
Commit: `feat: streams sink and history api` | **Gated: yes** (QuickNode API key)

### Task 10: README and test docs (first pass)
Phase: readme | Size: S
Files: `README.md`
Gate: rendered README shows For Judges line, live links, How to test in 30 seconds.
Commit: `docs: judge-first readme` | Gated: no

## Day 3: Thu Nov 19 (app)

Gemini office hours: Thu Nov 19, 1:00 AM Lagos. Questions in event.md.

### Task 11: App: risk board (no wallet)
Phase: ui | Size: M
Files: `app/**` (Next.js)
Gate: `npm run build` passes; board shows six assets with values matching the Feed accounts.
Phone check: open the Vercel URL, see the board update within a minute.
Commit: `feat: risk board` | **Gated: yes** (Vercel token)

### Task 12: App: borrow flow and history
Phase: ui | Size: M
Gate: in Phantom devnet, a borrow over the limit fails with `RiskTightened`; one under it succeeds; both show in the blocked/allowed feed within a minute.
Phone check: run both borrows in Phantom's in-app browser.
Commit: `feat: borrow flow and timeline` | Gated: yes (Oh-Jay signs in Phantom)

### Task 13: Full re-check after UI
Phase: recheck | Size: S
Gate: fresh-browser run of the demo path; every README link and address verified; tests green.
Commit: `chore: final re-check` | Gated: no

## Day 4: Fri Nov 20 (ship, deadline 7:00 PM Lagos)

- Morning: record the video (script in demo-script.md), Alchin's tracker numbers into the README, fill submission-draft.md.
- Submit by 3:00 PM Lagos, leaving 4 hours of buffer.

## Nice-to-have (cut first)

- `check_borrow` CPI from a second tiny program
- Event premium before scheduled macro events (Fed market)
- Shadow mode on real Kamino positions
