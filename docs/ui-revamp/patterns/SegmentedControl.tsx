"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

/*
 * Segmented switch with a sliding indicator, for History (SOL / BTC / ETH / XRP / ZEC) and
 * time ranges (6h / 24h).
 *
 * From motionsites: the Featured / Popular / Recent switch and the category rail are
 * rounded-full tracks with a highlighted segment. Brace keeps the sliding indicator but
 * uses 8px corners (no pills), and slides it with a CSS transform measured from the active
 * button, so it needs no layout-animation bundle.
 *
 * Keyboard: it is a radiogroup; arrow keys move and select, Home and End jump.
 */

export type Option<T extends string> = { value: T; label: string };

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const el = track.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    const measure = () => {
      if (el) setBox({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    return () => ro.disconnect();
  }, [value, options.length]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value);
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    track.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  };

  return (
    <div ref={track} className="rv-seg" role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {box && <span className="rv-seg-ind" style={{ transform: `translateX(${box.x}px)`, width: box.w }} aria-hidden />}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} className="rv-seg-btn" onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
