"use client";

import { useState, type ElementType } from "react";
import { usePrefersReducedMotion } from "./hooks";

/*
 * A slow tape of the five live feeds, under the hero.
 *
 * From motionsites: McpPromptMarquee is a requestAnimationFrame loop that moves a doubled
 * row by 48 px/s with translate3d, wraps at half the scroll width, and lets you drag it
 * (pointer capture, touch-pan-y). Their CSS also has `marquee-x` (translate 0 -> -50%, 240s).
 *
 * Brace's balance:
 *  - CSS animation, not a JS loop: cheaper on phones and it pauses itself off screen.
 *  - Only real values from the board (null shows "--"). No fake tickers, no prices we do not read.
 *  - A visible Pause button (WCAG 2.2.2: anything that moves for more than 5 seconds needs one),
 *    and it pauses on hover and keyboard focus.
 *  - Reduced motion: no movement at all; the row becomes a normal horizontal scroller.
 *  - The duplicate copy is aria-hidden and its links are out of the tab order, so screen
 *    readers and keyboards meet each feed once.
 */

export type TapeItem = {
  symbol: string;
  limitText: string; // already formatted, e.g. "69.2%" or "--"
  volText: string; // e.g. "85.8%"
  status: "live" | "stale" | "none";
  href: string;
};

export function LiveTape({ items, linkAs: L = "a", secondsPerItem = 6, reps = 2 }: { items: TapeItem[]; linkAs?: ElementType; secondsPerItem?: number; reps?: number }) {
  const reduced = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const still = reduced || paused;
  const n = reduced ? 1 : reps;

  // One copy must be wider than the widest screen or a gap shows at the loop point, so the
  // five feeds repeat `reps` times per copy. Only the very first run is exposed to assistive tech.
  const row = (copy: 0 | 1) => (
    <ul className="rv-tape-row" aria-hidden={copy === 1 ? true : undefined}>
      {Array.from({ length: n }).flatMap((_, r) =>
        items.map((it) => {
          const hidden = copy === 1 || r > 0;
          return (
            <li key={`${copy}-${r}-${it.symbol}`} aria-hidden={hidden && copy === 0 ? true : undefined}>
              <L href={it.href} className="rv-tape-item" tabIndex={hidden ? -1 : undefined}>
                <span className="rv-dot" data-status={it.status} />
                <span className="rv-tape-sym">{it.symbol}</span>
                <span className="rv-tape-k">limit</span>
                <span className="rv-tape-v">{it.limitText}</span>
                <span className="rv-tape-k">vol</span>
                <span className="rv-tape-v">{it.volText}</span>
              </L>
            </li>
          );
        }),
      )}
    </ul>
  );

  return (
    <div className="rv-tape" data-still={still ? "" : undefined}>
      <div className="rv-tape-viewport">
        <div className="rv-tape-track" style={{ animationDuration: `${items.length * n * secondsPerItem}s` }}>
          {row(0)}
          {!reduced && row(1)}
        </div>
      </div>
      {!reduced && (
        <button type="button" className="rv-tape-toggle" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          {paused ? "Play" : "Pause"}
          <span className="rv-sr-only"> the live feed ticker</span>
        </button>
      )}
    </div>
  );
}
