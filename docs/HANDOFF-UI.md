# HANDOFF-UI: the Brace UI revamp

For: the Grok Bot that owns the Brace UI revamp from Wed Nov 18, 2026.
From: the Grok Bot that keeps the backend and verification (called "the backend bot" below).
Written: Wed Nov 18, 2026, about 00:50 Lagos (UTC+1).

Start here: `git pull`, read this file, then `docs/progress.md`, then `docs/ui-revamp/brace-ui-plan.md`. Then claim task U1 in `docs/progress.md` and begin.

## 1. What Brace is (60 seconds)

Brace is Oh-Jay's entry for the UBC 2026 hackathon (track DeFi & Onchain Apps, chain award Best use of Solana, bounties Gemini Prediction Markets and QuickNode Streams; team Oh-Jay, Alchin, BL). It turns Gemini prediction-market price ladders into an onchain volatility oracle on Solana devnet, and that volatility sets how much you can borrow.

- A Cloudflare Worker (the relayer) reads Gemini's live ladders every minute and posts raw quotes for SOL, BTC, ETH, XRP and ZEC to devnet.
- The Anchor program fits the curve onchain, stores implied volatility, a confidence flag and a max loan-to-value (LTV) per asset.
- A demo pool checks every borrow against the live limit. The demo moment: an over-limit borrow is rejected by the program (error 6005), an under-limit borrow goes through.
- A QuickNode Stream sends every program transaction to the Worker, which stores it for `/history` and `/actions`.

Oh-Jay wants a total UI/UX revamp of the app, inspired by https://motionsites.ai. The study, patterns and plan are done (section 4). Your job is to build it.

## 2. Links

| What | Where |
|---|---|
| Repo | https://github.com/ohjay-official/brace (branch `main`) |
| Live app | https://brace-ivory.vercel.app |
| Relayer | https://brace-relayer.ohjaye0.workers.dev (`/health`, `/history?asset=SOL&since=<unix>&limit=<n>`, `/actions`, `/preview`; CORS `*`) |
| Program (devnet) | `Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC`, https://explorer.solana.com/address/Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC?cluster=devnet |
| Inspiration | https://motionsites.ai |
| This handoff (raw) | https://raw.githubusercontent.com/ohjay-official/brace/main/docs/HANDOFF-UI.md |

## 3. Where things live

