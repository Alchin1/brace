# Progress

Team: Oh-Jay (build, remote), Alchin (pitch, accuracy tracker, Austin), third student (Austin from Nov 18).

| # | Task | Status | Gate proof | Commit |
|---|---|---|---|---|
| 1 | Scaffold | done | anchor build exit 0 | bf23d46 |
| 2 | Math module | done | 11/11 tests incl. live SOL/BTC/ZEC fixtures, 5k-case properties; anchor build exit 0 | (this commit) |
| 3 | Oracle feed | done | 11/11 oracle tests; real SOL ladder logs sigma_bps=8272 max_ltv=6960 | (this commit) |
| 4 | Pool | done | 9/9 pool tests (borrow blocked above live limit, stale step-down, liquidation only above 80%, supply = debts) | (this commit) |
| 5 | Invariants | done | 3,000 random actions, 7 invariants held | 680ad99 |
| 6 | Reviews | passes 1-5 done; F1 and F2 fixed; program id switched to Frv6CVJK… | 49/49 tests (15 math, 12 adversarial, 1 fuzz, 12 oracle, 9 pool); F1/F2 marked in docs/reviews.md | (this commit) |
| 7 | Devnet deploy | done | program Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC on devnet; deploy sig 3LSQqWgxJRpRxhFeF2v7Y2vmLxyvvX32uS6uVUXdzYdEuu4nDK3xcohKRdLHccUto3kYmhoxNmNW9azEp1VmS5DX; explorer https://explorer.solana.com/address/Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC?cluster=devnet ; SOL Feed confident; cron posted SOL/BTC/ETH/XRP/ZEC | 18ea875 |
| 8 | Relayer Worker | done, live (Grok); per-tick RPC minimized (shared blockhash, packed posts, lazy confirm, RPC rotation) | worker vitest 55/55, tsc --noEmit exit 0; five live ticks at 05:24–05:28 WAT posted SOL/BTC/ETH/XRP/ZEC with lastError null; cron still on; re-check 05:46 WAT still posting | 3ee7c0e, 8638b58, e90d4a2 |
| 9 | Streams + history | done, live (Grok); QuickNode Stream brace-program ingesting | worker vitest 55/55 (suite now includes later relayer tests); live /history?asset=SOL is oldest-first and still ingesting (latest row 05:46:21 WAT, tx 3YpGc4zEkjUFymJSBMQHvz3f, matches on-chain SOL post); /actions is [] (no pool txs yet); CORS * already on GET/OPTIONS for /history, /preview, /actions, /health | dfd9188 |
| 10 | README | first pass done (Claude); TBD-post-build lines remain for live links | judge-first structure, test counts verified (52 Rust, worker 18) | claude/readme merged |
| 11 | Risk board | done (Claude) | live devnet data; app vitest 50/50, next build ok; redesigned around Gemini odds chart | claude/risk-board merged |
| 12 | Borrow flow | built (Claude); needs Oh-Jay's Phantom phone check | devnet simulation: over-limit borrow fails 6005 'brace blocked ltv=7987 limit=6987', under-limit succeeds | claude/risk-board merged |
| 12b | History page | done (Grok) | app vitest 60/60 (was 50), `npm run build` ok; live Streams data on /history; honest empty /actions; screenshots /workspace/brace-shots/history-390.png and history-1280.png | (this commit) |
| 13 | Re-check | prep recorded (Grok); full re-check after the UI lands | 2026-11-17 05:46 WAT: `anchor build --ignore-keys` exit 0 (cargo-build-sbf LTO warning only); `cargo test -p brace` 52/52 (15 math, 12 adversarial, 1 fuzz 51.45s, 12 oracle, 9 pool, 3 worker_ix); worker vitest 55/55; tsc --noEmit exit 0; program live, all five Feeds confident; see session log and docs/reviews.md | (this commit) |

Next up: Grok is on B1 (README pass 2). See docs/HANDOFF.md Part C.

## Session log

- Nov 16, 23:00 Lagos: spec, plan, demo script written. Live check: Gemini-implied vol now SOL 68%, BTC 42% (BTC 36% on Nov 11, price down from about $74.3k to $65.3k). Sample history file for Alchin in docs/sample-history.json (computed offchain, labeled SAMPLE).

