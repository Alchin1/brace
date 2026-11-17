"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./hooks";

/*
 * A live number that eases from its previous real value to its new real value.
 *
 * Motionsites templates (Wealthcore, Dashboard UI, Remit Race) count big figures up from zero
 * on load. Brace never does that: a count-up from 0 shows numbers that never existed.
 * Rules this component enforces:
 *  - first render shows the real value immediately, no animation
 *  - only animates between two real readings (e.g. 69.1% -> 69.4% when a new post lands)
 *  - null renders a placeholder, never a guess
 *  - a brief neutral tint plus a small up or down mark shows that the value changed;
 *    colour is neutral on purpose (a higher limit is not "good" and a lower one is not "bad")
 *  - reduced motion: the value swaps instantly, the tint still appears (it is not motion)
 *
 * Text updates go straight to the DOM node during the tween, so React re-renders once per
 * reading, not once per frame. The tween is a 20-line requestAnimationFrame loop rather than
 * motion's animate(): this component is on every page, and the loop costs nothing to ship.
 */

/** easeOutCubic-ish, matches --rv-ease-out closely enough for numbers. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function tween(from: number, to: number, ms: number, onUpdate: (v: number) => void): () => void {
  let raf = 0;
  const t0 = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / ms);
    onUpdate(from + (to - from) * easeOut(t));
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

type Props = {
  value: number | null;
  format: (n: number) => string;
  /** Seconds. */
  duration?: number;
  className?: string;
  placeholder?: string;
  /** Accessible text for screen readers, e.g. "SOL limit 69.1 percent". Defaults to the formatted value. */
  label?: string;
};

export function NumberTicker({ value, format, duration = 0.64, className, placeholder = "--", label }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();
  const [dir, setDir] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prev.current;
    prev.current = value;
    if (value === null) {
      el.textContent = placeholder;
      return;
    }
    if (from === null || from === value) {
      el.textContent = format(value);
      return;
    }
    setDir(value > from ? "up" : "down");
    const clear = window.setTimeout(() => setDir(null), 1200);
    if (reduced) {
      el.textContent = format(value);
      return () => window.clearTimeout(clear);
    }
    const stop = tween(from, value, duration * 1000, (v) => {
      el.textContent = format(v);
    });
    return () => {
      stop();
      window.clearTimeout(clear);
      el.textContent = format(value);
    };
  }, [value, format, duration, reduced, placeholder]);

  const text = value === null ? placeholder : format(value);
  return (
    <span className={`rv-ticker ${className ?? ""}`} data-dir={dir ?? undefined}>
      <span ref={ref} aria-hidden>
        {text}
      </span>
      <span className="rv-sr-only">{label ?? text}</span>
      <span className="rv-ticker-mark" aria-hidden>
        {dir === "up" ? "\u2191" : dir === "down" ? "\u2193" : ""}
      </span>
    </span>
  );
}
