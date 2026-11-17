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
| 7 | Devnet deploy | pending (needs devnet SOL) | | |
| 8 | Relayer Worker | in progress (Grok) | | |
| 9 | Streams + history | pending (needs QuickNode key) | | |
| 10 | README | pending | | |
| 11 | Risk board | pending (needs Vercel token) | | |
| 12 | Borrow flow | pending | | |
| 13 | Re-check | pending | | |

Next up: Grok building Task 8 relayer Worker; Task 7 still needs funded keys.

## Session log

- Nov 16, 23:00 Lagos: spec, plan, demo script written. Live check: Gemini-implied vol now SOL 68%, BTC 42% (BTC 36% on Nov 11, price down from about $74.3k to $65.3k). Sample history file for Alchin in docs/sample-history.json (computed offchain, labeled SAMPLE).

- Nov 17, 02:30 Lagos: Claude hit usage limits; Worker and pass 5 agents were killed with no output. Handover written to docs/HANDOVER.md for Grok/Claude to continue.

- Nov 17, 04:02 Lagos: Grok ran the baseline gate on main (47/47 tests pass) and completed review pass 5. No program code changes. Findings in docs/reviews.md.

- Nov 17, 04:08 Lagos: Grok fixed Pass 5 F1 (zero-debt withdraw without a SOL Feed) and F2 (initialize rejects the default relayer), switched the program id to Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC, and re-ran the gate: 49/49 tests pass.

- Nov 17, 04:08 Lagos: Devnet setup script written at scripts/devnet-setup.mjs (dry-run by default; not executed). Deployer and relayer balances on devnet are both 0 SOL; program is not deployed.
