"use client";

import { useEffect, useRef } from "react";
import { useFinePointer, useReducedMotion } from "./hooks";

/**
 * The backdrop for hero and closing panels: a hairline tile grid with corner
 * ticks, one soft neutral light, and a mask that fades the bottom. On a mouse
 * the light follows the pointer (rAF throttled, only while on screen). Touch
 * and reduced motion get the same picture, still.
 */
export function InstrumentField({ variant = "hero" }: { variant?: "hero" | "panel" | "quiet" }) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !fine || reduced) return;
    const host = el.parentElement;
    if (!host) return;
    let frame = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(host);
    const onMove = (e: PointerEvent) => {
      if (!visible || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = host.getBoundingClientRect();
        el.style.setProperty("--lx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
        el.style.setProperty("--ly", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      });
    };
    host.addEventListener("pointermove", onMove);
    return () => {
      host.removeEventListener("pointermove", onMove);
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [fine, reduced]);

  return (
    <div ref={ref} className={`field-bg field-${variant}`} aria-hidden>
      <svg className="field-grid" width="100%" height="100%">
        <defs>
          <pattern id={`tile-${variant}`} width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M64 0H0V64" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M0 0h4M0 0v4" stroke="currentColor" strokeWidth="1.5" className="tick" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#tile-${variant})`} />
      </svg>
      <div className="field-light" />
      <div className="field-grain" />
    </div>
  );
}