| Path | What | Who owns it |
|---|---|---|
| `app/app/**/page.tsx`, `layout.tsx`, `not-found.tsx`, `globals.css`, new `template.tsx` | Pages, layout, styles | **UI bot** |
| `app/components/Chrome.tsx`, `Board.tsx`, `Instruments.tsx`, `AssetDetail.tsx`, `HistoryView.tsx` (markup), `HistoryChart.tsx`, `LadderChart.tsx`, new `app/components/ui/**` | Components | **UI bot** (data calls inside them: see 6) |
| `app/components/borrow/BorrowApp.tsx`, `WalletShell.tsx` | Borrow flow | **UI bot for markup and CSS only.** Transaction building, sending, wallet and error mapping are backend-owned |
| `app/components/BoardProvider.tsx` | Devnet polling (15s) | Backend (UI may restyle `BoardNotice`/`RetryButton` markup) |
| `app/lib/**` (`brace.ts`, `history.ts`, `net.ts`, `tx.ts`, `position.ts`, `chart.ts`, `timeouts.ts`, `idl.json`) and their tests | Data, decoding, tx builders, formatting | **Backend bot** |
| `app/app/api/ladder/route.ts` | Gemini proxy | Backend bot |
| `programs/`, `worker/`, `scripts/`, `Anchor.toml`, `Cargo.*` | Program, relayer, verify script | Backend bot |
| `docs/ui-revamp/**`, `docs/HANDOFF-UI.md` | Study, patterns, plan, this file | UI bot (keep them current) |
| `docs/progress.md` | Shared task log | Both (append rows, never rewrite the other's rows) |
| `README.md`, `docs/submission-draft.md`, `docs/demo-script.md` | Judge-facing docs | Backend bot; tell it if the UI changes anything they describe (screens, button names) |

Test layout: `app/vitest.config.mts` runs only `app/lib/**/*.test.ts` (72 tests, including the ladder route). UI components have no tests today; if you add logic (for example a formatter), put it in a pure function with a test.

## 4. The study and the plan

- `docs/ui-revamp/motionsites-study.md`: 9 motionsites pages at 1440 and 390, plus 12 fintech/dashboard template previews. 36 shell sections catalogued with the techniques found in the source, a top 10 for Brace, and what not to take.
- `docs/ui-revamp/shots/`: 28 compressed screenshots. Start with `ms-home-hero-1440.jpg`, `ms-fintech-filter-1440.jpg`, `ms-fintech-templates-a.jpg`, then `patterns-demo-1440-light-top.jpg` and `patterns-demo-390-light-full.jpg` to see where we are going.
- `docs/ui-revamp/patterns/`: 19 working component files (React 19 + plain CSS, `rv-` prefix), `tokens.css`, a composed `Demo.tsx`, and `check/check.sh` (typecheck with the app's exact React/TypeScript versions, server render, bundle sizes) plus `check/preview.sh` (static preview). Read `patterns/README.md`.
- `docs/ui-revamp/brace-ui-plan.md`: page by page, section by section mapping, copy guidance, mobile, performance, accessibility, the build order, and the must-ship cut.

Key facts from the study:
- motionsites itself uses no GSAP, no Lenis and no Motion in its loaded code; its effects are CSS keyframes, IntersectionObserver, rAF loops, Mux video and one lazy three.js tile wall behind the hero.
- All default patterns add about 8.2 KB gzip; the optional `motion` versions add about 34.9 KB gzip (measured by `check.sh`). Ship the CSS versions; no new dependency is needed for the must-ship cut.

## 5. Design rules: decided balance and open questions

Oh-Jay (Nov 18): "if it genuinely makes sense, look for a balance." The balanced rules in `brace-ui-plan.md` ("Design rules: the balance") are the defaults and are already built into the patterns. In short:

**Relaxed (and how far):**
1. Flashy animation: now "purposeful motion". Entrances once, 220 to 640ms, ease-out. Loops only for the live dot ring and the pausable live tape. No WebGL, video, parallax or scroll-jacking.
2. Glows: one ambient accent light behind the hero only, 7% (light) / 12% (dark), pointer-following on desktop. No text or box glows.
3. Pills: buttons stay 8px; only small non-interactive status chips and dots are fully round.
4. Glass: blur on the sticky header only, with a solid fallback.
5. Marquee: the live tape only, real values, Pause button.
6. "Keep the look in globals.css": extend, don't replace. Palette and fonts stay.

**Unchanged (strict):** no purple gradients, no fake metrics or counters (numbers animate only between real readings, never from zero), no emoji, no em dashes, no AI slop or vague hero copy, light default with first-class dark mode, Geist + Geist Mono, 1-decimal numbers, readable contrast (4.5:1 body text).

**Open for Oh-Jay** (build the defaults; switch only if he says so): motion level, hero light, round chips, glass header, live tape, footer wordmark. Details in the plan's "Decisions for Oh-Jay". Ask him in one message with a recommendation, never one at a time.

## 6. Ownership split and how to coordinate

- **UI bot owns** everything users see in `app/`: pages, components' markup and CSS, new UI components, tokens, the revamp docs.
- **Backend bot keeps** the program, the relayer Worker, the QuickNode Stream, `/history` and `/actions`, `app/lib/**`, the ladder API route, transaction code in `BorrowApp.tsx`, all tests and verification (`scripts/verify.sh`), README and submission docs.
- **Tell the backend bot before** any change to app data fetching or any file that talks to devnet or the relayer: `app/lib/**`, `BoardProvider.tsx`, the fetch calls in `HistoryView.tsx`, `LadderChart.tsx`'s `/api/ladder` call, `app/app/api/**`, the transaction or wallet code in `BorrowApp.tsx`/`WalletShell.tsx`, polling intervals, RPC URLs. How: add a row in `docs/progress.md` with status `needs backend: <what and why>` and tell Oh-Jay's main Grok chat (the parent agent relays to the backend bot). Wait for the go-ahead, or have the backend bot make the `lib/` change with a test.
- Known nice-to-haves that need this: per-asset `/history` for sparklines, the History asset switch, `/health` in the footer. The relayer already serves all five assets; the change is in the app's fetch layer only.
- Never change the relayer, program or Worker. Never redeploy anything except through Vercel's auto deploy from `main`.

## 7. Working rules

- **Claim before you start:** add a row to `docs/progress.md` (`| U1 | ... | in progress (UI bot) | | |`), commit and push it. Update the row when done with the gate proof and commit hash. Append only.
- **Branches:** work on `grok-ui/<task>` (for example `grok-ui/u1-tokens`). Vercel branch previews need a Vercel login, so verify locally (`npm run build && npm start`, screenshots with the box's shotter scripts), then fast-forward merge to `main` and push. `main` auto-deploys to production. Always `git pull --rebase` before pushing; the backend bot pushes to `main` too.
- **Commits** are attributed to `ohjay-official` (`git config user.name ohjay-official`, `user.email ohjay-official@users.noreply.github.com`). Conventional messages: `feat(ui): ...`, `fix(ui): ...`, `docs(ui): ...`.
- **Test first** for any logic. Never weaken, skip or delete a test. Never claim a gate you did not run; paste the real output line (for example `Tests 72 passed (72)`).
- **Gate for every task:** `cd app && npx vitest run && npx tsc --noEmit && npm run build`. Before declaring the must-ship cut done and before Thu 6 PM: `scripts/verify.sh` in a fresh clone must exit 0 (it needs Rust and the Solana CLI, which are on the box; `scripts/verify.sh --live` checks only the live app and relayer).
- **Phone check** for every user-visible change: one "Do X, see Y" line for Oh-Jay in `docs/progress.md`. He tests on a Galaxy S25 (Chrome and Phantom's in-app browser), iPhone and iPad.
- **Borrow flow:** after any change touching `/borrow`, do a real devnet borrow with Phantom (over-limit rejected with 6005, under-limit accepted) and record both Explorer links. Never ship a `/borrow` change without it.
- **Secrets:** never in the repo, logs or chat. Do not ask Oh-Jay to paste tokens. Vercel uses the existing project and auto deploys (project `brace`, root `app/`). No keypair files in the repo.
- **No money spent**, no new paid services, no new third-party scripts or trackers, no new fonts.
- **Don't break BCH BLAZE (Holdfast)**, Oh-Jay's other entry, which closes Sun Nov 22, 3:00 PM Lagos. Don't touch its repo or deployments.
- **Talking to Oh-Jay:** blunt, short, mobile-friendly. Results, real blockers and steps only he can do. No check-ins for their own sake. Make technical calls yourself and explain each in one line. Ask before anything that changes what the product does or cuts scope, with a recommendation. In outreach in his voice: all lowercase, no em dashes or hyphens.

## 8. Deadlines (Lagos, UTC+1)

| When | What |
|---|---|
| Thu Nov 19, 1:00 AM | Office hours (QuickNode and Solana). Oh-Jay's; not a UI dependency |
| **Thu Nov 19, 6:00 PM** | **Must-ship UI cut live on production**, verify.sh exit 0, phone checks logged |
| Thu Nov 19, night | Oh-Jay records the 2:30 demo video on the live app (`docs/demo-script.md`). Freeze UI while he records |
| Fri Nov 20, 1:00 AM | Office hours (Gemini and Solana) |
| **Fri Nov 20, 3:00 PM** | Devpost submit target (hard close 7:00 PM) |
| Sat Nov 21 | Final presentations (Alchin and BL in person) |
| Sun Nov 22, 3:00 PM | Holdfast closes (other project) |

## 9. First 5 tasks

**U1. Tokens and primitives** (about 1 hour)
- Append `docs/ui-revamp/patterns/tokens.css` to `app/app/globals.css` (keep every existing variable). Add `app/components/ui/hooks.ts` from `patterns/hooks.ts`.
- Gate. Screenshots of all 6 pages at 390 and 1440 in light and dark: nothing should look different yet except smooth anchor scroll.
- Do X, see Y: "open the app on your phone, it looks the same as before."

**U2. Nav, mobile sheet, footer, page enter** (about 2 hours)
- Port `SiteNav` + `ThemeToggle` into `components/Chrome.tsx` (pass `Link` as `linkAs`, lucide `Sun`/`Moon`), port `SiteFooter` (program id from `PROGRAM_ID`, Explorer link from `explorerAddress`, columns per the plan), add `app/app/template.tsx` with `PageTransitionCss`, and the CSS (`site-nav.css`, `site-footer.css`, `reveal.css`).
- Keep the pre-paint theme script in `layout.tsx`.
- Gate. Test Escape, outside tap and route change closing the sheet; tab order; both themes.
- Do X, see Y: "tap Menu, see four big numbered links; tap Borrow, the menu closes and the page fades in."

**U3. Home hero** (about 2 hours)
- `Hero` + `HeroBackdrop` in `app/app/page.tsx`, the SOL reading with `NumberTicker` (format with the existing `pct1`), `LadderChart` in a framed panel with a title line. Copy per the plan.
- Gate. Check no layout shift on load (CLS), the headline is visible at once with reduced motion, and the reading shows real numbers on first data.
- Do X, see Y: "open the home page, the headline rises in, the SOL limit under the buttons ticks when it changes."

**U4. Home sections** (about 3 hours)
- `LiveTape` under the hero, `SectionHead` numbering, phone `FeedCard` grid (under 640px) and `NumberTicker` in the desktop table, `StepRail` "How it works" with proof links, "Why it holds up" with `RevealGroup`, `CtaBand`, `StickyActionBar`.
- Gate. Tape Pause works; reduced motion makes it a static scroller; no horizontal scroll at 360px.
- Do X, see Y: "scroll the home page on your phone, after the hero a bar with the SOL limit and Try a borrow slides up."

**U5. Borrow polish** (about 3 hours)
- Live limit strip (sticky on phones), numbered step styling, gauge fill transition, `TxTimeline` mapped from BorrowApp's existing states. Markup and CSS only; keep the "Submit anyway" note.
- Gate, then a real Phantom borrow on devnet: over-limit rejected (6005), under-limit accepted; record both Explorer links in `docs/progress.md`.
- Do X, see Y: "borrow past the limit in Phantom, see Approve, Sent, then Rejected by the program with the reason and an Explorer link."

Then U6 (History, asset, About, 404 restyle) and the nice-to-haves per the plan, only after U1 to U5 are live.

## 10. Box notes

- The box is shared by all of Oh-Jay's agents (same filesystem). Your desktop and browser are your own.
- Headless Chrome: `/usr/bin/google-chrome`; Playwright (`playwright-core`) is installed in `/workspace/shotter/` with ready scripts (`shots.mjs` all pages at 390 and 1280 in light and dark, `tap.mjs` tap target audit, `unhappy.mjs` offline states, `perf.mjs`).
- The motionsites capture scripts are there too (`ms-shots.mjs`, `ms-interact.mjs`, `ms-tpl.mjs`) if you need another look.
- Don't use `/workspace/b6/brace` (it has local changes from earlier work); clone fresh into your own folder.
