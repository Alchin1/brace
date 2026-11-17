# B6 full re-check (build-and-ship-playbook)

Run by Grok on Tue Nov 17, 2026, 12:12 to 12:45 Africa/Lagos (WAT, UTC+1), against `main` and the live services. Screenshots are on the build box under `/workspace/brace-shots/b6/` (44 page shots plus unhappy-path and post-deploy shots). "Needs team" means a person has to do it; it is not a failed test.

## Results

| Section | Test | Result | Evidence |
|---|---|---|---|
| 1 Planning | Rules listed with proof | pass, one gap | `docs/event.md`. Gap: the hackathon guide Google Doc (track extras) was never pasted in. Needs Oh-Jay. |
| 1 Planning | Dependencies called once | pass | Gemini events and pubticker, devnet RPC, Cloudflare, QuickNode Stream, Vercel all answered live today. |
| 1 Planning | Deadlines in one list | pass | `docs/event.md` key dates, CST and WAT. |
| 2 UI | Every page at 390 and 1280, light and dark | pass | 11 routes x 2 widths x 2 themes. No sideways scroll on any (scrollWidth equals clientWidth). No raw errors, no em dashes, no TODO or lorem text. |
| 2 UI | Loading, empty, error states | pass, improved (B6b) | Raw "Error: Failed to fetch" is gone. RPC blocked: board says "Live limits are not loading. Could not connect to Solana devnet. The page tries again every 15 seconds, or you can try now." with a Try again button; hero chart says "Devnet is not answering. Trying again."; borrow page says "The live SOL limit is not loading..." with Try again instead of "--" forever. Relayer blocked: "Could not load borrows. Could not connect to the history service." Gemini blocked: "Live quotes unavailable, showing the onchain fit". |
| 2 UI | Wallet not connected / no wallet | pass | Borrow page shows Connect wallet; with no wallet installed: "No Solana wallet found in this browser. On a phone, open this page inside Phantom." |
| 2 UI | Keyboard focus visible | pass | Tab focus shows a 2px solid outline. Screen reader run: not run (needs a real device). |
| 2 UI | Tap targets 44px | fixed, pass (B6b) | Theme toggle and Menu are 44x44; footer links, brand, desktop nav, "How it works" and "All assets" have 44px hit areas with no visual shift. Automated check on 5 pages at 390 and 1280: no control under 44px outside running text. |
| 2 UI | Clear 404 | fixed, pass (B6b) | Custom page: "Page not found" and a "Back to the board" button. Live `/does-not-exist` returns 404 with the link. |
| 3 Backend | Rule breaker, stale data, max size, invariants | pass | `cargo test -p brace` 52/52 in a fresh clone (12 adversarial, fuzz of 3,000 random actions in 51.90s, stale step-down tests p03, t10, a04). |
| 3 Backend | Automatic path with nobody watching | pass | Minute cron posted all 5 feeds; onchain Feed accounts last written 27s before 12:24:48 WAT. |
| 3 Backend | Two real users at once | not run | Needs team. |
| 4 API | Bad input to endpoints | fixed, pass | Before: `/history?asset=DOGE` and `since=abc` gave 200, `/preview?asset=DOGE` gave 200 with an error body. Now 400 with a plain error (live, see below). |
| 4 API | Oversize responses | fixed, pass | Before: `/history` with no filter returned every row (669 KB and growing about 100 KB an hour). Now capped at 10,000 rows, page forward with `since`. |
| 4 API | Timeouts and provider failure | fixed, pass | Gemini calls now time out at 8s, RPC at 10s with failover to the second RPC; `/api/ladder` times out at 8s and returns `unavailable`. Unit tests cover a hung call. |
| 4 API | CORS from a browser | pass | OPTIONS with a foreign Origin: 204, `access-control-allow-origin: *`. |
| 4 API | Streams sink auth | pass | POST `/streams` without or with a wrong secret: 401. |
| 5 AI | Adversarial inputs | n/a | No AI in the product. Automation inputs covered under 3 and 4. |
| 6 Security | Secrets in code, history, build output | pass | gitleaks 8.30.1 on 42 commits and the working tree: no leaks. No key file content from the box found in history or `.next` output. Worker secrets exist by name only (RELAYER_SECRET, STREAMS_SINK_SECRET). |
| 6 Security | Live equals tested | pass | Deployed program dumped from devnet is byte-identical to a fresh-clone `cargo build-sbf` (353,632 bytes). |
| 6 Security | Dependency alerts | partial | Worker: vitest critical (dev only) fixed by moving to vitest 5.1.0; 4 moderate left in `@solana/web3.js` 1.x. App: 4 high (bigint-buffer via spl-token, no fix; postcss via Next 15, fix needs Next 16) and 13 moderate, accepted for a devnet demo. Scripts: 2 high via anchor toml, deploy-time only. |
| 6 Security | Risks we could not fix written down | pass | README Known Limitations and `docs/reviews.md`. |
| 7 Performance | Throttled mobile load (1.6 Mbps, 150 ms, 4x CPU) | pass | First paint: board 980 ms, borrow 1,380 ms, history 1,148 ms. Layout shift 0.046 or less. About 330 KB per page. |
| 7 Performance | 10 minute soak | pass | Board left open 10 minutes: JS heap 3.2 MB at start, 4.5 MB at minutes 8 and 10 (flat); 6 requests every 2 minutes from the 15 second poll, no growth. |
| 7 Performance | Balances for the judging window | pass | Relayer 0.99037776 SOL at 12:24 WAT (earlier measured cost under 0.08 SOL through Nov 21). Deployer 0.280830884 SOL. |
| 8 Data | Duplicate writes | pass | Streams ingest of the same payload twice stores one row (worker test). |
| 9 Cross-device | Real phones, browsers, in-app browsers | not run | Needs team (Android and iPhone, Phantom in-app, X and Telegram link opens). |
| 10 Testing | Full suites in a fresh clone | pass | `scripts/verify.sh` exit 0: cargo 52/52, worker 76/76, worker tsc clean, app 63/63, app tsc clean, `next build` ok, live checks ok. |
| 10 Testing | One-command verify | fixed, pass | New `scripts/verify.sh`. Found: in a fresh clone, `anchor build` (even with `--ignore-keys`) makes a new keypair and rewrites `declare_id`, so the README's old command failed 1 test. README now uses `cargo build-sbf`. |
| 11 Deploy | Every link on the live host | pass | All 31 README links on logged-out GitHub: 200, except explorer.solana.com, which rate-limits curl (429). Each of those 6 transactions was confirmed through devnet RPC with the logs the README quotes. All 13 README anchors resolve. |
| 11 Deploy | Auto deploy and live check | pass | Vercel built 8a0a251 at 12:32 WAT; Worker redeployed through the Cloudflare connector at 12:29 WAT with the same bindings and cron; first cron after deploy had `lastError` null. |
| 11 Deploy | Rollback drill | not run | Cloudflare keeps prior versions and Vercel has instant rollback; not timed. |
| 12 Hackathon | Repo public, license, history | pass | Public, MIT detected by GitHub. First commit a71e7ef on Nov 15, after kickoff. 16 early commits are authored "Claude", disclosed in README. |
| 12 Hackathon | Program id identical everywhere | pass | `declare_id`, Anchor.toml, both IDLs, wrangler.toml, Worker binding, Streams filter, setup script, app bundle on Vercel, README and submission draft all say Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC. |
| 12 Hackathon | Form fields verified | partial | `docs/submission-draft.md` now has the live URL, links, description, team with BL and the AI disclosure. Video link and the final team names need Oh-Jay. |
| 13 Docs | Number and claim audit | fixed, pass | Test counts updated (worker 76, app 63, fuzz 52.07s). Demo script said "six feeds"; now five. README no longer says the tracker is powered today. Every README transaction and log line matched devnet. |
| 14 Completeness | Placeholder scan | pass | Only the two labeled README placeholders: film link (B7) and Alchin's hit rate (B4). |
| 14 Completeness | No-wallet try mode | pass | Board, asset pages and History need no wallet. |
| 14 Completeness | Outside users | not run | Needs team. |
| 15 Presentation | Preview audit | pass (B6b) | Favicon, icon, apple icon, 1200x630 og:image and twitter image all 200 live; og:title, og:description, og:url, og:type, og:image, twitter:card summary_large_image and twitter:image on every page. Card uses the real headline, no numbers. Pasting into X, WhatsApp and Telegram to see the card: needs a person. Video and cold-viewer test: not run (B7, team). |
| 16 Maintenance | Uptime alert, expiry list | partial | Hourly health check runs as a Grok routine (reports in chat, not a phone alert). Expiry list is in `docs/progress.md`. |