- Nov 17, 02:30 Lagos: Claude hit usage limits; Worker and pass 5 agents were killed with no output. Handover written to docs/HANDOVER.md for Grok/Claude to continue.

- Nov 17, 04:02 Lagos: Grok ran the baseline gate on main (47/47 tests pass) and completed review pass 5. No program code changes. Findings in docs/reviews.md.

- Nov 17, 04:08 Lagos: Grok fixed Pass 5 F1 (zero-debt withdraw without a SOL Feed) and F2 (initialize rejects the default relayer), switched the program id to Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC, and re-ran the gate: 49/49 tests pass.

- Nov 17, 04:08 Lagos: Devnet setup script written at scripts/devnet-setup.mjs (dry-run by default; not executed). Deployer and relayer balances on devnet are both 0 SOL; program is not deployed.

- Nov 17, 04:18 Lagos: Grok built the Cloudflare relayer Worker under worker/ (cron every minute, /health, /preview). Ladder selection and quote parsing unit-tested against live Gemini fixtures captured 2026-11-17 03:12 UTC. Worker-encoded post_quotes bytes match the program IDL and were accepted by LiteSVM with the local brace.so. wrangler.toml uses a placeholder account_id. Not deployed.

- Nov 17, 04:33 Lagos: Grok staged brace-relayer on Cloudflare via the Workers scripts API (no API token / no wrangler deploy). workers.dev URL https://brace-relayer.ohjaye0.workers.dev ; /health returns {"ok":true,"lastRun":null,"lastSigs":{}}. Vars PROGRAM_ID and RPC_URL set; secret RELAYER_SECRET set. Minute cron is not enabled until Task 7.

- Nov 17, 04:43 Lagos: Grok claimed Task 7. Deployer FncbMMNB… has 5 SOL and relayer BSzBkn… has 1 SOL on devnet; program not yet deployed. Phantom demo wallet still at 0 SOL.

- Nov 17, 04:46 Lagos: Grok staged the Streams sink and /history API on brace-relayer (same Worker, so one deploy). D1 database brace (117e5eff-90f6-415e-80cd-5ba350ad47dc) created; /history?asset=SOL and /actions return []. Cron still off. QuickNode Stream is not created yet (needs a key); filter and destination settings are in worker/filters/brace-program.js.

