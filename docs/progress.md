# Progress

Team: Oh-Jay (build, remote), Alchin (pitch, accuracy tracker, Austin), third student (Austin from Nov 18).

| # | Task | Status | Gate proof | Commit |
|---|---|---|---|---|
| 1 | Scaffold | done | anchor build exit 0 | bf23d46 |
| 2 | Math module | done | 11/11 tests incl. live SOL/BTC/ZEC fixtures, 5k-case properties; anchor build exit 0 | (this commit) |
| 3 | Oracle feed | done | 11/11 oracle tests; real SOL ladder logs sigma_bps=8272 max_ltv=6960 | (this commit) |
| 4 | Pool | done | 9/9 pool tests (borrow blocked above live limit, stale step-down, liquidation only above 80%, supply = debts) | (this commit) |
| 5 | Invariants | done | 3,000 random actions, 7 invariants held | 680ad99 |
| 6 | Reviews | passes 1-5 done (pass 5: 0 critical, 0 high, 1 medium, 4 low; no code changes) | baseline 47/47 (15 math, 11 adversarial, 1 fuzz, 11 oracle, 9 pool); pass 5 in docs/reviews.md | (this commit) |
| 7 | Devnet deploy | pending (needs devnet SOL) | | |
| 8 | Relayer Worker | pending (needs Cloudflare token) | | |
| 9 | Streams + history | pending (needs QuickNode key) | | |
| 10 | README | pending | | |
| 11 | Risk board | pending (needs Vercel token) | | |
| 12 | Borrow flow | pending | | |
| 13 | Re-check | pending | | |

Next up: Task 7 devnet deploy (needs funded keys), then Task 8 relayer Worker.

## Session log

- Nov 16, 23:00 Lagos: spec, plan, demo script written. Live check: Gemini-implied vol now SOL 68%, BTC 42% (BTC 36% on Nov 11, price down from about $74.3k to $65.3k). Sample history file for Alchin in docs/sample-history.json (computed offchain, labeled SAMPLE).

- Nov 17, 02:30 Lagos: Claude hit usage limits; Worker and pass 5 agents were killed with no output. Handover written to docs/HANDOVER.md for Grok/Claude to continue.

- Nov 17, 04:02 Lagos: Grok ran the baseline gate on main (47/47 tests pass) and completed review pass 5. No program code changes. Findings in docs/reviews.md.
