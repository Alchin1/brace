"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFinePointer, usePrefersReducedMotion } from "./hooks";

/*
 * Hero: editorial layout. The headline runs the full width on its own row (the big-type
 * moment motionsites heroes are built around), then the sub, actions and live reading sit on
 * the left with the live instrument (the existing LadderChart) on the right. On phones it all
 * stacks: headline, copy, chart. Keep each title line short (about 24 characters) so a line
 * never wraps on desktop; on phones the lines wrap naturally and still animate.
 *
 * From motionsites:
 *  - The home hero sits on a WebGL "tile wall" (three.js InstancedMesh) lit from behind the
 *    headline, with a pointer-following light and a ripple on load, masked to fade out at the
 *    bottom (mask-image: linear-gradient(black 50%, transparent)). It only loads when
 *    (hover: hover) and (pointer: fine) match and reduced motion is off, via dynamic import.
 *  - Headlines are huge, tight, uppercase, with an animated gradient word.
 *
 * Brace's balance:
 *  - The tile wall becomes a static SVG grid of hairlines (a measuring-paper feel that fits
 *    "instruments"), masked the same way. Zero JS, zero WebGL, nothing to download.
 *  - The light is one soft radial at 7 to 12% accent opacity. On desktop with a fine pointer
 *    it follows the cursor (CSS variables updated in rAF). On touch or reduced motion it
 *    stays put. No gradient text, no neon text-shadow.
 *  - Headline in sentence case, Geist 600, tight tracking; each line rises once on load
 *    with CSS keyframes (works before hydration, so it never blocks first paint).
 */

type Props = {
  eyebrow?: ReactNode;
  /** Each string is one line of the headline; keep it to 2 or 3 lines. */
  titleLines: string[];
  titleId?: string;
  sub: ReactNode;
  actions: ReactNode;
  /** The live reading strip (SOL limit, vol, age). Rendered without animation so it is readable at once. */
  reading?: ReactNode;
  visual?: ReactNode;
};

export function Hero({ eyebrow, titleLines, titleId = "hero-title", sub, actions, reading, visual }: Props) {
  return (
    <section className="rv-hero" aria-labelledby={titleId}>
      <HeroBackdrop />
      <div className="rv-hero-inner rv-wrap">
        <div className="rv-hero-head">
          {eyebrow && <p className="rv-eyebrow rv-hero-eyebrow">{eyebrow}</p>}
          <h1 id={titleId} className="rv-display rv-hero-title">
            {titleLines.map((line, i) => (
              <span key={i} className="rv-line">
                <span className="rv-line-inner" style={{ animationDelay: `${80 + i * 70}ms` }}>
                  {line}
                </span>
              </span>
            ))}
          </h1>
        </div>
        <div className="rv-hero-copy">
          <p className="rv-hero-sub">{sub}</p>
          <div className="rv-hero-actions">{actions}</div>
          {reading && <div className="rv-hero-reading">{reading}</div>}
        </div>
        {visual && <div className="rv-hero-visual">{visual}</div>}
      </div>
    </section>
  );
}

/** Grid + one ambient light. Decorative, aria-hidden, pointer-events none. */
export function HeroBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !fine || reduced) return;
    let frame = 0;
    let x = 0.5;
    let y = 0.35;
    const paint = () => {
      frame = 0;
      el.style.setProperty("--rv-mx", `${(x * 100).toFixed(2)}%`);
      el.style.setProperty("--rv-my", `${(y * 100).toFixed(2)}%`);
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (e.clientY > r.bottom) return;
      x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [fine, reduced]);

  return (
    <div ref={ref} className="rv-hero-backdrop" aria-hidden>
      <svg className="rv-hero-grid" width="100%" height="100%">
        <defs>
          <pattern id="rv-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="var(--rv-grid-line)" strokeWidth="1" shapeRendering="crispEdges" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#rv-grid)" />
      </svg>
      <div className="rv-hero-light" />
    </div>
  );
}