- Nov 17, 05:00 Lagos: Grok finished Task 7. `anchor build --ignore-keys` exit 0; `cargo test -p brace` 52/52 (15 math, 12 adversarial, 1 fuzz / 3,000 actions, 12 oracle, 9 pool, 3 worker_ix). Program deployed at Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC, deploy sig 3LSQqWgxJRpRxhFeF2v7Y2vmLxyvvX32uS6uVUXdzYdEuu4nDK3xcohKRdLHccUto3kYmhoxNmNW9azEp1VmS5DX (https://explorer.solana.com/tx/3LSQqWgxJRpRxhFeF2v7Y2vmLxyvvX32uS6uVUXdzYdEuu4nDK3xcohKRdLHccUto3kYmhoxNmNW9azEp1VmS5DX?cluster=devnet). initialize 4H572EjqHbkJpHV9u2fmpiCFaZexg4stdS1naNkBZEoWYeKCc81QYPuHD9jSszj6isTgWJ1xAMespsMyYLFnWoUW, init_pool 31h9T3mWT3GyQehEcCT7AGxgJ8Huyc2hpjVyeKGzYN2JXBGrvoZDpyEkM8NKCxfgpFzpRuEe2WxkNvam3nH3ryhB, first SOL post_quotes 2LsRV4nhZFvp9Qx1DesbFjx9kivt8xfd7j9zLkK21PYZYA9otUk41qBfaChNgavbK5oXrnpRt6LvJ9q5Gv86awNL (confident). Relayer cron enabled; api.devnet.solana.com 403s Cloudflare IPs, so RPC_URL was switched to https://solana-devnet.api.onfinality.io/public. On-chain Feed snapshot at 05:00:23 Lagos (Africa/Lagos, UTC+1), all five confident: SOL sigma_bps=8651 max_ltv=6913; BTC 4770 / 7400; ETH 7668 / 7036; XRP 8237 / 6965; ZEC 18376 / 5691. Balances after the 1 SOL demo transfer: deployer 2.180830884 SOL, relayer 0.99390872 SOL, Phantom CM7My7aNNR6Kb6rTjbVE4cjTt3zaGS6f22FT1BVYwSJP 1 SOL. /health still returns lastRun=null because that field is in-isolate memory; cron logs and Feed accounts are the live proof.

- Nov 17, 05:14 Lagos: Grok persisted relayer /health state in D1 (lastRun, per-asset lastSig, lastError, feed ageSecs) and added RPC 429 retries plus RPC_URLS fallback. Live probe from a Cloudflare Worker: api.devnet.solana.com is 403; OnFinality often 429s under load; https://solana-devnet.gateway.tatum.io accepted getLatestBlockhash and sendTransaction on devnet. Cron kept on. /history?asset=SOL is ingesting live Stream rows; /actions is still [].

- Nov 17, 05:29 Lagos: Grok cut per-tick RPC calls on the relayer: one shared getLatestBlockhash, skipPreflight fire-and-forget sends, lazy getSignatureStatuses confirmation, RPC rotation across OnFinality and Tatum, and packed post_quotes when the signed tx fits in 1232 bytes (CU is not the limiter: 80k budget/post, 5 posts = 410k vs 1.4M). Measured packing: 16-quote posts pack 3+2 (1182 and 882 bytes); typical fixture counts pack 4+1 (1098 and 462 bytes). Live books during the watch were small enough that all five assets shared one signature each tick. worker vitest 55/55 (was 41/41); tsc --noEmit exit 0. Redeployed via the Cloudflare connector keeping cron, RELAYER_SECRET, STREAMS_SINK_SECRET, D1 brace, and RPC_URLS. pending_sigs table migrated. Five consecutive live ticks after deploy (Africa/Lagos, UTC+1), lastError null, all five assets posted:

  1. lastRun 2026-11-17 05:24:17 WAT, sig 3LXtLPVPqx7pEk12yV3QvJ2HP35gVdmhwkBskti92uayR7v8Tx3Dbm8dEGn5j52TG7r2gjihkPootZKsMEeZS988, feed ages SOL/BTC/ETH/XRP/ZEC 5s.

  2. lastRun 2026-11-17 05:25:17 WAT, sig 3Jf62aqVPEX2whMdKttw76mrC5W9dRr4mNx87JEAiUbM6mRZxjqqB9awSVmYbKisaqAWoRpBxj3SfQ62JExgKC5w, ages 3s.

  3. lastRun 2026-11-17 05:26:17 WAT, sig 3M5yvqVnzbsFYmZJF5hRZqPsyBmnznPqeFQvuGSuKX1cz7UpAMfgD1oxqPcvAFthcqobJwvsHvSnUFLYY4seUJoo, ages SOL/BTC/ETH/XRP 0s, ZEC 59s (health age still on the prior Stream post; ZEC lastSig already updated; age was 3s by the next tick).

  4. lastRun 2026-11-17 05:27:18 WAT, sig 4b6DzJcqPuYJ7FrtYQeBHfGAq2GKgoY5yBGUtdDft6K8qjr4VeSQZnuCMFnQpAjtbS8uba8E4YE1ULgi59TXzsXf, ages 3s.

  5. lastRun 2026-11-17 05:28:18 WAT, sig nwkApE7EV5VbmcHX6uFjt74C3281EvGF8MiRvLWGndLPPr9YuGT9eEHeX8VNWuD1bxXZhknjdsQ9thWDCJ1FMH5, ages 8s.

- Nov 17, 05:47 Lagos: Grok ran Task 13 re-check prep (no program or Worker code change; no relayer redeploy). Gates on `grok/recheck-prep` at 4c3b87d / main: `anchor build --ignore-keys` exit 0 (same `cargo-build-sbf` warning as before: crate types `cdylib` + `lib` preclude LTO; no rustc warnings); `cargo test -p brace` 52 passed, 0 failed (15 math, 12 adversarial, 1 fuzz in 51.45s, 12 oracle, 9 pool, 3 worker_ix); worker `vitest run` 55/55; `tsc --noEmit` exit 0. `solana program show Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC` succeeds; authority FncbMMNBCFVv76GsPP8FJhkNGHkmAZfw7gnkkBj7SvdM; data length 353,632 bytes; program account 1.7973294 SOL; last deployed in slot 523137960. Relayer cron still on; /health lastError null. On-chain Feeds at 05:46:21 WAT (Africa/Lagos, UTC+1), all five confident, ages 15–16s: SOL sigma 79.58% max_ltv 70.00% spot 72.91; BTC 46.69% / 74.13% / 64957.28; ETH 80.64% / 69.86% / 1829.66; XRP 77.38% / 70.27% / 0.96438; ZEC 178.49% / 57.57% / 921.71. /history is live and oldest-first (SOL 40 rows, latest ts 1794890781 / 05:46:21 WAT, tx 3YpGc4zEkjUFymJSBMQHvz3f, sigma_annual 0.7958 max_ltv 0.7, matches the on-chain SOL post); BTC 40, ETH 30, XRP 26, ZEC 27 rows; /actions still []. CORS `access-control-allow-origin: *` is already on GET and OPTIONS for /health, /preview, /history and /actions; no header or shape change was needed. Claude's risk-board branch reads Feed accounts from devnet RPC directly and the history page is still a placeholder, so the app does not call the Worker yet. Balances at 05:45:13 WAT: deployer 2.180840884 SOL, relayer 0.99359543 SOL, Phantom CM7My7aNNR6Kb6rTjbVE4cjTt3zaGS6f22FT1BVYwSJP 1 SOL. Packed 5-asset `post_quotes` fee is 5,410 lamports (e.g. sig fqJfhU9ZruT1NVwFs7FsaqYFJhcmGrGuviWzPxcMqrsFWTMdySZ21P4x9728aLdCbadTkSso1oze3UWQ34aD3uh, 194,033 CU). When the book does not pack, a tick can split (05:45:23 WAT: 5,330 + 5,090 = 10,420 lamports). Even if every tick split (~0.015 SOL/day), 0.99359543 SOL lasts about 66 days; through Sat Nov 21, 23:59 WAT the cost is under 0.08 SOL. No independent third public devnet RPC works from Cloudflare Worker IPs without a key, so RPC_URLS was left as OnFinality + Tatum. Probed from a temporary Worker (brace-rpc-probe, deleted after): `https://api.devnet.solana.com` and `https://devnet.rpcpool.com` return 403; OnFinality often 429s; Tatum and its aliases (`gateway`, `rpc`, `api.tatum.io/v3/blockchain/node/solana-devnet`) return 200 and the devnet genesis hash; Uniblock is reachable but 429s on the public project limit. Adding a 403 URL or a Tatum alias would not be a real third provider. A keyed QuickNode or Helius devnet endpoint is the durability upgrade; it should be a Worker secret, not a repo var. Pass 5 F3–F7 stay accepted risks; no program change.


- Nov 17, 06:40 Lagos: Claude merged README first pass and the web app (board, asset pages, borrow flow) to main. Vercel project 'brace' (root app/) deploys main to production. Borrow flow verified by devnet simulation; real Phantom run pending.
- Nov 17, 10:14 Lagos: Grok claimed B2 (history page) and started wiring /history and /actions into the app.
- Nov 17, 10:20 Lagos: Grok shipped B2. History page reads `https://brace-relayer.ohjaye0.workers.dev/history?asset=SOL&since=` and `/actions?since=` (last 24h). Hand-drawn SVG of SOL effective limit (accent) and implied vol (neutral). Honest empty state when /actions is []. Line: "Recorded by QuickNode Streams from every Brace transaction on devnet." Gate: `cd app && npx vitest run` 60/60, `npm run build` exit 0. Screenshots at 390px and 1280px: /workspace/brace-shots/history-390.png and history-1280.png.
