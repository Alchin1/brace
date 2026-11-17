# motionsites.ai study

Studied Tue Nov 17 to Wed Nov 18, 2026 (Lagos, UTC+1) for the Brace UI revamp. Method: curl of the HTML, CSS and 30 JS chunks (read with prettier), headless Chrome at 1440x900 and 390x844 (iPhone width) with step-by-step scrolling (one screenshot per 0.85 viewport, so scroll-triggered states and lazy media load), full-page captures, a hover pass, the mobile menu, the Fintech and Dashboard filters, an expanded card, and 3 frames over 5 seconds of 12 fintech/dashboard template previews.

What it is: a gallery that sells AI website prompts. Its own pages are a dark shell around a grid of video previews; most of the "motion" lives in the showcased templates. So this study covers two layers: **the shell** (how motionsites itself is built) and **the templates** (what the most relevant fintech and dashboard designs do). Everything Brace takes is re-implemented as our own code in `patterns/`; no motionsites code, images, video or fonts are copied.

Screenshots are in `shots/` (JPEG, compressed, about 2 MB total). `ms-*` are motionsites, `brace-now-*` are the live Brace app before the revamp, `patterns-demo-*` are the patterns in this folder rendered.

## Coverage

| Area | Pages / states | Widths |
|---|---|---|
| Home `/` | hero, filter rail, grid (infinite scroll, 4 to 5 screens), Fintech filter, Dashboard filter, card hover, expanded card, mobile menu, promo bars | 1440, 390 |
| `/mcp` | hero, product frame, setup stepper, 3D marquee, footer | 1440, 390 |
| `/backgrounds` | hero, coverflow carousel, filter rail, video grid | 1440, 390 |
| `/academy` | cinematic hero, featured build, video lesson grid | 1440, 390 |
| `/3d-websites` | hero, masonry grid | 1440, 390 |
| `/unlimited` | pricing (3 plans), FAQ accordion, prompt packs | 1440, 390 |
| `/public-contact`, `/auth` | centered forms | 1440, 390 |
| `/terms` (same Legal template as privacy, cookie, refund) | long-form text | 1440 |
| Templates (videos) | Sellix, Wealthcore, Crypto Vault, Pulse, Aurex Finance, FinFlow, Crystal Scroll, Evergreen Finance, Cobalt Hour, Wealth Video Hero, Forecast Center, Dashboard UI | 1440 |

9 site pages and 12 templates: 36 shell sections and 12 template rows catalogued below.

## Stack found in the source

- React SPA generated with Lovable (assets on `gpt-engineer-file-uploads`), TanStack Start (`createServerFn`, `useServerFn`), Tailwind v4 utilities, Radix primitives (accordion, dropdown, popover, dialog), Supabase for data.
- Video: Mux. Cards show `image.mux.com/<id>/animated.webp?width=640&fps=15` as the moving thumbnail and `thumbnail.webp?time=2` as the poster; full previews stream HLS through hls.js (`ManagedHlsVideo`: hls.js when supported, native `application/vnd.apple.mpegurl` on Safari, and it tears the source down on unmount).
- WebGL: one lazy chunk, `tile-wall-*.js` (545 KB, three.js `InstancedMesh`), behind the home hero only.
- No GSAP, no Lenis, no ScrollTrigger. No Motion/Framer `whileInView`, `useScroll` or `AnimatePresence` in the loaded chunks. Animation is CSS keyframes, Tailwind transitions, IntersectionObserver and a few requestAnimationFrame loops.
- Fonts: Geist (nav bar, loaded at runtime with a `<link>`), Roboto Flex with the width axis pushed to `"wdth" 151` for display headlines, system sans elsewhere, Material Icons.
- Tokens (`:root`): background `#121212`, card `#292929`, border `#303030`, muted text `#ababab`, primary `#1a40ff`, radius `1rem`. Dark only.

## The shell, section by section

### 1. Promo bar (top)
Full-width purple strip, centered "We support Parity Purchasing, use code ... to get 30% off", left link with a lightning emoji. Seasonal marketing. *Brace: not taken (emoji, promo). The idea of a thin system strip is reused as the optional devnet status line.*

### 2. Nav bar
`ms-home-hero-1440.jpg`. Logo left, "Sites / Dashboards" tabs, right group "MCP, Backgrounds (TOP badge), Academy, Studio, 3D, Affiliate, Submit, Contact", search icon, "Sign up" in a dark rounded-full pill (height 48, `#262626`, a 4-layer soft shadow `rgba(0,0,0,.02) 0 0 2px, ... 0 6px 30px`). Inline `<style>` with breakpoints: links hidden under 1100px, a menu button takes over.
*Brace: sticky bar that is transparent over the hero and turns solid with a hairline and light blur after 8px of scroll (`SiteNav.tsx`). 10px corners, no pill.*

