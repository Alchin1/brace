# Brace UI revamp plan

Owner: the UI Grok Bot (see `docs/HANDOFF-UI.md`). Inputs: `motionsites-study.md`, `patterns/`, the live app. Written Wed Nov 18, 2026, about 00:45 Lagos.

**Deadlines (Lagos, UTC+1):** demo video recorded Thu Nov 19 night, so the "must ship" cut below has to be live on https://brace-ivory.vercel.app by **Thu Nov 19, 6:00 PM**. Devpost submit target Fri Nov 20, 3:00 PM (hard close 7:00 PM). After Thu 6 PM: only fixes, no new features, until the video is recorded.

## North star

Brace is a measuring instrument for lending risk. The revamp borrows motionsites' confidence (big type, one strong hero moment, living data, polished menus and footers) and keeps Brace's trust (real numbers only, calm colour, readable in light mode, fast on a mid-range Android in Phantom's in-app browser).

Motion is used where it carries information or orientation:
1. **Live data updates**: numbers tick between real readings, the live dot breathes, the tape moves.
2. **Scroll reveals**: section bodies below the fold fade up once; section rules draw across.
3. **Transitions**: 220ms page enter, menu sheet, segmented indicator, transaction timeline.
4. **The hero**: headline lines rise once; the grid light follows the pointer on desktop.

Nowhere else. No loops except the live dot and the pausable tape.

## Design rules: the balance

Oh-Jay's direction (relayed Nov 18): "if it genuinely makes sense, look for a balance". Each rule below says what stays, what relaxes and how far. The relaxed versions are already the defaults in `patterns/`. These are recommendations: Oh-Jay can veto any of them (see "Decisions for Oh-Jay" at the end).

| # | Old rule | motionsites does | Balanced default | Relaxed? |
|---|---|---|---|---|
| 1 | No flashy animation | WebGL tile wall, neon, autoplay video, marquees | **Purposeful motion.** One-time entrances at most 640ms (most 220 to 420ms), ease-out, no bounce, no blur, no scale-in. Two allowed loops: live dot ring and the pausable live tape. No WebGL, no video, no scroll-jacking, no parallax. | **Yes, moderately.** From "almost no motion" to "motion that carries data or orientation". |
| 2 | No glows | Neon text-shadow, blurred gradient duplicates, radial magenta glows | **One ambient light** behind the hero only: a radial at 7% (light) or 12% (dark) of the flat accent, masked out at the bottom, following the pointer on desktop. No text glow, no box glow, no coloured shadows. | **Yes, slightly.** One light, hero only. |
| 3 | No purple gradients | Gradient text, gradient buttons, pink/violet radial washes | **Stays.** Accent stays flat `#7B2FF2` / `#9945FF`. The only gradients are transparent-to-neutral masks and the 7 to 12% ambient light above (one colour fading to transparent, not purple-to-pink). | **No.** |
| 4 | No pill buttons | Every button and tab is rounded-full | **Buttons stay 8px**, segmented controls 10px track / 7px indicator, cards 14px, panels 20px. Fully round only for small non-interactive status chips ("live") and dots. | **Barely.** Chips only. |
| 5 | No fake metrics or counters | "500+ prompts", "$1M+", count-ups from 0, countdown timers | **Stays strict.** Every number is read live (devnet RPC or relayer). Numbers animate only between two real readings. Unknown shows `--` or a skeleton plus text. No count-ups, no "x users", no countdown. Test counts may appear only on About with the date they were run. | **No.** |
| 6 | No emoji | Lightning and flag emoji in banners | **Stays.** Text glyphs like the up and down arrows in the ticker are fine; icons come from lucide-react (already installed). | **No.** |
| 7 | No em dashes | Used in titles | **Stays** in all UI copy, alt text, metadata and docs. | **No.** |
| 8 | No AI slop copy, no vague hero text | "Unlock your AI Design Superpowers", "jaw-dropping" | **Stays.** Copy names the mechanism and the number: "Lending limits that move before the market does" stays the hero. Sentence case, concrete verbs, numbers with units. | **No.** |
| 9 | Light default, dark mode available | Dark only | **Stays.** Light default; dark is first-class (both themes screenshotted for every page). The hero grid and light are tuned per theme in `tokens.css`. | **No.** |
| 10 | Keep the established look in `globals.css` | n/a | **Extend, don't replace.** Keep all existing variables and colours; add `rv-` tokens and classes. Old classes are removed page by page as each page moves over. | **Yes.** The "look" evolves; the palette and fonts stay. |
| 11 | Geist + Geist Mono, 1-decimal numbers | Roboto Flex wide uppercase | **Stays Geist.** Display size up to about 76px, weight 600, tracking -0.035em, sentence case. No new font files. | **No** (scale changes only). |
| 12 | (implicit) no glass | `backdrop-filter` blur on chips and bars | **Sticky header only**, 12px blur over an 82% solid background with a solid fallback. No glass cards. | **Yes, slightly.** |
| 13 | (implicit) no marquee | Marquees of media | **Live tape only**, real values, Pause button, hover/focus pause, static scroller under reduced motion. | **Yes, scoped.** |

## Global systems

- **Tokens:** append `patterns/tokens.css` to `app/app/globals.css`. Do not change `--accent`, `--live`, `--stale` or the neutrals.
- **Layout:** `rv-wrap` (max 1200px, gutter 16 to 32px). Section spacing `--rv-section-y` (64 to 128px).
- **Type:** `rv-display` for page h1 on home only; page h1 elsewhere about 40px (`rv-h2` scale); body 15 to 16px; numbers always `--mono` with tabular figures and 1 decimal.
- **Nav:** `SiteNav` with links Board, Borrow, History, About; brand "Brace devnet"; right side theme toggle. Mobile sheet with numbered links.
- **Footer:** `SiteFooter` with program id + copy, live relayer line from `/health`, columns Product / Proof / Built on, note "Devnet build for UBC 2026. Test funds only.", outlined wordmark.
- **Page enter:** `app/app/template.tsx` wraps children in `PageTransitionCss`.
- **Reduced motion:** the CSS floor in `tokens.css` plus per-component checks. Test with Chrome DevTools > Rendering > "Emulate prefers-reduced-motion: reduce" and on iPhone Settings > Accessibility > Motion > Reduce Motion.

## Page by page

### Menu and header (every page)
| Part | Pattern | Notes |
|---|---|---|
| Bar | `SiteNav` | Transparent on top of the home hero, settles after 8px. On other pages it can start settled. |
| Active link | underline span | `isActive`: Board is active on `/` and `/asset/*` (same as today). |
| Mobile | sheet | Close on route change, Escape, outside tap. "Close" label + X. 64px rows. |
| Theme | `ThemeToggle` | Same `brace-theme` key and pre-paint script in `layout.tsx` (keep it). Use lucide `Sun`/`Moon` icons. |

### Home `/` (board)
| # | Section | Pattern | Data | Copy guidance |
|---|---|---|---|---|
| 1 | Hero | `Hero` + `HeroBackdrop` | SOL reading from `useBoard()` | Eyebrow "Onchain volatility oracle on Solana devnet". Title lines "Lending limits that move" / "before the market does". Sub stays. Actions: "Try a borrow" (primary), "How it works" (ghost, anchors to section 4). |
| 1a | Live reading | `NumberTicker` x2 + `rv-dot` | `feedEffectiveLtvBps`, `sigmaBps`, `relTime` | "SOL limit 69.2% · implied vol 85.8% · updated 12s ago". Never inside a reveal. |
| 1b | Hero visual | existing `LadderChart` in a framed panel | unchanged | Add a title line on the frame: "SOL · Gemini ladder · expires Nov 18, 5:00 PM ET" (from the chart's existing expiry label). Optional: the fit curve draws once (stroke-dashoffset) on first data. |
| 2 | Live tape | `LiveTape` | five feeds from `useBoard()` | Items "SOL limit 69.2% vol 85.8%". Status dot per feed. |
| 3 | Every asset, every minute | `SectionHead` 01 + desktop: today's table restyled with `NumberTicker` in the Limit column; phones (< 640px): `FeedCard` grid | `useBoard()` | Aside "Read from Solana devnet every 15 seconds" (true today). Sparklines are nice-to-have (needs `/history` per asset, see data rules). |
| 4 | How it works | `SectionHead` 02 + `StepRail` (3 steps) | static copy + one live number per step if cheap | Steps: "Read the market" (relayer posts raw Gemini quotes every minute), "Fit onchain" (the program fits the curve, stores vol, confidence, max LTV), "Set the limit" (pool checks every borrow; stale data only tightens). Each step links to proof: relayer `/health`, program on Explorer, a real rejected borrow tx (from README Proof). |
| 5 | Why it holds up | `SectionHead` 03 + `RevealGroup` of the three existing items | static | Keep the three titles and bodies (already reviewed for accuracy). |
| 6 | CTA | `CtaBand` | none | "Try the over-limit borrow yourself" / "Connect Phantom on devnet, borrow past the live limit, and watch the program refuse it." |
| 7 | Phone bar | `StickyActionBar watchId="hero"` | SOL limit | Hidden on desktop. |
| 8 | Footer | `SiteFooter` | `/health` (optional) | See global. |

### `/borrow`
Keep `BorrowApp.tsx` logic intact: wallet connect, instruction builders, sends, error mapping. UI changes are markup and CSS only.
| Part | Pattern | Notes |
|---|---|---|
| Header | page h1 "Try a borrow" + lede | Crumb "All assets" stays. |
| Live limit strip | `NumberTicker` + `rv-dot` | Sticky under the header on phones while the form is on screen (CSS `position: sticky; top: var(--rv-header-h)`). |
| Before you start | numbered list styled like the study's setup stepper | Same 3 steps. |
| Steps (Open, Deposit, Borrow, Repay or withdraw) | vertical numbered rail (StepRail styling without the scroll logic) | Done steps get a filled dot. |
| LTV gauge | existing `Gauge` with `markBps` | Animate the fill width with a CSS transition (220ms) when the slider moves; the number uses `NumberTicker` with `duration={0.2}`. |
| Submit anyway note | keep exactly | It tells judges to confirm past Phantom's warning. |
| Transaction progress | `TxTimeline` beside or replacing the look of `TxStatus` | Map BorrowApp's existing states to `TxPhase`; do not move send logic. Rejection copy: the program's reason, e.g. "Rejected by the program: 82.6% is over the 68.8% limit", plus Explorer link. |
| Recent actions | restyled list | Same data. |

### `/history`
| Part | Pattern | Notes |
|---|---|---|
| Header | h1 "History" + lede | Lede must match what is shown (today: SOL only, last 24 hours). |
| Asset switch | `SegmentedControl` SOL / BTC / ETH / XRP / ZEC | **Nice-to-have, needs a data change**: `HistoryView` passes `"SOL"` to `historyUrl`; switching assets means changing that call. Tell the backend bot first (data rule below). The relayer already serves all five (`/history?asset=BTC` etc. return data). |
| Chart | existing `HistoryChart` | Optional: the line draws in once; a hover/tap crosshair reading the nearest point. |
| Blocked and allowed borrows | list with `rv-dot` and status chip | Real rows from `/actions`. |
| Source link | keep | Links to the raw JSON (good for judges). |

### `/asset/[symbol]`
| Part | Pattern | Notes |
|---|---|---|
| Title row | big symbol + name + status chip | |
| Chart | `LadderChart` framed like the hero | |
| Limit panel | `NumberTicker` big number + `Gauge` | |
| Facts | `dl` grid in two columns on desktop | Same rows. |
| Other feeds | `FeedCard` x4 (the other assets) | Nice-to-have. |
| Explorer link | keep | |

### `/about`
| Part | Pattern | Notes |
|---|---|---|
| Hero | `rv-h2` scale h1 "How Brace works" + lede | |
| Body | prose, max 68ch, `Reveal` per block below the fold | Keep text; it was fact-checked. |
| Diagram | `StepRail` or a simple SVG flow: Gemini ladder → relayer → program → pool | Nice-to-have. Arrows as SVG, not emoji. |
| Known limitations | native `<details>` accordion styled like the study's FAQ | Keep every item; honesty is a feature for judges. |
| CTA | `CtaBand` | |

### 404
`rv-display` "Page not found", one line, "Back to the board" primary button (already there), hero backdrop at lower opacity.

## Data and logic rules (do not break the demo)

- **Never edit** `app/lib/**`, `app/app/api/**`, `app/components/BoardProvider.tsx` data logic, or the transaction code in `app/components/borrow/BorrowApp.tsx` without telling the backend bot first (`docs/HANDOFF-UI.md`, ownership). Reading their exports in new components is fine.
- New data needs (per-asset history for sparklines, asset switch on History, `/health` in the footer) go through a small, tested helper in `lib/` that the backend bot reviews, or reuse the existing `historyUrl()`/`fetchWithTimeout()` without changing them.
- Keep polling intervals as they are (board 15s, history 30s). Animations must not add requests.
- Phantom flow: test every UI change to `/borrow` with a real devnet borrow in Phantom (desktop extension and phone in-app browser) before calling it done.

## Mobile first

Oh-Jay tests on a Galaxy S25 (Chrome and Phantom's in-app browser), iPhone and iPad.
- Design at 390 first, then 768 (iPad portrait), 1024 (iPad landscape), 1440.
- Tap targets 44px, no hover-only information, the sticky bar respects `env(safe-area-inset-bottom)`, the menu sheet uses `100dvh`.
- No horizontal scroll at 360px (check with the shotter scripts in `/workspace/shotter/` on the box: `tap.mjs`, `shots.mjs`).
- Pointer light, card spotlight and hover lift are off on touch by design.

## Performance budget

- No new runtime dependency in the must-ship cut (patterns are React + CSS; measured +8.2 KB gzip for all of them in the demo bundle).
- `motion` only if a later feature needs it (measured +34.9 KB gzip).
- No images or video added to the hero. LCP element is the headline text.
- Animate only `transform` and `opacity` (and stroke-dashoffset on small SVGs). No layout-thrashing scroll handlers: one passive, rAF-throttled listener (`useScrolled`) and IntersectionObservers.
- Check with Lighthouse mobile on the Vercel URL before and after; do not ship a regression in LCP or CLS.

## Accessibility

- Contrast: body text on `--page` and `--card` must stay at least 4.5:1 in both themes (today's neutrals pass; don't dim text for effect).
- Live numbers: visible text updates silently (`aria-live` off) to avoid screen-reader spam every 15 seconds; the sr-only label carries the current value.
- The tape has a Pause button and only exposes one set of links to assistive tech.
- Menus: `aria-expanded`, `aria-controls`, Escape, focus return.
- Segmented control is a radiogroup with arrow keys.
- Respect reduced motion everywhere (see above).

## Build order (keeps every test green)

App tests only cover `lib/` and the ladder route, so UI work cannot break them unless it touches those files. Still run the full gate after every task.

1. **T1 Tokens and primitives**: append `tokens.css` to `globals.css`, add `components/ui/hooks.ts`. Gate. Screenshot all pages light and dark: nothing should change visually yet.
2. **T2 Nav and footer**: `SiteNav` + `ThemeToggle` + `SiteFooter` in `Chrome.tsx`; page enter via `app/template.tsx`. Gate + phone check.
3. **T3 Home hero**: `Hero`, `HeroBackdrop`, `NumberTicker` in the reading, framed `LadderChart`. Gate + phone check.
4. **T4 Home sections**: `SectionHead`, phone `FeedCard` grid, `NumberTicker` in the table, `LiveTape`, `StepRail` "How it works", "Why it holds up" reveal, `CtaBand`, `StickyActionBar`. Gate.
5. **T5 Borrow polish**: live strip, step rail styling, gauge transition, `TxTimeline`. Gate + **real Phantom borrow (over-limit rejected, under-limit accepted)**.
6. **T6 History, asset, about, 404 restyle** with existing data. Gate.
7. **Nice-to-have** (after the video, or before only if 1 to 6 are done by Thu 2 PM): sparklines, History asset switch, asset page "other feeds", About diagram, hero chart draw-in, history crosshair.

**Gate for every task:** `cd app && npx vitest run && npx tsc --noEmit && npm run build`, then push, wait for the Vercel deploy, load the page at 390 and 1440 in light and dark, then a "Do X, see Y" line in `docs/progress.md`. Before Thu 6 PM: `scripts/verify.sh` in a fresh clone must exit 0.

## Must ship by Thu Nov 19, 6:00 PM Lagos vs nice-to-have

| Must ship (video shows these) | Nice-to-have |
|---|---|
| Tokens, nav + mobile sheet, footer with program id | Sparklines on feed cards (needs per-asset history fetch) |
| Home hero with backdrop, line rise, live ticker reading | History asset switch (needs a data change, backend bot reviews) |
| Live tape | Asset page "other feeds" cards |
| Section heads + reveals, phone feed cards, How it works rail, CTA | About diagram |
| Phone sticky bar | Hero chart curve draw-in, history crosshair |
| Borrow: live strip, step styling, gauge transition, TxTimeline | `motion` package for exit animations |
| Page enter, reduced motion, both themes, 44px targets | Card spotlight tuning, 404 backdrop |

If time runs short, cut from the bottom of the left column upward, never the borrow flow.

## Decisions for Oh-Jay

The balanced defaults above are already in the patterns. Oh-Jay only needs to answer if he disagrees:
1. **Motion level** (rule 1): purposeful motion as above. Alternative: keep today's near-static look and only add the ticker and reveals.
2. **Hero light** (rule 2): one 7 to 12% accent light behind the hero. Alternative: grid only, no light.
3. **Chips** (rule 4): fully round status chips allowed, buttons stay 8px. Alternative: everything 8px.
4. **Glass header** (rule 12): blur on the sticky header. Alternative: solid header.
5. **Live tape** (rule 13): yes with Pause. Alternative: no tape, the table only.
6. **Footer wordmark**: large outlined "Brace" at the very bottom. Alternative: no wordmark.
