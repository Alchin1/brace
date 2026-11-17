# Brace UI patterns

Self-contained React 19 + plain CSS components for the revamp. They re-implement ideas from the motionsites.ai study (`../motionsites-study.md`) as our own code. No motionsites code, media or fonts are used.

The app has no Tailwind, so the patterns use plain CSS with an `rv-` prefix (no clashes with today's `globals.css` while both live side by side) and the app's existing CSS variables (`--page`, `--card`, `--text`, `--accent`, `--hair`, `--live`, `--stale`, `--mono`...). `tokens.css` adds the new ones.

## Proof they work (run it, don't trust it)

```
bash docs/ui-revamp/patterns/check/check.sh     # typecheck + server render + bundle sizes, touches nothing in app/
bash docs/ui-revamp/patterns/check/preview.sh   # static preview of Demo.tsx in /tmp/rv-preview (serve it and open index.html)
```

Last run, Wed Nov 18 2026 about 00:30 Lagos:

```
== typecheck
tsc: 0 errors
== server render
ssr: ok, 21389 chars of html
== browser bundle
react-dom alone: 67.3 KB gzip (baseline, already in the app)
all default patterns (CSS motion): +8.2 KB gzip over react-dom
optional motion versions (LazyMotion + m + PageTransition): +34.9 KB gzip over react-dom
css: 20.2 KB min, 4.7 KB gzip
ssr: 0 elements start at opacity:0 (must be 0 for the default CSS patterns)
```

The check uses the app's exact React 19.3.1, @types/react 19.3.0 and TypeScript 5.9.3 with the app's `tsconfig` options (strict, bundler resolution, `jsx: preserve`), in a temp folder. Rendered screenshots of `Demo.tsx`: `../shots/patterns-demo-*.jpg` (light, dark, 390 and 1440, mobile menu, sticky bar, reduced motion).

## Dependencies

- **Default set: none new.** Everything except the three files marked OPTIONAL runs on React alone.
- **Optional: `motion` (14.14.0 tested, `import ... from "motion/react"`).** Only `MotionProvider.tsx`, `Reveal.tsx`, `PageTransition.tsx` (and `DemoMotion.tsx`, which exists to measure them) need it. Measured cost: about 35 KB gzip. The CSS versions look the same, so the recommendation is to ship without it this week and add it only if a later feature needs exit or layout animation. To add it: `cd app && npm i motion@14.14.0`, then wrap `<body>` children in `<MotionProvider>`.

## Files

| File | What it is | Motion | Where it goes in Brace |
|---|---|---|---|
| `tokens.css` | Type scale, radii, motion durations, header and grid colours, live dot with pulse ring, buttons, status chip, reduced-motion floor, native smooth anchor scroll | CSS | `app/app/globals.css` (append, keep existing vars) |
| `hooks.ts` | `usePrefersReducedMotion`, `useFinePointer`, `useMediaQuery`, `useInViewOnce`, `useScrolled` | none | `app/components/ui/hooks.ts` |
| `SiteNav.tsx` + `site-nav.css` | Sticky header that settles on scroll, active link underline, mobile sheet with numbered links, `ThemeToggle` (same `brace-theme` storage key as today) | CSS | replaces `Header` in `components/Chrome.tsx` |
| `Hero.tsx` + `hero.css` | Editorial hero: full-width headline with line rise, copy left, chart right, `HeroBackdrop` grid + pointer light | CSS, rAF on desktop | `app/app/page.tsx` hero |
| `NumberTicker.tsx` + `number-ticker.css` | Live number that eases between real readings with a neutral flash and up/down mark; never counts from 0 | rAF | hero reading, board limits, asset page, borrow LTV |
| `LiveTape.tsx` + `live-tape.css` | Pausable tape of the five feeds | CSS | under the hero |
| `Sparkline.tsx` + `sparkline.css` | Tiny SVG line from `/history`, draws in once | CSS | FeedCard, asset page |
| `FeedCard.tsx` + `feed-card.css` | Asset card with status chip, big limit, spotlight hover | CSS | board on phones, asset page "other feeds" |
| `SegmentedControl.tsx` + `segmented.css` | Radiogroup switch with sliding indicator | CSS | History asset and range |
| `SectionHead.tsx` + `section.css` | Numbered section header, rule draws on enter | CSS | every page section |
| `StepRail.tsx` + `step-rail.css` | Scroll story with sticky rail and progress line | CSS | home "How it works", About |
| `CtaBand.tsx` + `cta-band.css` | Closing CTA panel with masked grid | none | end of home and About |
| `SiteFooter.tsx` + `site-footer.css` | Columns, program id + copy, live status, outlined wordmark | none | replaces `Footer` in `Chrome.tsx` |
| `StickyActionBar.tsx` + `sticky-bar.css` | Phone bottom bar after the hero | CSS | home |
| `TxTimeline.tsx` + `tx-timeline.css` | Approve, Sent, Result rail (presentational only) | CSS | `/borrow`, next to today's `TxStatus` |
| `Skeleton.tsx` + `skeleton.css` | Shimmer placeholder, always beside text status | CSS | loading states |
| `RevealCss.tsx` + `reveal.css` | DEFAULT scroll reveal and stagger, page enter and menu keyframes | CSS | section bodies below the fold |
| `PageEnter.tsx` | DEFAULT page enter (`PageTransitionCss`) | CSS | `app/app/template.tsx` |
| `Reveal.tsx`, `PageTransition.tsx`, `MotionProvider.tsx` | OPTIONAL motion versions | motion | only if motion is added |
| `fixtures.ts` | Real relayer snapshot (captured 00:15 Lagos Nov 18) for demos only | n/a | never imported by the app |
| `Demo.tsx`, `DemoMotion.tsx` | Everything composed; used by the check and preview | n/a | reference |
| `patterns.css` | Imports all CSS in order | n/a | reference |

## Rules the patterns enforce

- Live numbers render real values on first paint. Nothing counts up from zero. `null` shows `--` or a skeleton plus text.
- Every looping animation is either the live dot ring or the pausable tape. Everything else runs once.
- `prefers-reduced-motion: reduce` turns off transforms, loops and the pointer light; content is never hidden.
- Pointer effects only run on `(hover: hover) and (pointer: fine)`.
- Server HTML is complete and visible; reveals arm only after hydration.
- Targets are at least 44px; menus close on Escape; focus is visible (`--focus`).
- Buttons have 8px corners. Only small non-interactive status chips and dots are fully round.
- In the app, pass Next's `Link` as `linkAs` so navigation stays client-side.