### 3. Mobile menu
`ms-mobile-menu-390.jpg`. Burger in a 48px round button opens a dark rounded panel (radius about 16px) anchored under the bar, right aligned, 6 links at about 16px, generous 40px rows. No animation beyond a fade.
*Brace: full-height sheet under the bar, 28px links with mono index numbers (01 to 04), 64px rows, burger morphs to an X, Escape and outside tap close, focus moves in and back, scroll locked (`SiteNav.tsx`).*

### 4. Home hero (default state)
From the code: badge "Fresh Drops Everyday" (bold uppercase micro label inside a bordered chip), headline "Unlock your AI Design Superpowers" in Roboto Flex at 48 to 66px, black weight, uppercase, tight 44 to 56px leading. The word "Superpowers" is three stacked spans: a radial gradient clipped to text whose centre moves (`@property --gradient-x/--gradient-y` animated by a 6s `gradient-shift` keyframe), the same text blurred 10px with `mix-blend-mode: screen` at 0.8 opacity as a glow, and a noise texture with `mix-blend-mode: overlay`. Subline in muted grey, then the CTA.
*Brace: big tight display type yes; gradient text, glow and noise no (see conflicts).*

### 5. Home hero (seasonal state, live during the study)
`ms-home-hero-1440.jpg`. "BLACK FRIDAY 40% OFF" in neon (`text-shadow: 0 0 18px rgba(255,42,119,.9), 0 0 42px ..., 0 0 90px ...`) over the WebGL tile wall.

