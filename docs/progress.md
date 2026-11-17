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
| 7 | Devnet deploy | done | program Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC on devnet; deploy sig 3LSQqWgxJRpRxhFeF2v7Y2vmLxyvvX32uS6uVUXdzYdEuu4nDK3xcohKRdLHccUto3kYmhoxNmNW9azEp1VmS5DX; explorer https://explorer.solana.com/address/Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC?cluster=devnet ; SOL Feed confident; cron posted SOL/BTC/ETH/XRP/ZEC | (this commit) |
| 8 | Relayer Worker | live (Grok); minute cron enabled after Task 7 | https://brace-relayer.ohjaye0.workers.dev/health 200; cron * * * * * posting all 5 assets; RPC_URL set to https://solana-devnet.api.onfinality.io/public because api.devnet.solana.com returns 403 from Cloudflare IPs. /health lastRun stays null across isolates (in-memory only); on-chain feeds and Worker logs are the proof | (this commit) |
| 9 | Streams + history | sink + /history staged on Cloudflare (Grok); Stream itself gated on QuickNode key | worker vitest 32/32, tsc --noEmit exit 0; live GET /history?asset=SOL and /actions return []; POST /streams without x-brace-secret is 401; relayer cron now on (Task 7) | (this commit) |
| 10 | README | in progress (Claude, branch claude/readme) | | |
| 11 | Risk board | claimed (Claude, after README; mockup first) | | |
| 12 | Borrow flow | claimed (Claude, after risk board) | | |
| 13 | Re-check | pending | | |

Next up: Grok hardening the live relayer (D1-backed /health, RPC 429 retries and fallbacks). QuickNode Stream brace-program is already active. Claude has claimed tasks 10–12.

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
