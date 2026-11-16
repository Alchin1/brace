# Progress

Team: Oh-Jay (build, remote), Alchin (pitch, accuracy tracker, Austin), third student (Austin from Nov 18).

| # | Task | Status | Gate proof | Commit |
|---|---|---|---|---|
| 1 | Scaffold | done | anchor build exit 0 | bf23d46 |
| 2 | Math module | done | 11/11 tests incl. live SOL/BTC/ZEC fixtures, 5k-case properties; anchor build exit 0 | (this commit) |
| 3 | Oracle feed | done | 11/11 oracle tests; real SOL ladder logs sigma_bps=8272 max_ltv=6960 | (this commit) |
| 4 | Pool | pending | | |
| 5 | Invariants | pending | | |
| 6 | Reviews | pending | | |
| 7 | Devnet deploy | pending (needs devnet SOL) | | |
| 8 | Relayer Worker | pending (needs Cloudflare token) | | |
| 9 | Streams + history | pending (needs QuickNode key) | | |
| 10 | README | pending | | |
| 11 | Risk board | pending (needs Vercel token) | | |
| 12 | Borrow flow | pending | | |
| 13 | Re-check | pending | | |

Next up: Task 4 (pool). Review note: Feed PDA is created by hand in post_quotes (init-if-needed feature not enabled); spot price is relayer-trusted even on non-confident posts.

## Session log

- Nov 16, 23:00 Lagos: spec, plan, demo script written. Live check: Gemini-implied vol now SOL 68%, BTC 42% (BTC 36% on Nov 11, price down from about $74.3k to $65.3k). Sample history file for Alchin in docs/sample-history.json (computed offchain, labeled SAMPLE).