### 6. WebGL tile wall
Lazy-loaded only when `(hover: hover) and (pointer: fine)` matches and reduced motion is off (`matchMedia` gate, then dynamic `import()`). A grid of instanced tiles lit from behind the headline (it reads the headline's bounding box to place the light), a pointer-follow light (pointer mapped to -1..1), a ripple 250ms after warm-up, a radial magenta gradient behind it, and a CSS mask that fades the bottom half: `mask-image: linear-gradient(to bottom, black 0%, black 50%, transparent 100%)`. Canvas fades in over 700ms once ready.
*Brace: same composition with no WebGL: SVG hairline grid + one radial light that follows the pointer on desktop only, same mask (`Hero.tsx`, `HeroBackdrop`). The gating logic (fine pointer, reduced motion) is copied as an idea.*

### 7. Primary CTA button
"Go Unlimited →": rounded-full, h-14, a vertical gradient from pale blue `rgb(207,222,246)` to near white, dark text, and a 2px white top border that reads as a lit edge. Hover is just `opacity: .9`.
*Brace: flat accent button, 8px radius, 44px min height, press scale .98. The "hover is a small change, not a show" lesson is kept.*

### 8. Filter rail
Two segmented tracks: Featured / Popular / Recent, and a scrollable category rail (All, Sections, Hero, Landing Page, SaaS, 3D, ... Fintech) with arrow buttons that appear at the edges, plus a Pricing dropdown. Rounded-full track, highlighted segment. Mobile: one row with a filter icon button.
*Brace: `SegmentedControl.tsx` for History asset and time range. 8px corners, sliding indicator measured from the active button, radiogroup keyboard support.*

### 9. Gallery grid
`grid-cols-2`, then 3 at 900px, 4 at 1200px, 5 at 1600px, 16px gaps, infinite scroll via an IntersectionObserver sentinel (`useInfiniteScrollRef`). Each card: a rounded-2xl 16:10 media tile, then a caption row (title, grey category, a copy icon or a crown for premium).
*Brace: the caption-under-media rhythm becomes the FeedCard (symbol, name, status chip, then the big number).*

### 10. Card hover
`ms-fintech-filter-1440.jpg` (cursor on Wealthcore). Hover swaps the static poster for the animated preview (opacity crossfade, 300ms), shows a like button (black/60 + backdrop blur) top right and a copy button bottom right. On mouse leave the video's `src` is removed and `load()` called, so off-hover cards cost nothing.
*Brace: no video. Hover is a 2px lift, a brighter border and a soft cursor-following spotlight, desktop only (`FeedCard.tsx`).*

### 11. Expanded card
`ms-card-expanded-1440.jpg`. Clicking a card expands it in place to span the grid (back arrow, video left, side panel right with title, likes, "Copy prompt" white pill, "Edit in Studio", sponsored builds), the rest of the grid reflows around it.
*Brace: not needed for v1. Idea parked for the asset page (an asset row expanding into its detail on desktop).*

### 12. Inline promo card in the grid
A 2-column dark card inside the grid ("BACKGROUNDS, Animated backgrounds designed to convert, impress, and amaze. Explore Videos") with a decorative layer.
*Brace: the slot idea maps to a "How the limit is computed" card inside the feed grid on the board.*

### 13. Bottom sticky offer bar
Fixed to the bottom, slides up on load (`slide-up-banner`: translateY(120%) to 0, .35s, cubic-bezier(.16,1,.3,1)), "Black Friday, Lifetime Access for $299 instead of $499, Ends in 06h 53m 37s, See the deal". Countdown boxes in mono.
*Brace: the mechanics only, as a phone-only bar that appears after the hero leaves the screen, with the real SOL limit and "Try a borrow". No countdown, no urgency (`StickyActionBar.tsx`).*

### 14. Footer
One line: copyright and operator, Terms, Privacy, Cookie, Refund, YouTube and X icons. Dark, quiet.
*Brace: richer footer with the program id, copy button, live relayer status and link columns (`SiteFooter.tsx`).*

### 15. `/mcp` hero
`ms-mcp-hero-1440.jpg`. Micro badge "MOTIONSITES AI MCP", two-line uppercase headline with one gradient word, subline, two CTAs (lit pill "Install MCP", dark pill "See plans").

### 16. `/mcp` product frame
A rounded dark frame (like an app window) holding a live-looking product UI: a list panel on the left and a grid of cards, with a fake cursor. It shows the product working instead of describing it.
*Brace: this is exactly what the hero chart already does. The plan frames the LadderChart as an "instrument window" with a title bar line (asset, expiry, live dot).*

### 17. `/mcp` setup stepper
"SET UP IN UNDER A MINUTE." Numbered steps down a vertical line, step 1 is a tool picker (Claude, Claude Code, Cursor, Codex, Other) as square cards, later steps hold a copyable URL field and a button.
*Brace: the numbered vertical rail maps to the borrow flow (Before you start, Open, Deposit, Borrow, Repay) and to "How it works" (`StepRail.tsx`).*

### 18. `/mcp` 3D marquee
A full-bleed row of tilted video cards scrolling sideways. In code (`McpPromptMarquee`): a rAF loop moving a doubled row by 48 px/s with `translate3d`, wrapping at half the scroll width, draggable with pointer capture and `touch-pan-y`, videos play only while intersecting (IntersectionObserver with 100px margin).
*Brace: `LiveTape.tsx`, a tape of the five live feeds. CSS animation instead of a JS loop, a Pause button (WCAG 2.2.2), hover and focus pause it, static scroller under reduced motion.*

### 19. `/backgrounds` hero
Centered uppercase headline with gradient word, micro badge, lit pill CTA.

### 20. `/backgrounds` coverflow
Three cards: the centre one large and bright, side cards dimmed and partly off screen.

### 21. `/backgrounds` video grid
4-column grid of looping background videos with a watermark, filter rail (Featured, Popular, Recent, Dark, Light, Abstract, Nature, Space...).

### 22. `/academy` hero
Left aligned for once: "LEARN TO MAKE CINEMATIC 3D WEBSITES WITH AI", italic accent word, over a full-bleed cinematic sky image fading to black. Small "powered by" logo line.

### 23. `/academy` featured build + lesson grid
Large 16:9 featured video card with an app icon overlay, then "Watch & Learn", a 3-column grid of YouTube thumbnails with titles under them.

### 24. `/3d-websites`
Centered hero with a count line ("120+ 3D websites, new prompts added daily"), then a masonry grid of mixed-height cards.

### 25. `/unlimited` pricing
`ms-unlimited-pricing-sheet-1440.jpg`. Big two-line headline, 3 plan cards (dark `#292929`, radius 16px): name, one-line description, price, sub-price note, full-width button, check-list features with tiny "NEW" chips. The highlighted plan has a gradient button and a "Most Popular" badge, plus a struck-through old price.

### 26. `/unlimited` FAQ
Accordion rows in one bordered panel, chevron right, Radix accordion height animation (`accordion-down/up` keyframes on `--radix-accordion-content-height`).
*Brace: the About page's "Known limitations" and the judge FAQ can use native `<details>` with the same look, no library.*

### 27. `/unlimited` prompt packs
Left: big headline "NEED PROMPTS ON YOUR TERMS?". Right: a card with a 1 / 3 / 10 segmented picker and a price.

### 28. Contact and auth
`ms-contact-auth-1440.jpg`. Centered single-column forms, dark inputs with no border, white full-width pill submit (auth uses a coral to violet gradient button).

### 29. Legal pages
Plain long-form text on dark, same nav and footer.

### 30. Loaders and skeletons
`skeleton` component plus a `shimmer` keyframe (translate to 100%, 1.6s infinite), a spinning ring for infinite scroll.
*Brace: `Skeleton.tsx`, always next to a text status.*

### 31. Entrances
`parallax-fade-up` (opacity 0 to 1, translateY 16px to 0, .6s ease-out), Tailwind `animate-in` (enter/exit with optional blur), caret blink. Nothing scroll-scrubbed.
*Brace: `RevealCss.tsx`, 12px, .42s, once.*

### 32. Page transitions
None. Route changes swap content instantly; the hero is the moment.
*Brace: a 6px, 220ms enter on each route (`PageEnter.tsx`), because Brace is one instrument across 5 pages.*

### 33. Cursor effects
Only inside templates and the tile wall (pointer light). No custom cursor on the shell.

### 34. Typography
Uppercase display in a wide variable font, very tight leading, black weight, centered. Body small and grey. Mono for countdown digits.
*Brace: keeps Geist and Geist Mono (already loaded), takes the scale and tight tracking, keeps sentence case.*

### 35. Colour
Near-black `#121212` everywhere, cards one step lighter, white text, one accent per moment (pink neon, blue primary, gradient words). Dark only.

### 36. Spacing and grid
16px mobile and 24px desktop side margins, 16px grid gaps, max width 1920px on gallery pages, hero padding 48 to 64px top.

## The templates (fintech and dashboard)

Frames in `ms-fintech-templates-a.jpg` and `ms-fintech-templates-b.jpg` (3 frames each, 2.5s apart).

| Template | What moves | What Brace can take |
|---|---|---|
| Sellix | Slowly rotating dotted globe with violet rim light under a centered headline "Cross-border finance" | A slow, single background element; never purple gradients |
| Wealthcore | Monochrome grain, a floating glass card with portfolio numbers drifting in, split light | Floating "instrument" card next to copy; numbers arrive, not count |
| Crypto Vault | Hero swaps between scenes (headline, then three feature cards), metal card on rock | Feature trio with icons, clean dark/light split |
| Pulse | Bold brand word, an orange ribbon that sweeps through, playful stickers | Not Brace's tone |
| Aurex Finance | Glowing jellyfish drifting, tiny mono labels in corners like a HUD | Mono HUD labels around a chart (axis notes, "spot", "3σ") |
| FinFlow | Light theme, large white globe, centered headline, two buttons | Proof that a light, calm fintech hero works |
| Crystal Scroll | Scroll scene: crystal shape, logo strip, then "Real-world yield..." headline appears | Scroll-staged sections (Brace: StepRail, no pinning) |
| Evergreen Finance | Warm off-white, serif headline, product UI cards over a landscape, testimonial | Product UI cards in the hero; testimonials not applicable |
| Cobalt Hour | Portrait hero, a strip of product tiles marquee at the bottom | Bottom marquee under a hero (Brace: LiveTape) |
| Wealth Video Hero | Swooping light trails, feature row of 4 short items at the bottom | 4-item proof row under the hero |
| Forecast Center | Dashboard over a storm photo, glass panels, big numeric readings, a wavy line chart | Big mono readings with small labels; glass only where it aids legibility |
| Dashboard UI | Light glass tiles over a meadow, toggles, small charts | Tile grid with a mini chart per tile (Brace: FeedCard + Sparkline) |

## Top 10 ideas for Brace

1. **Editorial display headline.** Full-width, 2 lines, 64 to 76px on desktop, tight tracking, lines rise once on load (CSS, runs before hydration).
2. **Instrument backdrop.** Hairline grid with a bottom fade mask and one soft light that follows the pointer on desktop only: the tile wall's composition without WebGL.
3. **Live feed tape.** Real limits and vol for all five assets sliding under the hero, pausable, static under reduced motion.
4. **Numbers that tick between real readings.** 69.1% eases to 69.4% when a post lands, with a short neutral tint and an up or down mark. Never counts from zero.
5. **Feed cards with sparklines.** Phone-first replacement for table rows: big mono limit, status chip, 12-hour line drawn from `/history`.
6. **Sticky nav that settles.** Transparent over the hero, solid with a hairline and blur after scroll; full-height mobile sheet with big numbered links.
7. **Numbered sections with drawing rules.** "01 Live board, 02 How it works, 03 Proof": a hairline draws across as each section enters.
8. **How it works as a scroll story.** Sticky step rail with a progress line on desktop, stacked numbered panels on phones, no scroll-jacking.
9. **Phone sticky action bar.** After the hero, a bottom bar with the live SOL limit and "Try a borrow". Same slide-up as their offer bar, none of the urgency.
10. **Transaction timeline on /borrow.** Approve, Sent, Result as a 3-dot rail that fills as the borrow moves; the over-limit rejection shown calmly with the program's reason and Explorer link.

Also worth it: product-frame treatment for the hero chart (16), a footer with the program id and live relayer status (14), segmented asset switch on History (8), shimmer skeletons beside text status (30), CSS page enter (32).

## What not to take
Neon and gradient text, noise overlays, autoplay video, WebGL on phones, uppercase everywhere, promo and countdown bars, emoji, dark-only theme, pill buttons, big round-number claims ("500+", "$1M+"). Reasons and the balanced alternatives are in `brace-ui-plan.md`, "Design rules: the balance".
