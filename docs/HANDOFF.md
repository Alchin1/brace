# Brace: full handoff to Grok

Written Tue Nov 17, 2026, 10:05 Lagos, by Claude. From now on **Grok owns everything**. Claude only checks in occasionally. This file is the complete record of what was done in the Claude chat from the first message to now, plus the roadmap to submission.

Read this file, then `docs/progress.md`, `CLAUDE.md`, `docs/spec.md`, `docs/plan.md` and `docs/reviews.md`. The older `docs/HANDOVER.md` (Nov 17, 02:20) is still accurate for program internals; this file supersedes it on status and ownership.

**Deadline: Fri Nov 20, 12:00 PM CST = 7:00 PM Lagos, on Devpost. Submit by 3:00 PM Lagos.**

---

## Part A: what happened, from the beginning

### A1. Choosing the hackathon (Nov 11)
- Oh-Jay shared the UBC 2026 Hackathon (universityblockchain.org/programs/hackathon) and an old SolBlaze staking content PDF, and wanted "something crazy in DeFi on Solana that touches every track".
- **Rules we found** (from the site's page and script bundle):
  - Each project enters exactly one main track. After that, bounties stack, plus one chain award (Solana or Arc, not both).
  - Projects must be built during Nov 12 to 20.
  - Submission needs a public repo, a working demo, a 2 to 3 minute video and a README.
  - Judging: technical execution, product and UX, innovation, impact and potential, demo.
- **Organizers' prize-card example:** "A DeFi prediction market built on Solana with Gemini's API could win all four" ($8,500). Adding the QuickNode Streams bounty brings our ceiling to $9,000.
- **Blockers we hit:**
  - You must attend the closing ceremony in Austin to win any prize, including bounties.
  - Admins later clarified in Telegram: only **students** attending in person may compete; a teammate who can't travel is OK if **the majority of the team** is at the closing ceremony; only team with people you've met; decline cold DMs.
- **Decisions along the way:**
  - Oh-Jay has no US visa. Claude first advised skipping (BCH BLAZE / Holdfast runs Nov 14 to 22 in parallel).
  - Oh-Jay overrode that ("we don't leave opportunities on the table").
  - He found **Alchin Daryabari** (UT Austin student, software engineer: Python, Java, FastAPI, React, Docker, AWS), who posted in the group looking for a team.
  - **BL**, a student in Austin from Nov 18, became the third member.
  - Prize split is **equal**, agreed in writing in Telegram.
  - Daily text check-in at **4 PM Austin / 11 PM Lagos**. Calls don't work because of the time zones.

### A2. Research and the idea (Nov 11)
- **Benchmark:** about 35 past projects (`docs/research.md`).
  - No-loss prediction markets are saturated: Hedgehog, Smort, PolyYield (won Best use of Solana at NexHacks 2026), ExtraLife, EcoRound. So the SolBlaze-flavoured "stake SOL, yield pays winners" idea was dropped.
  - Prediction-market front-ends are saturated too.
  - The open lane: prediction markets as building blocks for the rest of DeFi.
- **Live data test:** we fitted a lognormal to Gemini's "price X or above" ladders.
  - Implied medians matched spot within 0.1%.
  - Implied vol: BTC about 36%, SOL about 58 to 62%, ETH about 50%, ZEC about 200%, silver about 38%.
- **Pick: Brace.** Gemini prediction markets become an onchain implied-volatility oracle that sets Solana lending limits.
- **Corrected claim (Nov 15):** Deribit lists options on 7 coins (BTC, ETH, SOL, HYPE, XRP, AVAX, TRX). XRP and HYPE do have options; ZEC and commodities don't.
- **Alchin's review:** he liked it and asked two questions.
  - "How accurate are odds?" Answer: limits only move in a safe direction on bad data, and we measure a live hit rate (his tracker).
  - "Why over existing tools?" Answer: options feeds only cover coins with options; Brace covers ZEC and commodities, updates every minute onchain, and plugs in with one call.
- **Alchin caught a real flaw:** stale data used to fall back to the normal limit. It was changed to fail safe: hold the limit, then step down.

### A3. Planning and build (Nov 15 to 17)
- **Repo:** `ohjay-official/brace`. Claude's session couldn't create repos, so Grok created it with a README.
- **Docs written:** `event.md`, `gates.md`, `research.md`, `brief.md`, `spec.md` (incl. Alchin's tracker data contract), `plan.md` (13 tasks), `demo-script.md`, `submission-draft.md`, `CLAUDE.md`, `progress.md`, `sample-history.json`.
- **Claude built (all tested, all on main):**
  - **Task 1:** Anchor 1.2.2 scaffold.
  - **Task 2:** integer-only onchain math (`programs/brace/src/math.rs`): probit table, ln series, least squares, isqrt, vol limit, fail-safe effective limit. Tested on live SOL, BTC and ZEC fixtures.
  - **Task 3:** Config, Feed PDA, `initialize`, `set_params`, `set_relayer`, `post_quotes`.
  - **Task 4:** demo pool: `init_pool`, `open_position`, `deposit`, `borrow` (fails `RiskTightened` 6005 above the live limit and logs `brace blocked ltv=.. limit=..`), `repay`, `withdraw`, `liquidate` (fixed 80% threshold only, never the odds); test USD mint.
  - **Task 5:** fuzz and invariant suite, 3,000 random actions and 7 invariants.
  - **Task 6:** review passes 1 to 4 by fresh reviewers, then one fix commit, each fix with a reproducing test:
    - spot only moves on confident posts; spot 0 rejected
    - 1-hour `StalePrice` (6009) guard on borrow, withdraw-with-debt and liquidate
    - pre-fund-safe mint
    - far strikes skipped instead of failing the fit
    - degenerate ladders rejected (strike span ≥ 0.5%, sigma ≥ 5%)
    - dust rounding favours the borrower in liquidation
    - `set_relayer` rejects the default key
- **Grok built (after Claude ran low on usage):**
  - new deploy keys
  - **review pass 5** and fixes
  - **Task 7:** devnet deploy. Program `Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC`, deploy tx `3LSQqWgx…S5DX`.
  - **Task 8:** relayer Worker live at `https://brace-relayer.ohjaye0.workers.dev`. Cron posts SOL, BTC, ETH, XRP and ZEC every minute. Shared blockhash, packed posts, lazy confirm, RPC rotation.
  - **Task 9:** QuickNode Stream `brace-program` → Worker → D1. `/history?asset=SOL`, `/actions`, `/health` and `/preview` are live, with CORS `*`.
  - **Task 13 prep.** Status at 05:46 WAT:
    - `cargo test -p brace`: 52/52 (15 math, 12 adversarial, 1 fuzz, 12 oracle, 9 pool, 3 worker_ix)
    - worker vitest: 55/55
- **Claude built the app (Tasks 10 to 12) on branches, merged to main:**
  - **README first pass**, judge-first. 10 `TBD-post-build` lines remain.
  - **Vercel:**
    - Oh-Jay connected the Vercel connector. Claude created the project `brace` (id `prj_9wGY8qg6SrXFm1yO4PxEzV2HuJoG`, team `team_mbAY3t3bzOPsb0RyQWblamxG`, scope "oh-jay-s-projects"), root `app/`, no token ever used.
    - `app/vercel.json` sets the framework to Next.js (the first build failed without it).
    - **Production:** https://brace-ivory.vercel.app, public, deploys from main. Branch previews need a Vercel login.
  - **Risk board** (Next.js 15, `app/`):
    - Oh-Jay rejected the first version as "AI slop, not a million dollar product". The redesign followed the unslop process.
    - **Direction:** exact, watchful, calm under pressure, a measuring-instruments world. Geist + Geist Mono, graphite neutrals, flat Solana purple (#9945FF dark / #7B2FF2 light text) only on the primary button and the fit curve, Solana green #14F195 live dot, amber for stale (#B45309 text on light). No gradients, glows, pills, emoji or em dashes. 1-decimal numbers.
    - **Home page:**
      - Hero "Lending limits that move before the market does".
      - Hand-drawn SVG chart of the live Gemini SOL ladder: real quote dots with bid–ask whiskers from `/api/ladder` (a server route proxying Gemini), the onchain lognormal fit curve, spot line, 24h 3σ band, and a live math line, e.g. "3σ 24h move ±12.8% → limit 80% × (1 − 0.128) = 69.8%".
      - "Every asset, every minute" list with the signature gauge (75% cap tick, 80% liquidation tick).
      - "Why it holds up" section, then the footer.
    - **Other pages:** `/asset/[symbol]` (chart, gauge, plain-language fields, Explorer link), `/about`, `/history` (still a placeholder), `/borrow`.
    - **Copy fix:** "Odds only tighten limits" was wrong, because limits rise when vol falls. It now says "Limits never exceed 75%, and odds never trigger a liquidation". The README was fixed the same way.
  - **Borrow flow:**
    - Wallet Standard (Phantom and Solflare) and a styled connect button.
    - Open position, deposit SOL, a borrow slider showing the live limit and "Submit anyway" over the limit (the demo: the chain rejects it), repay and withdraw.
    - Plain-English errors, Explorer links, an in-memory recent-actions list.
    - Instruction builders in `app/lib/tx.ts` are tested byte-for-byte against Anchor's encoder.
    - **Devnet simulation:** an over-limit borrow failed with 6005 (`brace blocked ltv=7987 limit=6987`); an under-limit borrow succeeded. **No real signed transaction yet.**
  - **App tests:** vitest 50/50; `next build` OK.
- **Readme skill:** Oh-Jay's `readme-playbook` skill update was proposed in a card for him to save:
  - quick-links table
  - "How It Compares" section with sourced comparisons
  - measuring rules for timings
  - "Professional Formatting" section
  - link-check rule

### A4. Accounts, keys and where things live
- **Keys:** the program upgrade authority and the deployer and relayer keys are on Grok's box. Claude's old keys (`WgkL5t5p…`, `HvCLY9Pe…`) are unused and never funded. Never commit keys.
- **Cloudflare:** Worker `brace-relayer` with D1 `brace` and secrets `RELAYER_SECRET` + QuickNode stream secret. Grok set this up via the scripts API.
- **QuickNode:** stream `brace-program`, Solana devnet, filtered to the program id. Grok set it up.
- **Vercel:** project `brace`, root `app/`, prod https://brace-ivory.vercel.app.
- **Oh-Jay** is phone-only (Android, Chrome). All his steps must be phone-friendly.

---

## Part B: current state (Tue Nov 17, 10:05 Lagos)

| # | Task | Owner now | State |
|---|---|---|---|
| 1 to 9 | Program, tests, reviews, deploy, relayer, Streams | done | live |
| 10 | README | **Grok** | First pass merged. Pass 2 needed (B1) |
| 11 | Risk board | done | live on brace-ivory.vercel.app |
| 12 | Borrow flow | **Oh-Jay + Grok** | Built and simulated. Needs the real Phantom check (B3) |
| 12b | History page | **Grok** | Placeholder. Wire to `/history` + `/actions` (B2) |
| 13 | Full re-check | **Grok** | After B1 to B3 |
| ship | Video, Devpost, submission | **Grok + Oh-Jay + Alchin** | Not started |

---

## Part C: roadmap (everything left, in order)

### B1. README pass 2 (Grok, Tue)
Follow the updated `readme-playbook` skill.
- **Quick links table** (what it is | time and what it needs):
  - live app (https://brace-ivory.vercel.app, no wallet)
  - borrow demo (Phantom devnet)
  - live data (`/history`)
  - one-command check (`anchor build && cargo test -p brace`, then `cd app && npx vitest run`)
  - the film
  - tracks
- **Fill every `TBD-post-build` line:**
  - program Explorer link
  - one real `post_quotes` tx with logs showing `brace SOL conf=1 …`
  - `/history` URL
  - app URL
  - QuickNode stream description
  - top screenshot of the live board, real, in `docs/images/`, ~260px phone shot, clean of personal wallet data
  - Try It steps written from the real on-screen words: "Try a borrow", "Connect wallet", "Open position", "Deposit", "Submit anyway", "Borrow"
  - add a `LICENSE` file (MIT)
- **How It Compares**, visible and sourced, dated "as their pages describe them on Nov 17, 2026", "Not stated" defined.
  - Candidate rows:
    - Brace (ours, first row)
    - static governance LTVs (e.g. Kamino or Jupiter Lend docs)
    - risk curators (Gauntlet, Chaos Labs)
    - options-based IV feeds (Block Scholes, Chainlink vol feeds)
    - Pyth price feeds with confidence intervals
  - Columns: data source | forward-looking? | assets covered | update cadence | where the math runs | cost and sign-in | open source.
  - Every competitor cell needs a vendor link; write "Not stated" where the page doesn't say.
  - Then 2 to 4 bold-claim bullets on why Brace stands out, and one honest line on where the others are stronger (maturity, coverage of majors, liquidity).
- **Test counts:** update from a fresh run. Last known: 52 Rust, worker 55, app 50.
- **Known limitations** as in `docs/reviews.md` accepted risks. Add: Gemini liquidity is thin; devnet only; 0% interest.
- **Built During UBC 2026:** first commit `a71e7ef` 2026-11-15; AI disclosure (Claude and Grok, directed by Oh-Jay); library versions from lockfiles.

### B2. History page (Grok, Tue/Wed)
- **Files:** `app/app/history/page.tsx` plus a client component.
- **Data:** `GET https://brace-relayer.ohjaye0.workers.dev/history?asset=SOL&since=<unix>` (shape in `docs/spec.md`), and `/actions?since=`.
- **Show:**
  - (a) A line chart of SOL's effective limit and implied vol over the last 24h, from real Streams rows. Hand-drawn SVG matching `components/LadderChart.tsx` style: accent on one line only, the other in neutral.
  - (b) A list of blocked vs allowed borrows from `/actions` (time, LTV vs limit, Explorer link).
  - (c) One line: "Recorded by QuickNode Streams from every Brace transaction on devnet."
- Honest empty state if `/actions` is empty.
- Match the design rules in A3 exactly.
- **Gate:** `npx vitest run && npm run build`, plus a screenshot at 390px and 1280px.

### B3. Real Phantom borrow (Oh-Jay, ASAP; Grok guides)
1. In Phantom: Settings → Developer settings → Testnet mode → Solana Devnet. Fund the wallet at faucet.solana.com if empty.
2. Open https://brace-ivory.vercel.app/borrow in Phantom's in-app browser.
3. Connect wallet → Open position → Deposit 0.5 SOL.
4. Slide past the limit → "Submit anyway". Expect "Rejected onchain…" with an Explorer link.
5. Borrow a small amount under the limit. Expect success.
6. Send the screenshots and tx links.

These two tx links go in the README Proof section and the video. If anything fails, read the Explorer logs. Common causes: Phantom ignoring skipPreflight; ATA creation; StalePrice if the relayer stopped. Check `/health`.

### B4. Alchin's accuracy tracker (Alchin; Oh-Jay forwards)
- **Send Alchin:** `https://brace-relayer.ohjaye0.workers.dev/history?asset=SOL` and the contract section of `docs/spec.md`.
- **Tracker:** a Python script computing the 1-hour band hit rates (1σ and 2σ) per asset.
- **Result:** goes in the README ("hit rate this week: X%", with the method linked) and the pitch. Only real measured numbers.

### B5. Gemini office hours (Oh-Jay, Thu Nov 19, 1:00 AM Lagos)
Ask the two questions in `docs/event.md`:
- Does building on the public data endpoints count for the bounty?
- Is publishing derived values onchain OK?

Record the answers in `docs/decisions.md`.

### B6. Full re-check, Task 13 (Grok, Wed/Thu)
- Fresh clone:
  - `anchor build && cargo test -p brace`
  - `cd worker && npx vitest run`
  - `cd app && npx vitest run && npm run build`
- Incognito run of every page on phone and desktop width.
- Every README link and anchor works (browser user agent; check anchors on logged-out github.com).
- Program id matches everywhere.
- `/health` is green.
- All five feeds updated within 2 minutes.
- Log results in `docs/progress.md`.

### B7. Video (Thu, record by Thu night)
- **Script:** finalize `docs/demo-script.md` with real numbers, 2:30, product on screen in the first 10 seconds.
  - **Shots:** board on phone → SOL chart and math line → Phantom borrow rejected onchain, then accepted → Explorer logs of a `post_quotes` → history timeline (Streams) → ZEC vs BTC limits plus Alchin's hit rate → closing line "Limits never exceed 75%, and odds never trigger a liquidation."
- **Recording:** phone screen recording by Oh-Jay or Alchin, with Do Not Disturb on and nothing private on screen.
- **Upload:** YouTube unlisted, then link it in the README and on Devpost.
- Keep a 60-second cut and know the longer technical explanation, because finalists pitch live: 5 min plus 2 min Q&A.

### B8. Devpost submission (Fri, by 3:00 PM Lagos)
- **Fields:** use `docs/submission-draft.md`.
  - Track: DeFi & Onchain Apps.
  - Chain award: Best use of Solana.
  - Bounties: Gemini Prediction Markets, QuickNode Streams.
  - Team: Oh-Jay, Alchin, BL.
  - Links: repo, live app, video, program id.
- **Double-check:** every link, that the README, video, app and form describe the same product, and the payout details.
- Keep the app, relayer and stream live through judging (Nov 21) and after.

### B9. Pitch prep (Alchin + BL, Thu/Fri)
- 5-minute pitch plus Q&A answers. Alchin already has the accuracy, "why not existing tools" and "what if Gemini stops" answers (`docs/HANDOVER.md` section 8).
- One hard number on a slide: implied medians within 0.1% of spot, plus the live hit rate.

### B10. After the deadline
Keep shipping for a week: fix judge-found issues, post updates on X (@Oh_Jay0), and follow up with Gemini, Solana and QuickNode.

---

## Part D: rules Grok must keep

- **Repo discipline:**
  - Repo is the source of truth.
  - Update `docs/progress.md` after every task and push.
  - Commits are attributed to `ohjay-official`.
  - Test first; never claim a pass you didn't run; never weaken a test; no secrets in repo, logs or chat.
- **Design rules:**
  - no purple gradients, pill buttons, fake metrics or counters, vague hero text, emoji, em dashes, flashy animations, AI-slop copy or images
  - light by default, dark mode available
  - keep the established look in `app/app/globals.css`
- **Working with Oh-Jay:**
  - He wants blunt, step-by-step, mobile-friendly instructions.
  - Make the technical calls yourself and explain each in one line.
  - Never present an unverified claim as fact.
  - He reviews before anything is final (10-80-10).
  - Ask him before changing what the product does or cutting scope, and bring a recommendation.
- **Vercel:** use the existing project and auto-deploys. Don't ask Oh-Jay for tokens; he refuses to paste secrets in chat.
- **BCH BLAZE (Holdfast):** runs in parallel and closes Nov 22, 3:00 PM Lagos. Don't let Brace work break it.
