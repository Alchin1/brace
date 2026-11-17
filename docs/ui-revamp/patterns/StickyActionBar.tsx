"use client";

import { useEffect, useState, type ReactNode } from "react";

/*
 * Phone-only bottom bar that slides up once the hero has scrolled away: live SOL limit on the
 * left, "Try a borrow" on the right.
 *
 * From motionsites: the "Black Friday ... Ends in 06h 53m 37s / See the deal" bar fixed to the
 * bottom (keyframe slide-up-banner: translateY(120%) to 0, 0.35s, cubic-bezier(.16,1,.3,1)).
 * Brace keeps the mechanics and drops the fake urgency: no countdown, no discount, only the
 * real live limit and the one action that matters for the demo.
 *
 * `watchId` is the id of the element (the hero) that hides the bar while it is on screen.
 * Hidden at >= 768px via CSS. Respects the iPhone home indicator with safe-area padding.
 */

export function StickyActionBar({ watchId, children }: { watchId: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const target = document.getElementById(watchId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { threshold: 0 });
    io.observe(target);
    return () => io.disconnect();
  }, [watchId]);
  return (
    <div className="rv-sticky" data-show={show ? "" : undefined} aria-hidden={show ? undefined : true} inert={!show}>
      <div className="rv-sticky-inner">{children}</div>
    </div>
  );
}
