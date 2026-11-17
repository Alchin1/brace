"use client";

import { useRef, type ElementType, type PointerEvent, type ReactNode } from "react";

/*
 * One asset as a card: symbol, live limit (big), vol, status, sparkline, gauge.
 * Replaces the table rows on phones; on desktop the plan keeps the table and uses cards
 * only where a grid reads better (asset page "other feeds", About).
 *
 * From motionsites: every gallery card is a rounded-2xl media tile with a caption row under
 * it, a hover state that wakes the media (video play), and a border that brightens
 * (hover:border-muted-foreground/30). Brace keeps the calm part: 14px radius, hairline
 * border, a 2px lift, and a soft spotlight that follows the cursor inside the card on
 * desktop only (CSS variables, no re-render). No autoplay video.
 */

type Props = {
  href: string;
  symbol: string;
  name: string;
  /** Already formatted, e.g. <NumberTicker .../> or "--". */
  limit: ReactNode;
  vol: ReactNode;
  status: "live" | "stale" | "none";
  statusText: string;
  age?: ReactNode;
  spark?: ReactNode;
  gauge?: ReactNode;
  linkAs?: ElementType;
};

export function FeedCard({ href, symbol, name, limit, vol, status, statusText, age, spark, gauge, linkAs: L = "a" }: Props) {
  const ref = useRef<HTMLElement>(null);
  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--rv-cx", `${e.clientX - r.left}px`);
    el.style.setProperty("--rv-cy", `${e.clientY - r.top}px`);
  };
  return (
    <L ref={ref} href={href} className="rv-feed" onPointerMove={onMove}>
      <div className="rv-feed-top">
        <span className="rv-feed-sym">{symbol}</span>
        <span className="rv-feed-name">{name}</span>
        <span className="rv-chip rv-feed-status">
          <span className="rv-dot" data-status={status} />
          {statusText}
        </span>
      </div>
      <div className="rv-feed-limit">
        <span className="rv-feed-k">Limit</span>
        <span className="rv-feed-big">{limit}</span>
      </div>
      {gauge && <div className="rv-feed-gauge">{gauge}</div>}
      <div className="rv-feed-foot">
        <span>
          <span className="rv-feed-k">Implied vol</span> <span className="rv-feed-v">{vol}</span>
        </span>
        {spark}
      </div>
      {age && <div className="rv-feed-age">{age}</div>}
    </L>
  );
}