## Live endpoint checks after the Worker redeploy (12:31 WAT)

- `/history?asset=DOGE` 400 `unknown asset DOGE; use one of SOL, BTC, ETH, XRP, ZEC`
- `/history?asset=sol&since=<5 min ago>` 200, SOL rows
- `/history?asset=SOL&since=abc` 400; `limit=0` 400; `limit=3` 200 with 3 rows
- `/actions?since=-1` 400; `/actions` 200 with the deposit, blocked and accepted rows
- `/preview?asset=DOGE` 400; `/preview?asset=eth` 200
- `/health` ok, all five feeds under 60s old

## Go/no-go (final gate)

| # | Question | Answer |
|---|---|---|
| 1 | Complete rules read, every requirement has proof | no: the hackathon guide doc is still unread (Oh-Jay to paste) |
| 2 | Core journey works for a new user on a real phone, mobile data, production | no: only Oh-Jay has run it (B3); needs one outside person |
| 3 | Every claim in README, video, post and form has proof | no: README and draft yes; video not recorded yet (B7) |
| 4 | No secret in repo, history, build output or logs | yes |
| 5 | Every third-party call has a timeout, failure message, tested fallback | yes |
| 6 | Safe against double taps, retries, refreshes, two users | no: code and tests yes; two real users at once not run |
| 7 | Full suite passes and manual core run repeated after the last change | no: suites yes; Phantom borrow not repeated after today's Worker change |
| 8 | Clean-machine setup from README works; verify passes | yes (fresh clone; `scripts/verify.sh` exit 0) |
| 9 | Production env vars, domain, routes, certificates checked live | yes |
| 10 | AI and automation run on adversarial and empty inputs, fail safely | yes |
| 11 | Public previews, icons and links show current assets | yes (B6b): favicon and og/twitter image live, tags on every page; a paste test in X or WhatsApp still needs a person |
| 12 | Alerts, rollback and an expiry calendar exist | no: hourly check and expiry list yes; no phone alert, rollback not drilled |
| 13 | Anything irreversible has a written go/no-go and was rehearsed | yes: program is upgradeable on devnet; Devpost fields rehearsed in `docs/submission-draft.md`; this table is the go/no-go |
| 14 | Submitted once, in the required form, copy saved | no: due Fri Nov 20, target 3:00 PM WAT |

## B6b front-end follow-up (Nov 17, 13:02 to 13:35 WAT)

Approved by Oh-Jay. Commits a762ed7 and 93ea3bc. Every browser request now has a timeout (devnet RPC 10 s through the web3.js Connection on the board and the borrow page; relayer and `/api/ladder` 10 s) and a plain message. Under **Submit anyway**: "Phantom will warn that this transaction may fail. Confirm it anyway to see the program reject it onchain." Fresh-clone `scripts/verify.sh` at a762ed7: exit 0 (cargo 52/52, worker 76/76, app 72/72, tsc clean, build ok, live feeds 34 s old). Go/no-go is now 7 yes, 7 no.

